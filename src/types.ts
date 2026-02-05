export interface SkillFrontmatter {
  name: string;
  description: string;
  tools?: string[];
}

export interface Skill {
  name: string;
  description: string;
  tools: string[];
  content: string;
  path: string;
}

export interface Config {
  remote?: {
    url?: string;
    branch?: string;
  };
  defaults?: {
    scope?: 'user' | 'project';
  };
  tools?: {
    claude?: boolean;
    cursor?: boolean;
    copilot?: boolean;
    windsurf?: boolean;
  };
  registry?: {
    url?: string;
  };
}

// Registry types
export interface RegistryUser {
  id: string;
  github_id: number;
  username: string;
  email: string | null;
  avatar_url: string | null;
}

export interface RegistrySkill {
  id: string;
  owner: string;
  owner_id: string | null;
  owner_org_id: string | null;
  team_id: string | null;
  name: string;
  description: string;
  visibility: 'public' | 'private' | 'org' | 'team';
  tools: string[];
  tags: string[];
  latest_version: string | null;
  downloads: number;
  deprecated: boolean;
  deprecation_message: string | null;
  created_at: string;
}

export interface SkillVersion {
  id: string;
  skill_id: string;
  version: string;
  content: string;
  published_by: string;
  published_at: string;
}

export interface InstalledSkill {
  owner: string;
  name: string;
  version: string;
  visibility?: 'public' | 'private' | 'org' | 'team';
  installedAt: string;
}

export interface Credentials {
  accessToken: string;
  refreshToken: string;
  user: RegistryUser;
}

// Organization types
export type OrgRole = 'owner' | 'admin' | 'member';

export interface Organization {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
  user?: RegistryUser;
}

export interface Team {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  joined_at: string;
  user?: RegistryUser;
}

export type Scope = 'user' | 'project';

export interface ToolAdapter {
  name: string;
  detect(): Promise<boolean>;
  getSkillPath(scope: Scope): string;
  transform(skill: Skill): string;
  write(skill: Skill, scope: Scope): Promise<void>;
  remove(skillName: string, scope: Scope): Promise<void>;
}
