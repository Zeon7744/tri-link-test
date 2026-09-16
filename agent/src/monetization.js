'use strict';
/**
 * Monetization Planner - Strategic monetization planning and tracking
 */
const fs = require('fs');
const path = require('path');

class MonetizationPlanner {
  constructor(memory, analytics) {
    this.memory = memory;
    this.analytics = analytics;
  }

  /**
   * Create a monetization plan based on current project state
   */
  createPlan() {
    const score = this.analytics.monetizationScore();
    const history = this.memory.data.history || [];
    const metrics = this.memory.data.metrics;

    const plan = {
      created: new Date().toISOString(),
      readiness: score,
      phases: [],
      revenueStreams: [],
    };

    // Phase 1: Foundation (always start here)
    plan.phases.push({
      id: 'foundation',
      name: '基础建设',
      priority: 'critical',
      conditions: [],
      tasks: this._foundationTasks(),
    });

    // Phase 2: Content (if enough history)
    if (score.score >= 30 || history.length >= 5) {
      plan.phases.push({
        id: 'content',
        name: '内容输出',
        priority: 'high',
        conditions: ['有5+任务历史'],
        tasks: this._contentTasks(),
      });
    }

    // Phase 3: Products (if stars or revenue)
    if (metrics.stars >= 10 || metrics.afdianSponsors >= 3) {
      plan.phases.push({
        id: 'products',
        name: '产品化',
        priority: 'medium',
        conditions: ['Stars >= 10 或 赞助者 >= 3'],
        tasks: this._productTasks(),
      });
    }

    // Phase 4: Scale (if revenue existing)
    if (metrics.monthlyIncome >= 50) {
      plan.phases.push({
        id: 'scale',
        name: '规模化',
        priority: 'low',
        conditions: ['月收入 >= 50元'],
        tasks: this._scaleTasks(),
      });
    }

    plan.revenueStreams = this._identifyStreams(metrics, score);
    return plan;
  }

  _foundationTasks() {
    return [
      { title: '完善 README 介绍页', estimate: '2h', impact: '高', category: 'docs' },
      { title: '添加示例代码和演示', estimate: '4h', impact: '高', category: 'content' },
      { title: '配置 GitHub Sponsors', estimate: '30min', impact: '中', category: 'monetize' },
      { title: '创建项目徽章和指标展示', estimate: '1h', impact: '中', category: 'docs' },
    ];
  }

  _contentTasks() {
    return [
      { title: '撰写 MCP 配置教程', estimate: '3h', impact: '高', category: 'content' },
      { title: '发布技术博客到掘金/V2EX', estimate: '2h', impact: '高', category: 'marketing' },
      { title: '录制项目演示视频', estimate: '4h', impact: '中', category: 'content' },
      { title: '创建 GitHub Topics 标签', estimate: '30min', impact: '低', category: 'docs' },
    ];
  }

  _productTasks() {
    return [
      { title: '开发付费 MCP 高级版', estimate: '20h', impact: '高', category: 'product' },
      { title: '创建订阅制教程系列', estimate: '15h', impact: '高', category: 'product' },
      { title: '设置爱发电赞助档位', estimate: '1h', impact: '中', category: 'monetize' },
      { title: '开发企业定制服务页面', estimate: '8h', impact: '中', category: 'product' },
    ];
  }

  _scaleTasks() {
    return [
      { title: '建立邮件订阅列表', estimate: '4h', impact: '中', category: 'marketing' },
      { title: '开发自动化工具产品化', estimate: '40h', impact: '高', category: 'product' },
      { title: '探索企业级许可模式', estimate: '8h', impact: '高', category: 'business' },
      { title: '建立社区和Discord', estimate: '12h', impact: '中', category: 'community' },
    ];
  }

  _identifyStreams(metrics, score) {
    const streams = [];

    if (score.score >= 30) {
      streams.push({ name: '爱发电赞助', potential: '中等', status: '待启动', target: '月入200元' });
    }
    if (score.score >= 50) {
      streams.push({ name: '付费教程/文档', potential: '高', status: '规划中', target: '月入500元' });
    }
    if (metrics.stars >= 20) {
      streams.push({ name: 'GitHub Sponsors', potential: '高', status: '可选', target: '月入300元' });
    }
    if (score.score >= 60) {
      streams.push({ name: '技术咨询/定制', potential: '高', status: '规划中', target: '单笔500-5000元' });
    }
    if (score.score >= 70) {
      streams.push({ name: 'SaaS 工具订阅', potential: '极高', status: '长期规划', target: '月入2000元+' });
    }

    return streams;
  }

  /**
   * Update metrics from external data
   */
  updateFromExternal(data) {
    const metrics = this.memory.data.metrics;
    if (data.stars !== undefined) metrics.stars = data.stars;
    if (data.afdianSponsors !== undefined) metrics.afdianSponsors = data.afdianSponsors;
    if (data.monthlyIncome !== undefined) metrics.monthlyIncome = data.monthlyIncome;
    if (data.blogPosts !== undefined) metrics.blogPosts = data.blogPosts;
    this.memory.save();
  }
}

module.exports = { MonetizationPlanner };
