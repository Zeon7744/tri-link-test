#!/usr/bin/env node
'use strict';
/**
 * AFDian MCP Integration Test
 */
const { AfdianClient } = require('../src/client');

function loadConfig() {
  const fs = require('fs');
  const path = require('path');
  const candidates = [
    path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'share', 'afdian-mcp', 'config.json'),
    path.join(process.env.HOME || process.env.USERPROFILE, '.local', 'bin', 'afdian-link-config.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  console.error('Config not found');
  process.exit(1);
}

async function test() {
  const config = loadConfig();
  const client = new AfdianClient(config);
  console.log('\n=== AFDian MCP Test ===\n');

  try {
    console.log('[1] get_creator_info');
    const info = await client.getCreatorInfo();
    console.log(`    OK - keys: ${Object.keys(info).join(', ')}`);
  } catch (e) { console.log(`    FAIL: ${e.message}`); }

  try {
    console.log('[2] list_sponsors (limit=5)');
    const data = await client.listSponsors(5);
    const list = data.list || [];
    console.log(`    OK - ${list.length} sponsors, total_count: ${data.total_count}`);
  } catch (e) { console.log(`    FAIL: ${e.message}`); }

  try {
    console.log('[3] get_sponsor_stats');
    const data = await client.getSponsorStats();
    console.log(`    OK - ${JSON.stringify(data).substring(0, 200)}`);
  } catch (e) { console.log(`    FAIL: ${e.message}`); }

  console.log('\n=== Done ===');
}

test().catch(console.error);
