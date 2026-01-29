import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getCacheDir } from './config.js';

const execAsync = promisify(exec);

export async function cloneOrPull(repoUrl: string, branch: string = 'main'): Promise<string> {
  const cacheDir = getCacheDir();
  await fs.mkdir(cacheDir, { recursive: true });

  const repoName = getRepoName(repoUrl);
  const localPath = path.join(cacheDir, repoName);

  const exists = await directoryExists(localPath);

  if (exists) {
    // Pull latest changes
    await execAsync(`git fetch origin`, { cwd: localPath });
    await execAsync(`git checkout ${branch}`, { cwd: localPath });
    await execAsync(`git pull origin ${branch}`, { cwd: localPath });
  } else {
    // Try gh clone first (handles auth automatically), fall back to git clone
    const repoSpec = extractRepoSpec(repoUrl);
    if (repoSpec && await isGhAvailable()) {
      await execAsync(`gh repo clone ${repoSpec} "${localPath}" -- --branch ${branch}`);
    } else {
      await execAsync(`git clone --branch ${branch} "${repoUrl}" "${localPath}"`);
    }
  }

  return localPath;
}

function getRepoName(url: string): string {
  const match = url.match(/\/([^/]+?)(\.git)?$/);
  if (match) {
    return match[1];
  }
  return url.replace(/[^a-zA-Z0-9]/g, '_');
}

// Extract "owner/repo" from various URL formats
function extractRepoSpec(url: string): string | null {
  // https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = url.match(/github\.com\/([^/]+\/[^/]+?)(\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  // git@github.com:owner/repo.git
  const sshMatch = url.match(/github\.com:([^/]+\/[^/]+?)(\.git)?$/);
  if (sshMatch) return sshMatch[1];

  return null;
}

async function isGhAvailable(): Promise<boolean> {
  try {
    await execAsync('gh --version');
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
