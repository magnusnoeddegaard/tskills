import { Command } from 'commander';
import chalk from 'chalk';
import { getSkill, getAllVersions } from '../lib/registry.js';
import { getInstalledVersion } from '../lib/manifest.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';
import { validateSkillRef } from '../lib/validation.js';

export const infoCommand = new Command('info')
  .description('Show detailed information about a skill')
  .argument('<skill>', 'Skill to show info for (format: owner/name)')
  .action(async (skillArg: string) => {
    try {
      // Parse and validate skill argument
      const { owner, name } = validateSkillRef(skillArg);

      const skill = await getSkill(owner, name);

      if (!skill) {
        console.error(chalk.red(`Skill not found: ${owner}/${name}`));
        process.exit(1);
      }

      // Check if installed locally
      const installedVersion = await getInstalledVersion(owner, name);

      // Header
      console.log(chalk.bold.cyan(`\n${owner}/${name}`));
      console.log('');

      // Description
      if (skill.description) {
        console.log(chalk.white(skill.description));
        console.log('');
      }

      // Basic info
      console.log(chalk.gray('Details:'));
      console.log(`  ${chalk.bold('Visibility:')} ${skill.visibility}`);
      console.log(`  ${chalk.bold('Latest:')}    ${skill.latest_version || 'no versions'}`);
      console.log(`  ${chalk.bold('Downloads:')} ${skill.downloads}`);
      console.log(`  ${chalk.bold('Created:')}   ${new Date(skill.created_at).toLocaleDateString()}`);

      // Deprecation status
      if (skill.deprecated) {
        console.log(`  ${chalk.bold('Status:')}    ${chalk.red('DEPRECATED')}`);
        if (skill.deprecation_message) {
          console.log(`  ${chalk.bold('Message:')}   ${chalk.yellow(skill.deprecation_message)}`);
        }
      }

      // Installation status
      if (installedVersion) {
        if (installedVersion === skill.latest_version) {
          console.log(`  ${chalk.bold('Status:')}    ${chalk.green('installed')} (v${installedVersion})`);
        } else {
          console.log(`  ${chalk.bold('Status:')}    ${chalk.yellow('installed')} (v${installedVersion}, update available: v${skill.latest_version})`);
        }
      } else {
        console.log(`  ${chalk.bold('Status:')}    ${chalk.gray('not installed')}`);
      }
      console.log('');

      // Tools
      if (skill.tools && skill.tools.length > 0) {
        console.log(chalk.gray('Supported tools:'));
        for (const tool of skill.tools) {
          console.log(`  - ${tool}`);
        }
        console.log('');
      }

      // Tags
      if (skill.tags && skill.tags.length > 0) {
        console.log(chalk.gray('Tags:'));
        console.log(`  ${skill.tags.join(', ')}`);
        console.log('');
      }

      // Versions
      const versions = await getAllVersions(owner, name);

      if (versions.length > 0) {
        console.log(chalk.gray('Versions:'));
        for (const version of versions.slice(0, 10)) {
          const date = new Date(version.published_at).toLocaleDateString();
          const isLatest = version.version === skill.latest_version;
          const isInstalled = version.version === installedVersion;

          let versionStr = `  ${version.version}`;
          if (isLatest) versionStr += chalk.green(' (latest)');
          if (isInstalled) versionStr += chalk.cyan(' (installed)');
          versionStr += chalk.gray(` - ${date}`);

          console.log(versionStr);
        }

        if (versions.length > 10) {
          console.log(chalk.gray(`  ... and ${versions.length - 10} more versions`));
        }
        console.log('');
      }

      // Install command
      if (!installedVersion) {
        console.log(chalk.gray(`Install: tskills install ${owner}/${name}`));
      } else if (installedVersion !== skill.latest_version) {
        console.log(chalk.gray(`Update: tskills install ${owner}/${name} --force`));
      }

    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
