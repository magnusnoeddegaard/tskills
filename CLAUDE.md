# tskills

A CLI tool for syncing private team AI skills across multiple tools (Claude Code, Cursor, Copilot, Windsurf).

## Project Structure

```
src/
├── cli.ts              # Entry point, registers all commands
├── types.ts            # TypeScript interfaces
├── commands/           # CLI commands
│   ├── setup.ts        # One-command GitHub repo setup
│   ├── init.ts         # Initialize skills directory
│   ├── add.ts          # Create new skill from template
│   ├── import.ts       # Import existing SKILL.md files
│   ├── list.ts         # List discovered skills
│   ├── sync.ts         # Pull from remote and sync to tools
│   ├── share.ts        # Generate share command + invite collaborators
│   └── config.ts       # View/edit configuration
├── adapters/           # Tool-specific adapters
│   ├── claude.ts       # Claude Code + Copilot (shared location)
│   ├── cursor.ts       # Cursor (.mdc format)
│   └── windsurf.ts     # Windsurf (.windsurfrules)
└── lib/                # Core utilities
    ├── config.ts       # Read/write ~/.tskills/config.toml
    ├── discover.ts     # Auto-discover SKILL.md files
    ├── git.ts          # Clone/pull operations (uses gh CLI)
    └── skill.ts        # Parse SKILL.md with YAML frontmatter
```

## Key Commands

- `tskills` or `ts` - Both work as CLI entry points
- Config stored at `~/.tskills/config.toml`
- Skills cached at `~/.tskills/cache/`

## Tech Stack

- TypeScript with ES modules
- Commander.js for CLI
- gray-matter for YAML frontmatter parsing
- smol-toml for config files
- inquirer for interactive prompts
- chalk for terminal colors

## Development

```bash
npm install
npm run build      # Compile TypeScript
npm run dev        # Watch mode
npm link           # Link for local testing
```

## Publishing

Manual publish with 2FA:
```bash
npm version patch
# Create PR, merge, then:
npm publish
```
