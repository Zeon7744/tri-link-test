# MCP Configuration Guide

Complete guide for configuring Model Context Protocol (MCP) servers for tri-link development.

## Overview

MCP (Model Context Protocol) allows AI tools to connect to external services and data sources. This project recommends the following MCP servers based on the [GitHub 2026 Development Trends](../../github-development-trends-2026.html) report.

---

## Quick Install

### Prerequisites

- Node.js 18+ installed
- An AI tool that supports MCP (Claude Code, Cursor, VS Code with Copilot, etc.)

### Install All Recommended Servers

```bash
# P0: Core servers (recommended first)
npx -y @modelcontextprotocol/server-filesystem
npx -y @modelcontextprotocol/server-github

# P1: Optional but useful
npx -y @modelcontextprotocol/server-sentry
```

---

## Configuration by IDE

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "$GITHUB_TOKEN"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/settings.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${env:GITHUB_TOKEN}"
      }
    }
  }
}
```

### VS Code + Copilot

Add to `.vscode/settings.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"]
    }
  }
}
```

---

## Server Reference

### Filesystem MCP (P0)

**Purpose**: Read and write local files

**Installation**:
```bash
npx -y @modelcontextprotocol/server-filesystem
```

**Usage**: Grant access to specific directories only for security.

---

### GitHub MCP (P0)

**Purpose**: PR review, issue management, repository operations

**Installation**:
```bash
npx -y @modelcontextprotocol/server-github
```

**Required Environment Variable**:
```bash
export GITHUB_TOKEN="ghp_your_personal_access_token"
```

**Token Requirements**: `repo`, `read:org`, `gist` scopes

---

### Sentry MCP (P1)

**Purpose**: Error analysis and incident response

**Installation**:
```bash
npx -y @modelcontextprotocol/server-sentry
```

**Required Environment Variables**:
```bash
export SENTRY_TOKEN="your_sentry_token"
export SENTRY_ORG="your_organization_slug"
```

---

## Security Notes

- Never commit tokens to source control
- Use environment variables or secure vaults for credentials
- Grant minimal directory access to Filesystem MCP
- Rotate tokens regularly
