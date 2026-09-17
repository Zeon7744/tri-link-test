# Tri-Link DevKit

One-command GitHub + Gitee + AFDian project toolkit.
Initialize, sync, and monitor your three-platform development workflow.

## Features

| Command | What it does |
|---------|-------------|
| `init` | Create a fully structured tri-link project locally |
| `create-remote` | Create repos on GitHub/Gitee via API (tokens) |
| `push` | Push to all configured remotes at once |
| `status` | Show branch, remotes, ahead/behind, dirty state |
| `github-stats` | Fetch stars/forks/issues via GitHub API |
| `afdian-stats` | Fetch sponsorship data via AFDian API |
| `mcp-config` | Generate MCP server config for IDE integration |
| `dashboard` | Generate standalone dashboard HTML with live stats |

## Quick Start

```bash
# 1. Initialize a new project
node packages/tri-link-devkit/bin/cli.js init my-repo \
  -g myuser -G myuser -A myuser \
  -d "My awesome project"

# 2. Create remote repos (requires tokens)
GITHUB_TOKEN=ghp_xxx GITEE_TOKEN=xxx \
  node packages/tri-link-devkit/bin/cli.js create-remote my-repo

# 3. Push to all platforms
node packages/tri-link-devkit/bin/cli.js push

# 4. Check status
node packages/tri-link-devkit/bin/cli.js status

# 5. Generate dashboard
node packages/tri-link-devkit/bin/cli.js dashboard my-repo
```

## Token Configuration

Tokens can be provided via CLI flags or environment variables:

| Flag | Env Var | Description |
|------|---------|-------------|
| `-t` | `GITHUB_TOKEN` | GitHub personal access token |
| `-T` | `GITEE_TOKEN` | Gitee personal access token |
| `-a` | `AFDIAN_TOKEN` | AFDian API token |

All other parameters (usernames, branch, description) can also use
`GITHUB_USER`, `GITEE_USER`, `AFDIAN_USER`, `TRI_BRANCH` env vars.

## Full Pipeline Example

```bash
# One-shot: init → create remote → push → dashboard
GITHUB_TOKEN=ghp_xxx GITEE_TOKEN=xxx AFDIAN_TOKEN=xxx \
  node packages/tri-link-devkit/bin/cli.js init my-repo \
  -g myuser -G myuser -A myuser \
&& GITHUB_TOKEN=ghp_xxx GITEE_TOKEN=xxx \
  node packages/tri-link-devkit/bin/cli.js create-remote my-repo \
&& node packages/tri-link-devkit/bin/cli.js push \
&& node packages/tri-link-devkit/bin/cli.js dashboard my-repo
```

## What `init` Creates

```
my-repo/
├── .git/
├── .github/
│   ├── FUNDING.yml              # AFDian sponsorship
│   └── workflows/
│       └── sync.yml             # GitHub Actions sync workflow
├── .tri-link/
│   └── config.json              # Project-level DevKit config (gitignored)
├── .gitignore
└── README.md
```

## Test

```bash
node packages/tri-link-devkit/test/index.js
```

## Generated Artifacts

- .mcp/mcp.json - MCP server config (sample, generated locally)
- dashboard/index.html - Dashboard HTML (sample, generated locally)

These files are committed as examples. You can regenerate them with:

    node bin/cli.js mcp-config
    node bin/cli.js dashboard <repo>
