import { Command } from 'commander';
import chalk from 'chalk';
import { clearCredentials, getCredentials } from '../lib/credentials.js';
import { getSupabaseClient, resetSupabaseClient } from '../lib/registry.js';

export const logoutCommand = new Command('logout')
  .description('Logout from the tskills registry')
  .action(async () => {
    try {
      const credentials = await getCredentials();

      if (!credentials) {
        console.log(chalk.yellow('Not currently logged in.'));
        return;
      }

      // Invalidate the server-side session
      try {
        const client = await getSupabaseClient();
        await client.auth.signOut();
      } catch {
        // Best-effort: if this fails (e.g. network error), still clear local credentials
      }

      const username = credentials.user.username;
      await clearCredentials();
      resetSupabaseClient();

      console.log(chalk.green(`Logged out from ${chalk.bold(username)}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });
