# tskills

A package manager for AI skills. Publish, discover, and install skills across Claude Code, Cursor, Copilot, and Windsurf. Backed by a Supabase registry with GitHub OAuth, organizations, teams, and semantic versioning.

## Project Structure

```
src/
├── cli.ts                  # Entry point, registers all commands
├── types.ts                # TypeScript interfaces (Skill, Registry, Org, Team types)
├── commands/               # CLI commands
│   ├── setup.ts            # One-command GitHub repo setup (legacy)
│   ├── init.ts             # Initialize skills directory (legacy)
│   ├── add.ts              # Create new skill from template
│   ├── import.ts           # Import existing SKILL.md files
│   ├── list.ts             # List discovered skills
│   ├── sync.ts             # Pull from remote and sync to tools
│   ├── share.ts            # Generate share command + invite collaborators (legacy)
│   ├── config.ts           # View/edit configuration
│   ├── login.ts            # GitHub OAuth login (opens browser, local callback server)
│   ├── logout.ts           # Sign out and clear credentials
│   ├── whoami.ts           # Display current user
│   ├── publish.ts          # Publish skill to registry (versioning, visibility, org/team)
│   ├── install.ts          # Install skill from registry and sync to tools
│   ├── uninstall.ts        # Remove installed skill from tools and cache
│   ├── search.ts           # Search registry (query, tags, tools filters)
│   ├── info.ts             # Show detailed skill info and version history
│   ├── outdated.ts         # Check installed skills for available updates
│   ├── update.ts           # Update installed skills to latest version
│   ├── deprecate.ts        # Mark/unmark skill as deprecated
│   ├── org.ts              # Organization management (create, list, info, add, remove, delete)
│   └── team.ts             # Team management (create, list, info, add, remove, delete)
├── adapters/               # Tool-specific output adapters
│   ├── types.ts            # ToolAdapter interface
│   ├── claude.ts           # Claude Code + Copilot (shared location)
│   ├── cursor.ts           # Cursor (.mdc format)
│   └── windsurf.ts         # Windsurf (.windsurfrules)
└── lib/                    # Core utilities
    ├── config.ts           # Read/write ~/.tskills/config.toml
    ├── discover.ts         # Auto-discover SKILL.md files
    ├── git.ts              # Clone/pull operations (uses gh CLI)
    ├── skill.ts            # Parse SKILL.md with YAML frontmatter
    ├── credentials.ts      # Save/load/clear auth tokens (~/.tskills/credentials.json)
    ├── errors.ts           # Custom error classes (Auth, Network, Validation, RateLimit, etc.)
    ├── error-handler.ts    # Map Supabase/Postgres/FS errors to custom errors
    ├── manifest.ts         # Track installed skills (~/.tskills/installed.json)
    ├── registry.ts         # Supabase client + full registry API (skills, orgs, teams, rate limits)
    ├── registry-config.ts  # Dynamic registry config with remote fetch + caching
    ├── retry.ts            # Retry with exponential backoff and jitter
    └── validation.ts       # Input validation (skill names, semver, org/team slugs, etc.)

supabase/
├── config.toml             # Supabase project configuration
└── migrations/             # 14 SQL migrations (schema, RLS, functions, fixes)
```

## Key Commands

- `tskills` or `ts` — both work as CLI entry points
- Config stored at `~/.tskills/config.toml`
- Credentials stored at `~/.tskills/credentials.json`
- Installed skills manifest at `~/.tskills/installed.json`
- Registry skill cache at `~/.tskills/registry/`
- Git-based skills cached at `~/.tskills/cache/`

## Tech Stack

- TypeScript with ES modules
- Commander.js for CLI
- @supabase/supabase-js for registry backend
- gray-matter for YAML frontmatter parsing
- smol-toml for config files
- semver for semantic versioning
- open for launching browser (OAuth flow)
- inquirer for interactive prompts
- chalk for terminal colors

## Backend

- Supabase (Postgres + Auth + Storage)
- GitHub OAuth for authentication
- Row Level Security (RLS) for visibility control
- Rate limiting (60/hr anon, 1000/hr auth for API; 30/hr for publish)
- Atomic operations for org creation and version tracking

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
