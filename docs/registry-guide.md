# tskills Registry User Guide

The tskills Registry is a central hub for publishing, discovering, and installing AI agent skills. Think of it as "npm for AI skills" - you can publish your skills for others to use, install skills from the community, and manage private skills within your organization.

## Table of Contents

- [Getting Started](#getting-started)
- [Publishing Skills](#publishing-skills)
- [Installing Skills](#installing-skills)
- [Managing Installed Skills](#managing-installed-skills)
- [Organizations and Teams](#organizations-and-teams)
- [Skill Deprecation](#skill-deprecation)

---

## Getting Started

### Prerequisites

- **Node.js 18+** - Required to run tskills
- **GitHub account** - Used for authentication

### Installation

```bash
npm install -g tskills
```

### Authentication

The registry uses GitHub OAuth for authentication. No passwords to remember - just use your GitHub account.

```bash
# Login (opens browser for GitHub authentication)
tskills login

# Check who you're logged in as
tskills whoami

# Logout when done
tskills logout
```

When you run `tskills login`, your browser opens to GitHub. After authorizing, you'll be automatically logged in. Your credentials are stored locally at `~/.tskills/credentials.json`.

---

## Publishing Skills

### Your First Publish

1. Create a skill file with YAML frontmatter:

```markdown
---
name: my-code-review
description: Code review checklist for our team
tools: [claude, cursor]
tags: [code-review, best-practices]
---

# Code Review Checklist

When reviewing code, check for:
- Naming conventions
- Error handling
- Test coverage
```

2. Publish it:

```bash
tskills publish ./SKILL.md
```

Your skill is now available at `yourusername/my-code-review`.

### Versioning

Skills use semantic versioning (semver). By default, tskills auto-increments the patch version:

```bash
# First publish: 1.0.0
tskills publish ./SKILL.md

# Next publish: 1.0.1 (auto-incremented)
tskills publish ./SKILL.md

# Specify a version explicitly
tskills publish ./SKILL.md --version 2.0.0
```

### Visibility Levels

| Visibility | Who can access |
|------------|----------------|
| `public` | Anyone (default for personal skills) |
| `private` | Only you |
| `org` | All members of your organization |
| `team` | Only members of a specific team |

```bash
# Public skill (default)
tskills publish ./SKILL.md

# Private skill
tskills publish ./SKILL.md --visibility private

# Organization skill (visible to all org members)
tskills publish ./SKILL.md --org acme --visibility org

# Team-restricted skill
tskills publish ./SKILL.md --org acme --team engineering --visibility team
```

### Skill Requirements

Your `SKILL.md` must include:

- **name** (required): Lowercase letters, numbers, and hyphens. Max 64 characters.
- **description** (required): What the skill does. Max 500 characters.
- **tools** (optional): Which AI tools support this skill (`claude`, `cursor`, `copilot`, `windsurf`, or `all`)
- **tags** (optional): Keywords for discovery

---

## Installing Skills

### Basic Installation

```bash
# Install the latest version
tskills install owner/skill-name

# Install a specific version
tskills install owner/skill-name@1.2.0

# Force reinstall
tskills install owner/skill-name --force
```

### Installation Scope

Skills can be installed at two levels:

| Scope | Location | Use case |
|-------|----------|----------|
| `user` | `~/.tskills/` | Available in all projects |
| `project` | `./.tskills/` | Only in current project |

```bash
# Install globally (default)
tskills install owner/skill-name

# Install for current project only
tskills install owner/skill-name --scope project
```

### Where Skills Are Synced

After installation, skills are automatically synced to your AI tools:

| Tool | User Scope | Project Scope |
|------|------------|---------------|
| Claude Code | `~/.claude/skills/` | `./.claude/skills/` |
| Cursor | `~/.cursor/rules/` | `./.cursor/rules/` |
| Copilot | `~/.claude/skills/` | `./.claude/skills/` |
| Windsurf | `~/.windsurfrules` | `./.windsurfrules` |

---

## Managing Installed Skills

### List Installed Skills

```bash
tskills list
```

### Search the Registry

```bash
# Search by keyword
tskills search "code review"

# Filter by tags
tskills search --tags testing,automation

# Filter by supported tools
tskills search --tools cursor

# Limit results
tskills search "deploy" --limit 10
```

### View Skill Details

```bash
tskills info owner/skill-name
```

Shows:
- Description
- Visibility level
- Latest version
- Download count
- All available versions
- Installation status
- Deprecation warnings (if any)

### Check for Updates

```bash
tskills outdated
```

Output shows which installed skills have newer versions available:

```
Updates available:

Package              Current  Latest
────────────────────────────────────
acme/deploy-check    1.0.0    1.2.0
johndoe/code-review  2.0.0    2.1.0
```

### Update Skills

```bash
# Update all outdated skills
tskills update

# Update a specific skill
tskills update owner/skill-name

# Force update (even if current)
tskills update owner/skill-name --force
```

### Uninstall Skills

```bash
# Uninstall (prompts for confirmation)
tskills uninstall owner/skill-name

# Skip confirmation
tskills uninstall owner/skill-name --yes
```

---

## Organizations and Teams

Organizations let you share skills privately within your company or team.

### Creating an Organization

```bash
tskills org create acme
tskills org create acme --name "Acme Corp" --description "Internal tools"
```

### Managing Organization Members

```bash
# List your organizations
tskills org list

# View organization details
tskills org info acme

# Add a member (by GitHub username)
tskills org add acme @johndoe
tskills org add acme @janedoe --role admin

# Remove a member
tskills org remove acme @johndoe

# Delete organization (owner only)
tskills org delete acme --force
```

**Organization Roles:**

| Role | Permissions |
|------|-------------|
| `owner` | Full control, can delete org |
| `admin` | Manage members and teams, publish skills |
| `member` | Publish skills, access org skills |

### Creating Teams

Teams are groups within organizations for more granular access control.

```bash
# Create a team
tskills team create acme/engineering

# List teams in an org
tskills team list acme

# View team details
tskills team info acme/engineering

# Add member to team
tskills team add acme/engineering @johndoe

# Remove from team
tskills team remove acme/engineering @johndoe

# Delete team (admin/owner only)
tskills team delete acme/engineering --force
```

### Publishing to Organizations

```bash
# Publish to org (visible to all org members)
tskills publish ./SKILL.md --org acme --visibility org

# Publish to specific team only
tskills publish ./SKILL.md --org acme --team engineering --visibility team
```

---

## Skill Deprecation

When a skill is outdated or replaced, mark it as deprecated instead of deleting it.

### Deprecating a Skill

```bash
# Mark as deprecated with a message
tskills deprecate owner/skill-name --message "Use owner/new-skill instead"

# Remove deprecation status
tskills deprecate owner/skill-name --undeprecate
```

### What Users See

When someone installs a deprecated skill:

```
Warning: This skill is deprecated.
Message: Use owner/new-skill instead

Installed owner/skill-name@1.0.0
```

The `tskills info` command also shows deprecation status:

```
owner/skill-name

Some description here

Details:
  Visibility: public
  Latest:    1.0.0
  Status:    DEPRECATED
  Message:   Use owner/new-skill instead
```

---

## Next Steps

- [CLI Reference](./cli-reference.md) - Complete command documentation
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
