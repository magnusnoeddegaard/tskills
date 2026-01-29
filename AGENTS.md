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

- `src/cli.ts` - Entry point, registers commands
- `src/commands/` - Each file is a CLI command
- `src/adapters/` - Tool-specific output adapters (Claude, Cursor, Windsurf)
- `src/lib/` - Shared utilities (config, git, skill parsing)
- `src/types.ts` - TypeScript interfaces

## Adding a New Command

1. Create `src/commands/mycommand.ts`
2. Export a Commander.js command
3. Import and register in `src/cli.ts`

## Adding a New Tool Adapter

1. Create `src/adapters/mytool.ts` extending `BaseAdapter`
2. Implement `getSkillPath()`, `transform()`, and optionally `write()`
3. Register in `src/adapters/index.ts`

## Testing

```bash
# Build first
npm run build

# Test commands locally
ts init
ts add test-skill
ts list
ts config --show
```

No automated test suite yet. Test manually before PRs.

## Code Style

- TypeScript strict mode
- ES modules (`import`/`export`)
- Async/await for all async operations
- Use `chalk` for colored terminal output
- Use `inquirer` for interactive prompts

## PR Checklist

Before submitting:
- [ ] `npm run build` passes
- [ ] Tested commands locally
- [ ] Updated README.md if adding/changing commands
- [ ] No secrets or credentials in code

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
