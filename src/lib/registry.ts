import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCredentials, saveCredentials, getAnonymousId } from './credentials.js';
import { RateLimitError, ValidationError } from './errors.js';
import { withRetry, isRetryableError } from './retry.js';
import { getRegistryConfig } from './registry-config.js';
import type {
  RegistryUser,
  RegistrySkill,
  SkillVersion,
  Credentials,
  Organization,
  OrgMember,
  OrgRole,
  Team,
  TeamMember,
} from '../types.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Reset the cached Supabase client. Must be called when credentials change
 * (login, logout, session refresh) so the next call to getSupabaseClient()
 * creates a fresh client with the current auth state.
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
}

export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = await getRegistryConfig();
  const credentials = await getCredentials();

  supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  });

  // Set session if credentials exist
  if (credentials?.accessToken && credentials?.refreshToken) {
    await supabaseClient.auth.setSession({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });
  }

  return supabaseClient;
}

export async function getSupabaseUrl(): Promise<string> {
  const config = await getRegistryConfig();
  return config.supabaseUrl;
}

export async function getSupabaseAnonKey(): Promise<string> {
  const config = await getRegistryConfig();
  return config.supabaseAnonKey;
}

// ============================================
// RATE LIMITING
// ============================================

interface RateLimitResult {
  allowed: boolean;
  limit: number | null;
  remaining: number | null;
  reset_at: string | null;
  retry_after?: number;
  error?: string;
}

/**
 * Check rate limit for an action
 * @throws RateLimitError if rate limit exceeded
 */
async function checkRateLimit(
  action: 'api' | 'publish',
  isAuthenticated: boolean
): Promise<void> {
  const client = await getSupabaseClient();
  const credentials = await getCredentials();

  // Use user ID if authenticated, otherwise use a persistent anonymous ID per installation
  const identifier = credentials?.user?.id || await getAnonymousId();

  const { data, error } = await client.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_action: action,
    p_is_authenticated: isAuthenticated,
  });

  if (error) {
    // Don't fail on rate limit check errors - let the request proceed
    // This prevents rate limiting infrastructure issues from blocking users
    console.warn('Rate limit check failed:', error.message);
    return;
  }

  const result = data as RateLimitResult;

  if (!result.allowed) {
    throw new RateLimitError(
      result.error || 'Rate limit exceeded. Please try again later.',
      result.retry_after || 3600,
      result.limit || 0,
      result.remaining || 0
    );
  }
}

/**
 * Wrapper that applies rate limiting to an operation
 */
export async function withRateLimit<T>(
  action: 'api' | 'publish',
  operation: () => Promise<T>
): Promise<T> {
  const credentials = await getCredentials();
  const isAuthenticated = !!credentials?.accessToken;

  await checkRateLimit(action, isAuthenticated);

  return operation();
}

export async function refreshSession(): Promise<Credentials | null> {
  const client = await getSupabaseClient();
  const { data, error } = await withRetry(
    () => client.auth.refreshSession(),
    { shouldRetry: isRetryableError }
  );

  if (error || !data.session) {
    return null;
  }

  const user = await getUser();
  if (!user) {
    return null;
  }

  await saveCredentials(
    data.session.access_token,
    data.session.refresh_token,
    user
  );

  // Reset cached client so next call picks up the new tokens
  resetSupabaseClient();

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    user,
  };
}

export async function getUser(): Promise<RegistryUser | null> {
  const client = await getSupabaseClient();
  const { data: { user } } = await withRetry(
    () => client.auth.getUser(),
    { shouldRetry: isRetryableError }
  );

  if (!user) {
    return null;
  }

  // Fetch user from our users table
  const { data, error } = await withRetry(
    async () => client
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single(),
    { shouldRetry: isRetryableError }
  );

  if (error || !data) {
    return null;
  }

  return data as RegistryUser;
}

export interface SearchOptions {
  query?: string;
  tags?: string[];
  tools?: string[];
  limit?: number;
  offset?: number;
}

export async function searchSkills(options: SearchOptions = {}): Promise<RegistrySkill[]> {
  return withRateLimit('api', async () => {
    const client = await getSupabaseClient();

    const { data, error } = await withRetry(
      async () => {
        // Note: RLS policies handle visibility filtering - authenticated users
        // will see public + private + org + team skills they have access to
        let query = client
          .from('skills')
          .select('*')
          .order('downloads', { ascending: false });

        if (options.query) {
          // Sanitize PostgREST filter chars to prevent injection, and escape LIKE wildcards
          const sanitized = options.query
            .replace(/[,().]/g, '')    // Remove PostgREST operator/grouping chars
            .replace(/[%_*\\]/g, '');  // Remove LIKE wildcards and backslash escapes
          query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
        }

        if (options.tags && options.tags.length > 0) {
          query = query.overlaps('tags', options.tags);
        }

        if (options.tools && options.tools.length > 0) {
          query = query.overlaps('tools', options.tools);
        }

        if (options.limit) {
          query = query.limit(options.limit);
        }

        if (options.offset) {
          query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
        }

        return query;
      },
      { shouldRetry: isRetryableError }
    );

    if (error) {
      throw new Error(`Failed to search skills: ${error.message}`);
    }

    return (data || []) as RegistrySkill[];
  });
}

export async function getSkill(owner: string, name: string): Promise<RegistrySkill | null> {
  const client = await getSupabaseClient();

  const { data, error } = await withRetry(
    async () => client
      .from('skills')
      .select('*')
      .eq('owner', owner)
      .eq('name', name)
      .single(),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get skill: ${error.message}`);
  }

  return data as RegistrySkill;
}

export async function getSkillVersion(
  owner: string,
  name: string,
  version?: string
): Promise<SkillVersion | null> {
  const client = await getSupabaseClient();

  // First get the skill
  const skill = await getSkill(owner, name);
  if (!skill) {
    return null;
  }

  // Use specified version or latest
  const targetVersion = version || skill.latest_version;
  if (!targetVersion) {
    return null;
  }

  const { data, error } = await withRetry(
    async () => client
      .from('skill_versions')
      .select('*')
      .eq('skill_id', skill.id)
      .eq('version', targetVersion)
      .single(),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get skill version: ${error.message}`);
  }

  return data as SkillVersion;
}

export async function getAllVersions(owner: string, name: string): Promise<SkillVersion[]> {
  const client = await getSupabaseClient();

  const skill = await getSkill(owner, name);
  if (!skill) {
    return [];
  }

  const { data, error } = await withRetry(
    async () => client
      .from('skill_versions')
      .select('*')
      .eq('skill_id', skill.id)
      .order('published_at', { ascending: false }),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    throw new Error(`Failed to get versions: ${error.message}`);
  }

  return (data || []) as SkillVersion[];
}

export interface PublishSkillOptions {
  description?: string;
  visibility?: 'public' | 'private' | 'org' | 'team';
  tools?: string[];
  tags?: string[];
  orgSlug?: string;
  teamSlug?: string;
}

export async function publishSkill(
  name: string,
  options: PublishSkillOptions = {}
): Promise<RegistrySkill> {
  return withRateLimit('publish', async () => {
    const client = await getSupabaseClient();
    const user = await getUser();

    if (!user) {
      throw new Error('Not authenticated. Please login first.');
    }

  let ownerId: string | null = user.id;
  let ownerOrgId: string | null = null;
  let ownerName = user.username;
  let teamId: string | null = null;

  // Handle org ownership
  if (options.orgSlug) {
    const org = await getOrg(options.orgSlug);
    if (!org) {
      throw new Error(`Organization "${options.orgSlug}" not found`);
    }

    const role = await getUserOrgRole(options.orgSlug);
    if (!role || !['owner', 'admin', 'member'].includes(role)) {
      throw new Error(`You do not have permission to publish skills to "${options.orgSlug}"`);
    }

    ownerId = null;
    ownerOrgId = org.id;
    ownerName = options.orgSlug;

    // Handle team visibility
    if (options.teamSlug) {
      const team = await getTeam(options.orgSlug, options.teamSlug);
      if (!team) {
        throw new Error(`Team "${options.orgSlug}/${options.teamSlug}" not found`);
      }
      teamId = team.id;
    }
  }

  // Validate visibility for team
  if (options.visibility === 'team' && !teamId) {
    throw new Error('Team visibility requires --team flag');
  }

  // Validate private visibility is only for personal skills
  if (options.visibility === 'private' && options.orgSlug) {
    throw new ValidationError('Private visibility is only for personal skills. Use "org" or "team" visibility for organization skills.', 'visibility');
  }

  // Check if skill already exists
  const existing = await getSkill(ownerName, name);

  if (existing) {
    // Update existing skill
    const { data, error } = await client
      .from('skills')
      .update({
        description: options.description ?? existing.description,
        visibility: options.visibility ?? existing.visibility,
        tools: options.tools ?? existing.tools,
        tags: options.tags ?? existing.tags,
        team_id: teamId,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update skill: ${error.message}`);
    }

    return data as RegistrySkill;
  }

  // Create new skill
  const { data, error } = await client
    .from('skills')
    .insert({
      owner_id: ownerId,
      owner_org_id: ownerOrgId,
      owner: ownerName,
      name,
      description: options.description || '',
      visibility: options.visibility || (options.orgSlug ? 'org' : 'public'),
      tools: options.tools || [],
      tags: options.tags || [],
      team_id: teamId,
    })
    .select()
    .single();

    if (error) {
      throw new Error(`Failed to create skill: ${error.message}`);
    }

    return data as RegistrySkill;
  });
}

export async function publishVersion(
  owner: string,
  name: string,
  version: string,
  content: string
): Promise<SkillVersion> {
  return withRateLimit('publish', async () => {
    const client = await getSupabaseClient();
    const user = await getUser();

    if (!user) {
      throw new Error('Not authenticated. Please login first.');
    }

    const skill = await getSkill(owner, name);
    if (!skill) {
      throw new Error(`Skill ${owner}/${name} not found`);
    }

    // Verify ownership - same pattern as deprecateSkill
    const isOwner = skill.owner_id === user.id;
    let canPublish = isOwner;

    // Check if user is org member/admin/owner for org-owned skills
    if (!isOwner && skill.owner_org_id) {
      const role = await getUserOrgRole(skill.owner);
      canPublish = role !== null && ['owner', 'admin', 'member'].includes(role);
    }

    if (!canPublish) {
      throw new Error('You do not have permission to publish versions to this skill');
    }

    // Insert new version
    const { data: versionData, error: versionError } = await client
      .from('skill_versions')
      .insert({
        skill_id: skill.id,
        version,
        content,
        published_by: user.id,
      })
      .select()
      .single();

    if (versionError) {
      if (versionError.code === '23505') {
        throw new Error(`Version ${version} already exists for ${owner}/${name}`);
      }
      throw new Error(`Failed to publish version: ${versionError.message}`);
    }

    // latest_version is updated atomically by a database trigger on skill_versions insert

    return versionData as SkillVersion;
  });
}

export async function incrementDownloads(owner: string, name: string): Promise<void> {
  const client = await getSupabaseClient();

  await withRetry(
    async () => client.rpc('increment_downloads', { p_owner: owner, p_name: name }),
    { shouldRetry: isRetryableError, maxAttempts: 2 }
  );
}

export async function deprecateSkill(
  owner: string,
  name: string,
  deprecated: boolean,
  message?: string
): Promise<void> {
  const client = await getSupabaseClient();
  const user = await getUser();

  if (!user) {
    throw new Error('Not authenticated. Please login first.');
  }

  const skill = await getSkill(owner, name);
  if (!skill) {
    throw new Error(`Skill not found: ${owner}/${name}`);
  }

  // Verify ownership
  const isOwner = skill.owner_id === user.id;
  let canManage = isOwner;

  // Check if user is org admin for org-owned skills
  if (!isOwner && skill.owner_org_id) {
    const role = await getUserOrgRole(skill.owner);
    canManage = role !== null && ['owner', 'admin'].includes(role);
  }

  if (!canManage) {
    throw new Error('You do not have permission to modify this skill');
  }

  const { error } = await client
    .from('skills')
    .update({
      deprecated,
      deprecation_message: deprecated ? (message || null) : null,
    })
    .eq('id', skill.id);

  if (error) {
    throw new Error(`Failed to update skill: ${error.message}`);
  }
}

// ============================================
// ORGANIZATION FUNCTIONS
// ============================================

export interface CreateOrgOptions {
  slug: string;
  name: string;
  description?: string;
}

export async function createOrg(options: CreateOrgOptions): Promise<Organization> {
  const client = await getSupabaseClient();
  const user = await getUser();

  if (!user) {
    throw new Error('Not authenticated. Please login first.');
  }

  // Use RPC to atomically create org and add creator as owner in a single transaction
  const { data, error } = await client.rpc('create_org_with_owner', {
    p_slug: options.slug,
    p_name: options.name,
    p_description: options.description || '',
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Organization "${options.slug}" already exists`);
    }
    throw new Error(`Failed to create organization: ${error.message}`);
  }

  return data as Organization;
}

export async function getOrg(slug: string): Promise<Organization | null> {
  const client = await getSupabaseClient();

  const { data, error } = await withRetry(
    async () => client
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single(),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get organization: ${error.message}`);
  }

  return data as Organization;
}

export async function listUserOrgs(): Promise<Organization[]> {
  const client = await getSupabaseClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await withRetry(
    async () => client
      .from('org_members')
      .select('org_id, role, organizations(*)')
      .eq('user_id', user.id),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    throw new Error(`Failed to list organizations: ${error.message}`);
  }

  return (data || []).map((m: any) => m.organizations as Organization);
}

export async function getOrgMembers(slug: string): Promise<OrgMember[]> {
  const client = await getSupabaseClient();

  const org = await getOrg(slug);
  if (!org) {
    throw new Error(`Organization "${slug}" not found`);
  }

  const { data, error } = await withRetry(
    async () => client
      .from('org_members')
      .select('*, users(*)')
      .eq('org_id', org.id),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    throw new Error(`Failed to get organization members: ${error.message}`);
  }

  return (data || []).map((m: any) => ({
    org_id: m.org_id,
    user_id: m.user_id,
    role: m.role as OrgRole,
    joined_at: m.joined_at,
    user: m.users as RegistryUser,
  }));
}

export async function getUserOrgRole(slug: string): Promise<OrgRole | null> {
  const client = await getSupabaseClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  const org = await getOrg(slug);
  if (!org) {
    return null;
  }

  const { data, error } = await withRetry(
    async () => client
      .from('org_members')
      .select('role')
      .eq('org_id', org.id)
      .eq('user_id', user.id)
      .single(),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    return null;
  }

  return (data?.role as OrgRole) || null;
}

export async function addOrgMember(
  slug: string,
  username: string,
  role: OrgRole = 'member'
): Promise<void> {
  const client = await getSupabaseClient();

  const org = await getOrg(slug);
  if (!org) {
    throw new Error(`Organization "${slug}" not found`);
  }

  // Only owners can assign the 'owner' role
  if (role === 'owner') {
    const callerRole = await getUserOrgRole(slug);
    if (callerRole !== 'owner') {
      throw new Error('Only organization owners can assign the owner role');
    }
  }

  // Find user by username
  const { data: targetUser, error: userError } = await client
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (userError || !targetUser) {
    throw new Error(`User "${username}" not found`);
  }

  const { error } = await client
    .from('org_members')
    .insert({
      org_id: org.id,
      user_id: targetUser.id,
      role,
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error(`User "${username}" is already a member of "${slug}"`);
    }
    throw new Error(`Failed to add member: ${error.message}`);
  }
}

export async function removeOrgMember(slug: string, username: string): Promise<void> {
  const client = await getSupabaseClient();

  const org = await getOrg(slug);
  if (!org) {
    throw new Error(`Organization "${slug}" not found`);
  }

  // Find user by username
  const { data: targetUser, error: userError } = await client
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (userError || !targetUser) {
    throw new Error(`User "${username}" not found`);
  }

  // Check if trying to remove the last owner
  const members = await getOrgMembers(slug);
  const owners = members.filter((m) => m.role === 'owner');
  const isLastOwner = owners.length === 1 && owners[0].user_id === targetUser.id;

  if (isLastOwner) {
    throw new Error('Cannot remove the last owner. Transfer ownership first.');
  }

  const { error } = await client
    .from('org_members')
    .delete()
    .eq('org_id', org.id)
    .eq('user_id', targetUser.id);

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`);
  }
}

export async function deleteOrg(slug: string): Promise<void> {
  const client = await getSupabaseClient();

  const org = await getOrg(slug);
  if (!org) {
    throw new Error(`Organization "${slug}" not found`);
  }

  const { error } = await client.from('organizations').delete().eq('id', org.id);

  if (error) {
    throw new Error(`Failed to delete organization: ${error.message}`);
  }
}

// ============================================
// TEAM FUNCTIONS
// ============================================

export interface CreateTeamOptions {
  orgSlug: string;
  teamSlug: string;
  name: string;
  description?: string;
}

export async function createTeam(options: CreateTeamOptions): Promise<Team> {
  const client = await getSupabaseClient();

  const org = await getOrg(options.orgSlug);
  if (!org) {
    throw new Error(`Organization "${options.orgSlug}" not found`);
  }

  const { data, error } = await client
    .from('teams')
    .insert({
      org_id: org.id,
      slug: options.teamSlug,
      name: options.name,
      description: options.description || '',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Team "${options.teamSlug}" already exists in "${options.orgSlug}"`);
    }
    throw new Error(`Failed to create team: ${error.message}`);
  }

  return data as Team;
}

export async function getTeam(orgSlug: string, teamSlug: string): Promise<Team | null> {
  const client = await getSupabaseClient();

  const org = await getOrg(orgSlug);
  if (!org) {
    return null;
  }

  const { data, error } = await withRetry(
    async () => client
      .from('teams')
      .select('*')
      .eq('org_id', org.id)
      .eq('slug', teamSlug)
      .single(),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get team: ${error.message}`);
  }

  return data as Team;
}

export async function listOrgTeams(orgSlug: string): Promise<Team[]> {
  const client = await getSupabaseClient();

  const org = await getOrg(orgSlug);
  if (!org) {
    throw new Error(`Organization "${orgSlug}" not found`);
  }

  const { data, error } = await withRetry(
    async () => client
      .from('teams')
      .select('*')
      .eq('org_id', org.id)
      .order('name'),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    throw new Error(`Failed to list teams: ${error.message}`);
  }

  return (data || []) as Team[];
}

export async function getTeamMembers(orgSlug: string, teamSlug: string): Promise<TeamMember[]> {
  const client = await getSupabaseClient();

  const team = await getTeam(orgSlug, teamSlug);
  if (!team) {
    throw new Error(`Team "${orgSlug}/${teamSlug}" not found`);
  }

  const { data, error } = await withRetry(
    async () => client
      .from('team_members')
      .select('*, users(*)')
      .eq('team_id', team.id),
    { shouldRetry: isRetryableError }
  );

  if (error) {
    throw new Error(`Failed to get team members: ${error.message}`);
  }

  return (data || []).map((m: any) => ({
    team_id: m.team_id,
    user_id: m.user_id,
    joined_at: m.joined_at,
    user: m.users as RegistryUser,
  }));
}

export async function addTeamMember(
  orgSlug: string,
  teamSlug: string,
  username: string
): Promise<void> {
  const client = await getSupabaseClient();

  const team = await getTeam(orgSlug, teamSlug);
  if (!team) {
    throw new Error(`Team "${orgSlug}/${teamSlug}" not found`);
  }

  // Find user by username
  const { data: targetUser, error: userError } = await client
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (userError || !targetUser) {
    throw new Error(`User "${username}" not found`);
  }

  const { error } = await client.from('team_members').insert({
    team_id: team.id,
    user_id: targetUser.id,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error(`User "${username}" is already a member of "${orgSlug}/${teamSlug}"`);
    }
    throw new Error(`Failed to add team member: ${error.message}`);
  }
}

export async function removeTeamMember(
  orgSlug: string,
  teamSlug: string,
  username: string
): Promise<void> {
  const client = await getSupabaseClient();

  const team = await getTeam(orgSlug, teamSlug);
  if (!team) {
    throw new Error(`Team "${orgSlug}/${teamSlug}" not found`);
  }

  // Find user by username
  const { data: targetUser, error: userError } = await client
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (userError || !targetUser) {
    throw new Error(`User "${username}" not found`);
  }

  const { error } = await client
    .from('team_members')
    .delete()
    .eq('team_id', team.id)
    .eq('user_id', targetUser.id);

  if (error) {
    throw new Error(`Failed to remove team member: ${error.message}`);
  }
}

export async function deleteTeam(orgSlug: string, teamSlug: string): Promise<void> {
  const client = await getSupabaseClient();

  const team = await getTeam(orgSlug, teamSlug);
  if (!team) {
    throw new Error(`Team "${orgSlug}/${teamSlug}" not found`);
  }

  const { error } = await client.from('teams').delete().eq('id', team.id);

  if (error) {
    throw new Error(`Failed to delete team: ${error.message}`);
  }
}
