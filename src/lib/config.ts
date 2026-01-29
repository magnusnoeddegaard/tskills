import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { parse, stringify } from 'smol-toml';
import type { Config } from '../types.js';

const CONFIG_DIR = path.join(os.homedir(), '.tskills');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.toml');

export async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

export async function readConfig(): Promise<Config> {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    return parse(content) as Config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return getDefaultConfig();
    }
    throw error;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await ensureConfigDir();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = stringify(config as any);
  await fs.writeFile(CONFIG_FILE, content, 'utf-8');
}

export async function updateConfig(updates: Partial<Config>): Promise<Config> {
  const current = await readConfig();
  const merged = deepMerge(current, updates);
  await writeConfig(merged);
  return merged;
}

export function getDefaultConfig(): Config {
  return {
    remote: {
      branch: 'main',
    },
    defaults: {
      scope: 'user',
    },
    tools: {
      claude: true,
      cursor: true,
      copilot: true,
      windsurf: false,
    },
  };
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getCacheDir(): string {
  return path.join(CONFIG_DIR, 'cache');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      sourceVal &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      ) as T[typeof key];
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal as T[typeof key];
    }
  }
  return result;
}
