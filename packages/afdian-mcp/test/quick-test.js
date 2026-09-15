#!/usr/bin/env node
'use strict';

/**
 * Quick test: call AFDian API directly with POST + signature
 */
const crypto = require('crypto');

const config = require('C:/Users/Admin/.local/bin/afdian-link-config.json');

function sign(paramsJson) {
  const ts = Math.floor(Date.now() / 1000);
  const raw = `${config.token}params${paramsJson}ts${ts}user_id${config.user_id}`;
  const sign = crypto.createHash('md5').update(raw, 'utf8').digest('hex');
  return { ts, sign };
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
  return await resp.json();
}

async function main() {
  console.log('=== AFDian API Quick Test ===\n');

  // Test 1: Query sponsor list
  console.log('[1] query-sponsor (page=1)');
  const r1 = await call('/query-sponsor', { page: '1' });
  console.log(`    code: ${r1.code}, message: ${r1.em || 'ok'}`);
  if (r1.code === 200) {
    const d = r1.data || {};
    console.log(`    total_count: ${d.total_count}`);
    console.log(`    total_page: ${d.total_page}`);
    if (d.list && d.list.length > 0) {
      d.list.slice(0, 3).forEach(s => {
        console.log(`    - ${s.user?.name || 'Unknown'}: ¥${s.all_sum_amount || s.amount || 0}`);
      });
    } else {
      console.log('    (no sponsors yet)');
    }
  }
  console.log();

  // Test 2: Stats
  console.log('[2] query-sponsor (stat=1)');
  const r2 = await call('/query-sponsor', { stat: '1' });
  console.log(`    code: ${r2.code}, message: ${r2.em || 'ok'}`);
  if (r2.code === 200) {
    console.log(`    data: ${JSON.stringify(r2.data).substring(0, 200)}`);
  }
  console.log();

  // Test 3: Creator info
  console.log('[3] query-sponsor (empty params)');
  const r3 = await call('/query-sponsor', {});
  console.log(`    code: ${r3.code}, message: ${r3.em || 'ok'}`);
  if (r3.code === 200) {
    console.log(`    data: ${JSON.stringify(r3.data).substring(0, 300)}`);
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
