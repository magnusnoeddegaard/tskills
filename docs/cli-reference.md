# tskills CLI Reference

Complete reference for all tskills commands.

## Global Options

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Show detailed error messages and stack traces |
| `-h, --help` | Display help for command |
| `-V, --version` | Display version number |

---

## Authentication Commands

### `tskills login`

Authenticate with the tskills registry via GitHub OAuth.

```bash
tskills login
```

Opens your browser for GitHub authentication. After authorizing, credentials are saved to `~/.tskills/credentials.json`.

---

### `tskills logout`

Clear stored credentials.

```bash
tskills logout
```

---

### `tskills whoami`

Display the currently authenticated user.

```bash
tskills whoami
```

**Output:**
```
Logged in as johndoe (john@example.com)
```

---

## Skill Commands

### `tskills publish`

Publish a skill to the registry.

```bash
tskills publish <path> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `path` | Path to SKILL.md file |

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-v, --version <version>` | Version to publish | Auto-increment |
| `--visibility <visibility>` | Skill visibility: `public`, `private`, `org`, `team` | `public` |
| `--org <org>` | Publish to an organization | - |
| `--team <team>` | Restrict to a team (requires `--org`) | - |

**Examples:**

```bash
# Publish personal skill
tskills publish ./SKILL.md

# Publish with specific version
tskills publish ./SKILL.md --version 2.0.0

# Publish to organization
tskills publish ./SKILL.md --org acme --visibility org

# Publish to team
tskills publish ./SKILL.md --org acme --team engineering --visibility team
```

---

### `tskills install`

Install a skill from the registry.

```bash
tskills install <skill> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `skill` | Skill to install: `owner/name` or `owner/name@version` |

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-s, --scope <scope>` | Install scope: `user` or `project` | `user` |
| `-f, --force` | Force reinstall even if already installed | `false` |

**Examples:**

```bash
# Install latest version
tskills install acme/deploy-checklist

# Install specific version
tskills install acme/deploy-checklist@1.2.0

# Install to project scope
tskills install acme/deploy-checklist --scope project

# Force reinstall
tskills install acme/deploy-checklist --force
```

---

### `tskills uninstall`

Remove an installed skill.

```bash
tskills uninstall <skill> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `skill` | Skill to uninstall: `owner/name` |

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-s, --scope <scope>` | Uninstall scope: `user` or `project` | `user` |
| `-y, --yes` | Skip confirmation prompt | `false` |

**Examples:**

```bash
# Uninstall (with confirmation)
tskills uninstall acme/deploy-checklist

# Skip confirmation
tskills uninstall acme/deploy-checklist --yes

# Uninstall from project scope
tskills uninstall acme/deploy-checklist --scope project
```

---

### `tskills search`

Search for skills in the registry.

```bash
tskills search [query] [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `query` | Search query (optional) |

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-t, --tags <tags>` | Filter by tags (comma-separated) | - |
| `--tools <tools>` | Filter by supported tools (comma-separated) | - |
| `-l, --limit <limit>` | Maximum results | `20` |

**Examples:**

```bash
# Search by keyword
tskills search "code review"

# Filter by tags
tskills search --tags testing,automation

# Filter by tool support
tskills search --tools cursor,claude

# Combine filters
tskills search "deploy" --tags devops --limit 5
```

---

### `tskills info`

Show detailed information about a skill.

```bash
tskills info <skill>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `skill` | Skill to show: `owner/name` |

**Example:**

```bash
tskills info acme/deploy-checklist
```

**Output:**
```
acme/deploy-checklist

Pre-deployment verification checklist

Details:
  Visibility: org
  Latest:    1.3.0
  Downloads: 142
  Created:   1/10/2024
  Status:    installed (v1.2.0, update available: v1.3.0)

Supported tools:
  - claude
  - cursor

Tags:
  devops, deployment

Versions:
  1.3.0 (latest) - 1/15/2024
  1.2.0 (installed) - 1/12/2024
  1.1.0 - 1/11/2024
  1.0.0 - 1/10/2024
```

---

### `tskills outdated`

Check installed skills for available updates.

```bash
tskills outdated
```

**Output:**
```
Updates available:

Package              Current  Latest
────────────────────────────────────
acme/deploy-check    1.0.0    1.2.0
johndoe/code-review  2.0.0    2.1.0

Run tskills update to update all outdated skills.
```

---

### `tskills update`

Update installed skills to the latest version.

```bash
tskills update [skill] [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `skill` | Specific skill to update (optional). If omitted, updates all. |

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-s, --scope <scope>` | Update scope: `user` or `project` | `user` |
| `-f, --force` | Force update even if at latest version | `false` |

**Examples:**

```bash
# Update all outdated skills
tskills update

# Update specific skill
tskills update acme/deploy-checklist

# Force update
tskills update acme/deploy-checklist --force
```

---

### `tskills deprecate`

Mark a skill as deprecated.

```bash
tskills deprecate <skill> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `skill` | Skill to deprecate: `owner/name` |

**Options:**
| Option | Description |
|--------|-------------|
| `-m, --message <message>` | Deprecation message (e.g., "Use owner/new-skill instead") |
| `--undeprecate` | Remove deprecation status |

**Examples:**

```bash
# Deprecate with message
tskills deprecate myuser/old-skill --message "Use myuser/new-skill instead"

# Remove deprecation
tskills deprecate myuser/old-skill --undeprecate
```

---

## Organization Commands

### `tskills org create`

Create a new organization.

```bash
tskills org create <slug> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `slug` | Organization identifier (lowercase, letters/numbers/hyphens) |

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Display name | Same as slug |
| `-d, --description <description>` | Organization description | - |

**Example:**

```bash
tskills org create acme --name "Acme Corp" --description "Internal tools"
```

---

### `tskills org list`

List your organizations.

```bash
tskills org list
```

---

### `tskills org info`

Show organization details.

```bash
tskills org info <slug>
```

---

### `tskills org add`

Add a member to an organization.

```bash
tskills org add <slug> <username> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `slug` | Organization identifier |
| `username` | GitHub username (with or without `@` prefix) |

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-r, --role <role>` | Member role: `owner`, `admin`, `member` | `member` |

**Examples:**

```bash
tskills org add acme @johndoe
tskills org add acme @janedoe --role admin
```

---

### `tskills org remove`

Remove a member from an organization.

```bash
tskills org remove <slug> <username>
```

---

### `tskills org delete`

Delete an organization (owner only).

```bash
tskills org delete <slug> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation |

**Example:**

```bash
tskills org delete acme --force
```

---

## Team Commands

### `tskills team create`

Create a new team within an organization.

```bash
tskills team create <org>/<team> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `<org>/<team>` | Organization and team slug |

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-n, --name <name>` | Display name | Same as slug |
| `-d, --description <description>` | Team description | - |

**Example:**

```bash
tskills team create acme/engineering --name "Engineering" --description "Dev team"
```

---

### `tskills team list`

List teams in an organization.

```bash
tskills team list <org>
```

---

### `tskills team info`

Show team details.

```bash
tskills team info <org>/<team>
```

---

### `tskills team add`

Add a member to a team.

```bash
tskills team add <org>/<team> <username>
```

**Example:**

```bash
tskills team add acme/engineering @johndoe
```

---

### `tskills team remove`

Remove a member from a team.

```bash
tskills team remove <org>/<team> <username>
```

---

### `tskills team delete`

Delete a team (admin/owner only).

```bash
tskills team delete <org>/<team> [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation |

---

## Local Commands (Git-Based Sync)

These commands work with the git-based workflow for syncing skills from a private repository.

| Command | Description |
|---------|-------------|
| `tskills setup` | Create GitHub repo and configure |
| `tskills init` | Initialize skills directory locally |
| `tskills add <name>` | Create a new skill from template |
| `tskills import <path>` | Import existing SKILL.md files |
| `tskills list` | List local skills |
| `tskills sync` | Pull from remote and sync to tools |
| `tskills share` | Get shareable setup command |
| `tskills invite <user>` | Add GitHub collaborator to repo |
| `tskills config` | View/edit configuration |

> **Note:** The `setup`, `share`, and `invite` commands require [GitHub CLI](https://cli.github.com) (`gh`).

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (see message for details) |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TSKILLS_SUPABASE_URL` | Override Supabase URL |
| `TSKILLS_SUPABASE_ANON_KEY` | Override Supabase anon key |
