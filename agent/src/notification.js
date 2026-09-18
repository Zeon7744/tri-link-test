'use strict';
/**
 * Notification - Multi-channel alert delivery
 * Supports: terminal, webhook (Discord/Slack), and log file
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const LOG_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.tri-link', 'notifications.log');

class Notification {
  constructor(options = {}) {
    this.webhookUrl = options.webhookUrl || process.env.TRI_LINK_WEBHOOK || null;
    this.channel = options.channel || process.env.TRI_LINK_NOTIFY_CHANNEL || 'terminal';
    this.project = options.project || 'tri-link-test';
    this._ensureLogDir();
  }

  _ensureLogDir() {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  /**
   * Send an alert with level, type, and message
   * Levels: 'info', 'warning', 'error', 'success'
   */
  send(level, type, message, extra = {}) {
    const entry = {
      time: new Date().toISOString(),
      level,
      type,
      project: this.project,
      message,
      ...extra,
    };

    // Always log to file
    this._writeLog(entry);

    // Terminal output (colored)
    this._printToTerminal(entry);

    // Webhook (Discord/Slack compatible)
    if (this.webhookUrl && this.channel === 'webhook') {
      this._sendWebhook(entry);
    }

    // Webhook on error/warning regardless of channel setting
    if (this.webhookUrl && (level === 'error' || level === 'warning')) {
      this._sendWebhook(entry);
    }
  }

  _writeLog(entry) {
    try {
      const line = `[${entry.time}] [${entry.level.toUpperCase()}] [${entry.type}] ${entry.message}\n`;
      fs.appendFileSync(LOG_PATH, line, 'utf8');
    } catch {}
  }

  _printToTerminal(entry) {
    const colors = {
      info: '\x1b[36m',     // cyan
      warning: '\x1b[33m',  // yellow
      error: '\x1b[31m',    // red
      success: '\x1b[32m',  // green
    };
    const reset = '\x1b[0m';
    const prefix = `${colors[entry.level] || ''}[${entry.level.toUpperCase()}]${reset}`;
    console.log(`  ${prefix} [${entry.type}] ${entry.message}`);
  }

  _sendWebhook(entry) {
    if (!this.webhookUrl) return;
    try {
      const color = entry.level === 'error' ? '0xf85149'
                  : entry.level === 'warning' ? '0xd29922'
                  : entry.level === 'success' ? '0x3fb950'
                  : '0x58a6ff';
      const payload = JSON.stringify({
        embeds: [{
          title: `Tri-Link: ${entry.type}`,
          description: entry.message,
          color: parseInt(color, 16),
          timestamp: entry.time,
          fields: [
            { name: 'Project', value: this.project, inline: true },
            { name: 'Level', value: entry.level.toUpperCase(), inline: true },
          ],
        }],
      });
      const parsed = new URL(this.webhookUrl);
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`  [Notification] Webhook delivered (${res.statusCode})`);
        } else {
          console.log(`  [Notification] Webhook failed: ${res.statusCode}`);
        }
      });
      req.on('error', (err) => console.log(`  [Notification] Webhook error: ${err.message}`));
      req.setTimeout(5000, () => { req.destroy(); });
      req.write(payload);
      req.end();
    } catch (err) {
      console.log(`  [Notification] Webhook send failed: ${err.message}`);
    }
  }

  /**
   * Convenience methods
   */
  info(type, message, extra) { this.send('info', type, message, extra); }
  warn(type, message, extra) { this.send('warning', type, message, extra); }
  error(type, message, extra) { this.send('error', type, message, extra); }
  success(type, message, extra) { this.send('success', type, message, extra); }

  /**
   * Read notification history from log file
   */
  getHistory(limit = 20) {
    try {
      const content = fs.readFileSync(LOG_PATH, 'utf8');
      const lines = content.trim().split('\n').slice(-limit);
      return lines.map(line => {
        const match = line.match(/\[(\d{4}-\d{2}-\d{2}T[\d:Z\-]+)\]\s+\[([A-Z]+)\]\s+\[([^\]]+)\]\s+(.*)/);
        if (match) {
          return { time: match[1], level: match[2].toLowerCase(), type: match[3], message: match[4] };
        }
        return { raw: line };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Get alert summary grouped by type
   */
  getSummary() {
    const history = this.getHistory(100);
    const counts = { info: 0, warning: 0, error: 0, success: 0 };
    const byType = {};
    for (const entry of history) {
      if (counts[entry.level] !== undefined) counts[entry.level]++;
      const key = entry.type || 'unknown';
      if (!byType[key]) byType[key] = { count: 0, levels: {} };
      byType[key].count++;
      byType[key].levels[entry.level] = (byType[key].levels[entry.level] || 0) + 1;
    }
    return { total: history.length, counts, byType: Object.entries(byType).map(([type, data]) => ({ type, ...data })) };
  }
}

module.exports = { Notification };
