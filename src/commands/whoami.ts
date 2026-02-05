import { Command } from 'commander';
import chalk from 'chalk';
import { getCredentials } from '../lib/credentials.js';

export const whoamiCommand = new Command('whoami')
  .description('Show currently logged in user')
  .action(async () => {
    try {
      const credentials = await getCredentials();

      if (!credentials) {
        console.log(chalk.yellow('Not logged in.'));
        console.log(chalk.gray('Use "tskills login" to authenticate.'));
        return;
      }

      const { user } = credentials;

      console.log(chalk.cyan('Logged in as:'));
      console.log(`  ${chalk.bold('Username:')} ${user.username}`);
      if (user.email) {
        console.log(`  ${chalk.bold('Email:')}    ${user.email}`);
      }
      if (user.github_id) {
        console.log(`  ${chalk.bold('GitHub ID:')} ${user.github_id}`);
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });
