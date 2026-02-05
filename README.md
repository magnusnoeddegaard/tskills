<div align="center">

# 🔄 tskills

**A package manager for AI skills.**

Publish, discover, and install AI skills across Claude Code, Cursor, Copilot, and Windsurf.

[![npm version](https://img.shields.io/npm/v/tskills.svg)](https://www.npmjs.com/package/tskills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

```bash
npm install -g tskills

tskills login              # Authenticate with GitHub
tskills search "deploy"    # Find skills
tskills install acme/skill # Install to all your AI tools
```

## Why?

- **Share team knowledge** — publish proprietary skills to your organization, not a public marketplace
- **Works everywhere** — one install syncs to Claude Code, Cursor, Copilot, and Windsurf
- **Versioned & managed** — semantic versioning, updates, deprecation, just like npm

---

## Quick Start

### 1. Install & Login

```bash
npm install -g tskills
tskills login
```

### 2. Search & Install

```bash
# Search for skills
tskills search "code review"

# Install a skill (syncs to all your AI tools automatically)
tskills install acme/deploy-checklist

# Install a specific version
tskills install acme/deploy-checklist@1.2.0
```

### 3. Publish Your Own

Create a `SKILL.md` with YAML frontmatter:

```markdown
---
name: code-review
description: Reviews code for our team's standards
tools: [claude, cursor]
tags: [code-review, best-practices]
---

# Code Review Guidelines

When reviewing code, check for:
- Our naming conventions
- Error handling patterns
- Test coverage requirements
```

Then publish:

```bash
tskills publish ./SKILL.md
```

### 4. Keep Skills Updated

```bash
tskills outdated           # Check for updates
tskills update             # Update all skills
```

---

## Registry Commands

| Command | Description |
|---------|-------------|
| `tskills login` | Authenticate via GitHub |
| `tskills logout` | Sign out |
| `tskills whoami` | Show current user |
| `tskills publish <path>` | Publish skill to registry |
| `tskills install <owner/name>` | Install from registry |
| `tskills uninstall <owner/name>` | Remove a skill |
| `tskills search [query]` | Search for skills |
| `tskills info <owner/name>` | View skill details |
| `tskills outdated` | Check for updates |
| `tskills update [owner/name]` | Update installed skills |
| `tskills deprecate <owner/name>` | Mark skill as deprecated |

### Organizations & Teams

| Command | Description |
|---------|-------------|
| `tskills org create <slug>` | Create an organization |
| `tskills org list` | List your organizations |
| `tskills org info <slug>` | View organization details |
| `tskills org add <slug> <user>` | Add member to organization |
| `tskills org remove <slug> <user>` | Remove member |
| `tskills org delete <slug>` | Delete organization |
| `tskills team create <org>/<team>` | Create a team |
| `tskills team list <org>` | List teams in organization |
| `tskills team info <org>/<team>` | View team details |
| `tskills team add <org>/<team> <user>` | Add member to team |
| `tskills team remove <org>/<team> <user>` | Remove member |
| `tskills team delete <org>/<team>` | Delete team |

Share private skills within your company:

```bash
# Create an organization
tskills org create acme --name "Acme Corp"

# Add team members
tskills org add acme @colleague

# Publish org-private skill
tskills publish ./SKILL.md --org acme --visibility org

# Publish team-restricted skill
tskills publish ./SKILL.md --org acme --team engineering --visibility team
```

### Visibility Levels

| Visibility | Who can access |
|------------|----------------|
| `public` | Anyone (default) |
| `private` | Only you |
| `org` | All members of your organization |
| `team` | Only members of a specific team |

---

## Git-Based Sync (Legacy)

tskills also supports syncing skills from a private Git repository — useful if you prefer managing skills in a repo rather than the registry.

| Command | Description |
|---------|-------------|
| `tskills setup` | Create GitHub repo + configure |
| `tskills init` | Initialize a skills repo locally |
| `tskills add <name>` | Create a new skill from template |
| `tskills import <path>` | Import existing SKILL.md files |
| `tskills list` | List available skills |
| `tskills sync` | Pull from remote and sync to tools |
| `tskills share` | Get shareable setup command |
| `tskills invite <user>` | Add GitHub collaborator |
| `tskills config` | View/edit configuration |

```bash
npx tskills setup --name my-team-skills   # Create repo
npx tskills sync                           # Sync to tools
```

> **Tip:** `ts` is a built-in alias for `tskills`

---

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
tskills config --repo <url>           # Set remote repo
tskills config --default-scope user   # Set default scope
tskills config --cursor false         # Disable Cursor sync
tskills config --show                 # View current config
```

## Requirements

- **Node.js** 18+
- **GitHub account** — for registry authentication
- **GitHub CLI** (`gh`) — only needed for legacy `setup`, `share`, and `invite` commands
  - Install: https://cli.github.com
  - Authenticate: `gh auth login`

## Documentation

- [Registry User Guide](docs/registry-guide.md) — complete guide to using the registry
- [CLI Reference](docs/cli-reference.md) — all commands and options
- [Troubleshooting](docs/troubleshooting.md) — common issues and solutions

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

## License

[MIT](LICENSE)
