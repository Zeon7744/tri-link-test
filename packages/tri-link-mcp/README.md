# Tri-Link MCP

Unified MCP server for GitHub + Gitee + AFDian.

One server, six tools, three platforms.

## Install

```bash
npm install -g @tri-link/mcp
# or use npx
npx @tri-link/mcp
```

## Configure

Add to your IDE's MCP config (`.mcp/mcp.json` or `.vscode/mcp.json`):

```json
{
  "mcpServers": {
    "tri-link": {
      "command": "node",
      "args": ["packages/tri-link-mcp/bin/server.js"],
      "env": {
        "GITHUB_USER": "your-username",
        "GITHUB_TOKEN": "ghp_xxx",
        "GITEE_USER": "your-username",
        "GITEE_TOKEN": "xxx",
        "AFDIAN_USER": "your-username",
        "AFDIAN_TOKEN": "xxx"
      }
    }
  }
}
```

All tokens are optional. Tools that require a token will return a helpful error message if the token is not set.

## Tools

| Tool | Platform | Description |
|------|----------|-------------|
| `get_repo_stats` | GitHub | Stars, forks, open issues for a repo |
| `list_issues` | GitHub | Open/closed issues list |
| `search_repos` | GitHub | Search repos by keyword |
| `gitee_repo_info` | Gitee | Repo metadata (stars, forks, description) |
| `afdian_creator_info` | AFDian | Creator profile and page URL |
| `afdian_sponsor_stats` | AFDian | Sponsorship statistics (requires AFDIAN_TOKEN) |

## Run locally

```bash
# Start the server
node packages/tri-link-mcp/bin/server.js

# Run tests
node packages/tri-link-mcp/test/index.js
```

## License

MIT
