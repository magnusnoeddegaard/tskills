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
}

export type Scope = 'user' | 'project';

export interface ToolAdapter {
  name: string;
  detect(): Promise<boolean>;
  getSkillPath(scope: Scope): string;
  transform(skill: Skill): string;
  write(skill: Skill, scope: Scope): Promise<void>;
}
