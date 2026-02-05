import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import type { InstalledSkill } from '../types.js';
import { SKILL_NAME_REGEX, USERNAME_REGEX } from './validation.js';
import { ValidationError } from './errors.js';

const CONFIG_DIR = path.join(os.homedir(), '.tskills');
const MANIFEST_FILE = path.join(CONFIG_DIR, 'installed.json');
const REGISTRY_DIR = path.join(CONFIG_DIR, 'registry');

/**
 * Validate that owner and name are safe for use in filesystem paths.
 * Prevents path traversal attacks (e.g., owner="../../etc" or name="..").
 * @throws ValidationError if owner or name contain unsafe characters
 */
function validatePathSegments(owner: string, name: string): void {
  if (!owner || !USERNAME_REGEX.test(owner)) {
    throw new ValidationError(
      'Invalid owner: must start with a letter and contain only letters, numbers, underscores, or hyphens',
      'owner'
    );
  }
  if (!name || !SKILL_NAME_REGEX.test(name)) {
    throw new ValidationError(
      'Invalid skill name: must be lowercase, start with a letter, and contain only letters, numbers, and hyphens',
      'name'
    );
  }
}

export function getManifestPath(): string {
  return MANIFEST_FILE;
}

export function getRegistryDir(): string {
  return REGISTRY_DIR;
}

export function getSkillDir(owner: string, name: string): string {
  validatePathSegments(owner, name);
  return path.join(REGISTRY_DIR, owner, name);
}

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

/**
 * Write file atomically by writing to temp file then renaming
 * This prevents corruption if the process is killed mid-write
 */
async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${randomUUID()}.tmp`);

  try {
    // Write to temp file
    await fs.writeFile(tempPath, content, 'utf-8');
    // Atomic rename (on POSIX this is truly atomic; on Windows it's as close as we can get)
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

export async function getInstalledSkills(): Promise<InstalledSkill[]> {
  try {
    const content = await fs.readFile(MANIFEST_FILE, 'utf-8');
    const data = JSON.parse(content);
    return data.skills || [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function saveManifest(skills: InstalledSkill[]): Promise<void> {
  await ensureConfigDir();
  const data = { skills, updatedAt: new Date().toISOString() };
  await atomicWriteFile(MANIFEST_FILE, JSON.stringify(data, null, 2));
}

export async function addInstalledSkill(
  owner: string,
  name: string,
  version: string,
  visibility?: 'public' | 'private' | 'org' | 'team'
): Promise<void> {
  const skills = await getInstalledSkills();

  // Remove existing entry if present
  const filtered = skills.filter(
    (s) => !(s.owner === owner && s.name === name)
  );

  // Add new entry
  filtered.push({
    owner,
    name,
    version,
    visibility,
    installedAt: new Date().toISOString(),
  });

  await saveManifest(filtered);
}

export async function removeInstalledSkill(
  owner: string,
  name: string
): Promise<boolean> {
  const skills = await getInstalledSkills();
  const filtered = skills.filter(
    (s) => !(s.owner === owner && s.name === name)
  );

  if (filtered.length === skills.length) {
    return false; // Not found
  }

  await saveManifest(filtered);
  return true;
}

export async function getInstalledVersion(
  owner: string,
  name: string
): Promise<string | null> {
  const skills = await getInstalledSkills();
  const skill = skills.find((s) => s.owner === owner && s.name === name);
  return skill?.version || null;
}

export async function isInstalled(owner: string, name: string): Promise<boolean> {
  const version = await getInstalledVersion(owner, name);
  return version !== null;
}

export async function saveSkillContent(
  owner: string,
  name: string,
  content: string
): Promise<string> {
  const skillDir = getSkillDir(owner, name);
  await fs.mkdir(skillDir, { recursive: true });

  const skillPath = path.join(skillDir, 'SKILL.md');
  await atomicWriteFile(skillPath, content);

  return skillPath;
}

export async function getSkillContent(
  owner: string,
  name: string
): Promise<string | null> {
  const skillPath = path.join(getSkillDir(owner, name), 'SKILL.md');

  try {
    return await fs.readFile(skillPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function removeSkillContent(
  owner: string,
  name: string
): Promise<void> {
  const skillDir = getSkillDir(owner, name);

  try {
    await fs.rm(skillDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
