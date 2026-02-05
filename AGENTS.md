# AGENTS.md

Instructions for AI coding agents working on this project.

## Dev Environment

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Link for local testing
npm link
```

After linking, test with:
```bash
tskills --help
ts --help
```

## Project Structure

- `src/cli.ts` - Entry point, registers all commands (local + registry + org/team)
- `src/types.ts` - TypeScript interfaces for skills, registry, orgs, teams, auth
- `src/commands/` - Each file is a CLI command:
  - **Registry:** `login`, `logout`, `whoami`, `publish`, `install`, `uninstall`, `search`, `info`, `outdated`, `update`, `deprecate`
  - **Organizations/Teams:** `org` (subcommands: create, list, info, add, remove, delete), `team` (same subcommands)
  - **Local/Legacy:** `setup`, `init`, `add`, `import`, `list`, `sync`, `share`, `config`
- `src/adapters/` - Tool-specific output adapters (Claude, Cursor, Windsurf)
- `src/lib/` - Shared utilities:
  - `config.ts` - Read/write `~/.tskills/config.toml`
  - `discover.ts` - Auto-discover SKILL.md files
  - `git.ts` - Clone/pull operations
  - `skill.ts` - Parse SKILL.md with YAML frontmatter
  - `credentials.ts` - Auth token storage (`~/.tskills/credentials.json`)
  - `errors.ts` - Custom error classes (Auth, Network, Validation, RateLimit, Permission, etc.)
  - `error-handler.ts` - Maps Supabase/Postgres/FS errors to custom errors
  - `manifest.ts` - Tracks installed skills (`~/.tskills/installed.json`)
  - `registry.ts` - Supabase client + full registry API (~1000 lines)
  - `registry-config.ts` - Dynamic registry config with remote fetch + caching
  - `retry.ts` - Retry with exponential backoff and jitter
  - `validation.ts` - Input validation (skill names, semver, slugs, usernames)
- `supabase/` - Supabase project config and 14 SQL migrations

## Backend (Supabase)

The registry backend is a Supabase project with:
- **Postgres tables:** users, skills, skill_versions, organizations, org_members, teams, team_members, rate_limits
- **Row Level Security (RLS):** visibility-based access control (public/private/org/team)
- **RPC functions:** `check_rate_limit`, `increment_downloads`, `create_org_with_owner`
- **GitHub OAuth** for authentication

Migrations are in `supabase/migrations/`. Apply with `supabase db push`.

## Adding a New Command

1. Create `src/commands/mycommand.ts`
2. Export a Commander.js command
3. Import and register in `src/cli.ts`

## Adding a New Tool Adapter

1. Create `src/adapters/mytool.ts` implementing the `ToolAdapter` interface from `src/adapters/types.ts`
2. Implement `getSkillPath()`, `transform()`, `write()`, and `remove()`
3. Register in `src/adapters/index.ts`

## Testing

```bash
# Build first
npm run build

# Test local commands
ts init
ts add test-skill
ts list
ts config --show

# Test registry commands (requires login)
tskills login
tskills search "test"
tskills whoami
tskills logout

# Test with verbose output
tskills search "test" --verbose
```

No automated test suite yet. Test manually before PRs.

## Code Style

- TypeScript strict mode
- ES modules (`import`/`export`)
- Async/await for all async operations
- Use `chalk` for colored terminal output
- Use `inquirer` for interactive prompts
- Custom error classes from `src/lib/errors.ts` for typed error handling
- Use `withErrorHandling()` wrapper from `src/lib/error-handler.ts` for command error handling
- Use `withRetry()` from `src/lib/retry.ts` for retryable operations
- Use validation functions from `src/lib/validation.ts` for user input

## PR Checklist

Before submitting:
- [ ] `npm run build` passes
- [ ] Tested commands locally
- [ ] Updated README.md if adding/changing commands
- [ ] No secrets or credentials in code
- [ ] New Supabase migrations added if schema changed

## Common Tasks

**Bump version:**
```bash
npm version patch  # or minor/major
```

**Publish to npm:**
```bash
npm publish  # requires 2FA
```

**Check what's published:**
```bash
npm view tskills
```

**Apply database migrations:**
```bash
supabase db push
```
