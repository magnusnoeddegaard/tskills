import { Command } from 'commander';
import chalk from 'chalk';
import { getSkill } from '../lib/registry.js';
import { getInstalledSkills } from '../lib/manifest.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';

interface OutdatedSkill {
  owner: string;
  name: string;
  currentVersion: string;
  latestVersion: string;
}

export const outdatedCommand = new Command('outdated')
  .description('Check installed skills for available updates')
  .action(async () => {
    try {
      const installed = await getInstalledSkills();

      if (installed.length === 0) {
        console.log(chalk.yellow('No skills installed.'));
        console.log(chalk.gray('Install skills with: tskills install owner/name'));
        return;
      }

      console.log(chalk.cyan('Checking for updates...\n'));

      const outdated: OutdatedSkill[] = [];
      const upToDate: string[] = [];
      const notFound: string[] = [];

      const results = await Promise.allSettled(
        installed.map(async (skill) => {
          const fullName = `${skill.owner}/${skill.name}`;
          try {
            const remote = await getSkill(skill.owner, skill.name);

            if (!remote || !remote.latest_version) {
              return { status: 'not_found' as const, fullName };
            }

            if (remote.latest_version !== skill.version) {
              return {
                status: 'outdated' as const,
                fullName,
                owner: skill.owner,
                name: skill.name,
                currentVersion: skill.version,
                latestVersion: remote.latest_version,
              };
            } else {
              return { status: 'up_to_date' as const, fullName };
            }
          } catch {
            return { status: 'not_found' as const, fullName };
          }
        })
      );

      for (const result of results) {
        // Promise.allSettled: rejected promises are caught here, fulfilled ones carry our result
        if (result.status === 'rejected') {
          continue;
        }
        const value = result.value;
        if (value.status === 'not_found') {
          notFound.push(value.fullName);
        } else if (value.status === 'outdated') {
          outdated.push({
            owner: value.owner,
            name: value.name,
            currentVersion: value.currentVersion,
            latestVersion: value.latestVersion,
          });
        } else {
          upToDate.push(value.fullName);
        }
      }

      if (outdated.length > 0) {
        console.log(chalk.yellow('Updates available:\n'));

        // Calculate column widths
        const nameWidth = Math.max(
          'Package'.length,
          ...outdated.map((s) => `${s.owner}/${s.name}`.length)
        );
        const currentWidth = Math.max(
          'Current'.length,
          ...outdated.map((s) => s.currentVersion.length)
        );
        const latestWidth = Math.max(
          'Latest'.length,
          ...outdated.map((s) => s.latestVersion.length)
        );

        // Header
        console.log(
          chalk.gray(
            `${'Package'.padEnd(nameWidth)}  ${'Current'.padEnd(currentWidth)}  ${'Latest'.padEnd(latestWidth)}`
          )
        );
        console.log(chalk.gray('─'.repeat(nameWidth + currentWidth + latestWidth + 4)));

        // Rows
        for (const skill of outdated) {
          const fullName = `${skill.owner}/${skill.name}`;
          console.log(
            `${chalk.bold(fullName.padEnd(nameWidth))}  ${chalk.red(skill.currentVersion.padEnd(currentWidth))}  ${chalk.green(skill.latestVersion.padEnd(latestWidth))}`
          );
        }

        console.log('');
        console.log(chalk.gray(`Run ${chalk.cyan('tskills update')} to update all outdated skills.`));
        console.log(chalk.gray(`Or update a specific skill: ${chalk.cyan('tskills update owner/name')}`));
      } else {
        console.log(chalk.green('All installed skills are up to date.'));
      }

      if (upToDate.length > 0 && outdated.length > 0) {
        console.log('');
        console.log(chalk.gray(`${upToDate.length} skill(s) up to date.`));
      }

      if (notFound.length > 0) {
        console.log('');
        console.log(chalk.yellow('Could not check updates for:'));
        for (const name of notFound) {
          console.log(chalk.gray(`  - ${name} (not found in registry)`));
        }
      }

    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
