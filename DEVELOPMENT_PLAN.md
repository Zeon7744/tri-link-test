# tri-link-test — 三端联动开发计划

## 项目概况

**名称**: tri-link-test
**描述**: GitHub + Gitee + 爱发电三方联动测试与开发计划
**维护者**: Zeon7744

---

## 当前状态

| 组件 | 状态 | 备注 |
|------|------|------|
| GitHub | ✅ 已推送 | https://github.com/Zeon7744/tri-link-test |
| Gitee | ✅ 已推送 | https://gitee.com/Zeon7744/tri-link-test |
| 爱发电 | ✅ API打通 | FUNDING.yml 已更新为 afdian.com 链接 |

---

## 开发计划

### Phase 1: 基础架构完善 (2026-Q3)

#### 1.1 Git工作流标准化
- [x] SSH双Host配置 (GitHub + Gitee)
- [x] Git全局身份配置 (Zeon7744)
- [x] Git别名: `push-all`, `sync-gitee`, `tri-init`
- [ ] 配置文件提交到仓库
- [ ] 编写CONTRIBUTING.md

#### 1.2 爱发电集成
- [x] API凭证配置 (user_id + token)
- [x] FUNDING.yml更新为afdian.com
- [ ] 读取赞助者数据写入README
- [ ] 设置爱发电自动同步脚本

### Phase 2: 工具链增强 (2026-Q3~Q4)

#### 2.1 MCP服务器集成
基于趋势报告，优先安装核心MCP服务器：
- [ ] Filesystem MCP — 本地文件读写
- [ ] GitHub MCP — PR审查/Issue分类
- [ ] Sentry MCP — 错误分析与事件响应
- [ ] 配置示例文档

#### 2.2 Agent Skills标准化
- [ ] 学习 `gh skill` 命令使用
- [ ] 为仓库创建自定义Agent Skill
- [ ] 发布到GitHub Skills Registry

#### 2.3 CI/CD自动化
- [ ] 配置GitHub Actions工作流
- [ ] 自动同步到Gitee
- [ ] 定期检查三方联动状态

### Phase 3: 高级功能 (2026-Q4+)

#### 3.1 AI辅助开发集成
- [ ] 配置Claude Code接入
- [ ] 配置OpenCode/Crush开源Agent
- [ ] 建立代码审查流程

#### 3.2 监控与告警
- [ ] GitHub提交数据分析
- [ ] 赞助者数量追踪
- [ ] 多平台状态监控

---

## 工具推荐清单

### 编辑器/IDE
| 工具 | 用途 | 价格 | 推荐指数 |
|------|------|------|---------|
| Cursor | 主开发IDE | Free/$20Pro | ⭐⭐⭐⭐⭐ |
| VS Code + Copilot | GitHub生态集成 | $10Pro | ⭐⭐⭐⭐ |
| Claude Code | 终端Agent | $20Pro含 | ⭐⭐⭐⭐⭐ |
| OpenCode/Crush | 开源备选 | Free | ⭐⭐⭐⭐ |

### CLI工具
| 工具 | 用途 | 安装方式 |
|------|------|---------|
| gh (GitHub CLI) | PR/Issue管理 | `gh skill install ...` |
| git | 版本控制 | 已配置 |
| afdian-link.ps1 | 爱发电API | 已配置 |

### MCP服务器
| 服务器 | 类别 | 优先级 |
|--------|------|--------|
| Filesystem | 本地文件 | P0 |
| GitHub | 开发工具 | P0 |
| Sentry | 可观测性 | P1 |
| PostgreSQL | 数据库 | P2 |

---

## 里程碑

| 日期 | 里程碑 | 状态 |
|------|--------|------|
| 2026-09-07 | 三方联动基础配置完成 | ✅ 已完成 |
| 2026-09-15 | 爱发电API打通 | ✅ 已完成 |
| 2026-Q3 | 工具链增强阶段启动 | 🔄 进行中 |
| 2026-Q4 | CI/CD自动化完成 | ⏳ 待开始 |
| 2027+ | 高级AI集成 | ⏳ 规划中 |

---

## 相关资源

- GitHub: https://github.com/Zeon7744/tri-link-test
- Gitee: https://gitee.com/Zeon7744/tri-link-test
- 爱发电: https://afdian.com/a/Zeon7744
- MCP规范: https://modelcontextprotocol.io
- Agent Skills: https://agentskills.io
