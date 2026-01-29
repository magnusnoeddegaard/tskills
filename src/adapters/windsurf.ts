import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { BaseAdapter } from './types.js';
import type { Skill, Scope } from '../types.js';

export class WindsurfAdapter extends BaseAdapter {
  name = 'windsurf';

  async detect(): Promise<boolean> {
    return true;
  }

  getSkillPath(scope: Scope): string {
    if (scope === 'user') {
      return os.homedir();
    }
    return process.cwd();
  }

  transform(skill: Skill): string {
    // Windsurf uses a single .windsurfrules file
    return `# ${skill.name}

${skill.description}

${skill.content}
`;
  }

  async write(skill: Skill, scope: Scope): Promise<void> {
    const basePath = this.getSkillPath(scope);
    const rulesFile = path.join(basePath, '.windsurfrules');

    // For windsurf, we append to the rules file rather than creating separate files
    let existingContent = '';
    try {
      existingContent = await fs.readFile(rulesFile, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    const skillMarker = `<!-- skillsync:${skill.name} -->`;
    const skillEndMarker = `<!-- /skillsync:${skill.name} -->`;
    const skillBlock = `${skillMarker}\n${this.transform(skill)}\n${skillEndMarker}`;

    // Check if skill already exists in file
    const markerRegex = new RegExp(
      `${escapeRegex(skillMarker)}[\\s\\S]*?${escapeRegex(skillEndMarker)}`,
      'g'
    );

    if (existingContent.includes(skillMarker)) {
      // Replace existing skill
      existingContent = existingContent.replace(markerRegex, skillBlock);
    } else {
      // Append new skill
      existingContent = existingContent.trim() + '\n\n' + skillBlock + '\n';
    }

    await fs.writeFile(rulesFile, existingContent.trim() + '\n', 'utf-8');
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
