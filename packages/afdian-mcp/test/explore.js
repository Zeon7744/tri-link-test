#!/usr/bin/env node
'use strict';
/**
 * AFDian API exploration script - discover valid endpoints and params
 */
const crypto = require('crypto');
const config = require('C:/Users/Admin/.local/bin/afdian-link-config.json');

function sign(paramsJson) {
  const ts = Math.floor(Date.now() / 1000);
  const raw = `${config.token}params${paramsJson}ts${ts}user_id${config.user_id}`;
  return { ts, sign: crypto.createHash('md5').update(raw, 'utf8').digest('hex') };
}

async function call(endpoint, params) {
  const paramsJson = JSON.stringify(params);
  const { ts, sign: s } = sign(paramsJson);
  const body = JSON.stringify({ user_id: config.user_id, params: paramsJson, ts, sign: s });
  const resp = await fetch(`${config.api_base}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

(async () => {
  console.log('=== AFDian API Exploration ===\n');
  console.log(`Base: ${config.api_base}`);
  console.log(`User: ${config.user_id}`);
  console.log(`Page: ${config.creator_page}\n`);

  // Test 1: Basic sponsor query
  console.log('[1] /query-sponsor with {"page":1}');
  const r1 = await call('/query-sponsor', { page: 1 });
  console.log(`    ec: ${r1.ec}, em: ${r1.em}`);
  if (r1.data) {
    console.log(`    total_count: ${r1.data.total_count}`);
    console.log(`    total_page: ${r1.data.total_page}`);
    if (r1.data.list) console.log(`    list length: ${r1.data.list.length}`);
    if (r1.data.list && r1.data.list[0]) {
      console.log(`    sample: ${JSON.stringify(r1.data.list[0]).substring(0, 300)}`);
    }
  }
  console.log();

  // Test 2: Stats query
  console.log('[2] /query-sponsor with {"stat":"1"}');
  const r2 = await call('/query-sponsor', { stat: '1' });
  console.log(`    ec: ${r2.ec}, em: ${r2.em}`);
  if (r2.data) console.log(`    data: ${JSON.stringify(r2.data).substring(0, 500)}`);
  console.log();

  // Test 3: Try different param formats
  console.log('[3] /query-sponsor with {"page":1,"limit":5}');
  const r3 = await call('/query-sponsor', { page: 1, limit: 5 });
  console.log(`    ec: ${r3.ec}, em: ${r3.em}`);
  if (r3.data && r3.data.list) console.log(`    list length: ${r3.data.list.length}`);
  console.log();

  // Test 4: Get all fields from a sponsor item
  console.log('[4] Detailed sponsor item analysis');
  if (r1.data && r1.data.list && r1.data.list.length > 0) {
    const item = r1.data.list[0];
    console.log(`    keys: ${Object.keys(item).join(', ')}`);
    console.log(`    user keys: ${item.user ? Object.keys(item.user).join(', ') : 'no user'}`);
    console.log(`    full item: ${JSON.stringify(item, null, 2).substring(0, 500)}`);
  } else {
    console.log('    (no sponsors to analyze)');
  }

  console.log('\n=== Done ===');
})();
