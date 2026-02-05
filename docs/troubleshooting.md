# Troubleshooting Guide

Common issues and solutions when using the tskills registry.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Publishing Issues](#publishing-issues)
- [Installation Issues](#installation-issues)
- [Permission Issues](#permission-issues)
- [Network Issues](#network-issues)
- [Rate Limiting](#rate-limiting)
- [Getting Help](#getting-help)

---

## Authentication Issues

### "Not logged in" error

**Problem:** Commands fail with "Not logged in. Please run 'tskills login' first."

**Solution:**
```bash
tskills login
```

If you're already logged in but seeing this error, your token may have expired:
```bash
tskills logout
tskills login
```

---

### Login opens browser but nothing happens

**Problem:** Browser opens for GitHub authentication but the CLI hangs.

**Possible causes:**

1. **Popup blocked:** Your browser may have blocked the OAuth popup. Check your browser's popup blocker settings.

2. **Port in use:** The callback server uses port 54321. If another process is using this port:
   ```
   Port 54321 is already in use.
   Make sure no other tskills login is running, or wait and try again.
   ```

   Wait for any other login attempts to complete, or kill the process using the port.

3. **Firewall:** Your firewall may be blocking localhost connections. Allow connections to `localhost:54321`.

---

### "Login timed out"

**Problem:** Login fails after 5 minutes.

**Solution:** The login process times out after 5 minutes. Run `tskills login` again and complete the GitHub authorization more quickly.

---

### Token expired

**Problem:** Commands that worked before now fail with authentication errors.

**Solution:** Re-authenticate:
```bash
tskills logout
tskills login
```

---

## Publishing Issues

### "Skill is missing required 'name' field"

**Problem:** Publish fails because the SKILL.md file is missing required frontmatter.

**Solution:** Ensure your SKILL.md has the required fields:

```markdown
---
name: my-skill-name
description: What this skill does
---

# Skill content here
```

---

### "Invalid version format"

**Problem:** The specified version doesn't follow semver format.

**Solution:** Use semantic versioning (e.g., `1.0.0`, `2.1.3`):
```bash
tskills publish ./SKILL.md --version 1.0.0
```

---

### "Version already exists"

**Problem:** You're trying to publish a version that already exists.

**Solution:** Either:
- Let tskills auto-increment: `tskills publish ./SKILL.md`
- Use a new version number: `tskills publish ./SKILL.md --version 1.0.1`

---

### "--team requires --org"

**Problem:** You specified `--team` without `--org`.

**Solution:** Always include `--org` when using `--team`:
```bash
tskills publish ./SKILL.md --org acme --team engineering --visibility team
```

---

### "Team visibility requires --team flag"

**Problem:** You set `--visibility team` but didn't specify which team.

**Solution:**
```bash
tskills publish ./SKILL.md --org acme --team engineering --visibility team
```

---

## Installation Issues

### "Skill not found"

**Problem:** The skill you're trying to install doesn't exist.

**Possible causes:**

1. **Typo:** Check the owner and skill name spelling.
   ```bash
   tskills search "skill-name"  # Find the correct name
   ```

2. **Private skill:** The skill may be private or team-restricted. Ensure you have access.

3. **Not published:** The skill may not have been published to the registry yet.

---

### "Version not found"

**Problem:** The specified version doesn't exist.

**Solution:** Check available versions:
```bash
tskills info owner/skill-name
```

Then install a valid version:
```bash
tskills install owner/skill-name@1.0.0
```

---

### "Already installed"

**Problem:** The skill is already installed.

**Solution:** To reinstall:
```bash
tskills install owner/skill-name --force
```

---

### Skills not appearing in AI tools

**Problem:** You installed a skill but it's not showing up in Claude/Cursor/etc.

**Possible causes:**

1. **Tool disabled:** Check your config:
   ```bash
   tskills config --show
   ```
   Enable the tool:
   ```bash
   tskills config --cursor true
   ```

2. **Wrong scope:** If you installed with `--scope project`, the skill is only in the current directory.

3. **Skill doesn't support the tool:** Check if the skill supports your tool:
   ```bash
   tskills info owner/skill-name
   ```
   Look at "Supported tools" in the output.

---

## Permission Issues

### "You don't have access"

**Problem:** You're trying to access a skill you don't have permission to view.

**Possible causes:**

1. **Private skill:** Only the owner can access private skills.
2. **Org skill:** You're not a member of the organization.
3. **Team skill:** You're not a member of the specific team.

**Solution:** Ask the skill owner to:
- Add you to their organization: `tskills org add acme @yourusername`
- Add you to the team: `tskills team add acme/engineering @yourusername`
- Change the skill's visibility to `public`

---

### "You do not have permission to create teams"

**Problem:** You're trying to create a team but aren't an admin or owner.

**Solution:** Contact an organization owner or admin to:
- Grant you admin role: `tskills org add acme @yourusername --role admin`
- Create the team for you

---

### "Only organization owners can delete"

**Problem:** You're trying to delete an organization but aren't the owner.

**Solution:** Contact the organization owner. Ownership cannot be transferred via CLI currently.

---

## Network Issues

### Connection timeout

**Problem:** Commands fail with timeout errors.

**Possible causes:**
- Poor internet connection
- Firewall blocking outbound connections
- Registry service temporarily unavailable

**Solutions:**
1. Check your internet connection
2. Try again in a few minutes
3. Use `--verbose` for more details:
   ```bash
   tskills search "test" --verbose
   ```

---

### "fetch failed" or network errors

**Problem:** Network requests are failing.

**Solution:**
1. Check if you can access the internet
2. Check if a proxy is required for your network
3. Try again later - the service may be temporarily unavailable

---

## Rate Limiting

### "Rate limit exceeded"

**Problem:** You've made too many requests.

**Limits:**
| Action | Limit |
|--------|-------|
| Search/Info (anonymous) | 60/hour |
| Search/Info (authenticated) | 1000/hour |
| Publish | 30/hour |

**Solution:**
- Wait for the rate limit window to reset (shown in error message)
- Log in for higher limits (if anonymous)
- Reduce request frequency

**Example error:**
```
Rate limit exceeded. Try again in 5 minutes.
Limit: 60 requests per hour
```

---

## Getting Help

### Enable verbose mode

For detailed error information:
```bash
tskills <command> --verbose
```

This shows:
- Full error details
- Stack traces
- Request/response information

### Check your setup

```bash
# Verify authentication
tskills whoami

# Check configuration
tskills config --show

# List installed skills
tskills list
```

### Report issues

If you've tried the above solutions and still have problems:

1. Gather information:
   - Run the command with `--verbose`
   - Note your Node.js version: `node --version`
   - Note your tskills version: `tskills --version`

2. Report at: https://github.com/magnusnoeddegaard/tskills/issues

### Common error codes

| Error | Meaning |
|-------|---------|
| `AUTH_REQUIRED` | Login required |
| `AUTH_INVALID` | Token expired or invalid |
| `NOT_FOUND` | Resource doesn't exist |
| `PERMISSION_DENIED` | No access to resource |
| `VALIDATION_ERROR` | Invalid input |
| `RATE_LIMITED` | Too many requests |
| `NETWORK_ERROR` | Connection failed |
