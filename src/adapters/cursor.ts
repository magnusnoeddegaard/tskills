import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { BaseAdapter } from './types.js';
import type { Skill, Scope } from '../types.js';

export class CursorAdapter extends BaseAdapter {
  name = 'cursor';

  async detect(): Promise<boolean> {
    // Check if .cursor directory exists in user home or current project
    const userPath = path.join(os.homedir(), '.cursor');
    const projectPath = path.join(process.cwd(), '.cursor');

    try {
      await fs.access(userPath);
      return true;
    } catch {
      try {
        await fs.access(projectPath);
        return true;
      } catch {
        // Cursor might not have been initialized yet, still allow writing
        return true;
      }
    }
  }

  getSkillPath(scope: Scope): string {
    if (scope === 'user') {
      return path.join(os.homedir(), '.cursor', 'rules');
    }
    return path.join(process.cwd(), '.cursor', 'rules');
  }

  transform(skill: Skill): string {
    // Cursor uses .mdc format with different frontmatter
    return `---
description: ${skill.description}
globs:
alwaysApply: false
---

# ${skill.name}

${skill.content}
`;
  }

  async write(skill: Skill, scope: Scope): Promise<void> {
    const basePath = this.getSkillPath(scope);
    const skillFile = path.join(basePath, `${skill.name}.mdc`);

    await fs.mkdir(basePath, { recursive: true });
    await fs.writeFile(skillFile, this.transform(skill), 'utf-8');
  }

  async remove(skillName: string, scope: Scope): Promise<void> {
    const basePath = this.getSkillPath(scope);
    const skillFile = path.join(basePath, `${skillName}.mdc`);

    try {
      await fs.unlink(skillFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
