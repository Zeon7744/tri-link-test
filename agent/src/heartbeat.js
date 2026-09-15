'use strict';
/**
 * Heartbeat - Periodic self-check and auto-optimize
 */
const { OpsAgent } = require('./ops');
const { Optimizer } = require('./optimizer');

class Heartbeat {
  constructor(agent) {
    this.agent = agent;
    this.timer = null;
    this.intervalMs = 30 * 60 * 1000; // 30 minutes default
  }

  /**
   * Start the heartbeat loop
   */
  start(intervalMs) {
    if (this.timer) this.stop();
    if (intervalMs) this.intervalMs = intervalMs;
    this._tick();
    this.timer = setInterval(() => this._tick(), this.intervalMs);
    console.log('[Heartbeat] Started, interval: ' + (this.intervalMs / 1000 / 60) + 'min');
  }

  /**
   * Stop the heartbeat loop
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Heartbeat] Stopped');
    }
  }

  async _tick() {
    console.log('[Heartbeat] Running periodic check...');
    try {
      // 1. Ops health check
      const ops = new OpsAgent(this.agent.memory);
      const checkResult = await ops.check();

      // 2. Auto-fix alerts
      for (const alert of checkResult.alerts) {
        const fix = await ops.autoFix(alert);
        if (fix.fixed) {
          console.log('[Heartbeat] Auto-fixed: ' + alert.check);
        }
      }

      // 3. Learning optimization
      const optimizer = new Optimizer(this.agent.brain);
      const analysis = optimizer.analyze();
      if (analysis.suggestions.length > 0) {
        console.log('[Heartbeat] Optimization suggestions:', analysis.suggestions.length);
        analysis.suggestions.forEach(s => console.log('  -', s.hint));
      }

      // 4. Update memory metrics
      this.agent.memory.updateMetrics({ lastHeartbeat: new Date().toISOString() });

      console.log('[Heartbeat] Check complete. Alerts: ' + checkResult.alerts.length);
    } catch (err) {
      console.error('[Heartbeat] Error:', err.message);
    }
  }
}

module.exports = { Heartbeat };
