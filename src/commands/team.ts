import { Command } from 'commander';
import chalk from 'chalk';
import { isLoggedIn } from '../lib/credentials.js';
import {
  createTeam,
  getTeam,
  listOrgTeams,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  deleteTeam,
  getUserOrgRole,
} from '../lib/registry.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';
import { validateOrgSlug, validateTeamSlug, validateUsername } from '../lib/validation.js';

export const teamCommand = new Command('team').description(
  'Manage teams within organizations'
);

// Helper to parse and validate org/team format
function parseTeamArg(arg: string): { org: string; team: string } {
  const parts = arg.split('/');
  if (parts.length !== 2) {
    throw new Error('Invalid format. Use: <org>/<team>');
  }
  const [org, team] = parts;
  validateOrgSlug(org);
  validateTeamSlug(team);
  return { org, team };
}

// tskills team create <org>/<team>
teamCommand
  .command('create <org-team>')
  .description('Create a new team in an organization')
  .option('-n, --name <name>', 'Display name (defaults to team slug)')
  .option('-d, --description <description>', 'Team description')
  .action(async (orgTeam: string, options) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const { org, team } = parseTeamArg(orgTeam);

      // Check permission
      const role = await getUserOrgRole(org);
      if (!role || !['owner', 'admin'].includes(role)) {
        console.error(chalk.red(`You do not have permission to create teams in "${org}"`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Creating team "${org}/${team}"...`));

      const createdTeam = await createTeam({
        orgSlug: org,
        teamSlug: team,
        name: options.name || team,
        description: options.description,
      });

      console.log(chalk.green(`\nTeam created: ${chalk.bold(`${org}/${createdTeam.slug}`)}`));
      console.log(chalk.gray(`\nNext steps:`));
      console.log(chalk.gray(`  Add members:    tskills team add ${org}/${team} @<username>`));
      console.log(
        chalk.gray(`  Publish skill:  tskills publish ./SKILL.md --org ${org} --team ${team}`)
      );
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills team list <org>
teamCommand
  .command('list <org>')
  .description('List teams in an organization')
  .action(async (org: string) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const teams = await listOrgTeams(org);

      if (teams.length === 0) {
        console.log(chalk.yellow(`No teams in "${org}".`));
        console.log(chalk.gray(`Create one: tskills team create ${org}/<team-name>`));
        return;
      }

      console.log(chalk.gray(`\nTeams in ${org} (${teams.length}):\n`));

      const memberCounts = await Promise.all(
        teams.map((team) => getTeamMembers(org, team.slug))
      );

      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        const members = memberCounts[i];
        console.log(chalk.bold(`  ${org}/${team.slug}`));
        if (team.name !== team.slug) {
          console.log(chalk.gray(`    Name: ${team.name}`));
        }
        if (team.description) {
          console.log(chalk.gray(`    ${team.description}`));
        }
        console.log(chalk.blue(`    Members: ${members.length}`));
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills team info <org>/<team>
teamCommand
  .command('info <org-team>')
  .description('Show team details')
  .action(async (orgTeam: string) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const { org, team: teamSlug } = parseTeamArg(orgTeam);

      const team = await getTeam(org, teamSlug);
      if (!team) {
        console.error(chalk.red(`Team "${org}/${teamSlug}" not found.`));
        process.exit(1);
      }

      const members = await getTeamMembers(org, teamSlug);

      console.log(chalk.bold.cyan(`\n${org}/${team.slug}`));
      if (team.name !== team.slug) {
        console.log(chalk.white(team.name));
      }
      if (team.description) {
        console.log(chalk.gray(team.description));
      }
      console.log('');

      console.log(chalk.gray('Details:'));
      console.log(`  ${chalk.bold('Members:')} ${members.length}`);
      console.log(`  ${chalk.bold('Created:')} ${new Date(team.created_at).toLocaleDateString()}`);
      console.log('');

      if (members.length > 0) {
        console.log(chalk.gray('Members:'));
        for (const member of members) {
          console.log(`  ${member.user?.username || member.user_id}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills team add <org>/<team> @<username>
teamCommand
  .command('add <org-team> <username>')
  .description('Add a member to a team')
  .action(async (orgTeam: string, username: string) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const { org, team } = parseTeamArg(orgTeam);
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

      // Validate username
      validateUsername(cleanUsername);

      // Check permission
      const role = await getUserOrgRole(org);
      if (!role || !['owner', 'admin'].includes(role)) {
        console.error(chalk.red(`You do not have permission to manage team members in "${org}". Requires owner or admin role.`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Adding ${cleanUsername} to ${org}/${team}...`));

      await addTeamMember(org, team, cleanUsername);

      console.log(
        chalk.green(`\nAdded ${chalk.bold(cleanUsername)} to ${chalk.bold(`${org}/${team}`)}`)
      );
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills team remove <org>/<team> @<username>
teamCommand
  .command('remove <org-team> <username>')
  .description('Remove a member from a team')
  .action(async (orgTeam: string, username: string) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const { org, team } = parseTeamArg(orgTeam);
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

      // Validate username
      validateUsername(cleanUsername);

      // Check permission
      const role = await getUserOrgRole(org);
      if (!role || !['owner', 'admin'].includes(role)) {
        console.error(chalk.red(`You do not have permission to manage team members in "${org}". Requires owner or admin role.`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Removing ${cleanUsername} from ${org}/${team}...`));

      await removeTeamMember(org, team, cleanUsername);

      console.log(
        chalk.green(`\nRemoved ${chalk.bold(cleanUsername)} from ${chalk.bold(`${org}/${team}`)}`)
      );
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills team delete <org>/<team>
teamCommand
  .command('delete <org-team>')
  .description('Delete a team')
  .option('-f, --force', 'Skip confirmation')
  .action(async (orgTeam: string, options) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const { org, team } = parseTeamArg(orgTeam);

      // Check permission
      const role = await getUserOrgRole(org);
      if (!role || !['owner', 'admin'].includes(role)) {
        console.error(chalk.red(`You do not have permission to delete teams in "${org}"`));
        process.exit(1);
      }

      if (!options.force) {
        console.log(chalk.yellow(`\nThis will permanently delete "${org}/${team}".`));
        console.log(chalk.gray('Skills with team visibility will become inaccessible.'));
        console.log(chalk.gray('Use --force to confirm.'));
        process.exit(1);
      }

      console.log(chalk.cyan(`Deleting team "${org}/${team}"...`));

      await deleteTeam(org, team);

      console.log(chalk.green(`\nDeleted team ${chalk.bold(`${org}/${team}`)}`));
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
