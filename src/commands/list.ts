import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import { discoverSkills } from '../lib/discover.js';
import { readConfig, getCacheDir } from '../lib/config.js';

export const listCommand = new Command('list')
  .description('List available skills')
  .option('-l, --local', 'List skills from local directory (default: ./skills)')
  .option('-r, --remote', 'List skills from synced remote repository')
  .option('-d, --dir <directory>', 'Skills directory to scan')
  .action(async (options) => {
    try {
      let skillsDir: string;
      let source: string;

      if (options.dir) {
        skillsDir = path.resolve(options.dir);
        source = skillsDir;
      } else if (options.remote) {
        const config = await readConfig();
        if (!config.remote?.url) {
          console.error(chalk.red('Error: No remote repository configured. Run "skillsync config --repo <url>" first.'));
          process.exit(1);
        }

        const repoName = getRepoName(config.remote.url);
        skillsDir = path.join(getCacheDir(), repoName, 'skills');
        source = config.remote.url;
      } else {
        // Default to local
        skillsDir = path.join(process.cwd(), 'skills');
        source = skillsDir;
      }

      const skills = await discoverSkills(skillsDir);

      if (skills.length === 0) {
        console.log(chalk.yellow('No skills found.'));
        if (!options.remote) {
          console.log(chalk.gray('Run "skillsync init" to create a skills repository, or "skillsync sync" to fetch from remote.'));
        }
        return;
      }

      console.log(chalk.cyan(`\nSkills from: ${source}\n`));

      const maxNameLen = Math.max(...skills.map(s => s.name.length), 10);

      for (const skill of skills) {
        const name = skill.name.padEnd(maxNameLen);
        const tools = skill.tools.join(', ');
        console.log(`  ${chalk.white(name)}  ${chalk.gray(skill.description)}`);
        console.log(`  ${' '.repeat(maxNameLen)}  ${chalk.cyan(`tools: ${tools}`)}`);
        console.log('');
      }

      console.log(chalk.gray(`Total: ${skills.length} skill(s)`));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

function getRepoName(url: string): string {
  const match = url.match(/\/([^/]+?)(\.git)?$/);
  if (match) {
    return match[1];
  }
  return url.replace(/[^a-zA-Z0-9]/g, '_');
}
