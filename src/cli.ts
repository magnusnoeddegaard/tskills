import { createRequire } from 'module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
import { configCommand } from './commands/config.js';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { importCommand } from './commands/import.js';
import { listCommand } from './commands/list.js';
import { syncCommand } from './commands/sync.js';
import { setupCommand } from './commands/setup.js';
import { shareCommand, inviteCommand } from './commands/share.js';
// Registry commands
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { whoamiCommand } from './commands/whoami.js';
import { publishCommand } from './commands/publish.js';
import { installCommand } from './commands/install.js';
import { searchCommand } from './commands/search.js';
import { infoCommand } from './commands/info.js';
import { outdatedCommand } from './commands/outdated.js';
import { updateCommand } from './commands/update.js';
import { uninstallCommand } from './commands/uninstall.js';
import { deprecateCommand } from './commands/deprecate.js';
// Organization and team commands
import { orgCommand } from './commands/org.js';
import { teamCommand } from './commands/team.js';

const program = new Command();

program
  .name('tskills')
  .description('Sync private team AI skills across multiple tools')
  .version(pkg.version)
  .option('-v, --verbose', 'Show detailed error information');

/**
 * Check if verbose mode is enabled (global flag)
 */
export function isVerbose(): boolean {
  const opts = program.opts();
  return opts.verbose === true;
}

program.addCommand(setupCommand);   // One-command setup
program.addCommand(initCommand);    // Manual init
program.addCommand(addCommand);     // Create new skill
program.addCommand(importCommand);  // Import existing skills
program.addCommand(listCommand);    // List skills
program.addCommand(syncCommand);    // Sync to tools
program.addCommand(shareCommand);   // Share with colleagues
program.addCommand(inviteCommand);  // Invite collaborator
program.addCommand(configCommand);  // Configure settings

// Registry commands
program.addCommand(loginCommand);   // Login to registry
program.addCommand(logoutCommand);  // Logout from registry
program.addCommand(whoamiCommand);  // Show current user
program.addCommand(publishCommand); // Publish skill to registry
program.addCommand(installCommand); // Install skill from registry
program.addCommand(uninstallCommand); // Uninstall skill
program.addCommand(searchCommand);  // Search registry
program.addCommand(infoCommand);    // Show skill info
program.addCommand(outdatedCommand); // Check for updates
program.addCommand(updateCommand);  // Update installed skills
program.addCommand(deprecateCommand); // Deprecate skills

// Organization and team commands
program.addCommand(orgCommand);     // Organization management
program.addCommand(teamCommand);    // Team management

program.parse();
