import path from 'path';
import os from 'os';
import { BaseAdapter } from './types.js';
import type { Skill, Scope } from '../types.js';

export class ClaudeAdapter extends BaseAdapter {
  name = 'claude';

  async detect(): Promise<boolean> {
    // Claude Code skills directory is always valid
    return true;
  }

  getSkillPath(scope: Scope): string {
    if (scope === 'user') {
      return path.join(os.homedir(), '.claude', 'skills');
    }
    return path.join(process.cwd(), '.claude', 'skills');
  }

  transform(skill: Skill): string {
    // Claude Code uses the same format, so just return the original content with frontmatter
    return `---
name: ${skill.name}
description: ${skill.description}
---

${skill.content}
`;
  }
}
