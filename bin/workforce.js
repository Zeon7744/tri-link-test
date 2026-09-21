'use strict';
/**
 * Tri-Link Digital Workforce - 数字员工系统
 *
 * 将 7 个守护进程抽象为 5 个"数字员工"角色，
 * 每个员工有明确职责、工作节奏、升级路径。
 * 总控调度器统一管理资源分配，避免冲突。
 *
 * 员工矩阵:
 *   ┌─────────────┬──────────────────────────────────────────────────┐
 *   │  员工        │  职责 + 工作节奏                                │
 *   ├─────────────┼──────────────────────────────────────────────────┤
 *   │ 同步员      │ 三端同步 (GitHub/Gitee/本地) · 10min             │
 *   │ 质检员      │ 深度代码/依赖/安全扫描 · 15min                   │
 *   │ 安防员      │ 告警监控 + 自动修复 + 进程守护 · 5min            │
 *   │ 数据员      │ 数据交换 + 趋势分析 + 大脑学习 · 30min           │
 *   │ 总调度员    │ 编排所有员工 + 资源监控 + 升级决策 · 15min       │
 *   └─────────────┴──────────────────────────────────────────────────┘
 *
 * CLI:
 *   node workforce.js deploy              - 部署全部 5 个员工
 *   node workforce.js undeploy           - 停止全部员工
 *   node workforce.js status             - 查看员工状态
 *   node workforce.js roster             - 显示员工花名册
 *   node workforce.js assign <role> <min> - 调整某员工工作间隔
 *   node workforce.js report             - 全系统工作报告
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const LOG_FILE = path.join(DATA_DIR, 'workforce.log');
const STATE_FILE = path.join(DATA_DIR, 'workforce-state.json');
const PID_FILE = path.join(DATA_DIR, 'workforce.pid');

// ── 员工定义 ─────────────────────────────────────────────────
const EMPLOYEES = [
  {
    id: 'sync-01',
    name: '同步员',
    role: '三端同步',
    script: 'auto-maintain.js',
    pidFile: 'maintain.pid',
    startArgs: ['start', '10'],
    intervalMin: 10,
    priority: 1,
    memoryBudgetMB: 80,
    duties: [
      '本地目录 vs GitHub/Gitee 差异检测',
      '自动 commit + push 到三端',
      'AFDian 赞助数据轮询',
      '发布就绪评分',
    ],
  },
  {
    id: 'qa-01',
    name: '质检员',
    role: '深度质检',
    script: 'quality-inspector.js',
    pidFile: 'quality.pid',
    startArgs: [], // quality-inspector 是批处理,由调度员触发
    intervalMin: 15,
    priority: 2,
    memoryBudgetMB: 60,
    duties: [
      '安全扫描 (PAT/密钥/.env)',
      '依赖审计 (npm audit)',
      '代码质量 (console/empty-catch)',
      '测试覆盖率 + 文件卫生',
    ],
  },
  {
    id: 'security-01',
    name: '安防员',
    role: '告警自愈',
    script: 'alert-healer.js',
    pidFile: 'alert-healer.pid',
    startArgs: ['start', '5'],
    intervalMin: 5,
    priority: 0,
    memoryBudgetMB: 50,
    duties: [
      '守护进程存活检查 + 自动重启',
      '项目脏文件检测 + 自动提交',
      'GitHub remote 连通性',
      '磁盘空间监控',
      '告警分级 (critical/high/warning)',
    ],
  },
  {
    id: 'data-01',
    name: '数据员',
    role: '数据交换分析',
    script: 'dialogue-exchange.js',
    pidFile: 'dialogue.pid',
    startArgs: ['start', '30'],
    intervalMin: 30,
    priority: 3,
    memoryBudgetMB: 50,
    duties: [
      '定时采集 commit/分支/赞助数据',
      '趋势分析 (commit 增速/内存增长)',
      '洞察生成 → 大脑学习',
      '历史快照保留 (最近 100 个)',
    ],
  },
  {
    id: 'dispatch-01',
    name: '总调度员',
    role: '编排调度',
    script: 'tri-link-orchestrator.js',
    pidFile: 'orchestrator.pid',
    startArgs: ['start', '15'],
    intervalMin: 15,
    priority: 1,
    memoryBudgetMB: 50,
    duties: [
      '编排全部员工工作节奏',
      '资源监控 (内存/CPU)',
      '升级决策 (告警→人工介入)',
      '全系统报告生成',
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] [workforce] ${msg}`;
  console.log(line);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function isAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid(file) {
  try { return parseInt(fs.readFileSync(path.join(DATA_DIR, file), 'utf8').trim(), 10) || 0; } catch { return 0; }
}

function writePid(file, pid) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(path.join(DATA_DIR, file), String(pid)); } catch {}
}

function getProcessMemory(pid) {
  if (!pid) return 0;
  try {
    const { execSync } = require('child_process');
    const psCmd = 'powershell -NonInteractive -Command "(Get-Process -Id ' + String(pid) + ' -ErrorAction SilentlyContinue).WorkingSet64 / 1MB"';
    const out = execSync(psCmd, { encoding: 'utf8', timeout: 8000, stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const mb = parseFloat(out);
    return isNaN(mb) ? 0 : Math.round(mb);
  } catch {
    try { process.kill(pid, 0); return 50; } catch { return 0; }
  }
}

// ── 员工操作 ──────────────────────────────────────────────────
function startEmployee(emp) {
  const pid = readPid(emp.pidFile);
  if (isAlive(pid)) {
    log(`${emp.name} (${emp.id}): already running (PID ${pid})`);
    return pid;
  }

  const scriptPath = path.join(__dirname, emp.script);
  if (!fs.existsSync(scriptPath)) {
    log(`${emp.name} (${emp.id}): script not found: ${scriptPath}`);
    return null;
  }

  // 质检员是批处理模式，不常驻
  if (emp.id === 'qa-01') {
    log(`${emp.name} (${emp.id}): batch mode - triggered by dispatcher`);
    return null;
  }

  const proc = spawn(process.execPath, [scriptPath, ...emp.startArgs], {
    cwd: path.join(__dirname, '..'),
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();
  writePid(emp.pidFile, proc.pid);
  log(`${emp.name} (${emp.id}): started (PID ${proc.pid}, interval ${emp.intervalMin}min)`);
  return proc.pid;
}

function stopEmployee(emp) {
  const pid = readPid(emp.pidFile);
  if (isAlive(pid)) {
    process.kill(pid, 'SIGTERM');
    log(`${emp.name} (${emp.id}): stopped (PID ${pid})`);
  } else {
    log(`${emp.name} (${emp.id}): not running`);
  }
  try { fs.unlinkSync(path.join(DATA_DIR, emp.pidFile)); } catch {}
}

function deployAll() {
  log('=== Deploying All Digital Employees ===');
  const results = {};

  // 按优先级排序 (priority 0 = 最高)
  const sorted = [...EMPLOYEES].sort((a, b) => a.priority - b.priority);

  for (const emp of sorted) {
    const pid = startEmployee(emp);
    results[emp.id] = {
      name: emp.name,
      pid: pid || null,
      running: pid !== null,
      intervalMin: emp.intervalMin,
    };
  }

  // 等待进程稳定
  setTimeout(() => {
    const final = {};
    for (const emp of EMPLOYEES) {
      const pid = readPid(emp.pidFile);
      final[emp.id] = {
        name: emp.name,
        pid: pid || null,
        running: isAlive(pid),
        memMB: pid ? Math.round(getProcessMemory(pid)) : 0,
      };
    }
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify({ deployed: new Date().toISOString(), employees: final }, null, 2));
    } catch {}
    log('=== Deployment Complete ===');
    log(JSON.stringify(final, null, 2));
  }, 2000);
}

function undeployAll() {
  log('=== Stopping All Digital Employees ===');
  for (const emp of EMPLOYEES) {
    stopEmployee(emp);
  }
  log('=== All Employees Stopped ===');
}

function getStatus() {
  const status = {};
  let totalMem = 0;
  for (const emp of EMPLOYEES) {
    const pid = readPid(emp.pidFile);
    const alive = isAlive(pid);
    const mem = alive ? Math.round(getProcessMemory(pid)) : 0;
    totalMem += mem;
    status[emp.id] = {
      name: emp.name,
      pid: pid || null,
      running: alive,
      memMB: mem,
      overBudget: mem > emp.memoryBudgetMB,
      intervalMin: emp.intervalMin,
      duties: emp.duties.length,
    };
  }
  return { employees: status, totalMemMB: totalMem, timestamp: new Date().toISOString() };
}

function getRoster() {
  const status = getStatus();
  console.log('\n=== Digital Workforce Roster ===\n');
  console.log('  ID          Name      Role        PID     Mem     Budget  Status');
  console.log('  ' + '─'.repeat(60));
  for (const emp of EMPLOYEES) {
    const s = status.employees[emp.id];
    const memStr = s.memMB > 0 ? `${s.memMB}MB` : '  -  ';
    const budgetStr = `${emp.memoryBudgetMB}MB`;
    const statusStr = s.running ? 'ON DUTY ' : 'OFF DUTY';
    const warn = s.overBudget ? ' ⚠' : '';
    console.log(`  ${emp.id.padEnd(10)}  ${emp.name.padEnd(8)}  ${emp.role.padEnd(8)}  ${String(s.pid || '-').padEnd(6)}  ${memStr.padEnd(6)}  ${budgetStr.padEnd(7)}  ${statusStr}${warn}`);
  }
  console.log(`\n  Total memory: ${status.totalMemMB}MB / Budget: ${EMPLOYEES.reduce((a, e) => a + e.memoryBudgetMB, 0)}MB`);
  console.log('  ' + '─'.repeat(60) + '\n');
}

function report() {
  const status = getStatus();
  console.log('\n=== Workforce Report ===\n');

  // Employee status
  for (const emp of EMPLOYEES) {
    const s = status.employees[emp.id];
    const icon = s.running ? '[ON]' : '[--]';
    console.log(`  ${icon} ${emp.name} (${emp.id})`);
    console.log(`     PID: ${s.pid || 'N/A'}  Mem: ${s.memMB}MB/${emp.memoryBudgetMB}MB  Interval: ${s.intervalMin}min`);
    if (s.overBudget) console.log(`     ⚠ OVER BUDGET by ${s.memMB - emp.memoryBudgetMB}MB`);
    console.log('     Duties:');
    emp.duties.forEach(d => console.log(`       - ${d}`));
    console.log('');
  }

  // Alerts
  try {
    const alerts = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'alerts.json'), 'utf8'));
    const active = alerts.activeAlerts || [];
    console.log(`  Active Alerts: ${active.length}`);
    for (const a of active.slice(0, 5)) {
      console.log(`    [${a.level.toUpperCase()}] ${a.message}`);
    }
    if (active.length > 5) console.log(`    ... ${active.length - 5} more`);
  } catch {}

  // Quality
  try {
    const q = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'quality-state.json'), 'utf8'));
    const results = Object.entries(q.results || {});
    const passing = results.filter(([, r]) => r.pass).length;
    console.log(`\n  Quality: ${passing}/${results.length} projects passing`);
    for (const [name, r] of results) {
      const icon = r.pass ? '+' : '!';
      console.log(`    ${icon} ${name}: ${r.grade} (${r.score}/100)`);
    }
  } catch {}

  // Brain
  try {
    const brain = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'brain.json'), 'utf8'));
    console.log(`\n  Brain: cycles=${brain.selfState?.cycles || 0} decisions=${brain.decisions?.length || 0} learned=${brain.learned?.length || 0}`);
  } catch {}

  console.log('');
}

function assignRole(role, newIntervalMin) {
  const emp = EMPLOYEES.find(e => e.name === role || e.id === role);
  if (!emp) {
    console.log(`Unknown role: ${role}`);
    console.log('Available: ' + EMPLOYEES.map(e => e.name + ' (' + e.id + ')').join(', '));
    process.exit(1);
  }
  if (newIntervalMin) {
    emp.intervalMin = newIntervalMin;
    emp.startArgs[1] = String(newIntervalMin);
    log(`${emp.name} interval updated to ${newIntervalMin}min`);
    stopEmployee(emp);
    setTimeout(() => startEmployee(emp), 1000);
  }
}

// ── CLI ───────────────────────────────────────────────────────
const cmd = process.argv[2] || 'status';
switch (cmd) {
  case 'deploy':
    deployAll();
    break;
  case 'undeploy':
    undeployAll();
    break;
  case 'status':
    console.log(JSON.stringify(getStatus(), null, 2));
    break;
  case 'roster':
    getRoster();
    break;
  case 'report':
    report();
    break;
  case 'assign':
    assignRole(process.argv[3], process.argv[4] ? parseInt(process.argv[4], 10) : null);
    break;
  default:
    console.log(`
Tri-Link Digital Workforce v1.0
Usage:
  node workforce.js deploy              - Deploy all 5 employees
  node workforce.js undeploy            - Stop all employees
  node workforce.js status              - Show employee status (JSON)
  node workforce.js roster              - Show roster table
  node workforce.js report              - Full system report
  node workforce.js assign <role> <min> - Adjust interval
`);
}
