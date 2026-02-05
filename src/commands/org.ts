import { Command } from 'commander';
import chalk from 'chalk';
import { isLoggedIn } from '../lib/credentials.js';
import {
  createOrg,
  getOrg,
  listUserOrgs,
  getOrgMembers,
  addOrgMember,
  removeOrgMember,
  deleteOrg,
  getUserOrgRole,
} from '../lib/registry.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';
import { validateOrgSlug, validateUsername } from '../lib/validation.js';
import type { OrgRole } from '../types.js';

export const orgCommand = new Command('org').description('Manage organizations');

// tskills org create <slug>
orgCommand
  .command('create <slug>')
  .description('Create a new organization')
  .option('-n, --name <name>', 'Display name (defaults to slug)')
  .option('-d, --description <description>', 'Organization description')
  .action(async (slug: string, options) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      // Validate slug format
      validateOrgSlug(slug);

      console.log(chalk.cyan(`Creating organization "${slug}"...`));

      const org = await createOrg({
        slug,
        name: options.name || slug,
        description: options.description,
      });

      console.log(chalk.green(`\nOrganization created: ${chalk.bold(org.slug)}`));
      console.log(chalk.gray(`\nNext steps:`));
      console.log(chalk.gray(`  Add members:    tskills org add ${slug} @<username>`));
      console.log(chalk.gray(`  Create team:    tskills team create ${slug}/<team-name>`));
      console.log(chalk.gray(`  Publish skill:  tskills publish ./SKILL.md --org ${slug}`));
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills org list
orgCommand
  .command('list')
  .description('List your organizations')
  .action(async () => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const orgs = await listUserOrgs();

      if (orgs.length === 0) {
        console.log(chalk.yellow('You are not a member of any organizations.'));
        console.log(chalk.gray('Create one: tskills org create <slug>'));
        return;
      }

      console.log(chalk.gray(`\nYour organizations (${orgs.length}):\n`));

      const roles = await Promise.all(orgs.map((org) => getUserOrgRole(org.slug)));

      for (let i = 0; i < orgs.length; i++) {
        const org = orgs[i];
        const role = roles[i];
        console.log(chalk.bold(`  ${org.slug}`));
        if (org.name !== org.slug) {
          console.log(chalk.gray(`    Name: ${org.name}`));
        }
        if (org.description) {
          console.log(chalk.gray(`    ${org.description}`));
        }
        console.log(chalk.blue(`    Role: ${role}`));
        console.log('');
      }
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills org info <slug>
orgCommand
  .command('info <slug>')
  .description('Show organization details')
  .action(async (slug: string) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const org = await getOrg(slug);
      if (!org) {
        console.error(chalk.red(`Organization "${slug}" not found or you don't have access.`));
        process.exit(1);
      }

      const members = await getOrgMembers(slug);
      const yourRole = await getUserOrgRole(slug);

      console.log(chalk.bold.cyan(`\n${org.slug}`));
      if (org.name !== org.slug) {
        console.log(chalk.white(org.name));
      }
      if (org.description) {
        console.log(chalk.gray(org.description));
      }
      console.log('');

      console.log(chalk.gray('Details:'));
      console.log(`  ${chalk.bold('Your role:')} ${yourRole}`);
      console.log(`  ${chalk.bold('Members:')}  ${members.length}`);
      console.log(`  ${chalk.bold('Created:')}  ${new Date(org.created_at).toLocaleDateString()}`);
      console.log('');

      console.log(chalk.gray('Members:'));
      for (const member of members) {
        const roleColor =
          member.role === 'owner'
            ? chalk.yellow
            : member.role === 'admin'
              ? chalk.blue
              : chalk.gray;
        console.log(`  ${member.user?.username || member.user_id} ${roleColor(`(${member.role})`)}`);
      }
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills org add <slug> @<username> [--role]
orgCommand
  .command('add <slug> <username>')
  .description('Add a member to an organization')
  .option('-r, --role <role>', 'Member role: owner, admin, member (default: member)', 'member')
  .action(async (slug: string, username: string, options) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      // Remove @ prefix if present
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

      // Validate inputs
      validateOrgSlug(slug);
      validateUsername(cleanUsername);

      // Validate role
      const role = options.role as OrgRole;
      if (!['owner', 'admin', 'member'].includes(role)) {
        console.error(chalk.red('Role must be: owner, admin, or member'));
        process.exit(1);
      }

      // Check permission
      const callerRole = await getUserOrgRole(slug);
      if (!callerRole || !['owner', 'admin'].includes(callerRole)) {
        console.error(chalk.red(`You do not have permission to manage members in "${slug}". Requires owner or admin role.`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Adding ${cleanUsername} to ${slug}...`));

      await addOrgMember(slug, cleanUsername, role);

      console.log(
        chalk.green(`\nAdded ${chalk.bold(cleanUsername)} to ${chalk.bold(slug)} as ${role}`)
      );
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills org remove <slug> @<username>
orgCommand
  .command('remove <slug> <username>')
  .description('Remove a member from an organization')
  .action(async (slug: string, username: string) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      // Remove @ prefix if present
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

      // Validate inputs
      validateOrgSlug(slug);
      validateUsername(cleanUsername);

      // Check permission
      const role = await getUserOrgRole(slug);
      if (!role || !['owner', 'admin'].includes(role)) {
        console.error(chalk.red(`You do not have permission to manage members in "${slug}". Requires owner or admin role.`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Removing ${cleanUsername} from ${slug}...`));

      await removeOrgMember(slug, cleanUsername);

      console.log(chalk.green(`\nRemoved ${chalk.bold(cleanUsername)} from ${chalk.bold(slug)}`));
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });

// tskills org delete <slug>
orgCommand
  .command('delete <slug>')
  .description('Delete an organization (owner only)')
  .option('-f, --force', 'Skip confirmation')
  .action(async (slug: string, options) => {
    try {
      if (!(await isLoggedIn())) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const role = await getUserOrgRole(slug);
      if (role !== 'owner') {
        console.error(chalk.red('Only organization owners can delete organizations.'));
        process.exit(1);
      }

      if (!options.force) {
        console.log(chalk.yellow(`\nThis will permanently delete "${slug}" and all its skills.`));
        console.log(chalk.gray('Use --force to confirm.'));
        process.exit(1);
      }

      console.log(chalk.cyan(`Deleting organization "${slug}"...`));

      await deleteOrg(slug);

      console.log(chalk.green(`\nDeleted organization ${chalk.bold(slug)}`));
    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
