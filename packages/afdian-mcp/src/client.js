'use strict';
/**
 * AFDian API Client with MD5 signature
 * Sign: md5(token + "params" + paramsJson + "ts" + ts + "user_id" + userId)
 * API endpoint: POST {base}/query-sponsor
 * Response: { ec: 200, em: "sponsor", data: { ... } }
 */
const crypto = require('crypto');

class AfdianClient {
  constructor(config) {
    this.user_id = config.user_id;
    this.token = config.token;
    this.api_base = (config.api_base || 'https://afdian.com/api/open').replace(/\/+$/, '');
  }

  _sign(paramsJson) {
    const ts = Math.floor(Date.now() / 1000);
    const raw = `${this.token}params${paramsJson}ts${ts}user_id${this.user_id}`;
    const sign = crypto.createHash('md5').update(raw, 'utf8').digest('hex');
    return { ts, sign };
  }

  async request(params) {
    const paramsJson = JSON.stringify(params);
    const { ts, sign } = this._sign(paramsJson);
    const body = JSON.stringify({ user_id: this.user_id, params: paramsJson, ts, sign });
    const resp = await fetch(`${this.api_base}/query-sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    if (data.ec !== 200) {
      const hints = { 400002: 'timestamp drift', 400003: 'invalid params', 400004: 'invalid token', 400005: 'signature mismatch' };
      throw new Error(`AFDian error ${data.ec}: ${hints[data.ec] || data.em || ''}`);
    }
    return data.data || data;
  }

  async getCreatorInfo() {
    // Use page param to get creator page info
    const data = await this.request({ page: 1 });
    return { page_url: 'https://afdian.com/a/' + this.user_id.slice(0, 8), ...data };
  }

  async listSponsors(limit = 20, page = 1) {
    return this.request({ page, limit });
  }

  async getSponsorStats() {
    return this.request({ stat: '1' });
  }

  async getSponsorHistory(userId, limit = 20) {
    return this.request({ page: 1, limit, user_id: userId });
  }
}

module.exports = { AfdianClient };
