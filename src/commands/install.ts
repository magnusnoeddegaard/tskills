import { Command } from 'commander';
import chalk from 'chalk';
import { isLoggedIn } from '../lib/credentials.js';
import {
  getSkill,
  getSkillVersion,
  incrementDownloads,
} from '../lib/registry.js';
import {
  addInstalledSkill,
  saveSkillContent,
  getInstalledVersion,
} from '../lib/manifest.js';
import { parseSkill } from '../lib/skill.js';
import { readConfig } from '../lib/config.js';
import { getEnabledAdapters } from '../adapters/index.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';
import { validateSkillRef, validateScope } from '../lib/validation.js';
import type { Scope } from '../types.js';

export const installCommand = new Command('install')
  .description('Install a skill from the tskills registry')
  .argument('<skill>', 'Skill to install (format: owner/name[@version])')
  .option('-s, --scope <scope>', 'Install scope: "user" (global) or "project" (current directory)')
  .option('-f, --force', 'Force reinstall even if already installed')
  .action(async (skillArg: string, options) => {
    try {
      // Parse and validate skill argument
      const { owner, name, version: requestedVersion } = validateSkillRef(skillArg);

      // Check if already installed
      const installedVersion = await getInstalledVersion(owner, name);
      if (installedVersion && !options.force) {
        console.log(chalk.yellow(`${owner}/${name}@${installedVersion} is already installed.`));
        console.log(chalk.gray('Use --force to reinstall.'));
        return;
      }

      const loggedIn = await isLoggedIn();

      console.log(chalk.cyan(`Installing ${chalk.bold(`${owner}/${name}`)}...`));

      // Check if skill exists and is accessible (RLS filters by visibility)
      const skill = await getSkill(owner, name);

      if (!skill) {
        if (!loggedIn) {
          console.error(chalk.red(`Skill not found: ${owner}/${name}`));
          console.error(chalk.gray('If this is a private or organization skill, try logging in first:'));
          console.error(chalk.gray('  tskills login'));
        } else {
          console.error(chalk.red(`Skill not found: ${owner}/${name}`));
        }
        process.exit(1);
      }

      // Show deprecation warning
      if (skill.deprecated) {
        console.log(chalk.yellow(`\nWarning: This skill is deprecated.`));
        if (skill.deprecation_message) {
          console.log(chalk.yellow(`Message: ${skill.deprecation_message}`));
        }
        console.log('');
      }

      // Get the skill version content
      const version = requestedVersion || skill.latest_version;

      if (!version) {
        console.error(chalk.red('No versions available for this skill.'));
        process.exit(1);
      }

      const skillVersion = await getSkillVersion(owner, name, version);

      if (!skillVersion) {
        console.error(chalk.red(`Version ${version} not found for ${owner}/${name}`));
        process.exit(1);
      }

      // Save skill content to local registry directory
      const skillPath = await saveSkillContent(owner, name, skillVersion.content);

      // Parse the skill content
      const parsedSkill = parseSkill(skillVersion.content, skillPath);

      // Get config and determine scope
      const config = await readConfig();
      const scope: Scope = validateScope(options.scope || config.defaults?.scope || 'user');

      // Get enabled adapters
      const tools = config.tools || { claude: true, cursor: true, copilot: true, windsurf: false };
      const adapters = getEnabledAdapters(tools);

      if (adapters.length === 0) {
        console.log(chalk.yellow('No tools enabled. The skill has been cached but not synced.'));
        console.log(chalk.gray('Run "tskills config --show" to see configuration.'));
      } else {
        // Sync to enabled tools
        const skillTools = parsedSkill.tools.map(t => t.toLowerCase());

        console.log(chalk.gray(`\nSyncing to tools (scope: ${scope}):`));

        for (const adapter of adapters) {
          // Check if this skill should be synced to this tool
          if (!skillTools.includes(adapter.name) && !skillTools.includes('all')) {
            console.log(chalk.gray(`  ${adapter.name}: skipped (not in skill's tools list)`));
            continue;
          }

          await adapter.write(parsedSkill, scope);
          console.log(chalk.green(`  ${adapter.name}: synced`));
        }
      }

      // Update manifest
      await addInstalledSkill(owner, name, version, skill.visibility);

      // Increment download count
      await incrementDownloads(owner, name);

      console.log(chalk.green(`\nInstalled ${chalk.bold(`${owner}/${name}@${version}`)}`));

    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
