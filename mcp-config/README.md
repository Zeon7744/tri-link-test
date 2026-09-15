# MCP Server Configuration Examples

This directory contains example configurations for MCP (Model Context Protocol) servers.

## Filesystem MCP

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/workspace"]
    }
  }
}
```

## GitHub MCP

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "<your-github-token>"
      }
    }
  }
}
```

## Sentry MCP

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sentry"],
      "env": {
        "SENTRY_TOKEN": "<your-sentry-token>",
        "SENTRY_ORG": "<your-sentry-org>"
      }
    }
  }
}
```

## Installation

```bash
# Install all recommended MCP servers
npx -y @modelcontextprotocol/server-filesystem
npx -y @modelcontextprotocol/server-github
npx -y @modelcontextprotocol/server-sentry
```

## Configuration Locations

- **VS Code**: `.vscode/settings.json`
- **Cursor**: `.cursor/settings.json`
- **Claude Code**: `.codex/config.json`
- **General**: `~/.config/mcp.json` or project-level `.mcp.json`
