import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import { readConfig } from '../lib/config.js';
import { cloneOrPull } from '../lib/git.js';
import { discoverSkills } from '../lib/discover.js';
import { getEnabledAdapters } from '../adapters/index.js';
import { validateScope } from '../lib/validation.js';
import type { Scope } from '../types.js';

export const syncCommand = new Command('sync')
  .description('Sync skills from remote repository to local tools')
  .option('-s, --scope <scope>', 'Install scope: "user" (global) or "project" (current directory)')
  .option('--dry-run', 'Show what would be synced without making changes')
  .action(async (options) => {
    try {
      const config = await readConfig();

      if (!config.remote?.url) {
        console.error(chalk.red('Error: No remote repository configured.'));
        console.log(chalk.gray('Run "skillsync config --repo <url>" to set the remote repository.'));
        process.exit(1);
      }

      const scope: Scope = validateScope(options.scope || config.defaults?.scope || 'user');

      console.log(chalk.cyan(`Syncing from: ${config.remote.url}`));
      console.log(chalk.gray(`Branch: ${config.remote.branch || 'main'}`));
      console.log(chalk.gray(`Scope: ${scope}`));
      console.log('');

      // Clone or pull the repository
      if (!options.dryRun) {
        console.log(chalk.gray('Fetching remote repository...'));
      }

      const localPath = options.dryRun
        ? path.join(process.cwd(), 'skills') // For dry run, check local
        : await cloneOrPull(config.remote.url, config.remote.branch || 'main');

      // Discover skills
      const skillsDir = path.join(localPath, 'skills');
      const skills = await discoverSkills(skillsDir);

      if (skills.length === 0) {
        console.log(chalk.yellow('No skills found in remote repository.'));
        return;
      }

      console.log(chalk.green(`Found ${skills.length} skill(s)`));
      console.log('');

      // Get enabled adapters
      const tools = config.tools || { claude: true, cursor: true, copilot: true, windsurf: false };
      const adapters = getEnabledAdapters(tools);

      if (adapters.length === 0) {
        console.log(chalk.yellow('No tools enabled. Run "skillsync config --show" to see configuration.'));
        return;
      }

      // Sync each skill to each enabled tool
      for (const skill of skills) {
        const skillTools = skill.tools.map(t => t.toLowerCase());

        console.log(chalk.white(`  ${skill.name}`));

        for (const adapter of adapters) {
          // Check if this skill should be synced to this tool
          if (!skillTools.includes(adapter.name) && !skillTools.includes('all')) {
            console.log(chalk.gray(`    ${adapter.name}: skipped (not in skill's tools list)`));
            continue;
          }

          const targetPath = adapter.getSkillPath(scope);

          if (options.dryRun) {
            console.log(chalk.cyan(`    ${adapter.name}: would write to ${targetPath}`));
          } else {
            await adapter.write(skill, scope);
            console.log(chalk.green(`    ${adapter.name}: synced to ${targetPath}`));
          }
        }
        console.log('');
      }

      if (options.dryRun) {
        console.log(chalk.yellow('Dry run complete. No changes were made.'));
      } else {
        console.log(chalk.green('Sync complete!'));
        console.log(chalk.gray('\nSkills are now available in your AI tools.'));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });
