import { Command } from 'commander';
import chalk from 'chalk';
import { isLoggedIn } from '../lib/credentials.js';
import { getSkill, deprecateSkill } from '../lib/registry.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';
import { validateSkillRef } from '../lib/validation.js';

export const deprecateCommand = new Command('deprecate')
  .description('Mark a skill as deprecated')
  .argument('<skill>', 'Skill to deprecate (format: owner/name)')
  .option('-m, --message <message>', 'Deprecation message (e.g., "Use owner/new-skill instead")')
  .option('--undeprecate', 'Remove deprecation status')
  .action(async (skillArg: string, options) => {
    try {
      // Check authentication
      if (!await isLoggedIn()) {
        console.error(chalk.red('Please login first.'));
        console.error(chalk.gray('Run "tskills login" to authenticate.'));
        process.exit(1);
      }

      // Parse and validate skill argument
      const { owner, name } = validateSkillRef(skillArg);
      const fullName = `${owner}/${name}`;

      // Get skill info
      const skill = await getSkill(owner, name);
      if (!skill) {
        console.error(chalk.red(`Skill not found: ${fullName}`));
        process.exit(1);
      }

      if (options.undeprecate) {
        // Remove deprecation
        if (!skill.deprecated) {
          console.log(chalk.yellow(`${fullName} is not deprecated.`));
          return;
        }

        await deprecateSkill(owner, name, false);
        console.log(chalk.green(`Removed deprecation status from ${chalk.bold(fullName)}`));
      } else {
        // Deprecate the skill
        if (skill.deprecated && !options.message) {
          console.log(chalk.yellow(`${fullName} is already deprecated.`));
          if (skill.deprecation_message) {
            console.log(chalk.gray(`Message: ${skill.deprecation_message}`));
          }
          console.log(chalk.gray('Use --message to update the deprecation message.'));
          return;
        }

        await deprecateSkill(owner, name, true, options.message);

        console.log(chalk.green(`Marked ${chalk.bold(fullName)} as deprecated.`));
        if (options.message) {
          console.log(chalk.gray(`Message: ${options.message}`));
        }
        console.log('');
        console.log(chalk.gray('Users will see a warning when installing this skill.'));
        console.log(chalk.gray('To remove deprecation: tskills deprecate ' + fullName + ' --undeprecate'));
      }

    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
