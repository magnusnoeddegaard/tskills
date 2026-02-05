import { Command } from 'commander';
import chalk from 'chalk';
import { readConfig, updateConfig, getConfigPath, getDefaultConfig } from '../lib/config.js';
import { validateScope } from '../lib/validation.js';
import type { Config } from '../types.js';

export const configCommand = new Command('config')
  .description('Configure skillsync settings')
  .option('-r, --repo <url>', 'Set the remote repository URL')
  .option('-b, --branch <branch>', 'Set the branch to sync from')
  .option('-s, --default-scope <scope>', 'Set default scope (user or project)')
  .option('--claude <enabled>', 'Enable/disable Claude Code sync (true/false)')
  .option('--cursor <enabled>', 'Enable/disable Cursor sync (true/false)')
  .option('--copilot <enabled>', 'Enable/disable Copilot sync (true/false)')
  .option('--windsurf <enabled>', 'Enable/disable Windsurf sync (true/false)')
  .option('--show', 'Show current configuration')
  .option('--reset', 'Reset configuration to defaults')
  .action(async (options) => {
    try {
      if (options.reset) {
        const defaults = getDefaultConfig();
        await updateConfig(defaults);
        console.log(chalk.green('Configuration reset to defaults.'));
        return;
      }

      if (options.show || Object.keys(options).length === 0) {
        const config = await readConfig();
        console.log(chalk.cyan('\nCurrent configuration:'));
        console.log(chalk.gray(`Config file: ${getConfigPath()}\n`));
        console.log(formatConfig(config));
        return;
      }

      const updates: Record<string, unknown> = {};

      if (options.repo) {
        updates.remote = { ...((await readConfig()).remote || {}), url: options.repo };
      }

      if (options.branch) {
        updates.remote = { ...((await readConfig()).remote || {}), branch: options.branch };
      }

      if (options.defaultScope) {
        const validatedScope = validateScope(options.defaultScope);
        updates.defaults = { scope: validatedScope };
      }

      const toolOptions = ['claude', 'cursor', 'copilot', 'windsurf'];
      const toolUpdates: Record<string, boolean> = {};

      for (const tool of toolOptions) {
        if (options[tool] !== undefined) {
          const value = options[tool].toLowerCase();
          if (!['true', 'false'].includes(value)) {
            console.error(chalk.red(`Error: --${tool} must be "true" or "false"`));
            process.exit(1);
          }
          toolUpdates[tool] = value === 'true';
        }
      }

      if (Object.keys(toolUpdates).length > 0) {
        const currentConfig = await readConfig();
        updates.tools = { ...(currentConfig.tools || {}), ...toolUpdates };
      }

      if (Object.keys(updates).length > 0) {
        await updateConfig(updates);
        console.log(chalk.green('Configuration updated.'));

        const config = await readConfig();
        console.log(chalk.cyan('\nNew configuration:'));
        console.log(formatConfig(config));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

function formatConfig(config: Config): string {
  const lines: string[] = [];

  if (config.remote) {
    const remote = config.remote as Record<string, string>;
    lines.push(chalk.white('[remote]'));
    if (remote.url) lines.push(`  url = ${chalk.yellow(`"${remote.url}"`)}`);
    if (remote.branch) lines.push(`  branch = ${chalk.yellow(`"${remote.branch}"`)}`);
    lines.push('');
  }

  if (config.defaults) {
    const defaults = config.defaults as Record<string, string>;
    lines.push(chalk.white('[defaults]'));
    if (defaults.scope) lines.push(`  scope = ${chalk.yellow(`"${defaults.scope}"`)}`);
    lines.push('');
  }

  if (config.tools) {
    const tools = config.tools as Record<string, boolean>;
    lines.push(chalk.white('[tools]'));
    for (const [name, enabled] of Object.entries(tools)) {
      const value = enabled ? chalk.green('true') : chalk.red('false');
      lines.push(`  ${name} = ${value}`);
    }
  }

  return lines.join('\n');
}
