'use strict';
/**
 * Brain - Self-learning engine for the Tri-Link Agent
 * Learns from task outcomes, user corrections, and execution patterns.
 */
const fs = require('fs');
const path = require('path');

const BRAIN_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.tri-link', 'brain.json');

class Brain {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(BRAIN_PATH)) return JSON.parse(fs.readFileSync(BRAIN_PATH, 'utf8'));
    } catch {}
    return this._default();
  }

  _default() {
    return {
      version: '2.0.0',
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      knowledge: {
        projectContext: {
          name: 'tri-link-test',
          stack: ['Node.js', 'PowerShell', 'GitHub', 'Gitee', 'AFDian', 'MCP'],
          language: 'zh-CN',
        },
        conventions: {
          commitStyle: 'Conventional Commits (feat/fix/chore/docs)',
          branchStyle: 'main',
          codingStyle: 'CommonJS',
          docStyle: 'Markdown with Chinese headers',
        },
        apiKnowledge: {
          afdian: {
            endpoint: '/query-sponsor',
            method: 'POST',
            signatureFormat: 'md5(token + "params" + paramsJson + "ts" + ts + "user_id" + userId)',
            responseCodeField: 'ec',
            successCode: 200,
          },
        },
        filePatterns: {
          mcpServer: ['src/server.js', 'src/client.js', 'bin/server.js', 'test/index.js', 'package.json', 'README.md'],
          dashboard: ['src/App.jsx', 'src/main.jsx', 'index.html', 'vite.config.js', 'server.js', 'package.json'],
        },
      },
      experience: { taskHistory: [], patternLibrary: {}, failedPatterns: [], successfulPatterns: [] },
      preferences: { autoCommit: true, autoPush: false, autoTest: true, verboseOutput: true },
      metrics: { totalTasks: 0, completedTasks: 0, failedTasks: 0, avgDuration: 0, patternsDiscovered: 0, learningCycles: 0 },
      reflections: [],
      config: { learningRate: 0.1, confidenceThreshold: 0.7, maxPatterns: 50, reflectionInterval: 5, autoImprove: true },
    };
  }

  save() {
    this.data.lastUpdated = new Date().toISOString();
    const dir = path.dirname(BRAIN_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BRAIN_PATH, JSON.stringify(this.data, null, 2), 'utf8');
  }

  learnFromTask(taskResult) {
    const { task, duration, success, error, insights = [] } = taskResult;
    this.data.experience.taskHistory.push({ id: task.id, title: task.title, category: task.category, priority: task.priority, duration, success, error: error ? error.substring(0, 500) : null, insights, timestamp: new Date().toISOString() });
    this.data.metrics.totalTasks++;
    if (success) this.data.metrics.completedTasks++; else this.data.metrics.failedTasks++;
    if (this.data.metrics.totalTasks > 0) {
      const history = this.data.experience.taskHistory.filter(t => t.duration);
      this.data.metrics.avgDuration = Math.round(history.reduce((s, t) => s + t.duration, 0) / history.length);
    }
    if (success && insights.length > 0) this._recordPattern(task, insights, true);
    else if (!success && this.data.config.learnFromErrors) this._recordFailure(task, error);
    if (this.data.metrics.totalTasks % this.data.config.reflectionInterval === 0) this._reflect();
    this.save();
  }

  _recordPattern(task, insights, success) {
    const key = task.category + ':' + task.priority;
    if (!this.data.experience.patternLibrary[key]) {
      this.data.experience.patternLibrary[key] = { trigger: task.title, insights, confidence: 0.8, successCount: 1, failCount: 0 };
      this.data.metrics.patternsDiscovered++;
    } else {
      this.data.experience.patternLibrary[key].insights = insights;
      this.data.experience.patternLibrary[key].confidence = Math.min(1, this.data.experience.patternLibrary[key].confidence + this.data.config.learningRate);
      this.data.experience.patternLibrary[key].successCount++;
    }
    this.data.experience.successfulPatterns.unshift({ ...task, insights, timestamp: new Date().toISOString() });
    if (this.data.experience.successfulPatterns.length > 20) this.data.experience.successfulPatterns.pop();
  }

  _recordFailure(task, error) {
    this.data.experience.failedPatterns.unshift({ title: task.title, category: task.category, error: error ? error.substring(0, 300) : 'unknown', timestamp: new Date().toISOString() });
    this.data.metrics.errorsFixed = (this.data.metrics.errorsFixed || 0) + 1;
    if (this.data.experience.failedPatterns.length > 20) this.data.experience.failedPatterns.pop();
    if (error && this.data.config.autoImprove) {
      const fix = this._generateFix(error);
      if (fix) {
        const key = 'fix:' + task.category + ':' + (error.substring(0, 50));
        this.data.experience.patternLibrary[key] = { trigger: error, fix, confidence: 0.5, successCount: 0, failCount: 1 };
      }
    }
  }

  _generateFix(error) {
    if (error.includes('permission') || error.includes('EACCES')) return 'Run with appropriate permissions';
    if (error.includes('not found') || error.includes('ENOENT')) return 'Check file paths and dependencies';
    if (error.includes('syntax') || error.includes('Unexpected token')) return 'Review generated code for syntax errors';
    if (error.includes('timeout')) return 'Increase timeout or check network';
    return null;
  }

  _reflect() {
    const recent = this.data.experience.taskHistory.slice(-10);
    const successRate = recent.length > 0 ? recent.filter(t => t.success).length / recent.length : 0;
    const insights = [];
    if (successRate < 0.5) insights.push('Low success rate. Review error patterns.');
    if (recent.some(t => t.duration > 120)) insights.push('Some tasks >2min. Consider breaking into smaller sub-tasks.');
    this.data.reflections.unshift({ time: new Date().toISOString(), successRate: Math.round(successRate * 100), insights, totalTasks: this.data.metrics.totalTasks });
    if (this.data.reflections.length > 20) this.data.reflections.pop();
    this.data.metrics.learningCycles++;
  }

  getPlanningHints(requirement) {
    const hints = [];
    const req = requirement.toLowerCase();
    const patterns = [
      { keywords: ['mcp', 'server'], pattern: 'mcp-server', estimate: '2-4h' },
      { keywords: ['dashboard', '面板', '监控'], pattern: 'dashboard', estimate: '3-6h' },
      { keywords: ['blog', '博客', '文章'], pattern: 'content', estimate: '1-2h' },
      { keywords: ['script', '脚本', 'automation'], pattern: 'automation', estimate: '1-3h' },
      { keywords: ['test', '测试'], pattern: 'testing', estimate: '1-2h' },
      { keywords: ['docs', '文档', 'guide'], pattern: 'documentation', estimate: '0.5-1h' },
      { keywords: ['api', '接口'], pattern: 'api-integration', estimate: '1-3h' },
      { keywords: ['deploy', '部署', 'ci-cd'], pattern: 'devops', estimate: '1-2h' },
      { keywords: ['star', 'stars', '推广'], pattern: 'marketing', estimate: '1-2h' },
      { keywords: ['sponsor', '赞助', 'afdian'], pattern: 'monetize', estimate: '1-2h' },
    ];
    for (const p of patterns) {
      if (p.keywords.some(k => req.includes(k))) {
        const hint = { pattern: p.pattern, estimate: p.estimate };
        const known = this.data.experience.patternLibrary[p.pattern];
        if (known) { hint.confidence = known.confidence; hint.lessons = known.insights; }
        hints.push(hint);
      }
    }
    return hints;
  }

  getErrorAvoidance(category) {
    return this.data.experience.failedPatterns.filter(p => p.category === category).map(p => ({ error: p.error, fix: p.fix || 'Review and retry' })).slice(0, 3);
  }

  getReport() {
    return {
      totalTasks: (this.data.metrics || {}).totalTasks || 0,
      completedTasks: (this.data.metrics || {}).completedTasks || 0,
      failedTasks: (this.data.metrics || {}).failedTasks || 0,
      successRate: this.data.metrics.totalTasks > 0 ? Math.round((this.data.metrics.completedTasks / this.data.metrics.totalTasks) * 100) + '%' : 'N/A',
      avgDuration: (this.data.metrics || {}).avgDuration || 0 + 's',
      patternsDiscovered: (this.data.metrics || {}).patternsDiscovered || 0,
      learningCycles: (this.data.metrics || {}).learningCycles || 0,
      recentReflections: this.data.reflections.slice(0, 3),
      errorPatterns: this.data.experience.failedPatterns.slice(0, 5),
    };
  }
}

module.exports = { Brain };
