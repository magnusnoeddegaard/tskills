import { Command } from 'commander';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import semver from 'semver';
import matter from 'gray-matter';
import { isLoggedIn, getCredentials } from '../lib/credentials.js';
import {
  publishSkill,
  publishVersion,
  getSkill,
  getAllVersions,
} from '../lib/registry.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';
import {
  validateSkillName,
  validateDescription,
  validateVisibility,
  validateOrgSlug,
  validateTeamSlug,
} from '../lib/validation.js';

export const publishCommand = new Command('publish')
  .description('Publish a skill to the tskills registry')
  .argument('<path>', 'Path to SKILL.md file')
  .option('--version <version>', 'Version to publish (default: auto-increment)')
  .option('--visibility <visibility>', 'Skill visibility (public, private, org, or team)', 'public')
  .option('--org <org>', 'Publish to an organization')
  .option('--team <team>', 'Restrict visibility to a team (requires --org)')
  .action(async (skillPath: string, options) => {
    try {
      // Check authentication
      if (!await isLoggedIn()) {
        console.error(chalk.red('Not logged in. Please run "tskills login" first.'));
        process.exit(1);
      }

      const credentials = await getCredentials();
      if (!credentials) {
        console.error(chalk.red('Failed to get credentials.'));
        process.exit(1);
      }

      // Resolve and read skill file
      const resolvedPath = path.resolve(skillPath);
      let content: string;

      try {
        content = await fs.readFile(resolvedPath, 'utf-8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          console.error(chalk.red(`File not found: ${resolvedPath}`));
          process.exit(1);
        }
        throw error;
      }

      // Parse frontmatter
      const { data: frontmatter, content: body } = matter(content);

      if (!frontmatter.name) {
        console.error(chalk.red('Skill is missing required "name" field in frontmatter.'));
        process.exit(1);
      }

      if (!frontmatter.description) {
        console.error(chalk.red('Skill is missing required "description" field in frontmatter.'));
        process.exit(1);
      }

      const skillName = frontmatter.name as string;
      const description = frontmatter.description as string;
      const tools = (frontmatter.tools as string[]) || [];
      const tags = (frontmatter.tags as string[]) || [];

      // Validate skill name and description
      validateSkillName(skillName);
      validateDescription(description);

      // Validate team requires org
      if (options.team && !options.org) {
        console.error(chalk.red('--team requires --org to be specified.'));
        process.exit(1);
      }

      // Validate visibility
      const visibility = validateVisibility(options.visibility);

      // Validate org and team slugs if provided
      if (options.org) {
        validateOrgSlug(options.org);
      }
      if (options.team) {
        validateTeamSlug(options.team);
      }

      // Validate team visibility requires --team flag
      if (visibility === 'team' && !options.team) {
        console.error(chalk.red('Team visibility requires --team flag.'));
        process.exit(1);
      }

      // Validate org/team visibility requires --org flag
      if ((visibility === 'org' || visibility === 'team') && !options.org) {
        console.error(chalk.red(`${visibility} visibility requires --org flag.`));
        process.exit(1);
      }

      // Validate private visibility is only for personal skills
      if (visibility === 'private' && options.org) {
        console.error(chalk.red('Private visibility is only for personal skills. Use "org" or "team" visibility with --org.'));
        process.exit(1);
      }

      const ownerName = options.org || credentials.user.username;
      console.log(chalk.cyan(`Publishing ${chalk.bold(skillName)} to ${chalk.bold(ownerName)}...`));

      // Create or update the skill
      await publishSkill(skillName, {
        description,
        visibility,
        tools,
        tags,
        orgSlug: options.org,
        teamSlug: options.team,
      });

      // Determine version
      let version = options.version;

      if (!version) {
        // Auto-increment version
        const existingSkill = await getSkill(ownerName, skillName);

        if (existingSkill?.latest_version) {
          // Increment patch version
          const parsed = semver.parse(existingSkill.latest_version);
          if (parsed) {
            version = semver.inc(existingSkill.latest_version, 'patch');
          } else {
            // If existing version isn't semver, start fresh
            version = '1.0.0';
          }
        } else {
          version = '1.0.0';
        }
      }

      // Validate version format
      if (!semver.valid(version)) {
        console.error(chalk.red(`Invalid version format: ${version}`));
        console.error(chalk.gray('Version must follow semver format (e.g., 1.0.0, 2.1.3)'));
        process.exit(1);
      }

      // Check if version already exists
      const versions = await getAllVersions(ownerName, skillName);
      const existingVersion = versions.find((v) => v.version === version);

      if (existingVersion) {
        console.error(chalk.red(`Version ${version} already exists.`));
        console.error(chalk.gray('Use a different version number or let it auto-increment.'));
        process.exit(1);
      }

      // Publish the version
      await publishVersion(ownerName, skillName, version, content);

      console.log(chalk.green(`\nPublished ${chalk.bold(`${ownerName}/${skillName}@${version}`)}`));
      console.log(chalk.gray(`\nInstall with: tskills install ${ownerName}/${skillName}`));

    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
