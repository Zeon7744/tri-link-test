#!/usr/bin/env node
'use strict';
/**
 * Agent Ops - Autonomous Digital Employee
 * Monitors, analyzes, auto-repairs, and scores all projects.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const LOG_FILE = path.join(DATA_DIR, 'agent-ops.log');
const PID_FILE = path.join(DATA_DIR, 'agent-ops.pid');
const BRAIN_FILE = path.join(DATA_DIR, 'brain.json');

// Load projects from auto-maintain
const amPath = path.join(__dirname, 'auto-maintain.js');
let CONFIG;
try {
  const amSrc = fs.readFileSync(amPath, 'utf8');
  const m = amSrc.match(/projects:\s*\[([\s\S]*?)\n\s*\],/);
  if (m) {
    const projects = eval('[' + m[1] + ']');
    CONFIG = { owner: "Zeon7744", projects, intervalMin: 15 };
  } else { CONFIG = { owner: "Zeon7744", projects: [], intervalMin: 15 }; }
} catch(e) { rp.push(".gitignore failed: "+e.message); }

function log(msg) {
  const line = "[" + new Date().toISOString() + "] " + msg;
  console.log(line);
  try { fs.mkdirSync(DATA_DIR, {recursive:true}); fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
}

function git(cmd, cwd) {
  try {
    if (process.platform === "win32") {
      let c = cmd
        .replace(/ 2>\/dev\/null/g, '')
        .replace(/ \| head -\d+/g, '')
        .replace(/ \| grep .*$/g, '');
      return execSync(c, { cwd, encoding: 'utf8', timeout: 30000, stdio: ['pipe','pipe','ignore'] }).trim();
    }
    return execSync(cmd, { cwd, encoding: 'utf8', timeout: 30000 }).trim();
  } catch { return null; }
}

function loadBrain() {
  try {
    const b = JSON.parse(fs.readFileSync(BRAIN_FILE, 'utf8'));
    if (!b.decisions) b.decisions = [];
    if (!b.learned) b.learned = [];
    if (!b.selfState) b.selfState = { health: "unknown", cycles: 0 };
    return b;
} catch(e) { rp.push(".gitignore failed: "+e.message); }
}

function saveBrain(b) {
  try {
    fs.mkdirSync(DATA_DIR, {recursive:true});
    if (b.decisions.length > 100) b.decisions = b.decisions.slice(-100);
    if (b.learned.length > 50) b.learned = b.learned.slice(-50);
    fs.writeFileSync(BRAIN_FILE, JSON.stringify(b, null, 2));
  } catch {}
}

function selfState() {
  const s = { timestamp: new Date().toISOString(), daemons: {}, health: "healthy", warnings: [] };
  for (const [n, pf] of [["auto-maintain","maintain.pid"],["afdian","daemon.pid"]]) {
    try {
      const pid = parseInt(fs.readFileSync(path.join(DATA_DIR, pf), 'utf8').trim(), 10);
      let alive = false;
      if (pid) { try { process.kill(pid, 0); alive = true; } catch {} }
      s.daemons[n] = { pid, alive };
      if (!alive) { s.warnings.push(n + " dead"); s.health = "degraded"; }
} catch(e) { rp.push(".gitignore failed: "+e.message); }
  }
  return s;
}

function walkFiles(dir, depth) {
  const r = [];
  if (depth > 5) return r;
  try {
    for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) r.push(...walkFiles(f, depth+1));
      else r.push(f);
    }
  } catch {}
  return r;
}

function analyzeRisks(proj) {
  const risks = [];
  const local = proj.local;
  if (!fs.existsSync(local)) { risks.push({severity:'high',category:'config',issue:'Not found locally'}); return risks; }

  // Secrets
  const pats = [/ghp_[a-zA-Z0-9]{36}/g, /ghs_[a-zA-Z0-9]{36}/g, /access_token=[a-f0-9]{32}/g];
  for (const f of walkFiles(local, 3)) {
    const ext = path.extname(f).toLowerCase();
    if (!['.js','.json','.py','.md','.yml','.yaml'].includes(ext)) continue;
    if (f.includes('node_modules')) continue;
    try {
      const c = fs.readFileSync(f, 'utf8');
      for (const p of pats) { p.lastIndex = 0; if (c.match(p)) risks.push({severity:"high",category:"security",file:path.relative(local,f),issue:"Hardcoded secret",fix:"Move to .env"}); }
    } catch {}
  }

  // .env files
  for (const f of walkFiles(local, 2)) {
    const n = path.basename(f);
    if (n === '.env' || (n.startsWith('.env') && !n.includes('example')))
      risks.push({severity:"high",category:"security",file:path.relative(local,f),issue:".env tracked",fix:"gitignore and rotate"});
  }

  if (fs.existsSync(path.join(local,'.git')) && !fs.existsSync(path.join(local,'.gitignore')))
    risks.push({severity:'medium',category:'config',issue:'Missing .gitignore'});

  if (fs.existsSync(path.join(local,'.git'))) {
    const lf = git('git ls-files', local);
    if (lf && lf.includes('node_modules/'))
      risks.push({severity:'high',category:'bloat',issue:'node_modules in git',fix:'git rm -r --cached'});
  }

  for (const p of ['package.json','src/frontend/package.json']) {
    const pp = path.join(local, p);
    if (fs.existsSync(pp)) {
      try { const pkg = JSON.parse(fs.readFileSync(pp,'utf8'));
        if (!pkg.name) risks.push({severity:"low",category:"quality",issue:"pkg missing name"});
        if (!pkg.version) risks.push({severity:"low",category:"quality",issue:"pkg missing version"});
        if (!pkg.description) risks.push({severity:"low",category:"quality",issue:"pkg missing desc"});
} catch(e) { rp.push(".gitignore failed: "+e.message); }
      break;
    }
  }

  const rp2 = path.join(local, 'README.md');
  if (fs.existsSync(rp2)) {
    if (fs.readFileSync(rp2,"utf8").length < 200) risks.push({severity:"medium",category:"docs",issue:"README too short"});
} else risks.push({severity:"high",category:"docs",issue:"Missing README"});

  const tests = walkFiles(local,4).filter(f=>/test|spec/i.test(f)&&!f.includes('node_modules'));
  if (tests.length===0 && fs.existsSync(path.join(local,'src')))
    risks.push({severity:"low",category:"quality",issue:"No test files"});

  for (const f of walkFiles(local,4)) {
    if (f.includes('node_modules')||f.includes('.git')) continue;
    try { if (fs.statSync(f).size > 5*1024*1024) risks.push({severity:'medium',category:'bloat',file:path.relative(local,f),issue:'Large file'}); } catch {}
  }

  if (fs.existsSync(path.join(local,'.git'))) {
    const st2 = git('git status --short', local);
    if (st2 && st2.trim() !== "") {
      const n2 = st2.split("\n").filter(Boolean).length;
      risks.push({severity:"medium",category:"sync",issue:n2+" uncommitted",fix:"Commit and push"});
    }
  }
  return risks;
}

function computeScore(risks, ls, gh, ge) {
  let s = 100; const d = [];
  for (const r of risks.filter(x=>x.category==='security')) { const p=r.severity==='high'?15:5; s-=p; d.push({reason:r.issue,points:-p}); }
  if (ls.commitsAhead>0) { const p=Math.min(ls.commitsAhead*5,20); s-=p; d.push({reason:ls.commitsAhead+' unpushed',points:-p}); }
  for (const r of risks.filter(x=>x.category==='quality')) { s-=3; d.push({reason:r.issue,points:-3}); }
  for (const r of risks.filter(x=>x.category==='docs')) { const p=r.severity==='high'?8:3; s-=p; d.push({reason:r.issue,points:-p}); }
  for (const r of risks.filter(x=>x.category==='bloat')) { s-=5; d.push({reason:r.issue,points:-5}); }
  if (!gh.ok) { s-=10; d.push({reason:'No GitHub',points:-10}); }
  if (!ge.ok) { s-=5; d.push({reason:'No Gitee',points:-5}); }
  if (gh.stars>0) { const b=Math.min(gh.stars*2,10); s+=b; d.push({reason:gh.stars+' stars',points:b}); }
  s = Math.max(0, Math.min(100, s));
  const grade = s>=90?'A':s>=75?'B':s>=60?'C':s>=40?'D':'F';
  return { score:s, grade, publishable:s>=75, recs:d.filter(x=>x.points<0).map(x=>x.reason) };
}

function autoRepair(proj, risks) {
  const rp = []; const local = proj.local;
  const giRisk = risks.find(r=>r.category==='config'&&r.issue&&r.issue.includes('.gitignore'));
  if (giRisk && fs.existsSync(local)) {
    try {
      fs.writeFileSync(path.join(local,'.gitignore'),'node_modules/\n.env\n__pycache__/\n*.pyc\n*.log\ndist/\nbuild/\n.DS_Store\nThumbs.db\n');
      git('git add .gitignore', local);
      git('git commit -m "fix: add .gitignore"', local);
      rp.push('Added .gitignore');
} catch(e) { rp.push(".gitignore failed: "+e.message); }
  }
  const st3 = git('git status --short', local);
  if (st3 && st3.trim() !== "") {
    try {
      git('git add -A', local);
      git('git commit -m "chore(agent): auto-sync '+new Date().toISOString().substring(0,10)+'"', local);
      const pr = git('git push origin main', local);
      if (pr) { git('git push gitee main', local); rp.push('Synced '+st3.split('\n').filter(Boolean).length+' changes'); }
} catch(e) { rp.push(".gitignore failed: "+e.message); }
  }
  return rp;
}

async function runCycle() {
  log('=== Agent Ops Cycle ===');
  const brain = loadBrain();
  const ss = selfState();
  brain.selfState = ss;

  if (ss.daemons['auto-maintain'] && !ss.daemons['auto-maintain'].alive) {
    log('Restarting auto-maintain...');
    try { const p=spawn(process.execPath,[path.join(__dirname,'auto-maintain.js'),'start','10'],{cwd:path.join(__dirname,'..'),detached:true,stdio:'ignore'});p.unref();await new Promise(r=>setTimeout(r,2000));log('am PID '+p.pid);brain.decisions.push({time:new Date().toISOString(),action:'restart-am'});}catch{}
  }
  if (ss.daemons['afdian'] && !ss.daemons['afdian'].alive) {
    log('Restarting AFDian...');
    try { const p=spawn(process.execPath,[path.join(__dirname,'afdian-daemon.js'),'start','30'],{cwd:path.join(__dirname,'..'),detached:true,stdio:'ignore'});p.unref();await new Promise(r=>setTimeout(r,2000));log('afdian PID '+p.pid);brain.decisions.push({time:new Date().toISOString(),action:'restart-afdian'});}catch{}
  }

  const results = {};
  for (const proj of CONFIG.projects) {
    try {
      const risks = analyzeRisks(proj);
      let ls = {exists:false,commitsAhead:0};
      if (fs.existsSync(proj.local)) { ls.exists=true; const a=git('git rev-list --count HEAD..origin/main',proj.local); ls.commitsAhead=parseInt(a)||0; }
      const gh={ok:!!git('git ls-remote origin main',proj.local),stars:0};
      const ge={ok:!!git('git ls-remote gitee main',proj.local),stars:0};
      const sc = computeScore(risks,ls,gh,ge);
      const rp = sc.score<70 ? autoRepair(proj,risks) : [];
      results[proj.name]={risks:risks.slice(0,5),score:sc,repairs:rp,localExists:ls.exists,synced:ls.commitsAhead===0};
      log('['+proj.name+'] '+sc.grade+' ('+sc.score+'/100) risks='+risks.length+' rp='+rp.length+' pub='+sc.publishable);
      if (risks.length>3) brain.learned.push({time:new Date().toISOString(),project:proj.name,insight:'High risk ('+risks.length+')'});
      if (rp.length>0) brain.decisions.push({time:new Date().toISOString(),action:'repair',project:proj.name,repairs:rp});
} catch(e) { rp.push(".gitignore failed: "+e.message); }
  }

  brain.selfState.cycles=(brain.selfState.cycles||0)+1;
  brain.selfState.lastCycle=new Date().toISOString();
  brain.analysisResults=results;
  saveBrain(brain);
  log('Cycle done. Dec: '+(brain.decisions||[]).length+' Learned: '+(brain.learned||[]).length);
  return results;
}

let timer=null;
function writePid(){try{fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(PID_FILE,String(process.pid));}catch{}}
function readPid(){try{return fs.readFileSync(PID_FILE,"utf8").trim();}catch{return null;}}

function runDaemon(ms){
  writePid();
  log("Agent-ops started PID="+process.pid+" interval="+Math.round(ms/60000)+"min");
  const tick=async()=>{try{await runCycle();}catch(e){log("Err: "+e.message);}};
  tick();
  timer=setInterval(tick,ms);
  process.on("SIGINT",()=>{log("Stop");clearInterval(timer);try{fs.unlinkSync(PID_FILE);}catch{}process.exit(0);});
  process.on("SIGTERM",()=>{log("Stop");clearInterval(timer);try{fs.unlinkSync(PID_FILE);}catch{}process.exit(0);});
}

const cmd=process.argv[2]||'run';
const ivMin=parseInt(process.argv[3])||15;
switch(cmd){
  case 'run':
    runCycle().then(r=>{
      console.log('\n=== Summary ===');
      for(const [n,d] of Object.entries(r))
        console.log('  '+n+': '+d.score.grade+' ('+d.score.score+'/100) '+(d.score.publishable?'OK':'NEEDS WORK')+(d.repairs.length?' fixes: '+d.repairs.join('; '):''));
      process.exit(0);
    });
    break;
  case 'start':
    const p=readPid();
    if(p&&p!==String(process.pid)){try{process.kill(p,0);console.log("Already running");process.exit(1);}catch{}}
    runDaemon(ivMin*60*1000);
    break;
  case 'stop':
    const sp=readPid();
    if(sp){try{process.kill(sp,"SIGTERM");console.log("Stopped");}catch{console.log("Not running");}try{fs.unlinkSync(PID_FILE);}catch{}}
    else console.log("Not running");
    break;
  case 'status':
    const st4=readPid();let al=false;if(st4){try{process.kill(st4,0);al=true;}catch{}}
    const b4=loadBrain();
    console.log(JSON.stringify({running:al,pid:st4,lastCycle:b4.selfState?b4.selfState.lastCycle:null,cycles:b4.selfState?b4.selfState.cycles:0,decisions:(b4.decisions||[]).length,learned:(b4.learned||[]).length,health:b4.selfState?b4.selfState.health:'?'},null,2));
    break;
  case 'report':
    const b5=loadBrain();
    console.log('\n=== Agent-ops Report ===');
    console.log('Cycles: '+(b5.selfState?b5.selfState.cycles:0)+' Last: '+(b5.selfState?b5.selfState.lastCycle:'never'));
    console.log('Decisions: '+(b5.decisions||[]).length+' Learned: '+(b5.learned||[]).length);
    if(b5.analysisResults){
      console.log('\nScores:');
      for(const [n,d] of Object.entries(b5.analysisResults)){
        console.log('  '+n+': '+d.score.grade+' ('+d.score.score+'/100) pub='+d.score.publishable);
        if(d.risks.length>0)d.risks.slice(0,3).forEach(r=>console.log('    ['+r.severity+'] '+r.issue));
        if(d.repairs.length>0)d.repairs.forEach(r=>console.log('    -- fixed: '+r));
        if(d.score.recs&&d.score.recs.length>0)console.log('    -- fixes: '+d.score.recs.slice(0,3).join('; '));
      }
    }
    break;
  case 'score':
    for(const proj of CONFIG.projects){
      const r2=analyzeRisks(proj);
      let l2={exists:fs.existsSync(proj.local),commitsAhead:0};
      if(l2.exists){const a=git('git rev-list --count HEAD..origin/main',proj.local);l2.commitsAhead=parseInt(a)||0;}
      const g2={ok:!!git('git ls-remote origin main',proj.local),stars:0};
      const e2={ok:!!git('git ls-remote gitee main',proj.local),stars:0};
      const s2=computeScore(r2,l2,g2,e2);
      console.log(proj.name+': '+s2.grade+' ('+s2.score+'/100) pub='+s2.publishable);
      if(s2.recs.length>0)console.log('  Fixes: '+s2.recs.slice(0,3).join('; '));
    }
    break;
  default: console.log("Unknown: "+cmd); process.exit(1);
}