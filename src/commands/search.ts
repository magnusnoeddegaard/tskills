import { Command } from 'commander';
import chalk from 'chalk';
import { searchSkills } from '../lib/registry.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';

export const searchCommand = new Command('search')
  .description('Search for skills in the tskills registry')
  .argument('[query]', 'Search query (searches name and description)')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('--tools <tools>', 'Filter by supported tools (comma-separated)')
  .option('-l, --limit <limit>', 'Maximum number of results', '20')
  .action(async (query: string | undefined, options) => {
    try {
      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined;
      const tools = options.tools ? options.tools.split(',').map((t: string) => t.trim()) : undefined;
      const limit = parseInt(options.limit, 10) || 20;

      console.log(chalk.cyan('Searching registry...\n'));

      const skills = await searchSkills({
        query,
        tags,
        tools,
        limit,
      });

      if (skills.length === 0) {
        if (query) {
          console.log(chalk.yellow(`No skills found matching "${query}"`));
        } else {
          console.log(chalk.yellow('No skills found.'));
        }
        return;
      }

      console.log(chalk.gray(`Found ${skills.length} skill(s):\n`));

      for (const skill of skills) {
        // Skill name with owner
        console.log(chalk.bold(`${skill.owner}/${skill.name}`));

        // Description
        if (skill.description) {
          const desc = skill.description.length > 80
            ? skill.description.substring(0, 77) + '...'
            : skill.description;
          console.log(chalk.gray(`  ${desc}`));
        }

        // Version and downloads
        const version = skill.latest_version ? `v${skill.latest_version}` : 'no versions';
        const downloads = skill.downloads === 1 ? '1 download' : `${skill.downloads} downloads`;
        console.log(chalk.gray(`  ${version} | ${downloads}`));

        // Tags
        if (skill.tags && skill.tags.length > 0) {
          console.log(chalk.blue(`  tags: ${skill.tags.join(', ')}`));
        }

        // Tools
        if (skill.tools && skill.tools.length > 0) {
          console.log(chalk.magenta(`  tools: ${skill.tools.join(', ')}`));
        }

        console.log('');
      }

      console.log(chalk.gray(`Install a skill: tskills install <owner>/<name>`));
      console.log(chalk.gray(`View details: tskills info <owner>/<name>`));

    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
