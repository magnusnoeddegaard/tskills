import { Command } from 'commander';
import { configCommand } from './commands/config.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { importCommand } from './commands/import.js';
import { listCommand } from './commands/list.js';
import { syncCommand } from './commands/sync.js';
import { setupCommand } from './commands/setup.js';
import { shareCommand, inviteCommand } from './commands/share.js';

const program = new Command();

program
  .name('skillsync')
  .description('Sync private team AI skills across multiple tools')
  .version('0.1.0');

program.addCommand(setupCommand);   // One-command setup
program.addCommand(initCommand);    // Manual init
program.addCommand(addCommand);     // Create new skill
program.addCommand(importCommand);  // Import existing skills
program.addCommand(listCommand);    // List skills
program.addCommand(syncCommand);    // Sync to tools
program.addCommand(shareCommand);   // Share with colleagues
program.addCommand(inviteCommand);  // Invite collaborator
program.addCommand(configCommand);  // Configure settings

program.parse();
