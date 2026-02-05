import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import type { Credentials, RegistryUser } from '../types.js';

const CONFIG_DIR = path.join(os.homedir(), '.tskills');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');

export function getCredentialsPath(): string {
  return CREDENTIALS_FILE;
}

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  if (process.platform !== 'win32') {
    await fs.chmod(CONFIG_DIR, 0o700);
  }
}

export async function saveCredentials(
  accessToken: string,
  refreshToken: string,
  user: RegistryUser
): Promise<void> {
  await ensureConfigDir();
  const credentials: Credentials = {
    accessToken,
    refreshToken,
    user,
  };
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), 'utf-8');
  if (process.platform !== 'win32') {
    await fs.chmod(CREDENTIALS_FILE, 0o600);
  }
}

export async function getCredentials(): Promise<Credentials | null> {
  try {
    const content = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(content) as Credentials;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function clearCredentials(): Promise<void> {
  try {
    await fs.unlink(CREDENTIALS_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const credentials = await getCredentials();
  return credentials !== null && !!credentials.accessToken;
}

const ANONYMOUS_ID_FILE = path.join(CONFIG_DIR, 'anonymous-id');

export async function getAnonymousId(): Promise<string> {
  try {
    const id = await fs.readFile(ANONYMOUS_ID_FILE, 'utf-8');
    return id.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  await ensureConfigDir();
  const id = crypto.randomUUID();
  await fs.writeFile(ANONYMOUS_ID_FILE, id, 'utf-8');
  return id;
}
