import type { Skill, Scope, ToolAdapter } from '../types.js';

export type { ToolAdapter };

export abstract class BaseAdapter implements ToolAdapter {
  abstract name: string;

  abstract detect(): Promise<boolean>;
  abstract getSkillPath(scope: Scope): string;
  abstract transform(skill: Skill): string;

  async write(skill: Skill, scope: Scope): Promise<void> {
    const { promises: fs } = await import('fs');
    const path = await import('path');

    const basePath = this.getSkillPath(scope);
    const skillDir = path.join(basePath, skill.name);
    const skillFile = path.join(skillDir, 'SKILL.md');

    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(skillFile, this.transform(skill), 'utf-8');
  }
}
