-- tskills Registry Organizations & Teams RLS Policies
-- This migration adds RLS policies for organizations and teams

-- Helper function: Check if user is a member of an organization
create or replace function public.is_org_member(p_org_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = p_user_id
  );
$$ language sql security definer stable;

-- Helper function: Get user's role in an organization
create or replace function public.get_org_role(p_org_id uuid, p_user_id uuid)
returns text as $$
  select role from public.org_members
  where org_id = p_org_id and user_id = p_user_id;
$$ language sql security definer stable;

-- Helper function: Check if user is a member of a team
create or replace function public.is_team_member(p_team_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_user_id
  );
$$ language sql security definer stable;

-- Helper function: Check if user can manage an organization (owner or admin)
create or replace function public.can_manage_org(p_org_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = p_user_id
      and role in ('owner', 'admin')
  );
$$ language sql security definer stable;

-- ============================================
-- ORGANIZATIONS RLS POLICIES
-- ============================================

-- Organizations are viewable by their members
create policy "Organizations are viewable by members"
  on public.organizations for select
  using (public.is_org_member(id, auth.uid()));

-- Authenticated users can create organizations
create policy "Authenticated users can create organizations"
  on public.organizations for insert
  with check (auth.uid() = created_by);

-- Org owners and admins can update organization
create policy "Org owners/admins can update organization"
  on public.organizations for update
  using (public.can_manage_org(id, auth.uid()));

-- Only org owners can delete organization
create policy "Only org owners can delete organization"
  on public.organizations for delete
  using (public.get_org_role(id, auth.uid()) = 'owner');

-- ============================================
-- ORG MEMBERS RLS POLICIES
-- ============================================

-- Org members can view other members
create policy "Org members can view other members"
  on public.org_members for select
  using (public.is_org_member(org_id, auth.uid()));

-- Org owners and admins can add members
create policy "Org owners/admins can add members"
  on public.org_members for insert
  with check (public.can_manage_org(org_id, auth.uid()));

-- Org owners and admins can update member roles
create policy "Org owners/admins can update member roles"
  on public.org_members for update
  using (public.can_manage_org(org_id, auth.uid()));

-- Org owners and admins can remove members
create policy "Org owners/admins can remove members"
  on public.org_members for delete
  using (public.can_manage_org(org_id, auth.uid()));

-- ============================================
-- TEAMS RLS POLICIES
-- ============================================

-- Teams are viewable by org members
create policy "Teams are viewable by org members"
  on public.teams for select
  using (public.is_org_member(org_id, auth.uid()));

-- Org owners and admins can create teams
create policy "Org owners/admins can create teams"
  on public.teams for insert
  with check (public.can_manage_org(org_id, auth.uid()));

-- Org owners and admins can update teams
create policy "Org owners/admins can update teams"
  on public.teams for update
  using (public.can_manage_org(org_id, auth.uid()));

-- Org owners and admins can delete teams
create policy "Org owners/admins can delete teams"
  on public.teams for delete
  using (public.can_manage_org(org_id, auth.uid()));

-- ============================================
-- TEAM MEMBERS RLS POLICIES
-- ============================================

-- Team members are viewable by org members
create policy "Team members viewable by org members"
  on public.team_members for select
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_id
      and public.is_org_member(t.org_id, auth.uid())
    )
  );

-- Org owners and admins can add team members
create policy "Org owners/admins can add team members"
  on public.team_members for insert
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id
      and public.can_manage_org(t.org_id, auth.uid())
    )
  );

-- Org owners and admins can remove team members
create policy "Org owners/admins can remove team members"
  on public.team_members for delete
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_id
      and public.can_manage_org(t.org_id, auth.uid())
    )
  );

-- ============================================
-- UPDATED SKILLS RLS POLICIES
-- ============================================

-- Drop the old skills visibility policy
drop policy if exists "Public skills are viewable by everyone" on public.skills;

-- New visibility policy supporting org and team visibility
create policy "Skills visibility policy"
  on public.skills for select
  using (
    -- Public skills visible to everyone
    visibility = 'public'
    -- Private skills only visible to owner
    or (visibility = 'private' and owner_id = auth.uid())
    -- User's own skills always visible
    or owner_id = auth.uid()
    -- Org skills visible to org members
    or (visibility = 'org' and owner_org_id is not null and public.is_org_member(owner_org_id, auth.uid()))
    -- Team skills visible to team members
    or (visibility = 'team' and team_id is not null and public.is_team_member(team_id, auth.uid()))
  );

-- Drop and recreate skills insert policy to support org ownership
drop policy if exists "Users can insert own skills" on public.skills;

create policy "Users can insert skills"
  on public.skills for insert
  with check (
    -- User can insert personal skills
    (owner_id = auth.uid() and owner_org_id is null)
    -- Org owners/admins can insert org skills
    or (owner_org_id is not null and public.can_manage_org(owner_org_id, auth.uid()))
  );

-- Drop and recreate skills update policy to support org ownership
drop policy if exists "Users can update own skills" on public.skills;

create policy "Users can update own or org skills"
  on public.skills for update
  using (
    owner_id = auth.uid()
    or (owner_org_id is not null and public.can_manage_org(owner_org_id, auth.uid()))
  );

-- Drop and recreate skills delete policy to support org ownership
drop policy if exists "Users can delete own skills" on public.skills;

create policy "Users can delete own or org skills"
  on public.skills for delete
  using (
    owner_id = auth.uid()
    or (owner_org_id is not null and public.can_manage_org(owner_org_id, auth.uid()))
  );

-- ============================================
-- UPDATED SKILL VERSIONS RLS POLICIES
-- ============================================

-- Drop old skill_versions visibility policy
drop policy if exists "Skill versions follow skill visibility" on public.skill_versions;

-- New visibility policy for skill versions
create policy "Skill versions follow skill visibility"
  on public.skill_versions for select
  using (
    exists (
      select 1 from public.skills s
      where s.id = skill_versions.skill_id
      and (
        s.visibility = 'public'
        or s.owner_id = auth.uid()
        or (s.visibility = 'org' and s.owner_org_id is not null and public.is_org_member(s.owner_org_id, auth.uid()))
        or (s.visibility = 'team' and s.team_id is not null and public.is_team_member(s.team_id, auth.uid()))
      )
    )
  );

-- Drop and recreate skill_versions insert policy
drop policy if exists "Users can insert versions for own skills" on public.skill_versions;

create policy "Users can insert versions for own or org skills"
  on public.skill_versions for insert
  with check (
    exists (
      select 1 from public.skills s
      where s.id = skill_versions.skill_id
      and (
        s.owner_id = auth.uid()
        or (s.owner_org_id is not null and public.can_manage_org(s.owner_org_id, auth.uid()))
      )
    )
  );
