# tri-link-test — 三端联动开发计划

## 项目概况

| 属性 | 值 |
|------|------|
| **名称** | tri-link-test |
| **描述** | GitHub + Gitee + 爱发电三方联动开发框架 |
| **维护者** | Zeon7744 |
| **GitHub** | https://github.com/Zeon7744/tri-link-test |
| **Gitee** | https://gitee.com/Zeon7744/tri-link-test |
| **爱发电** | https://afdian.com/a/Zeon7744 |
| **许可证** | MIT |
| **版本** | 1.1.0 |

---

## 当前状态 (2026-09-15)

| 组件 | 状态 | 备注 |
|------|------|------|
| GitHub 仓库 | ✅ 已创建 | https://github.com/Zeon7744/tri-link-test |
| Gitee 镜像 | ✅ 已同步 | https://gitee.com/Zeon7744/tri-link-test |
| 爱发电赞助 | ✅ API打通 | FUNDING.yml 已配置 |
| SSH 双账户 | ✅ 已配置 | GitHub + Gitee |
| Git 别名 | ✅ 已配置 | push-all / sync-gitee / tri-init |
| CI/CD 工作流 | ✅ 已部署 | GitHub Actions (sync.yml + gitee-sync.yml) |
| 项目文档 | ✅ 完善 | README / GUIDE / CONTRIBUTING / SECURITY |
| MCP 配置 | ✅ 示例就绪 | filesystem + github + sentry |
| 变现计划 | ✅ 已制定 | 见 MONETIZATION_PLAN.md |
| 依赖监控 | ✅ 已配置 | dependabot.yml |

---

## 开发计划

### Phase 1: 基础架构完善 (2026-Q3) ✅ 已完成

#### 1.1 Git 工作流标准化
- [x] SSH 双 Host 配置 (GitHub + Gitee)
- [x] Git 全局身份配置 (Zeon7744)
- [x] Git 别名: `push-all`, `sync-gitee`, `tri-init`
- [x] 脚本文件入库 (scripts/)
- [x] CONTRIBUTING.md 编写
- [x] LICENSE (MIT) 添加
- [x] SECURITY.md 安全政策
- [x] CODE_OF_CONDUCT.md 行为准则
- [x] CHANGELOG.md 版本历史
- [x] .editorconfig 代码规范
- [x] .github/dependabot.yml 依赖监控
- [ ] GitHub 仓库描述更新 (需 gh auth)
- [ ] 仓库 Topics 标签设置 (需 gh auth)

#### 1.2 爱发电集成
- [x] API 凭证配置 (user_id + token)
- [x] FUNDING.yml 更新为 afdian.com
- [ ] 读取赞助者数据写入 README
- [ ] 设置爱发电自动同步脚本
- [ ] 订阅爱发电 webhook (可选)

---

### Phase 2: 工具链增强 (2026-Q3 ~ Q4) 🔄 进行中

#### 2.1 MCP 服务器集成
基于 [GitHub 开发趋势 2026](../github-development-trends-2026.html) 报告，优先安装核心 MCP 服务器：

- [x] Filesystem MCP — 本地文件读写 (配置示例已提供)
- [ ] GitHub MCP — PR 审查 / Issue 分类
- [ ] Sentry MCP — 错误分析与事件响应
- [x] 配置示例文档 (mcp-config/)

#### 2.2 Agent Skills 标准化
- [ ] 学习 `gh skill` 命令使用
- [ ] 为仓库创建自定义 Agent Skill
- [ ] 发布到 GitHub Skills Registry

#### 2.3 CI/CD 自动化增强
- [x] GitHub Actions 基础工作流 (sync.yml)
- [x] Gitee 同步工作流 (gitee-sync.yml)
- [ ] 自动同步到 Gitee (通过 API)
- [ ] 定期检查三方联动状态
- [x] PR 模板和 Issue 模板

---

### Phase 3: 高级功能 (2026-Q4+) 📋 规划中

#### 3.1 AI 辅助开发集成
- [ ] 配置 Claude Code 接入
- [ ] 配置 OpenCode/Crush 开源 Agent
- [ ] 建立代码审查流程

#### 3.2 监控与告警
- [ ] GitHub 提交数据分析
- [ ] 赞助者数量追踪
- [ ] 多平台状态监控面板

#### 3.3 内容输出
- [ ] 技术博客文章 (三方联动最佳实践)
- [ ] MCP 配置教程
- [ ] AI 开发工具链指南

---

## 工具推荐清单

### 编辑器 / IDE
| 工具 | 用途 | 价格 | 推荐指数 |
|------|------|------|---------|
| Cursor | 主开发 IDE | Free / $20 Pro | ⭐⭐⭐⭐⭐ |
| VS Code + Copilot | GitHub 生态集成 | $10 Pro | ⭐⭐⭐⭐ |
| Claude Code | 终端 Agent | $20 Pro 起 | ⭐⭐⭐⭐⭐ |
| OpenCode / Crush | 开源备选 | Free | ⭐⭐⭐⭐ |

### CLI 工具
| 工具 | 用途 | 安装方式 |
|------|------|---------|
| gh (GitHub CLI) | PR / Issue 管理 | `gh skill install ...` |
| git | 版本控制 | 已配置 |
| scripts/*.ps1 | 三方联动脚本 | 已配置 |

### MCP 服务器
| 服务器 | 类别 | 优先级 | 状态 |
|--------|------|--------|------|
| Filesystem | 本地文件 | P0 | ✅ 配置示例就绪 |
| GitHub | 开发工具 | P0 | 📋 待安装 |
| Sentry | 可观测性 | P1 | 📋 待安装 |
| PostgreSQL | 数据库 | P2 | 📋 待安装 |

---

## 里程碑

| 日期 | 里程碑 | 状态 |
|------|--------|------|
| 2026-09-07 | 三方联动基础配置完成 | ✅ 已完成 |
| 2026-09-15 | 爱发电 API 打通 + 项目结构完善 | ✅ 已完成 |
| 2026-09-15 | 全面文档化 + 安全策略 + 工具链 | ✅ 已完成 |
| 2026-Q3 | 工具链增强阶段 | 🔄 进行中 |
| 2026-Q4 | CI/CD 自动化完善 | ⏳ 待开始 |
| 2027+ | 高级 AI 集成 + 内容输出 | ⏳ 规划中 |

---

## 相关资源

- GitHub: https://github.com/Zeon7744/tri-link-test
- Gitee: https://gitee.com/Zeon7744/tri-link-test
- 爱发电: https://afdian.com/a/Zeon7744
- MCP 规范: https://modelcontextprotocol.io
- Agent Skills: https://agentskills.io
- 使用指南: [docs/GUIDE.md](docs/GUIDE.md)
- GitHub 开发趋势报告: [github-development-trends-2026.html](../github-development-trends-2026.html)
