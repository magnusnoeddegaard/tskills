# skillsync

Sync private team AI skills across multiple tools (Claude Code, Cursor, Copilot, Windsurf).

```bash
npx skillsync setup    # Create GitHub repo + configure
npx skillsync sync     # Sync skills to all your AI tools
```

## Why?

- **Public marketplaces** (Vercel Skills, etc.) are great, but you can't share proprietary team knowledge
- **Repo-specific skills** work, but don't scale across projects
- **skillsync** lets you maintain a private library of team skills and sync them everywhere

## Quick Start

### 1. Setup (one-time)

```bash
# Creates a private GitHub repo and configures everything
npx skillsync setup --name my-team-skills
```

### 2. Add skills

```bash
# Create a new skill
ss add code-review

# Or import existing skills
ss import ~/.claude/skills --recursive
```

### 3. Share with your team

```bash
# Invite colleagues to the private repo
ss invite teammate-username

# Get the setup command to share
ss share --copy
```

### 4. Sync

```bash
ss sync                 # Sync to user-level (all projects)
ss sync --scope project # Sync to current project only
```

## Commands

| Command | Description |
|---------|-------------|
| `ss setup` | One-command setup: create GitHub repo, push, configure |
| `ss init` | Initialize a skills repo locally (without GitHub) |
| `ss add <name>` | Create a new skill from template |
| `ss import <path>` | Import existing SKILL.md files |
| `ss list` | List available skills |
| `ss sync` | Pull from remote and sync to all tools |
| `ss share` | Get shareable setup command for colleagues |
| `ss invite <user>` | Add GitHub collaborator to private repo |
| `ss config` | View/edit configuration |

> **Tip:** `ss` is a built-in alias for `skillsync`

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

Config is stored in `~/.skillsync/config.toml`:

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
ss config --repo <url>           # Set remote repo
ss config --default-scope user   # Set default scope
ss config --cursor false         # Disable Cursor sync
ss config --show                 # View current config
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
