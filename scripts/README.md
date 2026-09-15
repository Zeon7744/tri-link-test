# PowerShell Script Reference

Complete reference for tri-link PowerShell automation scripts.

---

## Scripts Overview

| Script | Purpose | Usage |
|--------|---------|-------|
| `init-tri-link.ps1` | Initialize new project | `-RepoName <name>` |
| `push-all.ps1` | Push to all remotes | Optional `-Branch` |
| `sync-to-gitee.ps1` | Sync to Gitee | Optional `-RepoName` |

---

## init-tri-link.ps1

Initialize a new repository with three-way linkage.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `-RepoName` | Yes | — | Name of the repository |
| `-Description` | No | `""` | Repository description |
| `-GitHubUser` | No | `"Zeon7744"` | GitHub username |
| `-GiteeUser` | No | `"Zeon7744"` | Gitee username |
| `-AFDianUser` | No | `"Zeon7744"` | AFDian username |

### Example

```powershell
# Basic usage
powershell -File scripts/init-tri-link.ps1 -RepoName "my-project"

# With custom description
powershell -File scripts/init-tri-link.ps1 -RepoName "my-project" -Description "My awesome project"

# Custom usernames
powershell -File scripts/init-tri-link.ps1 -RepoName "my-project" -GitHubUser "other-user"
```

### What It Creates

1. Git repository (if not exists)
2. GitHub remote (`origin`)
3. Gitee remote (`gitee`)
4. `.github/FUNDING.yml` with AFDian link
5. `README.md` with mirror links
6. `.gitignore` with common patterns

---

## push-all.ps1

Push current branch to all configured remotes.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `-Branch` | No | Current branch | Target branch to push |

### Example

```powershell
# Push current branch to all remotes
powershell -File scripts/push-all.ps1

# Push specific branch
powershell -File scripts/push-all.ps1 -Branch feature/add-auth
```

---

## sync-to-gitee.ps1

Sync a GitHub repository to Gitee.

### Parameters

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `-RepoName` | No | Auto-detect | Repository name |
| `-RemoteName` | No | `"gitee"` | Remote name to use |
| `-GiteeUser` | No | `"Zeon7744"` | Gitee username |

### Example

```powershell
# Sync current repo
powershell -File scripts/sync-to-gitee.ps1

# Sync specific repo
powershell -File scripts/sync-to-gitee.ps1 -RepoName "my-other-project"
```

---

## Error Handling

All scripts use `$ErrorActionPreference = "Stop"` for strict error handling.

Common errors:
- **Remote already exists**: Scripts handle this gracefully
- **Branch not found**: Use correct branch name
- **SSH authentication failed**: Check SSH key and config

---

## Git Alias Setup

For convenience, add these aliases to your global git config:

```bash
# Add to ~/.gitconfig
[alias]
    push-all = !powershell -ExecutionPolicy Bypass -File C:/Users/Admin/.local/bin/push-all.ps1
    sync-gitee = !powershell -ExecutionPolicy Bypass -File C:/Users/Admin/.local/bin/sync-to-gitee.ps1
    tri-init = !powershell -ExecutionPolicy Bypass -File C:/Users/Admin/.local/bin/init-tri-link.ps1
```
