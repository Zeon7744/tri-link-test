# tri-link-test

GitHub + Gitee + 爱发电三方联动框架与工具链

## 项目简介

这是一个用于演示和测试 **GitHub + Gitee + 爱发电** 三方联动开发的完整框架。集成了 Git 工作流脚本、CI/CD 自动化、MCP 服务器配置指南以及 AI 开发工具链推荐。

### 核心功能

- **双平台推送**: 一键推送到 GitHub 和 Gitee
- **自动同步**: GitHub -> Gitee 自动镜像同步
- **赞助集成**: 爱发电 (Afdian) FUNDING.yml 配置
- **工具链文档**: MCP 服务器 + Agent Skills 配置指南

## 爱发电赞助

如果这个项目对你有帮助，欢迎在爱发电上支持我：
- https://afdian.com/a/Zeon7744

## 镜像仓库

| 平台 | URL |
|------|-----|
| GitHub | https://github.com/Zeon7744/tri-link-test |
| Gitee | https://gitee.com/Zeon7744/tri-link-test |

## Quick Start

```bash
# 初始化新项目的三方联动框架
powershell -File scripts/init-tri-link.ps1 -RepoName "my-project"

# 一键推送到所有平台
git push-all

# 同步到 Gitee
git sync-gitee -RepoName "my-project"
```

## 全局 Git 别名

```bash
git push-all          # 推送到所有配置的远程仓库
git sync-gitee        # 同步到 Gitee
git tri-init          # 初始化新的三方联动项目
```

## 工具栈

| 类别 | 工具 | 用途 |
|------|------|------|
| **编辑器** | Cursor / VS Code + Copilot | 主开发环境 |
| **Agent** | Claude Code / OpenCode | 终端 AI 助手 |
| **CLI** | gh (GitHub CLI) | PR/Issue 管理 |
| **MCP** | Filesystem + GitHub | 本地文件 + 仓库集成 |
| **CI/CD** | GitHub Actions | 自动同步 |

## 目录结构

```
tri-link-test/
├── .github/
│   ├── workflows/
│   │   └── sync.yml          # GitHub Actions 同步工作流
│   └── FUNDING.yml           # 爱发电赞助链接
├── scripts/
│   ├── init-tri-link.ps1     # 项目初始化脚本
│   ├── push-all.ps1          # 一键推送脚本
│   └── sync-to-gitee.ps1     # Gitee 同步脚本
├── DEVELOPMENT_PLAN.md       # 开发计划
├── MONETIZATION_PLAN.md      # 变现计划
├── CONTRIBUTING.md           # 贡献指南
├── LICENSE                   # MIT License
└── README.md
```

## 相关资源

- [开发计划](DEVELOPMENT_PLAN.md)
- [变现计划](MONETIZATION_PLAN.md)
- [配置报告](../tri-link-setup-report.html)
- [GitHub 开发趋势 2026](../github-development-trends-2026.html)

## 许可证

[MIT License](LICENSE) - 自由使用、修改和分发。
