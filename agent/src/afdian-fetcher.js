'use strict';
/**
 * AfdianFetcher - Periodic AFDian data fetcher
 * Fetches sponsor stats and creator info on a schedule.
 * Stores results in agent memory for dashboard + agent use.
 */

const https = require('https');

function log(level, msg) {
  const colors = { ok: '\x1b[32m', warn: '\x1b[33m', err: '\x1b[31m', info: '\x1b[36m' };
  const prefix = { ok: '[OK]', warn: '[WARN]', err: '[ERR]', info: '  >>' }[level] || '  -';
  console.log(`${colors[level] || ''}${prefix}\x1b[0m ${msg}`);
}
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'tri-link-agent/1.0',
        'Referer': 'https://afdian.com',
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: null, raw: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15_000, () => { req.destroy(); reject(new Error('AFDian request timeout')); });
  });
}

class AfdianFetcher {
  /**
   * @param {object} opts
   * @param {string} opts.user        AFDian username
   * @param {string} opts.token       AFDian API token (required for stats)
   * @param {number} opts.intervalMs  Poll interval in ms (default: 1 hour)
   * @param {function} opts.onData    Callback invoked with each fetch result
   */
  constructor(opts = {}) {
    this.user = opts.user || process.env.AFDIAN_USER || 'Zeon7744';
    this.token = opts.token || process.env.AFDIAN_TOKEN || '';
    this.intervalMs = opts.intervalMs || 60 * 60 * 1000; // 1 hour
    this.onData = opts.onData || null;
    this.timer = null;
    this.lastData = null;
    this.lastFetchAt = null;
    this.fetchCount = 0;
    this.errorCount = 0;
  }

  /**
   * Start periodic fetching
   */
  start(intervalMs) {
    if (this.timer) this.stop();
    if (intervalMs) this.intervalMs = intervalMs;
    console.log('[AfdianFetcher] Started, user=' + this.user + ' interval=' + (this.intervalMs / 1000 / 60) + 'min');
    this._tick();
    this.timer = setInterval(() => this._tick(), this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[AfdianFetcher] Stopped');
    }
  }

  /**
   * Fetch creator info (public, no token needed)
   */
  async fetchCreatorInfo() {
    const url = `https://afdian.com/a/${this.user}`;
    const res = await httpsGet(url);
    return {
      type: 'creator_info',
      user: this.user,
      page_url: `https://afdian.com/a/${this.user}`,
      status: res.status,
      ok: res.status === 200,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Fetch sponsor stats (requires AFDIAN_TOKEN)
   */
  async fetchSponsorStats() {
    if (!this.token) {
      return { type: 'sponsor_stats', ok: false, error: 'AFDIAN_TOKEN not set', timestamp: new Date().toISOString() };
    }
    const res = await httpsGet(
      'https://afdian.com/api/sponsor/get_sponsor_stats',
      { Authorization: 'Bearer ' + this.token }
    );
    const ok = res.status === 200 && res.body?.ec === 200;
    return {
      type: 'sponsor_stats',
      user: this.user,
      ok,
      total_sponsors: ok ? res.body.data?.total_sponsors : null,
      monthly_income: ok ? res.body.data?.monthly_income : null,
      recent_records: ok ? res.body.data?.records?.slice(0, 10) : null,
      status: res.status,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * One fetch cycle: creator info + sponsor stats
   */
  async _tick() {
    console.log('[AfdianFetcher] Fetching AFDian data for ' + this.user + '...');
    this.fetchCount++;
    const results = [];

    try {
      const info = await this.fetchCreatorInfo();
      results.push(info);
    } catch (err) {
      results.push({ type: 'creator_info', ok: false, error: err.message, timestamp: new Date().toISOString() });
      this.errorCount++;
    }

    try {
      const stats = await this.fetchSponsorStats();
      results.push(stats);
      if (stats.ok) this.lastData = stats;
    } catch (err) {
      results.push({ type: 'sponsor_stats', ok: false, error: err.message, timestamp: new Date().toISOString() });
      this.errorCount++;
    }

    this.lastFetchAt = new Date().toISOString();

    if (this.onData) {
      try { this.onData(results); } catch {}
    }

    console.log('[AfdianFetcher] Fetch complete. fetchCount=' + this.fetchCount + ' errorCount=' + this.errorCount);
    return results;
  }

  /**
   * Get the most recent fetch result
   */
  getLatest() {
    return this.lastData;
  }

  /**
   * Get fetch statistics
   */
  getStatus() {
    return {
      user: this.user,
      running: Boolean(this.timer),
      intervalMs: this.intervalMs,
      lastFetchAt: this.lastFetchAt,
      fetchCount: this.fetchCount,
      errorCount: this.errorCount,
      hasToken: Boolean(this.token),
    };
  }
}

module.exports = { AfdianFetcher, httpsGet };
