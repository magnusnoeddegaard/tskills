import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getSkillTemplate } from '../lib/skill.js';
import { skillExists } from '../lib/discover.js';
import { validateSkillName, SKILL_NAME_REGEX } from '../lib/validation.js';

export const addCommand = new Command('add')
  .description('Add a new skill to the repository')
  .argument('[name]', 'Name of the skill')
  .option('-d, --dir <directory>', 'Skills directory (default: ./skills)')
  .action(async (name, options) => {
    try {
      const skillsDir = options.dir ? path.resolve(options.dir) : path.join(process.cwd(), 'skills');

      // Ensure skills directory exists
      try {
        await fs.access(skillsDir);
      } catch {
        console.error(chalk.red('Error: Skills directory not found. Run "skillsync init" first.'));
        process.exit(1);
      }

      // Get skill name if not provided
      let skillName = name;
      if (!skillName) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Skill name (lowercase, hyphens only):',
            validate: (input: string) => {
              if (!input) return 'Name is required';
              if (!SKILL_NAME_REGEX.test(input)) {
                return 'Name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens';
              }
              return true;
            },
          },
        ]);
        skillName = answers.name;
      }

      // Validate name format
      validateSkillName(skillName);

      // Check if skill already exists
      if (await skillExists(skillsDir, skillName)) {
        console.error(chalk.red(`Error: Skill "${skillName}" already exists`));
        process.exit(1);
      }

      // Create skill directory and file
      const skillDir = path.join(skillsDir, skillName);
      const skillFile = path.join(skillDir, 'SKILL.md');

      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(skillFile, getSkillTemplate(skillName), 'utf-8');

      console.log(chalk.green(`Created skill: ${skillName}`));
      console.log(chalk.gray(`  ${skillFile}`));
      console.log(chalk.cyan('\nEdit the SKILL.md file to add your skill instructions.'));
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });
