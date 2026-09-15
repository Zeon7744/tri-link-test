'use strict';

/**
 * Planner - Breaks requirements into actionable task sequences
 */

const PRIORITIES = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const CATEGORIES = {
  feature: '功能开发',
  fix: '缺陷修复',
  docs: '文档完善',
  infra: '基础设施',
  devops: '运维部署',
  monetize: '变现相关',
  research: '调研分析',
};

class Planner {
  constructor(memory) {
    this.memory = memory;
  }

  /**
   * Parse a natural language requirement into structured tasks
   */
  parseRequirement(requirement) {
    const req = requirement.toLowerCase();
    const tasks = [];

    // Detect intent patterns
    if (req.includes('mcp') || req.includes('mcp')) {
      tasks.push(...this._parseMCPReq(req));
    }
    if (req.includes('dashboard') || req.includes('面板') || req.includes('监控')) {
      tasks.push(...this._parseDashboardReq(req));
    }
    if (req.includes('blog') || req.includes('博客') || req.includes('文章')) {
      tasks.push(...this._parseBlogReq(req));
    }
    if (req.includes('变现') || req.includes('赚钱') || req.includes('monetiz')) {
      tasks.push(...this._parseMonetizeReq(req));
    }
    if (req.includes('push') || req.includes('推送') || req.includes('同步')) {
      tasks.push(...this._parseSyncReq(req));
    }
    if (req.includes('agent') || req.includes('自动') || req.includes('自动化')) {
      tasks.push(...this._parseAgentReq(req));
    }
    if (req.includes('skill') || req.includes('技能')) {
      tasks.push(...this._parseSkillReq(req));
    }
    if (req.includes('star') || req.includes('stars') || req.includes('关注')) {
      tasks.push(...this._parseStarReq(req));
    }
    if (req.includes('sponsor') || req.includes('赞助') || req.includes('afdian')) {
      tasks.push(...this._parseSponsorReq(req));
    }
    if (req.includes('docs') || req.includes('文档') || req.includes('指南')) {
      tasks.push(...this._parseDocsReq(req));
    }

    // Default: create a general development task
    if (tasks.length === 0) {
      tasks.push({
        title: requirement,
        description: requirement,
        category: 'feature',
        priority: 'medium',
        estimate: '2-4h',
        commands: [`echo "Implement: ${requirement}"`],
      });
    }

    // Sort by priority
    tasks.sort((a, b) => PRIORITIES[a.priority] - PRIORITIES[b.priority]);
    return tasks;
  }

  _parseMCPReq(req) {
    return [
      { title: '创建 MCP 服务器模板', description: '基于现有 afdian-mcp 模式创建新 MCP 服务器', category: 'feature', priority: 'high', estimate: '1-2h', commands: [] },
      { title: '编写 MCP 配置文档', description: '创建 MCP 服务器配置示例和安装指南', category: 'docs', priority: 'medium', estimate: '30min', commands: [] },
      { title: '添加测试用例', description: '为 MCP 服务器添加集成测试', category: 'feature', priority: 'medium', estimate: '1h', commands: [] },
    ];
  }

  _parseDashboardReq(req) {
    return [
      { title: '完善 Dashboard API', description: '实现 GitHub stats + AFDian stats 聚合 API', category: 'feature', priority: 'high', estimate: '2h', commands: [] },
      { title: '添加数据可视化', description: '集成图表库展示赞助趋势和提交统计', category: 'feature', priority: 'medium', estimate: '3h', commands: [] },
      { title: '实现自动刷新', description: 'WebSocket 或轮询实现实时数据更新', category: 'feature', priority: 'low', estimate: '1h', commands: [] },
    ];
  }

  _parseBlogReq(req) {
    return [
      { title: '撰写技术博客文章', description: '基于当前开发经验输出技术文章', category: 'monetize', priority: 'high', estimate: '2-4h', commands: [] },
      { title: '发布到掘金/V2EX', description: '将文章发布到技术社区获取曝光', category: 'monetize', priority: 'high', estimate: '30min', commands: [] },
      { title: '同步到知乎/GitHub Blog', description: '多平台分发扩大影响力', category: 'monetize', priority: 'medium', estimate: '30min', commands: [] },
    ];
  }

  _parseMonetizeReq(req) {
    return [
      { title: '完善爱发电赞助页面', description: '添加赞助者感谢页面和权益说明', category: 'monetize', priority: 'high', estimate: '1h', commands: [] },
      { title: '创建付费教程大纲', description: '规划 MCP 配置 / AI 工具链付费内容', category: 'monetize', priority: 'high', estimate: '1h', commands: [] },
      { title: '设置赞助档位', description: '在爱发电设置 ¥5/¥20/¥50 三档赞助', category: 'monetize', priority: 'medium', estimate: '30min', commands: [] },
      { title: '创建 Gumroad/Patreon 页面', description: '扩展变现渠道', category: 'monetize', priority: 'low', estimate: '2h', commands: [] },
    ];
  }

  _parseSyncReq(req) {
    return [
      { title: '增强 CI/CD 同步', description: 'GitHub Actions 自动同步到 Gitee', category: 'infra', priority: 'high', estimate: '1h', commands: [] },
      { title: '添加 Gitee webhook', description: '实现 Gitee 推送时反向同步到 GitHub', category: 'infra', priority: 'medium', estimate: '1h', commands: [] },
      { title: '冲突检测机制', description: '双平台冲突自动检测和解决', category: 'infra', priority: 'low', estimate: '2h', commands: [] },
    ];
  }

  _parseAgentReq(req) {
    return [
      { title: '实现 Agent 核心循环', description: '需求解析 → 规划 → 执行 → 反馈闭环', category: 'feature', priority: 'critical', estimate: '4h', commands: [] },
      { title: '添加记忆持久化', description: 'JSON 存储项目上下文和决策历史', category: 'infra', priority: 'high', estimate: '2h', commands: [] },
      { title: '实现自动 commit + push', description: 'Agent 完成开发后自动提交到双平台', category: 'devops', priority: 'high', estimate: '1h', commands: [] },
      { title: '添加错误恢复机制', description: '任务失败自动重试或降级处理', category: 'infra', priority: 'medium', estimate: '2h', commands: [] },
    ];
  }

  _parseSkillReq(req) {
    return [
      { title: '创建 Agent Skill 定义', description: '编写 SKILL.md 和 skill.json 元数据', category: 'feature', priority: 'high', estimate: '1h', commands: [] },
      { title: '发布到 GitHub Skills Registry', description: '通过 gh skill publish 发布', category: 'devops', priority: 'medium', estimate: '30min', commands: [] },
      { title: '添加多平台兼容测试', description: '验证 Skill 在 Claude Code / Cursor / Codex 中的兼容性', category: 'feature', priority: 'medium', estimate: '1h', commands: [] },
    ];
  }

  _parseStarReq(req) {
    return [
      { title: '优化 README 可读性', description: '添加徽章、架构图、快速开始，提升 star 转化率', category: 'docs', priority: 'high', estimate: '1h', commands: [] },
      { title: '添加 Demo 视频/GIF', description: '在项目首页添加演示动图', category: 'docs', priority: 'medium', estimate: '2h', commands: [] },
      { title: '技术社区推广', description: '在 V2EX / 掘金 / Reddit 分享项目', category: 'monetize', priority: 'high', estimate: '1h', commands: [] },
      { title: 'GitHub Trending 策略', description: '选择合适的发布时间窗口', category: 'monetize', priority: 'low', estimate: '30min', commands: [] },
    ];
  }

  _parseSponsorReq(req) {
    return [
      { title: '集成 AFDian MCP 数据到 README', description: '自动显示最新赞助者列表', category: 'feature', priority: 'high', estimate: '1h', commands: [] },
      { title: '添加赞助者感谢页面', description: '专门页面展示赞助者贡献', category: 'feature', priority: 'medium', estimate: '1h', commands: [] },
      { title: '设置赞助里程碑通知', description: '达到 N 个赞助者时自动通知', category: 'feature', priority: 'low', estimate: '30min', commands: [] },
    ];
  }

  _parseDocsReq(req) {
    return [
      { title: '编写 API 文档', description: '为所有脚本和 MCP 工具编写详细文档', category: 'docs', priority: 'high', estimate: '2h', commands: [] },
      { title: '添加架构图', description: '绘制系统架构和数据流图', category: 'docs', priority: 'medium', estimate: '1h', commands: [] },
      { title: '创建 FAQ', description: '整理常见问题和解决方案', category: 'docs', priority: 'low', estimate: '1h', commands: [] },
    ];
  }

  /**
   * Generate a full plan from a requirement
   */
  createPlan(requirement, options = {}) {
    const tasks = this.parseRequirement(requirement);
    const plan = {
      title: requirement,
      description: options.description || '',
      tasks,
      status: 'planned',
      priority: options.priority || 'medium',
      tags: options.tags || [],
    };
    this.memory.addPlan(plan);
    tasks.forEach(t => this.memory.addTask(t));
    return plan;
  }

  /**
   * Get next task to execute
   */
  getNextTask() {
    const { tasks } = this.memory.data;
    if (tasks.length === 0) return null;
    // Return highest priority pending task
    return tasks.sort((a, b) => PRIORITIES[a.priority] - PRIORITIES[b.priority])[0];
  }
}

module.exports = { Planner };
