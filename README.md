<div align="center">

# 🔄 tskills

**A package manager for private team AI skills.**

Sync skills across Claude Code, Cursor, Copilot, and Windsurf with one command.

[![npm version](https://img.shields.io/npm/v/tskills.svg)](https://www.npmjs.com/package/tskills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

```bash
npx tskills setup    # Create GitHub repo + configure
npx tskills sync     # Sync skills to all your AI tools
```

## Why?

- **Public marketplaces** (Vercel Skills, etc.) are great, but you can't share proprietary team knowledge
- **Repo-specific skills** work, but don't scale across projects
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
ts add code-review

# Or import existing skills
ts import ~/.claude/skills --recursive
```

### 3. Share with your team

```bash
# Invite colleagues to the private repo
ts invite teammate-username

# Get the setup command to share
ts share --copy
```

### 4. Sync

```bash
ts sync                 # Sync to user-level (all projects)
ts sync --scope project # Sync to current project only
```

## Commands

| Command | Description |
|---------|-------------|
| `ts setup` | One-command setup: create GitHub repo, push, configure |
| `ts init` | Initialize a skills repo locally (without GitHub) |
| `ts add <name>` | Create a new skill from template |
| `ts import <path>` | Import existing SKILL.md files |
| `ts list` | List available skills |
| `ts sync` | Pull from remote and sync to all tools |
| `ts share` | Get shareable setup command for colleagues |
| `ts invite <user>` | Add GitHub collaborator to private repo |
| `ts config` | View/edit configuration |

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
ts config --repo <url>           # Set remote repo
ts config --default-scope user   # Set default scope
ts config --cursor false         # Disable Cursor sync
ts config --show                 # View current config
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
