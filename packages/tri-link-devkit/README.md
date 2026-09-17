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
| `self` | Self-inspect DevKit capabilities, learnings, and gaps |
| `learn <text>` | Record user feedback into `.tri-link/learnings.json` |
| `upgrade [id\|--suggest]` | List or apply self-upgrades |
| `release [version]` | Bump version, generate CHANGELOG.md, tag |
| `setup` | Interactive guided setup wizard |

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
node packages/tri-link-devkit/bin/cli.js dashboard my-repo \
  -g myuser -A myuser

# 6. Generate MCP config
node packages/tri-link-devkit/bin/cli.js mcp-config -o .mcp

# 7. Fetch GitHub stats
node packages/tri-link-devkit/bin/cli.js github-stats my-repo -g myuser

# 8. Fetch AFDian stats
node packages/tri-link-devkit/bin/cli.js afdian-stats -A myuser
```

## Token Configuration

| Flag | Env var | Description |
|------|---------|-------------|
| `-g` | `GITHUB_USER` | GitHub username |
| `-G` | `GITEE_USER` | Gitee username |
| `-A` | `AFDIAN_USER` | AFDian username |
| `-t` | `GITHUB_TOKEN` | GitHub personal access token |
| `-T` | `GITEE_TOKEN` | Gitee personal access token |
| `-a` | `AFDIAN_TOKEN` | AFDian API token |

## Full Pipeline Example

```bash
# Initialize locally
node bin/cli.js init my-repo -g myuser -G myuser -A myuser -d "My project"

# Create remote repos
GITHUB_TOKEN=ghp_xxx GITEE_TOKEN=xxx node bin/cli.js create-remote my-repo

# Push to all platforms
node bin/cli.js push

# Generate dashboard and MCP config
node bin/cli.js dashboard my-repo -g myuser -A myuser
node bin/cli.js mcp-config -o .mcp
```

## What `init` Creates

```
my-repo/
├── .git/
├── .github/
│   ├── FUNDING.yml              # AFDian sponsorship
│   └── workflows/sync.yml       # Auto-sync workflow
├── .tri-link/
│   └── config.json              # Project configuration
├── .gitignore
└── README.md                    # Tri-link project README
```

## Test

```bash
node packages/tri-link-devkit/test/index.js
```

## Generated Artifacts

The repository ships with example generated artifacts:

- `.mcp/mcp.json` — MCP server configuration template
- `dashboard/index.html` — standalone dashboard with live GitHub/AFDian stats
- `packages/tri-link-devkit/CHANGELOG.md` — auto-generated changelog
- `packages/tri-link-devkit/.tri-link/config.json` — user configuration
- `packages/tri-link-devkit/.tri-link/learnings.json` — learning memory

Regenerate them with:

```bash
node bin/cli.js mcp-config
node bin/cli.js dashboard my-repo
node bin/cli.js release
node bin/cli.js learn "your feedback"
```

## Self-Evolution Engine

DevKit can inspect itself, learn from feedback, and apply upgrades:

```bash
# Inspect current capabilities and gaps
node bin/cli.js self

# Record a learning
node bin/cli.js learn "push to gitee failed: auth token expired"

# List suggested upgrades
node bin/cli.js upgrade --suggest

# Apply a specific upgrade
node bin/cli.js upgrade add-release-command

# Release with changelog + tag
node bin/cli.js release

# Guided setup
node bin/cli.js setup
```

## License

MIT
