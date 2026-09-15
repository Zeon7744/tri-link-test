# tri-link-test Documentation

Comprehensive guides and reference materials for the tri-link project.

## Table of Contents

- [Quick Start](#quick-start)
- [SSH Configuration](#ssh-configuration)
- [Git Workflows](#git-workflows)
- [MCP Setup](#mcp-setup)
- [CI/CD Guide](#cicd-guide)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone git@github.com:Zeon7744/tri-link-test.git
cd tri-link-test
```

### 2. Initialize a New Project

```powershell
# For PowerShell users
powershell -File scripts/init-tri-link.ps1 -RepoName "my-project"

# Or use the git alias (if configured globally)
git tri-init -RepoName "my-project"
```

### 3. Push to All Platforms

```bash
# One-click push to GitHub + Gitee
git push-all

# Or push individually
git push origin main
git push gitee main
```

---

## SSH Configuration

### Dual-Account Setup

This project uses separate SSH keys for GitHub and Gitee.

#### Key Locations

| Platform | Private Key | Public Key |
|----------|------------|------------|
| GitHub | `~/.ssh/id_ed25519_zeon7744` | `~/.ssh/id_ed25519_zeon7744.pub` |
| Gitee | `~/.ssh/id_ed25519_gitee` | `~/.ssh/id_ed25519_gitee.pub` |

#### SSH Config

```ssh-config
# GitHub - Zeon7744
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_zeon7744
    IdentitiesOnly yes

# Gitee - Zeon7744
Host gitee.com
    HostName gitee.com
    User git
    IdentityFile ~/.ssh/id_ed25519_gitee
    IdentitiesOnly yes
```

### Testing Connections

```bash
# GitHub
ssh -T git@github.com
# Expected: Hi Zeon7744! You've successfully authenticated...

# Gitee
ssh -T git@gitee.com
# Expected: Welcome to Gitee.com, 足够卑微!
```

---

## Git Workflows

### Global Aliases

These aliases are configured globally for the Zeon7744 account:

```bash
# Push to all remotes
git push-all

# Sync to Gitee
git sync-gitee [-RepoName <name>]

# Initialize new tri-link project
git tri-init -RepoName <name>
```

### Common Workflows

#### Daily Development

```bash
# Make changes
git add .
git commit -m "feat: add new feature"

# Push to all platforms
git push-all
```

#### Starting a New Project

```bash
# Create new project directory
mkdir my-project && cd my-project

# Initialize tri-link
git tri-init -RepoName "my-project"

# Create initial commit
git add .
git commit -m "chore: initial commit"

# Push to both platforms
git push-all
```

---

## MCP Setup

### Installing MCP Servers

#### Filesystem MCP (P0)

```bash
# Install
npx -y @modelcontextprotocol/server-filesystem

# Configure in your IDE
# VS Code: Add to .vscode/settings.json
# Cursor: Add to .cursor/settings.json
```

#### GitHub MCP (P0)

```bash
# Install
npx -y @modelcontextprotocol/server-github

# Set environment variable
export GITHUB_TOKEN="your-token-here"

# Configure in IDE (see mcp-config/README.md)
```

#### Sentry MCP (P1)

```bash
# Install
npx -y @modelcontextprotocol/server-sentry

# Set environment variables
export SENTRY_TOKEN="your-token"
export SENTRY_ORG="your-org"
```

---

## CI/CD Guide

### GitHub Actions Workflow

The project uses a GitHub Actions workflow for sync monitoring.

#### Trigger Conditions

- On push to `main` or `master`
- Manual dispatch (`workflow_dispatch`)
- Daily at 00:00 UTC (`schedule`)

#### Artifacts

Each run creates a sync marker artifact available for 7 days.

### Local Sync Script

For manual Gitee synchronization:

```bash
# Sync current repo to Gitee
git sync-gitee

# Or specify a different repo name
git sync-gitee -RepoName "my-other-project"
```

---

## Troubleshooting

### SSH Connection Issues

**Problem**: `Permission denied (publickey)`

**Solution**:
1. Verify SSH agent is running: `ssh-add -l`
2. Add your key: `ssh-add ~/.ssh/id_ed25519_zeon7744`
3. Check SSH config: `cat ~/.ssh/config`

### Git Push Failures

**Problem**: Push to one remote succeeds but the other fails

**Solution**:
```bash
# Check remote URLs
git remote -v

# Fix if needed
git remote set-url origin git@github.com:Zeon7744/tri-link-test.git
git remote set-url gitee git@gitee.com:Zeon7744/tri-link-test.git
```

### gh CLI Not Authenticated

**Problem**: `gh auth: You are not logged into any GitHub hosts`

**Solution**:
```bash
# Login with web flow
gh auth login

# Or set token manually
export GH_TOKEN="ghp_your_token_here"
```

---

## Related Resources

- [Development Plan](../DEVELOPMENT_PLAN.md)
- [Monetization Plan](../MONETIZATION_PLAN.md)
- [AFDIAN Setup Guide](../AFDIAN_SETUP.md)
- [MCP Config Examples](../mcp-config/README.md)
