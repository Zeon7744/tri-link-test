# @tri-link/afdian-mcp

爱发电 (AFDian) MCP 服务器 — 让 AI 助手读取赞助者数据

## 功能

- 获取创作者信息 (用户名、头像、简介)
- 获取赞助列表 (最近赞助者、赞助金额)
- 获取赞助统计 (总赞助数、月收入、赞助趋势)
- 获取指定赞助者的历史赞助记录

## 安装

```bash
npm install -g @tri-link/afdian-mcp
```

## 配置

创建配置文件 `~/.local/share/afdian-mcp/config.json`:

```json
{
  "user_id": "YOUR_AFDIAN_USER_ID",
  "token": "YOUR_AFDIAN_API_TOKEN",
  "api_base": "https://afdian.com/api/open"
}
```

## 在 Claude Code 中使用

添加到 `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "afdian": {
      "command": "npx",
      "args": ["-y", "@tri-link/afdian-mcp"]
    }
  }
}
```

## 工具列表

| 工具 | 描述 |
|------|------|
| `get_creator_info` | 获取创作者账号信息 |
| `list_sponsors` | 获取最近赞助者列表 |
| `get_sponsor_stats` | 获取赞助统计数据 |
| `get_sponsor_history` | 获取指定用户的赞助历史 |

## 本地开发

```bash
cd packages/afdian-mcp
npm install
npm run dev
```
