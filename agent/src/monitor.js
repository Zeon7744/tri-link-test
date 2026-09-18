'use strict';
/**
 * Monitor - Unified monitoring service
 * Combines health checks, analytics, and learning cycles
 * 
 * Ticks:
 *   - health:    every 5 min  — GitHub/Gitee/AFDian status + auto-fix
 *   - analytics: every 30 min — trends, risks, opportunities
 *   - learn:     after 5 tasks — Brain reflection + pattern update
 */
const { OpsAgent } = require('./ops');
const { Analytics } = require('./analytics');
const { Notification } = require('./notification');

class Monitor {
  constructor(agent) {
    this.agent = agent;
    this.ops = new OpsAgent(agent.memory);
    this.analytics = new Analytics(agent.brain, agent.memory);
    this.notification = new Notification({ project: agent.memory.data.project?.name || 'tri-link-test' });

    // Tick intervals (ms)
    this.healthInterval = 5 * 60 * 1000;   // 5 min
    this.analyticsInterval = 30 * 60 * 1000; // 30 min
    this.learnInterval = 5; // tasks

    this.timer = null;
    this.tasksSinceLastLearn = 0;
    this.lastHealthCheck = null;
    this.lastAnalyticsCheck = null;
    this.startTime = Date.now();
  }

  /**
   * Start continuous monitoring
   * @param {number} [intervalMs] - override default intervals
   */
  start(intervalMs) {
    if (this.timer) this.stop();
    if (intervalMs) {
      this.healthInterval = intervalMs;
      this.analyticsInterval = intervalMs * 6;
    }
    this._tick();
    this.timer = setInterval(() => this._tick(), this.healthInterval);
    this.notification.info('monitor', `Monitor started (health: ${this.healthInterval / 1000 / 60}min, analytics: ${this.analyticsInterval / 1000 / 60}min)`);
    console.log(`[Monitor] Started — health every ${this.healthInterval / 1000 / 60}min, analytics every ${this.analyticsInterval / 1000 / 60}min`);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.notification.info('monitor', 'Monitor stopped');
      console.log('[Monitor] Stopped');
    }
  }

  /**
   * Main tick — runs all checks sequentially
   */
  async _tick() {
    const now = Date.now();

    // Health check (always runs)
    await this._healthTick(now);

    // Analytics check (every ~6 health ticks = 30 min)
    if (now - (this.lastAnalyticsCheck || 0) >= this.analyticsInterval) {
      await this._analyticsTick(now);
    }

    // Learn check (after N tasks)
    if (this.tasksSinceLastLearn >= this.learnInterval) {
      await this._learnTick();
      this.tasksSinceLastLearn = 0;
    }
  }

  /**
   * Health check: ops status + auto-fix + metrics sync
   */
  async _healthTick(now) {
    this.lastHealthCheck = now;
    this.notification.info('health', 'Running health check...');
    try {
      const result = await this.ops.check();

      // Report status
      for (const [service, data] of Object.entries(result.checks)) {
        const icon = data.status === 'ok' ? '✓' : data.status === 'error' ? '✗' : '~';
        this.notification.info('health', `${icon} ${service}: ${data.message || data.status}`);
      }

      // Auto-fix critical issues
      for (const alert of result.alerts) {
        if (alert.level === 'error') {
          this.notification.warn('alert', `${alert.check}: ${alert.message}`);
          try {
            const fix = await this.ops.autoFix(alert);
            if (fix.fixed) {
              this.notification.success('fixed', `Auto-fixed: ${alert.check} — ${fix.action}`);
              this.agent.memory.addDecision({
                type: 'auto_fixed',
                check: alert.check,
                action: fix.action,
                time: new Date().toISOString(),
              });
            }
          } catch {}
        } else if (alert.level === 'warning') {
          this.notification.warn('alert', `${alert.check}: ${alert.message}`);
        }
      }

      // Sync external metrics
      await this._syncExternalMetrics();

      this.notification.success('health', `Health check complete — ${result.alerts.length} alerts`);
    } catch (err) {
      this.notification.error('health', `Health check failed: ${err.message}`);
    }
  }

  /**
   * Analytics tick: trends, risks, opportunities
   */
  async _analyticsTick(now) {
    this.lastAnalyticsCheck = now;
    this.notification.info('analytics', 'Running analytics...');
    try {
      const analysis = this.analytics.analyze();

      // Summary
      this.notification.info('analytics', `Tasks: ${analysis.summary.totalTasks} | Success: ${analysis.summary.successRate} | Patterns: ${analysis.summary.patternsDiscovered}`);

      // Trends
      if (analysis.trends.trend !== 'insufficient_data') {
        const trendIcon = analysis.trends.trend === 'improving' ? '↑' : analysis.trends.trend === 'declining' ? '↓' : '→';
        this.notification.info('trend', `${trendIcon} Performance: ${analysis.trends.trend} (${analysis.trends.note})`);
      }

      // Risks
      for (const risk of analysis.risks) {
        const icon = risk.level === 'high' ? '🔴' : '🟡';
        this.notification.warn('risk', `${icon} ${risk.type}: ${risk.message}`);
      }

      // Opportunities
      for (const opp of analysis.opportunities) {
        this.notification.info('opportunity', `[*] ${opp.type}: ${opp.message}`);
      }

      // Recommendations
      for (const rec of analysis.recommendations) {
        const prio = rec.priority === 'high' ? '!' : rec.priority === 'medium' ? '~' : '.';
        this.notification.info('recommendation', `${prio} ${rec.action}`);
      }

      this.notification.success('analytics', 'Analytics check complete');
    } catch (err) {
      this.notification.error('analytics', `Analytics failed: ${err.message}`);
    }
  }

  /**
   * Learn tick: Brain reflection + pattern update
   */
  async _learnTick() {
    this.notification.info('learn', 'Running learning cycle...');
    try {
      this.agent.brain._reflect();
      this.agent.brain.save();
      const report = this.agent.brain.getReport();
      this.notification.success('learn', `Learning cycle #${report.learningCycles} — success rate: ${report.successRate}`);
    } catch (err) {
      this.notification.error('learn', `Learning failed: ${err.message}`);
    }
  }

  /**
   * Sync external metrics from GitHub API
   */
  async _syncExternalMetrics() {
    try {
      const resp = await this.ops._httpGet('api.github.com/repos/Zeon7744/tri-link-test');
      const data = JSON.parse(resp);
      this.agent.memory.updateMetrics({
        stars: data.stargazers_count,
        forks: data.forks_count,
        lastSync: new Date().toISOString(),
      });
      this.notification.info('sync', `GitHub stats: stars=${data.stargazers_count} forks=${data.forks_count}`);
    } catch (err) {
      this.notification.warn('sync', `GitHub sync skipped: ${err.message.substring(0, 80)}`);
    }
  }

  /**
   * Manually mark task completion to trigger learn check
   */
  taskCompleted() {
    this.tasksSinceLastLearn++;
  }

  /**
   * Get current monitor status
   */
  getStatus() {
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    return {
      running: !!this.timer,
      uptimeSeconds: uptime,
      tasksSinceLastLearn: this.tasksSinceLastLearn,
      lastHealthCheck: this.lastHealthCheck ? new Date(this.lastHealthCheck).toISOString() : null,
      lastAnalyticsCheck: this.lastAnalyticsCheck ? new Date(this.lastAnalyticsCheck).toISOString() : null,
      intervals: {
        health: `${this.healthInterval / 1000 / 60}min`,
        analytics: `${this.analyticsInterval / 1000 / 60}min`,
        learn: `${this.learnInterval} tasks`,
      },
    };
  }

  /**
   * Get comprehensive report
   */
  getReport() {
    const health = this.lastHealthCheck ? {
      lastCheck: new Date(this.lastHealthCheck).toISOString(),
      status: this.ops.lastCheck?.checks || {},
    } : { lastCheck: null, status: {} };

    const analytics = this.lastAnalyticsCheck ? {
      lastCheck: new Date(this.lastAnalyticsCheck).toISOString(),
      analysis: this.analytics.analyze(),
    } : { lastCheck: null, analysis: null };

    return {
      ...this.getStatus(),
      health,
      analytics,
      notificationSummary: this.notification.getSummary(),
    };
  }
}

module.exports = { Monitor };
