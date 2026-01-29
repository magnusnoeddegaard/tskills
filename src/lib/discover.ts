import { promises as fs } from 'fs';
import path from 'path';
import { parseSkill } from './skill.js';
import type { Skill } from '../types.js';

export async function discoverSkills(baseDir: string): Promise<Skill[]> {
  const skills: Skill[] = [];

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(baseDir, entry.name, 'SKILL.md');

      try {
        const content = await fs.readFile(skillPath, 'utf-8');
        const skill = parseSkill(content, skillPath);
        skills.push(skill);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`Warning: Failed to parse ${skillPath}: ${(error as Error).message}`);
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function skillExists(baseDir: string, name: string): Promise<boolean> {
  const skillPath = path.join(baseDir, name, 'SKILL.md');
  try {
    await fs.access(skillPath);
    return true;
  } catch {
    return false;
  }
}
