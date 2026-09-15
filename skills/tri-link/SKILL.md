# tri-link Agent Skill

This skill provides instructions for working with the tri-link project (GitHub + Gitee + AFDian three-way linkage).

## When to Use

Use this skill when:
- Initializing a new multi-platform Git project
- Syncing repositories between GitHub and Gitee
- Configuring AFDian sponsorship integration
- Setting up MCP servers for development
- Reviewing the development or monetization plan

## Commands

```bash
# Initialize a new tri-link project
git tri-init -RepoName "project-name"

# Push to all platforms
git push-all

# Sync to Gitee
git sync-gitee

# Check tri-link status
powershell -File scripts/check-tri-link.ps1
```

## Workflow

1. **Project Setup**: Run `git tri-init` to create the standard project structure
2. **Push**: Use `git push-all` to push to both GitHub and Gitee
3. **Monitor**: Check tri-link status with the check script
4. **Document**: Update DEVELOPMENT_PLAN.md with progress

## Key Files

| File | Purpose |
|------|---------|
| `scripts/init-tri-link.ps1` | Project initialization |
| `scripts/push-all.ps1` | Multi-platform push |
| `scripts/sync-to-gitee.ps1` | Gitee sync |
| `DEVELOPMENT_PLAN.md` | Development roadmap |
| `MONETIZATION_PLAN.md` | Monetization strategy |
| `mcp-config/` | MCP server examples |

## Best Practices

- Always push to both platforms after commits
- Keep DEVELOPMENT_PLAN.md updated
- Use the AFDian MCP server for sponsorship data
- Follow the trend report for tool recommendations
