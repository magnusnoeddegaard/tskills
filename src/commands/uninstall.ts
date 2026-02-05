import { Command } from 'commander';
import chalk from 'chalk';
import { createInterface } from 'readline';
import {
  isInstalled,
  removeInstalledSkill,
  removeSkillContent,
  getSkillContent,
} from '../lib/manifest.js';
import { parseSkill } from '../lib/skill.js';
import { readConfig } from '../lib/config.js';
import { getEnabledAdapters } from '../adapters/index.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';
import { validateSkillRef, validateScope } from '../lib/validation.js';
import type { Scope } from '../types.js';

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export const uninstallCommand = new Command('uninstall')
  .description('Uninstall a skill from local cache and tools')
  .argument('<skill>', 'Skill to uninstall (format: owner/name)')
  .option('-s, --scope <scope>', 'Uninstall scope: "user" (global) or "project" (current directory)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (skillArg: string, options) => {
    try {
      // Parse and validate skill argument
      const { owner, name } = validateSkillRef(skillArg);
      const fullName = `${owner}/${name}`;

      // Check if installed
      if (!await isInstalled(owner, name)) {
        console.log(chalk.yellow(`Skill ${chalk.bold(fullName)} is not installed.`));
        return;
      }

      // Confirm uninstall
      if (!options.yes) {
        const confirmed = await confirm(`Uninstall ${chalk.bold(fullName)}? (y/N) `);
        if (!confirmed) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }
      }

      console.log(chalk.cyan(`\nUninstalling ${chalk.bold(fullName)}...`));

      const config = await readConfig();
      const scope: Scope = validateScope(options.scope || config.defaults?.scope || 'user');

      // Get skill content to determine which tools it was synced to
      const content = await getSkillContent(owner, name);
      let skillTools: string[] = ['claude', 'cursor', 'copilot', 'windsurf']; // Default to all

      if (content) {
        try {
          const parsed = parseSkill(content, '');
          skillTools = parsed.tools.map((t) => t.toLowerCase());
        } catch {
          // If we can't parse, try to remove from all adapters
        }
      }

      // Get enabled adapters
      const tools = config.tools || { claude: true, cursor: true, copilot: true, windsurf: false };
      const adapters = getEnabledAdapters(tools);

      console.log(chalk.gray(`\nRemoving from tools (scope: ${scope}):`));

      for (const adapter of adapters) {
        // Only remove from tools the skill was synced to
        if (!skillTools.includes(adapter.name) && !skillTools.includes('all')) {
          continue;
        }

        try {
          await adapter.remove(name, scope);
          console.log(chalk.green(`  ${adapter.name}: removed`));
        } catch (error) {
          console.log(chalk.yellow(`  ${adapter.name}: ${(error as Error).message}`));
        }
      }

      // Remove from local cache
      await removeSkillContent(owner, name);
      console.log(chalk.green('  cache: removed'));

      // Remove from manifest
      const wasInstalled = await removeInstalledSkill(owner, name);

      if (wasInstalled) {
        console.log(chalk.green('  manifest: removed'));
        console.log(chalk.green(`\nUninstalled ${chalk.bold(fullName)}`));
      } else {
        console.log(chalk.yellow('  manifest: not found'));
      }

    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
