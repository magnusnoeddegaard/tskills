# tskills

Sync private team AI skills acrotsmultiple tools (Claude Code, Cursor, Copilot, Windsurf).

```bash
npx tskills setup    # Create GitHub repo + configure
npx tskills sync     # Sync skills to all your AI tools
```

## Why?

- **Public marketplaces** (Vercel Skills, etc.) are great, but you can't share proprietary team knowledge
- **Repo-specific skills** work, but don't scale acrotsprojects
- **tskills** lets you maintain a private library of team skills and sync them everywhere

## Quick Start

### 1. Setup (one-time)

```bash
# Creates a private GitHub repo and configures everything
npx tskills setup --name my-team-skills
```

### 2. Add skills

```bash
# Create a new skill
tsadd code-review

# Or import existing skills
tsimport ~/.claude/skills --recursive
```

### 3. Share with your team

```bash
# Invite colleagues to the private repo
tsinvite teammate-username

# Get the setup command to share
tsshare --copy
```

### 4. Sync

```bash
tssync                 # Sync to user-level (all projects)
tssync --scope project # Sync to current project only
```

## Commands

| Command | Description |
|---------|-------------|
| `tssetup` | One-command setup: create GitHub repo, push, configure |
| `tsinit` | Initialize a skills repo locally (without GitHub) |
| `tsadd <name>` | Create a new skill from template |
| `tsimport <path>` | Import existing SKILL.md files |
| `tslist` | List available skills |
| `tssync` | Pull from remote and sync to all tools |
| `tsshare` | Get shareable setup command for colleagues |
| `tsinvite <user>` | Add GitHub collaborator to private repo |
| `tsconfig` | View/edit configuration |

> **Tip:** `ts` is a built-in alias for `tskills`

## Skill Format

Skills are simple Markdown files with YAML frontmatter:

```markdown
---
name: code-review
description: Reviews code for our team's standards
---

# Code Review Guidelines

When reviewing code, check for:
- Our naming conventions
- Error handling patterns
- Test coverage requirements
```

## Where Skills Are Synced

| Tool | User Scope | Project Scope |
|------|------------|---------------|
| Claude Code | `~/.claude/skills/` | `./.claude/skills/` |
| GitHub Copilot | `~/.claude/skills/` | `./.claude/skills/` |
| Cursor | `~/.cursor/rules/` | `./.cursor/rules/` |
| Windsurf | `~/.windsurfrules` | `./.windsurfrules` |

## Configuration

Config is stored in `~/.tskills/config.toml`:

```toml
[remote]
url = "https://github.com/your-org/team-skills.git"
branch = "main"

[defaults]
scope = "user"

[tools]
claude = true
cursor = true
copilot = true
windsurf = false
```

Edit with:

```bash
tsconfig --repo <url>           # Set remote repo
tsconfig --default-scope user   # Set default scope
tsconfig --cursor false         # Disable Cursor sync
tsconfig --show                 # View current config
```

## Requirements

- **Node.js** 18+
- **GitHub CLI** (`gh`) - for `setup`, `share`, and `invite` commands
  - Install: https://cli.github.com
  - Authenticate: `gh auth login`

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

## License

[MIT](LICENSE)
