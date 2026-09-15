# tri-link-test

GitHub + Gitee + 爱发电 三方联动测试项目

## AFDian Sponsor

If this project is helpful, consider sponsoring:
- https://afdian.com/a/Zeon7744

## Mirror

| Platform | URL |
|----------|-----|
| GitHub | https://github.com/Zeon7744/tri-link-test |
| Gitee | https://gitee.com/Zeon7744/tri-link-test |

## Quick Start

```bash
# Initialize new repo with three-way linkage
git tri-init -RepoName my-project

# Push to all platforms
git push-all

# Sync to Gitee
git sync-gitee -RepoName my-project
```

## Tools Stack

- **Editor**: Cursor / VS Code + Copilot
- **Agent**: Claude Code / OpenCode
- **CLI**: gh (GitHub CLI)
- **MCP**: Filesystem + GitHub + Sentry
- **CI/CD**: GitHub Actions

## Links

- [Development Plan](DEVELOPMENT_PLAN.md)
- [Configuration Report](../tri-link-setup-report.html)
