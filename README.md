# tri-link-test

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/Zeon7744/tri-link-test?style=social)](https://github.com/Zeon7744/tri-link-test)
[![Gitee Mirror](https://gitee.com/Zeon7744/tri-link-test/widgets/widget_1.svg)](https://gitee.com/Zeon7744/tri-link-test)
[![爱发电赞助](https://img.shields.io/badge/赞助-爱发电-orange)](https://afdian.com/a/Zeon7744)
[![GitHub Actions](https://github.com/Zeon7744/tri-link-test/actions/workflows/sync.yml/badge.svg)](https://github.com/Zeon7744/tri-link-test/actions)

GitHub + Gitee + 爱发电三方联动框架与工具链

---

## 项目简介

一个用于演示和测试 **GitHub + Gitee + 爱发电** 三方联动开发的完整框架。集成了 Git 工作流脚本、CI/CD 自动化、MCP 服务器配置指南以及 AI 开发工具链推荐。

### 核心功能

- **双平台推送**: 一键推送到 GitHub 和 Gitee
- **自动同步**: GitHub -> Gitee 自动镜像同步
- **赞助集成**: 爱发电 (Afdian) FUNDING.yml 配置
- **工具链文档**: MCP 服务器 + Agent Skills 配置指南

---

## 快速开始

### 初始化新项目

```bash
# 使用全局 Git 别名 (推荐)
git tri-init -RepoName "my-project"

# 或直接运行脚本
powershell -File scripts/init-tri-link.ps1 -RepoName "my-project"
```

### 推送代码

```bash
# 一键推送到所有平台
git push-all

# 仅同步到 Gitee
git sync-gitee -RepoName "my-project"
```

### 全局 Git 别名

```bash
git push-all          # 推送到所有配置的远程仓库
git sync-gitee        # 同步到 Gitee
git tri-init          # 初始化新的三方联动项目
```

---

## 架构概览

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GitHub    │◄───►│  tri-link   │◄───►│   Gitee     │
│  (主仓库)    │     │  scripts/   │     │  (镜像仓库)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │           ┌───────┴───────┐           │
       │           │  GitHub       │           │
       │           │  Actions      │           │
       │           │  (CI/CD)      │           │
       │           └───────────────┘           │
       │                                       │
       ▼                                       ▼
┌─────────────────────────────────────────────────────┐
│                  爱发电 (Afdian)                     │
│              FUNDING.yml 赞助集成                    │
└─────────────────────────────────────────────────────┘
```

---

## 目录结构

```
tri-link-test/
├── .github/
│   ├── workflows/
│   │   ├── sync.yml            # GitHub Actions 同步工作流
│   │   └── gitee-sync.yml      # Gitee 自动同步工作流
│   ├── FUNDING.yml             # 爱发电赞助链接
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE.md
├── docs/
│   └── GUIDE.md                # 完整使用指南
├── mcp-config/
│   └── README.md               # MCP 服务器配置示例
├── scripts/
│   ├── init-tri-link.ps1       # 项目初始化脚本
│   ├── push-all.ps1            # 一键推送脚本
│   └── sync-to-gitee.ps1       # Gitee 同步脚本
├── DEVELOPMENT_PLAN.md         # 开发计划
├── MONETIZATION_PLAN.md        # 变现计划
├── CONTRIBUTING.md             # 贡献指南
├── SECURITY.md                 # 安全政策
├── CODE_OF_CONDUCT.md          # 行为准则
├── CHANGELOG.md                # 版本历史
├── AFDIAN_SETUP.md             # 爱发电配置指南
├── LICENSE                     # MIT License
└── README.md
```

---

## 工具栈

| 类别 | 工具 | 用途 |
|------|------|------|
| **编辑器** | Cursor / VS Code + Copilot | 主开发环境 |
| **Agent** | Claude Code / OpenCode | 终端 AI 助手 |
| **CLI** | gh (GitHub CLI) | PR/Issue 管理 |
| **MCP** | Filesystem + GitHub | 本地文件 + 仓库集成 |
| **CI/CD** | GitHub Actions | 自动同步 |

---

## 开发状态

| 组件 | 状态 | 说明 |
|------|------|------|
| GitHub 仓库 | ✅ 已创建 | https://github.com/Zeon7744/tri-link-test |
| Gitee 镜像 | ✅ 已同步 | https://gitee.com/Zeon7744/tri-link-test |
| 爱发电赞助 | ✅ API打通 | FUNDING.yml 已配置 |
| SSH 双账户 | ✅ 已配置 | GitHub + Gitee |
| Git 别名 | ✅ 已配置 | push-all / sync-gitee / tri-init |
| CI/CD 工作流 | ✅ 已部署 | GitHub Actions |
| 项目文档 | ✅ 完善 | 含开发计划、变现计划、指南 |

详细开发计划请查看 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)

---

## 变现潜力

| 路径 | 当前状态 | 预期收入 |
|------|---------|---------|
| 爱发电赞助 | ✅ 已配置 | ¥20-200/月 |
| 技术博客 | 🔄 规划中 | 品牌积累 |
| MCP 教程 | 📋 待启动 | ¥500-5,000/月 |
| 技术咨询 | ⏳ 待启动 | ¥500-2,000/次 |

详细分析请查看 [MONETIZATION_PLAN.md](MONETIZATION_PLAN.md)

---

## 相关资源

- [开发计划](DEVELOPMENT_PLAN.md)
- [变现计划](MONETIZATION_PLAN.md)
- [使用指南](docs/GUIDE.md)
- [贡献指南](CONTRIBUTING.md)
- [安全政策](SECURITY.md)
- [爱发电配置](AFDIAN_SETUP.md)
- [MCP 配置示例](mcp-config/README.md)
- [GitHub 开发趋势 2026](../github-development-trends-2026.html)
- [配置报告](../tri-link-setup-report.html)

---

## 许可证

[MIT License](LICENSE) — 自由使用、修改和分发。

---

## 感谢赞助

如果这个项目对你有帮助，欢迎在爱发电上支持我：

🔗 [https://afdian.com/a/Zeon7744](https://afdian.com/a/Zeon7744)
