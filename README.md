# 🔗 Tri-Link Test — 三端联动测试项目

> **跨平台联动测试框架** — GitHub · Gitee · GitCode 同步验证  
> 用于测试多平台协作工作流

[![GitHub Stars](https://img.shields.io/github/stars/Zeon7744/tri-link-test?style=social)](https://github.com/Zeon7744/tri-link-test)
[![GitHub Forks](https://img.shields.io/github/forks/Zeon7744/tri-link-test?style=social)](https://github.com/Zeon7744/tri-link-test/forks)
[![GitHub License](https://img.shields.io/github/license/Zeon7744/tri-link-test)](https://github.com/Zeon7744/tri-link-test/blob/main/LICENSE)
[![Gitee Stars](https://gitee.com/Zeon7744/tri-link-test/badge/star.svg?theme=gvp)](https://gitee.com/Zeon7744/tri-link-test)

---

## 📌 这是 GitHub 官方主仓

> **Gitee 镜像**: [gitee.com/Zeon7744/tri-link-test](https://gitee.com/Zeon7744/tri-link-test)

Issues 和 PR 请在 GitHub 提交。

---

## ⚡ 快速开始

```bash
git clone https://github.com/Zeon7744/tri-link-test.git
cd tri-link-test

# 冒烟测试（9 项，验证三端 workflow / JS 核心 / 收款门控）
./smoke_test.sh

# 一键演示（含 agent-cli 三端同步检查）
./run.sh
```

> 需要 Node.js 18+；无需 Python。test_sync.py 已改为 JS 工具链，见 `agent/test/`。

---

## 🛠️ 测试内容

| 测试项 | 说明 |
|--------|------|
| **GitHub → Gitee** | 单向镜像同步验证 |
| **GitHub → GitCode** | 单向镜像同步验证 |
| **冲突检测** | 多端冲突自动解决 |
| **Commit 追踪** | 提交历史完整性验证 |

---

## 📁 项目结构

```
tri-link-test/
├── test_sync.py       # 同步测试脚本
├── test_conflict.py   # 冲突处理测试
├── requirements.txt   # 依赖列表
└── README.md         # 项目文档
```

---

## ⚠️ 注意事项

- 本仓库用于内部测试
- 不保证生产环境稳定性

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

**开发者**: Zeon7744  
**最后更新**: 2026-09-25  
**GitHub**: https://github.com/Zeon7744/tri-link-test


---

## 💛 支持 & 发布（爱发电双通道）

本仓通过**爱发电**完成「**创作者赞赏/订阅收款**」与「**作品/内容社区发布**」双通道运营，二者共存：

| 通道 | 用途 | 入口 |
|------|------|------|
| 💰 爱发电收款 | 赞赏、订阅、Pro 会员、赞助维护 | [爱发电 @Zeon7744](https://afdian.net/@Zeon7744) |
| 📣 爱发电社区发布 | 作品展示、内容连载、粉丝互动、发布分发 | [爱发电社区 @Zeon7744](https://afdian.com/user/0c59dda8a1bb11f19b9552540025c377) |

- **收款**：赞赏 / 订阅 Pro / 企业赞助，支付宝 + 微信支付，无需备案域名
- **社区发布**：把本仓产出（作品 / 剧本 / 工具演示 / 案例）在爱发电社区连载发布，沉淀粉丝、引流回仓
- 两通道独立共存，按需选用；收款不强制绑定社区发布

> 本仓内容仅供创作参考，发布前请完成人工合规审查与平台备案。

---

## 🎯 定价理念：先体验，后付费

**以人为本，让使用者深度体验价值后再做决定：**

- **免费额度拉满**：所有仓库的免费版本提供足够深度的体验额度，不人为设限——把核心能力先跑起来，让你真正用到
- **深度体验再付费**：付费版解锁的是更高频次、更完整功能、更高级资源（模板/工具/分成），不是限制基础体验
- **你的反馈驱动迭代**：每一条回馈都是产品优化的第一手依据，我们据此持续完善

## 💬 用户回馈（驱动迭代）

**使用中发现任何问题、想法、建议 → 直接回馈，驱动下一版：**

| 方式 | 入口 | 说明 |
|------|------|------|
| 社区评论 | [爱发电社区 @Zeon7744](https://afdian.com/user/0c59dda8a1bb11f19b9552540025c377) | 作品下评论/留言，直接驱动迭代 |
| Issue | 本仓 GitHub / Gitee / GitCode 的 Issues | Bug / 功能建议 / 定价反馈 |
| 赞赏反馈 | 爱发电赞赏留言 | 支持的同时留下使用心得 |

> 每一条回馈都是产品优化的第一手依据。不强制，但真诚欢迎。
