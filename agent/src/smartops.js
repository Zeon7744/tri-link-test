'use strict';
/**
 * SmartOps - Intelligent operations with auto-healing and prediction
 */
const { OpsAgent } = require('./ops');
const { Analytics } = require('./analytics');

class SmartOps {
  constructor(agent) {
    this.agent = agent;
    this.ops = new OpsAgent(agent.memory);
    this.analytics = new Analytics(agent.brain, agent.memory);
    this.checkInterval = 30 * 60 * 1000; // 30 min
    this.timer = null;
  }

  /**
   * Start continuous monitoring
   */
  start(intervalMs) {
    if (this.timer) this.stop();
    if (intervalMs) this.checkInterval = intervalMs;
    this._tick();
    this.timer = setInterval(() => this._tick(), this.checkInterval);
    console.log('[SmartOps] Started, interval: ' + (this.checkInterval / 1000 / 60) + 'min');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[SmartOps] Stopped');
    }
  }

  async _tick() {
    console.log('[SmartOps] Running smart operations check...');
    try {
      // 1. Health check with auto-fix
      const health = await this.ops.check();

      // 2. Auto-fix critical issues
      for (const alert of health.alerts) {
        if (alert.level === 'error') {
          const fix = await this.ops.autoFix(alert);
          if (fix.fixed) {
            console.log('[SmartOps] Auto-fixed: ' + alert.check);
            this.agent.memory.addDecision({
              type: 'auto_fixed',
              check: alert.check,
              action: fix.action,
              time: new Date().toISOString(),
            });
          }
        }
      }

      // 3. Analytics and insights
      const analysis = this.analytics.analyze();
      if (analysis.risks.length > 0) {
        console.log('[SmartOps] Risks detected:', analysis.risks.length);
        analysis.risks.forEach(r => console.log('  [!] ' + r.message));
      }
      if (analysis.opportunities.length > 0) {
        console.log('[SmartOps] Opportunities found:', analysis.opportunities.length);
        analysis.opportunities.forEach(o => console.log('  [*] ' + o.message));
      }

      // 4. Learning optimization
      this.agent.brain._reflect();
      this.agent.brain.save();

      // 5. Update external metrics
      await this._updateExternalMetrics();

      console.log('[SmartOps] Check complete. Health: ' + health.checks.github?.status + '/' + health.checks.gitee?.status + '/' + health.checks.afdian?.status);
    } catch (err) {
      console.error('[SmartOps] Error:', err.message);
    }
  }

  async _updateExternalMetrics() {
    try {
      const resp = await fetch('https://api.github.com/repos/Zeon7744/tri-link-test');
      const data = await resp.json();
      this.agent.memory.updateMetrics({ stars: data.stargazers_count, forks: data.forks_count });
      console.log('[SmartOps] GitHub stats updated: stars=' + data.stargazers_count);
    } catch (err) {
      console.log('[SmartOps] GitHub stats update skipped:', err.message);
    }
  }

  /**
   * Get comprehensive operations report
   */
  getReport() {
    const health = { github: 'unknown', gitee: 'unknown', afdian: 'unknown' };
    const analytics = this.analytics.analyze();
    const monetization = this.agent.monetization?.createPlan() || null;

    return {
      timestamp: new Date().toISOString(),
      health,
      analytics,
      monetization,
      recommendations: analytics.recommendations,
    };
  }
}

module.exports = { SmartOps };
