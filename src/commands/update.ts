import { Command } from 'commander';
import chalk from 'chalk';
import { getSkill, getSkillVersion } from '../lib/registry.js';
import {
  getInstalledSkills,
  getInstalledVersion,
  addInstalledSkill,
  saveSkillContent,
} from '../lib/manifest.js';
import { parseSkill } from '../lib/skill.js';
import { readConfig } from '../lib/config.js';
import { getEnabledAdapters } from '../adapters/index.js';
import { formatErrorForCLI } from '../lib/error-handler.js';
import { isVerbose } from '../cli.js';
import { validateSkillRef, validateScope } from '../lib/validation.js';
import type { Scope, InstalledSkill } from '../types.js';

interface UpdateResult {
  owner: string;
  name: string;
  oldVersion: string;
  newVersion: string;
  success: boolean;
  error?: string;
}

async function updateSkill(
  owner: string,
  name: string,
  currentVersion: string,
  targetVersion: string | null,
  scope: Scope,
  tools: Record<string, boolean>
): Promise<UpdateResult> {
  const fullName = `${owner}/${name}`;
  const result: UpdateResult = {
    owner,
    name,
    oldVersion: currentVersion,
    newVersion: targetVersion || 'unknown',
    success: false,
  };

  try {
    // Get the skill version content
    const skillVersion = await getSkillVersion(owner, name, targetVersion || undefined);

    if (!skillVersion) {
      result.error = 'Version not found';
      return result;
    }

    result.newVersion = skillVersion.version;

    // Save skill content to local registry directory
    const skillPath = await saveSkillContent(owner, name, skillVersion.content);

    // Parse the skill content
    const parsedSkill = parseSkill(skillVersion.content, skillPath);

    // Get enabled adapters
    const adapters = getEnabledAdapters(tools);
    const skillTools = parsedSkill.tools.map((t) => t.toLowerCase());

    // Sync to enabled tools
    for (const adapter of adapters) {
      if (!skillTools.includes(adapter.name) && !skillTools.includes('all')) {
        continue;
      }
      await adapter.write(parsedSkill, scope);
    }

    // Update manifest
    await addInstalledSkill(owner, name, skillVersion.version);

    result.success = true;
    return result;
  } catch (error) {
    result.error = (error as Error).message;
    return result;
  }
}

export const updateCommand = new Command('update')
  .description('Update installed skills to the latest version')
  .argument('[skill]', 'Skill to update (format: owner/name). If omitted, updates all outdated skills.')
  .option('-s, --scope <scope>', 'Update scope: "user" (global) or "project" (current directory)')
  .option('-f, --force', 'Force update even if already at latest version')
  .action(async (skillArg: string | undefined, options) => {
    try {
      const config = await readConfig();
      const scope: Scope = validateScope(options.scope || config.defaults?.scope || 'user');
      const tools = config.tools || { claude: true, cursor: true, copilot: true, windsurf: false };

      // If specific skill provided, update only that one
      if (skillArg) {
        // Parse and validate skill argument
        const { owner, name } = validateSkillRef(skillArg);
        const fullName = `${owner}/${name}`;

        // Check if installed
        const currentVersion = await getInstalledVersion(owner, name);
        if (!currentVersion) {
          console.error(chalk.red(`Skill not installed: ${fullName}`));
          console.log(chalk.gray(`Install it with: tskills install ${fullName}`));
          process.exit(1);
        }

        // Get remote info
        const remote = await getSkill(owner, name);
        if (!remote) {
          console.error(chalk.red(`Skill not found in registry: ${fullName}`));
          process.exit(1);
        }

        if (!remote.latest_version) {
          console.error(chalk.red(`No versions available for ${fullName}`));
          process.exit(1);
        }

        // Check if update needed
        if (currentVersion === remote.latest_version && !options.force) {
          console.log(chalk.green(`${fullName} is already at the latest version (${currentVersion}).`));
          return;
        }

        console.log(chalk.cyan(`Updating ${chalk.bold(fullName)}...`));

        const result = await updateSkill(owner, name, currentVersion, remote.latest_version, scope, tools);

        if (result.success) {
          console.log(chalk.green(`\nUpdated ${chalk.bold(fullName)}: ${result.oldVersion} → ${result.newVersion}`));
        } else {
          console.error(chalk.red(`\nFailed to update ${fullName}: ${result.error}`));
          process.exit(1);
        }

        return;
      }

      // No skill specified - update all outdated
      const installed = await getInstalledSkills();

      if (installed.length === 0) {
        console.log(chalk.yellow('No skills installed.'));
        return;
      }

      console.log(chalk.cyan('Checking for updates...\n'));

      // Find outdated skills
      const toUpdate: Array<{ skill: InstalledSkill; latestVersion: string }> = [];

      for (const skill of installed) {
        const fullName = `${skill.owner}/${skill.name}`;

        try {
          const remote = await getSkill(skill.owner, skill.name);

          if (!remote || !remote.latest_version) {
            continue;
          }

          if (remote.latest_version !== skill.version || options.force) {
            toUpdate.push({ skill, latestVersion: remote.latest_version });
          }
        } catch {
          console.log(chalk.yellow(`Could not check ${fullName}`));
        }
      }

      if (toUpdate.length === 0) {
        console.log(chalk.green('All skills are up to date.'));
        return;
      }

      console.log(chalk.yellow(`Found ${toUpdate.length} skill(s) to update.\n`));

      const results: UpdateResult[] = [];

      for (const { skill, latestVersion } of toUpdate) {
        const fullName = `${skill.owner}/${skill.name}`;
        console.log(chalk.gray(`Updating ${fullName}...`));

        const result = await updateSkill(
          skill.owner,
          skill.name,
          skill.version,
          latestVersion,
          scope,
          tools
        );

        results.push(result);

        if (result.success) {
          console.log(chalk.green(`  ${result.oldVersion} → ${result.newVersion}`));
        } else {
          console.log(chalk.red(`  Failed: ${result.error}`));
        }
      }

      // Summary
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      console.log('');
      if (successful.length > 0) {
        console.log(chalk.green(`Updated ${successful.length} skill(s).`));
      }
      if (failed.length > 0) {
        console.log(chalk.red(`Failed to update ${failed.length} skill(s).`));
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red(formatErrorForCLI(error as Error, isVerbose())));
      process.exit(1);
    }
  });
