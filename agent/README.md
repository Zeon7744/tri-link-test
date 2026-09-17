# Tri-Link Autonomous Agent

全自动开发 Agent 系统 — 接收需求、自动规划、逐步开发、持续运维。

## 架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────►│   Agent     │────►│  Planner    │────►│  Executor   │
│  (CLI/Web)  │◄────│  Core Loop  │     │  (任务拆解)  │     │  (自动执行)  │
└─────────────┘     └──────┬──────┘     └─────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Memory    │◄───►│    Ops      │
                    │  (JSON存储)  │     │  (健康监控)  │
                    └─────────────┘     └─────────────┘
```

## 快速开始

```bash
# 查看状态
node bin/agent-cli.js --status

# 运行健康检查
node bin/agent-cli.js --check

# 交互式模式
node bin/agent-cli.js

# 单条需求
node bin/agent-cli.js "创建一个 GitHub MCP 服务器"
```

## Agent 命令

| 命令 | 说明 |
|------|------|
| `status` | 查看项目状态和待处理任务 |
| `require <需求>` | 提出开发需求，自动规划和执行 |
| `run` | 自动执行所有待处理任务 |
| `plan` | 查看当前计划 |
| `tasks` | 列出所有待处理任务 |
| `memory` | 查看记忆摘要 |
| `clear` | 清空待处理任务 |
| `quit` | 退出 |
| `auto-sync` | 自动 commit + 推送 GitHub/Gitee |

## 需求示例

```
node bin/agent-cli.js "添加 GitHub MCP 服务器"
node bin/agent-cli.js "完善 Dashboard 数据可视化"
node bin/agent-cli.js "写一篇 MCP 配置教程博客"
node bin/agent-cli.js "优化爱发电赞助页面"
node bin/agent-cli.js "创建 Agent Skill 并发布"
```

## 记忆存储

Agent 状态持久化到 `~/.tri-link/memory.json`，包含：
- 项目上下文和历史决策
- 计划列表和任务队列
- 执行指标（stars、赞助者、收入等）
- Agent 状态和会话历史
