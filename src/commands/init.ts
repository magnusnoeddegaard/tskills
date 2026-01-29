import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

export const initCommand = new Command('init')
  .description('Initialize a new team skills repository')
  .option('-d, --dir <directory>', 'Directory to initialize (default: current directory)')
  .action(async (options) => {
    try {
      const baseDir = options.dir ? path.resolve(options.dir) : process.cwd();
      const skillsDir = path.join(baseDir, 'skills');

      // Check if already initialized
      try {
        await fs.access(skillsDir);
        console.log(chalk.yellow('Skills directory already exists.'));
        return;
      } catch {
        // Directory doesn't exist, create it
      }

      // Create skills directory
      await fs.mkdir(skillsDir, { recursive: true });

      // Create a README
      const readme = `# Team Skills

This repository contains shared AI skills for your team.

## Structure

Each skill is a directory containing a \`SKILL.md\` file:

\`\`\`
skills/
├── code-review/
│   └── SKILL.md
├── pr-template/
│   └── SKILL.md
└── deploy-checklist/
    └── SKILL.md
\`\`\`

## SKILL.md Format

\`\`\`markdown
---
name: skill-name
description: When this skill should be used
---

# Skill Name

Your skill instructions here.
\`\`\`

## Usage

Team members can sync these skills to their local environment:

\`\`\`bash
skillsync config --repo <this-repo-url>
skillsync sync
\`\`\`

## Adding Skills

\`\`\`bash
skillsync add <skill-name>
\`\`\`
`;

      await fs.writeFile(path.join(baseDir, 'README.md'), readme, 'utf-8');

      // Create .gitignore
      const gitignore = `# OS files
.DS_Store
Thumbs.db

# Editor files
.vscode/
.idea/
`;
      await fs.writeFile(path.join(baseDir, '.gitignore'), gitignore, 'utf-8');

      console.log(chalk.green('Initialized team skills repository.'));
      console.log(chalk.gray(`\nCreated:\n  ${skillsDir}/\n  ${path.join(baseDir, 'README.md')}\n  ${path.join(baseDir, '.gitignore')}`));
      console.log(chalk.cyan('\nNext steps:'));
      console.log(chalk.white('  1. Add a skill: skillsync add <skill-name>'));
      console.log(chalk.white('  2. Initialize git: git init'));
      console.log(chalk.white('  3. Push to your private repo'));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });
