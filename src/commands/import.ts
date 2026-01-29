import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { parseSkill } from '../lib/skill.js';
import { skillExists } from '../lib/discover.js';

export const importCommand = new Command('import')
  .description('Import existing skills into the repository')
  .argument('<source>', 'Path to SKILL.md file or directory containing skills')
  .option('-d, --dir <directory>', 'Target skills directory (default: ./skills)')
  .option('-r, --recursive', 'Recursively search for SKILL.md files in subdirectories')
  .action(async (source, options) => {
    try {
      const skillsDir = options.dir ? path.resolve(options.dir) : path.join(process.cwd(), 'skills');
      const sourcePath = path.resolve(source);

      // Ensure skills directory exists
      await fs.mkdir(skillsDir, { recursive: true });

      const stat = await fs.stat(sourcePath);
      const imported: string[] = [];
      const skipped: string[] = [];
      const errors: string[] = [];

      if (stat.isFile()) {
        // Import single file
        const result = await importSkillFile(sourcePath, skillsDir);
        if (result.success) {
          imported.push(result.name!);
        } else if (result.skipped) {
          skipped.push(result.name!);
        } else {
          errors.push(result.error!);
        }
      } else if (stat.isDirectory()) {
        // Import from directory
        const files = await findSkillFiles(sourcePath, options.recursive);

        for (const file of files) {
          const result = await importSkillFile(file, skillsDir);
          if (result.success) {
            imported.push(result.name!);
          } else if (result.skipped) {
            skipped.push(result.name!);
          } else {
            errors.push(`${file}: ${result.error}`);
          }
        }
      }

      // Report results
      console.log('');
      if (imported.length > 0) {
        console.log(chalk.green(`Imported ${imported.length} skill(s):`));
        imported.forEach(name => console.log(chalk.gray(`  - ${name}`)));
      }

      if (skipped.length > 0) {
        console.log(chalk.yellow(`\nSkipped ${skipped.length} skill(s) (already exist):`));
        skipped.forEach(name => console.log(chalk.gray(`  - ${name}`)));
      }

      if (errors.length > 0) {
        console.log(chalk.red(`\nFailed to import ${errors.length} file(s):`));
        errors.forEach(err => console.log(chalk.gray(`  - ${err}`)));
      }

      if (imported.length === 0 && skipped.length === 0 && errors.length === 0) {
        console.log(chalk.yellow('No SKILL.md files found to import.'));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

interface ImportResult {
  success?: boolean;
  skipped?: boolean;
  name?: string;
  error?: string;
}

async function importSkillFile(sourcePath: string, skillsDir: string): Promise<ImportResult> {
  try {
    const content = await fs.readFile(sourcePath, 'utf-8');
    const skill = parseSkill(content, sourcePath);

    // Check if skill already exists
    if (await skillExists(skillsDir, skill.name)) {
      return { skipped: true, name: skill.name };
    }

    // Create skill directory and copy file
    const targetDir = path.join(skillsDir, skill.name);
    const targetFile = path.join(targetDir, 'SKILL.md');

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetFile, content, 'utf-8');

    return { success: true, name: skill.name };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

async function findSkillFiles(dir: string, recursive: boolean = false): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name === 'SKILL.md') {
      files.push(fullPath);
    } else if (entry.isDirectory() && recursive) {
      const subFiles = await findSkillFiles(fullPath, true);
      files.push(...subFiles);
    } else if (entry.isDirectory()) {
      // Check immediate subdirectory for SKILL.md
      const skillFile = path.join(fullPath, 'SKILL.md');
      try {
        await fs.access(skillFile);
        files.push(skillFile);
      } catch {
        // No SKILL.md in this directory
      }
    }
  }

  return files;
}
