import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import { updateConfig } from '../lib/config.js';

const execAsync = promisify(exec);

export const setupCommand = new Command('setup')
  .description('One-command setup: create GitHub repo, push skills, and configure')
  .option('-n, --name <name>', 'Repository name (default: team-skills)')
  .option('-o, --org <org>', 'GitHub organization (default: personal account)')
  .option('--public', 'Create a public repository (default: private)')
  .option('-d, --dir <directory>', 'Local directory for skills (default: current directory)')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(async (options) => {
    try {
      // Check if gh CLI is available
      const ghAvailable = await checkGhCli();
      if (!ghAvailable) {
        console.error(chalk.red('Error: GitHub CLI (gh) is required for this command.'));
        console.log(chalk.gray('\nInstall it from: https://cli.github.com/'));
        console.log(chalk.gray('Then run: gh auth login'));
        process.exit(1);
      }

      // Check if authenticated
      const authenticated = await checkGhAuth();
      if (!authenticated) {
        console.error(chalk.red('Error: Not authenticated with GitHub CLI.'));
        console.log(chalk.gray('\nRun: gh auth login'));
        process.exit(1);
      }

      const repoName = options.name || 'team-skills';
      const isPrivate = !options.public;
      const baseDir = options.dir ? path.resolve(options.dir) : process.cwd();
      const skillsDir = path.join(baseDir, 'skills');

      // Get GitHub username or org
      let owner: string;
      if (options.org) {
        owner = options.org;
      } else {
        owner = await getGhUsername();
      }

      const repoFullName = `${owner}/${repoName}`;
      const repoUrl = `https://github.com/${repoFullName}.git`;

      console.log(chalk.cyan('\nSetup Configuration:'));
      console.log(chalk.gray(`  Repository: ${repoFullName}`));
      console.log(chalk.gray(`  Visibility: ${isPrivate ? 'private' : 'public'}`));
      console.log(chalk.gray(`  Local directory: ${baseDir}`));
      console.log('');

      // Confirm unless --yes flag
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Proceed with setup?',
            default: true,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Setup cancelled.'));
          return;
        }
      }

      // Step 1: Check if repo already exists
      console.log(chalk.gray('\nChecking if repository exists...'));
      const repoExists = await checkRepoExists(repoFullName);

      if (repoExists) {
        console.log(chalk.yellow(`Repository ${repoFullName} already exists.`));

        const { useExisting } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useExisting',
            message: 'Use existing repository?',
            default: true,
          },
        ]);

        if (!useExisting) {
          console.log(chalk.yellow('Setup cancelled.'));
          return;
        }
      } else {
        // Create the repository
        console.log(chalk.gray('Creating GitHub repository...'));
        await createRepo(repoName, isPrivate, options.org);
        console.log(chalk.green(`Created repository: ${repoFullName}`));
      }

      // Step 2: Initialize local skills directory
      console.log(chalk.gray('Initializing local skills directory...'));
      await fs.mkdir(skillsDir, { recursive: true });

      // Create README if it doesn't exist
      const readmePath = path.join(baseDir, 'README.md');
      try {
        await fs.access(readmePath);
      } catch {
        await fs.writeFile(readmePath, getReadmeContent(repoFullName), 'utf-8');
      }

      // Create .gitignore if it doesn't exist
      const gitignorePath = path.join(baseDir, '.gitignore');
      try {
        await fs.access(gitignorePath);
      } catch {
        await fs.writeFile(gitignorePath, '.DS_Store\nThumbs.db\n.vscode/\n.idea/\n', 'utf-8');
      }

      // Step 3: Initialize git and push
      console.log(chalk.gray('Initializing git repository...'));

      const isGitRepo = await checkIsGitRepo(baseDir);
      if (!isGitRepo) {
        await execAsync('git init', { cwd: baseDir });
      }

      // Check if remote exists
      const remoteExists = await checkRemoteExists(baseDir, 'origin');
      if (remoteExists) {
        await execAsync('git remote remove origin', { cwd: baseDir });
      }
      await execAsync(`git remote add origin ${repoUrl}`, { cwd: baseDir });

      // Configure git to use gh for auth (makes push work without SSH keys)
      await execAsync('gh auth setup-git', { cwd: baseDir }).catch(() => {
        // Ignore if this fails, user might have other auth configured
      });

      // Add and commit
      await execAsync('git add .', { cwd: baseDir });

      const hasChanges = await checkHasChanges(baseDir);
      if (hasChanges) {
        await execAsync('git commit -m "Initial skills setup"', { cwd: baseDir });
      }

      // Push using gh (handles auth automatically)
      console.log(chalk.gray('Pushing to GitHub...'));
      try {
        await execAsync('git branch -M main', { cwd: baseDir });
        // Use git push but gh auth setup-git should have configured credentials
        await execAsync('git push -u origin main', { cwd: baseDir });
      } catch (error) {
        // If push fails, it might be because remote has content
        console.log(chalk.yellow('Note: Could not push (remote may have existing content)'));
      }

      // Step 4: Configure skillsync
      console.log(chalk.gray('Configuring skillsync...'));
      await updateConfig({
        remote: {
          url: repoUrl,
          branch: 'main',
        },
      });

      console.log(chalk.green('\nSetup complete!'));
      console.log(chalk.cyan('\nNext steps:'));
      console.log(chalk.white('  1. Add skills:     skillsync add <skill-name>'));
      console.log(chalk.white('  2. Import skills:  skillsync import <path-to-skills>'));
      console.log(chalk.white('  3. Push changes:   git add . && git commit -m "Add skills" && git push'));
      console.log(chalk.white('  4. Sync to tools:  skillsync sync'));
      console.log('');
      console.log(chalk.gray(`Repository: https://github.com/${repoFullName}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

async function checkGhCli(): Promise<boolean> {
  try {
    await execAsync('gh --version');
    return true;
  } catch {
    return false;
  }
}

async function checkGhAuth(): Promise<boolean> {
  try {
    await execAsync('gh auth status');
    return true;
  } catch {
    return false;
  }
}

async function getGhUsername(): Promise<string> {
  const { stdout } = await execAsync('gh api user --jq .login');
  return stdout.trim();
}

async function checkRepoExists(fullName: string): Promise<boolean> {
  try {
    await execAsync(`gh repo view ${fullName}`);
    return true;
  } catch {
    return false;
  }
}

async function createRepo(name: string, isPrivate: boolean, org?: string): Promise<void> {
  const visibility = isPrivate ? '--private' : '--public';
  const orgFlag = org ? `--org ${org}` : '';
  await execAsync(`gh repo create ${name} ${visibility} ${orgFlag} --description "Team AI skills for skillsync"`);
}

async function checkIsGitRepo(dir: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { cwd: dir });
    return true;
  } catch {
    return false;
  }
}

async function checkRemoteExists(dir: string, remoteName: string): Promise<boolean> {
  try {
    await execAsync(`git remote get-url ${remoteName}`, { cwd: dir });
    return true;
  } catch {
    return false;
  }
}

async function checkHasChanges(dir: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: dir });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

function getReadmeContent(repoFullName: string): string {
  return `# Team Skills

Private AI skills shared across the team via [skillsync](https://github.com/anthropics/skillsync).

## Usage

### For team members

\`\`\`bash
# Install skillsync
npm install -g skillsync

# Configure to use this repo
skillsync config --repo https://github.com/${repoFullName}.git

# Sync skills to your local tools
skillsync sync
\`\`\`

### Adding new skills

\`\`\`bash
# Create a new skill
skillsync add <skill-name>

# Or import existing skills
skillsync import <path-to-skill>

# Push to share with team
git add . && git commit -m "Add skill" && git push
\`\`\`

## Skills

| Skill | Description |
|-------|-------------|
| (none yet) | Run \`skillsync add <name>\` to create one |
`;
}
