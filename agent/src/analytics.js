'use strict';
/**
 * Analytics - Real-time data analysis and insights
 */
class Analytics {
  constructor(brain, memory) {
    this.brain = brain;
    this.memory = memory;
  }

  analyze() {
    const taskHistory = this.brain.data.experience.taskHistory;
    const tasks = this.memory.data.tasks;
    const completed = this.memory.data.completedTasks;
    const metrics = this.memory.data.metrics;

    return {
      timestamp: new Date().toISOString(),
      summary: this._summary(taskHistory, tasks, completed, metrics),
      trends: this._trends(taskHistory),
      risks: this._identifyRisks(taskHistory, tasks),
      opportunities: this._findOpportunities(taskHistory, metrics),
      recommendations: this._generateRecommendations(taskHistory, tasks, metrics),
    };
  }

  _summary(history, tasks, completed, metrics) {
    const total = history.length;
    const success = history.filter(t => t.success).length;
    const avgDuration = total > 0 ? Math.round(history.reduce((s, t) => s + (t.duration || 0), 0) / total) : 0;
    return {
      totalTasks: total,
      completedTasks: completed.length,
      pendingTasks: tasks.length,
      successRate: total > 0 ? Math.round(success / total * 100) + '%' : 'N/A',
      avgDurationSeconds: avgDuration,
      patternsDiscovered: this.brain.data.metrics.patternsDiscovered,
      learningCycles: this.brain.data.metrics.learningCycles,
    };
  }

  _trends(history) {
    if (history.length < 3) return { trend: 'insufficient_data', note: 'Need at least 3 tasks to detect trends' };
    const recent = history.slice(-5);
    const recentSuccess = recent.filter(t => t.success).length / recent.length;
    const older = history.slice(-10, -5);
    const olderSuccess = older.length > 0 ? older.filter(t => t.success).length / older.length : 0;
    let trend = 'stable';
    if (recentSuccess > olderSuccess + 0.2) trend = 'improving';
    else if (recentSuccess < olderSuccess - 0.2) trend = 'declining';
    return {
      trend,
      recentSuccessRate: Math.round(recentSuccess * 100) + '%',
      olderSuccessRate: Math.round(olderSuccess * 100) + '%',
      note: trend === 'improving' ? 'Success rate is increasing' : trend === 'declining' ? 'Success rate is decreasing, review errors' : 'Performance is stable',
    };
  }

  _identifyRisks(history, tasks) {
    const risks = [];
    const recentErrors = this.brain.data.experience.failedPatterns;
    if (recentErrors.length >= 3) {
      risks.push({ level: 'high', type: 'error_pattern', message: recentErrors.length + ' recent failures detected.' });
    }
    if (tasks.length > 10) {
      risks.push({ level: 'medium', type: 'task_bottleneck', message: tasks.length + ' pending tasks may cause bottleneck.' });
    }
    if (history.length >= 5) {
      const longTasks = history.filter(t => t.duration > 300);
      if (longTasks.length > history.length * 0.3) {
        risks.push({ level: 'medium', type: 'duration_spike', message: 'Many tasks >5min. Break into smaller sub-tasks.' });
      }
    }
    return risks;
  }

  _findOpportunities(history, metrics) {
    const opportunities = [];
    const categoryCounts = {};
    for (const task of history) {
      const cat = task.category || 'unknown';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    for (const [cat, count] of Object.entries(categoryCounts)) {
      if (count >= 3) {
        opportunities.push({ type: 'pattern_mastery', category: cat, count, message: 'Mastered ' + cat + ' (' + count + ' tasks). Create reusable templates.' });
      }
    }
    if (metrics.totalCommits >= 5) {
      opportunities.push({ type: 'content_creation', message: 'Accumulated enough commits for a technical blog post.' });
    }
    return opportunities;
  }

  _generateRecommendations(history, tasks, metrics) {
    const recs = [];
    const trend = this._trends(history);
    if (trend.trend === 'declining') {
      recs.push({ priority: 'high', action: 'Review recent failures and update error patterns.' });
    }
    if (tasks.length > 0) {
      recs.push({ priority: 'medium', action: 'Continue with ' + tasks.length + ' pending tasks. Use --auto to execute.' });
    }
    if (history.length >= 5 && metrics.totalCommits > 0) {
      recs.push({ priority: 'low', action: 'Consider publishing a technical article about the development journey.' });
    }
    recs.push({ priority: 'low', action: 'Run --check regularly to monitor GitHub/Gitee/AFDian health.' });
    return recs;
  }

  monetizationScore() {
    const history = this.brain.data.experience.taskHistory;
    const metrics = this.memory.data.metrics;
    let score = 0;
    const details = [];

    if (metrics.stars >= 10) { score += 20; details.push('GitHub stars >= 10 (+20)'); }
    else if (metrics.stars >= 1) { score += 10; details.push('GitHub stars >= 1 (+10)'); }
    else { details.push('No GitHub stars yet (0/20)'); }

    if (history.length >= 20) { score += 25; details.push('Rich history 20+ tasks (+25)'); }
    else if (history.length >= 10) { score += 15; details.push('Moderate history 10+ tasks (+15)'); }
    else if (history.length >= 5) { score += 5; details.push('Basic history (+5)'); }
    else { details.push('Limited history (0/25)'); }

    const docFiles = ['README.md', 'DEVELOPMENT_PLAN.md', 'MONETIZATION_PLAN.md'];
    const docCount = docFiles.filter(f => require('fs').existsSync(require('path').join(process.cwd(), f))).length;
    score += docCount * 10;
    details.push(docCount + '/3 docs present (+' + (docCount * 10) + ')');

    if (metrics.totalCommits >= 10) { score += 20; details.push('Active development 10+ commits (+20)'); }
    else if (metrics.totalCommits >= 5) { score += 10; details.push('Some activity (+10)'); }

    if (require('fs').existsSync(require('path').join(process.cwd(), 'agent/test/integration.js'))) {
      score += 15; details.push('Test suite exists (+15)');
    }

    return { score: Math.min(100, score), details, level: score >= 70 ? 'ready' : score >= 40 ? 'building' : 'early' };
  }
}

module.exports = { Analytics };
