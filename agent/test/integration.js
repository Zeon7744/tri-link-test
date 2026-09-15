'use strict';
/**
 * Agent Integration Tests - v4
 */
const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

const testHome = path.join(os.tmpdir(), 'tri-link-test-' + process.pid);
process.env.HOME = testHome;
try { fs.mkdirSync(testHome, { recursive: true }); } catch {}
try { fs.unlinkSync(path.join(testHome, 'memory.json')); } catch {}
try { fs.unlinkSync(path.join(testHome, 'brain.json')); } catch {}

const memoryPath = path.join(testHome, 'memory.json');

const { Agent } = require('../src/agent');
const { Brain } = require('../src/brain');
const { Planner } = require('../src/planner');
const { Memory } = require('../src/memory');
const { Optimizer } = require('../src/optimizer');
const { CodeGen } = require('../src/codegen');

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log('  [PASS] ' + name); }
  catch (e) { failed++; console.log('  [FAIL] ' + name + ': ' + e.message); }
}

function asyncTest(name, fn) {
  return fn().then(() => { passed++; console.log('  [PASS] ' + name); })
    .catch(e => { failed++; console.log('  [FAIL] ' + name + ': ' + e.message); });
}

console.log('\n=== Agent v2.0 Integration Tests ===\n');

console.log('[Brain]');
test(' Brain initializes with empty state', () => {
  const b = new Brain();
  assert.strictEqual(b.data.metrics.totalTasks, 0);
});

test(' Brain learns from a completed task', () => {
  const b = new Brain();
  b.learnFromTask({ task: { id: 't1', title: 'test', category: 'feature', priority: 'high' }, duration: 5000, success: true, insights: ['insight'] });
  assert.strictEqual(b.data.metrics.totalTasks, 1);
  assert.strictEqual(b.data.metrics.completedTasks, 1);
});

test(' Brain generates report', () => {
  const b = new Brain();
  b.learnFromTask({ task: { id: 't1', title: 'x', category: 'feature' }, duration: 1000, success: true });
  const report = b.getReport();
  assert.ok(report.totalTasks >= 1, 'totalTasks: ' + report.totalTasks);
  assert.strictEqual(report.successRate, '100%');
});

console.log('\n[Memory]');
test(' Memory stores and retrieves tasks', () => {
  const m = new Memory(memoryPath);
  const task = m.addTask({ title: 'test-task', category: 'feature', priority: 'medium' });
  assert.ok(task.id);
  assert.strictEqual(task.status, 'pending');
});

test(' Memory completes tasks correctly', () => {
  const m = new Memory(memoryPath);
  const task = m.addTask({ title: 'complete-me', category: 'feature', priority: 'high' });
  m.completeTask(task.id, { results: [], summary: 'done' });
  assert.ok(!m.data.tasks.find(t => t.id === task.id));
  assert.strictEqual(m.data.completedTasks.length, 1);
});

console.log('\n[Planner]');
test(' Planner parses MCP requirement', () => {
  const m = new Memory(memoryPath);
  const p = new Planner(m);
  const tasks = p.parseRequirement('创建 GitHub MCP 服务器');
  assert.ok(tasks.some(t => t.title.toLowerCase().includes('mcp')));
});

test(' Planner parses dashboard requirement', () => {
  const m = new Memory(memoryPath);
  const p = new Planner(m);
  const tasks = p.parseRequirement('完善 Dashboard 面板');
  assert.ok(tasks.some(t => t.title.includes('Dashboard') || t.title.includes('面板')));
});

console.log('\n[Optimizer]');
test(' Optimizer needs enough data', () => {
  const b = new Brain();
  const opt = new Optimizer(b);
  assert.ok(opt.analyze().note.includes('Not enough'));
});

test(' Optimizer finds suggestions with enough data', () => {
  const b = new Brain();
  b.learnFromTask({ task: { id: 't1', title: 'x', category: 'feature' }, duration: 1000, success: true });
  b.learnFromTask({ task: { id: 't2', title: 'x', category: 'feature' }, duration: 5000, success: true });
  b.learnFromTask({ task: { id: 't3', title: 'x', category: 'feature' }, duration: 3000, success: true });
  const opt = new Optimizer(b);
  assert.ok(!opt.analyze().note.includes('Not enough'));
});

console.log('\n[CodeGen]');
test(' CodeGen generates MCP server with real tools', () => {
  const cg = new CodeGen();
  const uniqueName = 'test-mcp-' + Date.now();
  const result = cg.generateMCPServer(uniqueName, { description: 'Test MCP' });
  assert.ok(result.success, result.message || '');
  assert.ok(fs.existsSync(path.join(result.path, 'src', 'server.js')));
  const content = fs.readFileSync(path.join(result.path, 'src', 'server.js'), 'utf8');
  assert.ok(content.includes('get_repo_stats'), 'missing get_repo_stats');
  assert.ok(content.includes('search_repos'), 'missing search_repos');
  try { require('child_process').execSync('rm -rf "' + result.path + '"', { stdio: 'pipe' }); } catch {}
});

test(' CodeGen rejects existing package', () => {
  const cg = new CodeGen();
  const uniqueName = 'test-mcp-dup-' + Date.now();
  const r1 = cg.generateMCPServer(uniqueName, { description: 'Test' });
  assert.ok(r1.success, r1.message || '');
  const r2 = cg.generateMCPServer(uniqueName, { description: 'Test' });
  assert.ok(!r2.success, 'Should reject duplicate: ' + r2.message);
  try { require('child_process').execSync('rm -rf "' + r1.path + '"', { stdio: 'pipe' }); } catch {}
});

console.log('\n[Agent Integration]');

(async () => {
  await asyncTest(' Agent full cycle: require -> plan -> execute -> learn', async () => {
    const a = new Agent();
    const plan = a.require('创建一个测试MCP服务器', { autoExecute: false });
    assert.ok(plan.tasks.length > 0, 'Should have tasks');
    await a.executor.run(plan.tasks[0]);
    a.memory.completeTask(plan.tasks[0].id, { results: [], summary: 'done' });
    const report = a.brain.getReport();
    assert.ok(report.totalTasks >= 1, 'Brain should have learned');
  });

  try { require('child_process').execSync('rm -rf "' + testHome + '"', { stdio: 'pipe' }); } catch {}

  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===\n');
  process.exit(failed > 0 ? 1 : 0);
})();
