import { Command } from 'commander';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readConfig } from '../lib/config.js';

const execAsync = promisify(exec);

export const shareCommand = new Command('share')
  .description('Share your team skills with colleagues')
  .option('-c, --copy', 'Copy the setup command to clipboard')
  .action(async (options) => {
    try {
      const config = await readConfig();

      if (!config.remote?.url) {
        console.error(chalk.red('Error: No remote repository configured.'));
        console.log(chalk.gray('Run "skillsync setup" first to create a repository.'));
        process.exit(1);
      }

      const repoUrl = config.remote.url;
      const repoSpec = extractRepoSpec(repoUrl);

      // Generate the one-liner setup command
      const setupCommand = `npx skillsync@latest config --repo ${repoUrl} && npx skillsync@latest sync`;

      console.log(chalk.cyan('\nShare this with your colleagues:\n'));
      console.log(chalk.white('─'.repeat(60)));
      console.log('');
      console.log(chalk.yellow(setupCommand));
      console.log('');
      console.log(chalk.white('─'.repeat(60)));

      if (options.copy) {
        await copyToClipboard(setupCommand);
        console.log(chalk.green('\n✓ Copied to clipboard!'));
      }

      console.log(chalk.gray('\nThis command will:'));
      console.log(chalk.gray('  1. Configure skillsync to use your team repo'));
      console.log(chalk.gray('  2. Sync all skills to their local tools'));

      // Check if repo is private and remind about access
      if (repoSpec) {
        const isPrivate = await checkIfPrivate(repoSpec);
        if (isPrivate) {
          console.log(chalk.yellow('\n⚠ Your repo is private. Make sure to add collaborators:'));
          console.log(chalk.white(`  skillsync invite <github-username>`));
        }
      }

    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

export const inviteCommand = new Command('invite')
  .description('Invite a colleague to your team skills repo')
  .argument('<username>', 'GitHub username to invite')
  .option('-r, --role <role>', 'Permission level: pull, push, admin (default: push)', 'push')
  .action(async (username, options) => {
    try {
      const config = await readConfig();

      if (!config.remote?.url) {
        console.error(chalk.red('Error: No remote repository configured.'));
        console.log(chalk.gray('Run "skillsync setup" first to create a repository.'));
        process.exit(1);
      }

      const repoSpec = extractRepoSpec(config.remote.url);
      if (!repoSpec) {
        console.error(chalk.red('Error: Could not parse repository from URL.'));
        process.exit(1);
      }

      // Check if gh is available
      try {
        await execAsync('gh --version');
      } catch {
        console.error(chalk.red('Error: GitHub CLI (gh) is required.'));
        console.log(chalk.gray('Install from: https://cli.github.com/'));
        process.exit(1);
      }

      console.log(chalk.gray(`Inviting ${username} to ${repoSpec}...`));

      // Add collaborator using gh api
      const role = options.role || 'push';
      await execAsync(
        `gh api repos/${repoSpec}/collaborators/${username} -X PUT -f permission=${role}`
      );

      console.log(chalk.green(`\n✓ Invited ${username} with ${role} access!`));
      console.log(chalk.gray(`\nThey will receive an email invitation from GitHub.`));
      console.log(chalk.gray(`Once accepted, they can run:\n`));
      console.log(chalk.yellow(`  npx skillsync@latest config --repo ${config.remote.url}`));
      console.log(chalk.yellow(`  npx skillsync@latest sync`));

    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('404')) {
        console.error(chalk.red(`Error: User "${username}" not found on GitHub.`));
      } else if (message.includes('403')) {
        console.error(chalk.red('Error: You do not have permission to add collaborators.'));
      } else {
        console.error(chalk.red(`Error: ${message}`));
      }
      process.exit(1);
    }
  });

function extractRepoSpec(url: string): string | null {
  // https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = url.match(/github\.com\/([^/]+\/[^/]+?)(\.git)?$/);
  if (httpsMatch) return httpsMatch[1];

  // git@github.com:owner/repo.git
  const sshMatch = url.match(/github\.com:([^/]+\/[^/]+?)(\.git)?$/);
  if (sshMatch) return sshMatch[1];

  return null;
}

async function checkIfPrivate(repoSpec: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`gh repo view ${repoSpec} --json isPrivate --jq .isPrivate`);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

async function copyToClipboard(text: string): Promise<void> {
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      await execAsync(`echo ${text} | clip`);
    } else if (platform === 'darwin') {
      await execAsync(`echo "${text}" | pbcopy`);
    } else {
      // Linux - try xclip or xsel
      try {
        await execAsync(`echo "${text}" | xclip -selection clipboard`);
      } catch {
        await execAsync(`echo "${text}" | xsel --clipboard`);
      }
    }
  } catch {
    throw new Error('Could not copy to clipboard. Please copy manually.');
  }
}
