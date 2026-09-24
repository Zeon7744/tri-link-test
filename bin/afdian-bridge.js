'use strict';
/**
 * AFDian Cross-Platform Bridge
 * Enriches the AFDian (爱发电) creator page with GitHub/Gitee repo information.
 *
 * What it does:
 *   1. Collects repo metadata from GitHub + Gitee API
 *   2. Generates structured "about / 简介" text for the AFDian creator profile
 *   3. Generates a "sponsor link" page with repo links + descriptions
 *   4. Outputs a config file that the afdian-daemon can read and publish
 *
 * CLI:
 *   node afdian-bridge.js generate   - Generate cross-platform content
 *   node afdian-bridge.js preview    - Show what would be published
 *   node afdian-bridge.js push       - Generate + write to afdian-publish-config.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.tri-link');
const PUBLISH_FILE = path.join(DATA_DIR, 'afdian-publish-config.json');
const LOG_FILE = path.join(DATA_DIR, 'afdian-bridge.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] [afdian-bridge] ${msg}`;
  console.log(line);
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

// Load .env
function loadEnv(key) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith(key + '=')) {
          return trimmed.split('=').slice(1).join('=').trim().replace(/\r/g, '');
        }
      }
    }
  } catch {}
  return '';
}

const CONFIG = {
  githubToken: loadEnv('GITHUB_TOKEN'),
  giteeToken: loadEnv('GITEE_TOKEN'),
  owner: 'Zeon7744',
  afdianUserId: '', // loaded from config
};

// Load AFDian config
try {
  const cfgPath = path.join(HOME, '.local', 'bin', 'afdian-link-config.json');
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    CONFIG.afdianUserId = cfg.user_id || '';
  }
} catch {}

// Load project list from auto-maintain
const amPath = path.join(__dirname, 'auto-maintain.js');
let PROJECTS = [];
try {
  const src = fs.readFileSync(amPath, 'utf8');
  const m = src.match(/projects:\s*\[([\s\S]*?)\n\s*\],/);
  if (m) PROJECTS = eval('[' + m[1] + ']');
} catch {}

// ── API helpers ───────────────────────────────────────────────
function githubAPI(apath) {
  return new Promise(resolve => {
    if (!CONFIG.githubToken) { resolve(null); return; }
    const req = https.get({
      hostname: 'api.github.com',
      path: apath,
      headers: { 'User-Agent': 'tri-link-afdian-bridge', 'Authorization': 'Bearer ' + CONFIG.githubToken },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

function giteeAPI(apath) {
  return new Promise(resolve => {
    if (!CONFIG.giteeToken) { resolve(null); return; }
    const req = https.get({
      hostname: 'gitee.com',
      path: apath + '?access_token=' + CONFIG.giteeToken,
      headers: { 'User-Agent': 'tri-link-afdian-bridge' },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      });
    });
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// ── Collect repo metadata ────────────────────────────────────
async function collectRepoInfo(project) {
  const info = {
    name: project.name,
    type: project.type || 'project',
    github: {},
    gitee: {},
    description: '',
    readme: '',
  };

  // GitHub
  const gh = await githubAPI(`/repos/${CONFIG.owner}/${project.github}`);
  if (gh && gh.name) {
    info.github = {
      url: `https://github.com/${CONFIG.owner}/${project.github}`,
      stars: gh.stargazers_count || 0,
      forks: gh.forks_count || 0,
      size: gh.size || 0,
      language: gh.language || 'N/A',
      updated: (gh.updated_at || '').substring(0, 10),
      openIssues: gh.open_issues_count || 0,
      hasPages: gh.has_pages || false,
      description: gh.description || '',
    };
    info.description = info.github.description || '';

    // Fetch README
    const readme = await githubAPI(`/repos/${CONFIG.owner}/${project.github}/readme`);
    if (readme && readme.content) {
      try {
        info.readme = Buffer.from(readme.content, 'base64').toString('utf8').substring(0, 2000);
      } catch {}
    }
  }

  // Local README fallback (fixes Chinese encoding issues from GitHub API)
  try {
    if (project.local && fs.existsSync(project.local)) {
      const lr = path.join(project.local, 'README.md');
      if (fs.existsSync(lr)) {
        const lc = fs.readFileSync(lr, 'utf8');
        if (lc.length > 50 && !lc.includes(String.fromCharCode(65533))) {
          info.readme = lc.substring(0, 2000);
          // Fix: GitHub API replaces CJK chars with '?'. Use local README if desc is broken.
          const hasCJK = /[\u4e00-\u9fff]/.test(info.description || '');
          if (!hasCJK) {
            const ll = lc.split('\n').filter(l => l.trim() && !l.startsWith('#'));
            if (ll.length > 0) info.description = ll[0].substring(0, 120);
          }
          // Extract description from first non-heading line
          const ll = lc.split('\n').filter(l => l.trim() && !l.startsWith('#'));
          if (ll.length > 0 && info.description && info.description.includes(String.fromCharCode(65533))) {
            info.description = ll[0].substring(0, 120);
          }
        }
      }
    }
  } catch {}

  // Gitee
  const ge = await giteeAPI(`/api/v5/repos/${CONFIG.owner}/${project.gitee}`);
  if (ge && (ge.full_name || ge.name)) {
    info.gitee = {
      url: `https://gitee.com/${CONFIG.owner}/${project.gitee}`,
      stars: ge.stars_count || 0,
      forks: ge.fork_count || 0,
      updated: (ge.updated_at || '').substring(0, 10),
      description: ge.description || '',
    };
  }

  return info;
}

// ── Generate AFDian content ──────────────────────────────────
function generateAFDianContent(repoInfos) {
  const now = new Date().toISOString().substring(0, 10);

  // 1. About section (创作者简介)
  const about = buildAbout(repoInfos, now);

  // 2. Sponsor link page (赞助页)
  const sponsorPage = buildSponsorPage(repoInfos, now);

  // 3. Update notes (更新日志)
  const updates = buildUpdates(repoInfos, now);

  return { about, sponsorPage, updates, generatedAt: new Date().toISOString() };
}

function buildAbout(repoInfos, date) {
  const active = repoInfos.filter(r => r.github.url || r.gitee.url);
  const totalStars = active.reduce((a, r) => a + (r.github.stars || 0) + (r.gitee.stars || 0), 0);
  const totalRepos = active.length;

  let about = `开源开发者，专注 AI Agent 与全栈工程。\n\n`;
  about += `当前维护 ${totalRepos} 个开源项目，累计 ${totalStars} stars。\n`;
  about += `核心方向：建筑行业 AI 检测系统、AI 短剧生成、加密货币量化模型、全球投资 ML 管道。\n\n`;
  about += `代码托管：GitHub (@Zeon7744) + Gitee (足够卑微)\n`;
  about += `赞助支持 → 持续开发、文档优化、Bug 修复\n\n`;

  about += `▸ 项目一览：\n`;
  for (const r of active) {
    const lang = r.github.language || '';
    const stars = r.github.stars || 0;
    let desc = (r.description || r.github.description || r.gitee.description || r.name);
    if (/[\uFFFD\u0000-\u0008]/.test(desc)) desc = r.name + ' (' + (r.type || 'project') + ')';
    desc = desc.substring(0, 40);
    about += `  • ${r.name}${lang ? ' [' + lang + ']' : ''}${stars ? ' ⭐' + stars : ''} - ${desc}\n`;
  }
  about += `\n最后更新：${date}`;
  return about;
}

function buildSponsorPage(repoInfos, date) {
  let page = `# 感谢赞助\n\n您的支持让项目持续迭代。\n\n## 当前项目状态\n\n`;
  for (const r of repoInfos) {
    const gh = r.github.url ? `[GitHub](${r.github.url})` : '';
    const ge = r.gitee.url ? `[Gitee](${r.gitee.url})` : '';
    const links = [gh, ge].filter(Boolean).join(' · ');
    const status = r.github.updated ? `最近更新: ${r.github.updated}` : '数据同步中';
    page += `### ${r.name}\n${links}\n${status}\n\n`;
    let sd = r.description || r.github.description || r.gitee.description || '';
    if (!/[\u4e00-\u9fff]/.test(sd) && r.readme) {
      const rl = r.readme.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      sd = rl.length > 0 ? rl[0] : '';
    }
    if (sd) page += `${sd}\n\n`;
  }
  page += `---\n*由 tri-link 自动同步系统生成 · ${date}*`;
  return page;
}

function buildUpdates(repoInfos, date) {
  let updates = `## 更新日志\n\n`;
  const sorted = [...repoInfos].sort((a, b) => (b.github.updated || '').localeCompare(a.github.updated || ''));
  for (const r of sorted) {
    if (!r.github.updated && !r.gitee.updated) continue;
    const upd = r.github.updated || r.gitee.updated;
    const changes = [];
    if (r.github.updated && r.github.updated === date) changes.push('GitHub 更新');
    if (r.gitee.updated && r.gitee.updated === date) changes.push('Gitee 更新');
    const tag = changes.length ? changes.join(', ') : '常规维护';
    updates += `- **${upd}** ${r.name} - ${tag}\n`;
  }
  updates += `\n*自动生成于 ${date}*`;
  return updates;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const cmd = process.argv[2] || 'generate';
  log(`Starting (${cmd})`);

  // Collect all repo info
  const repoInfos = [];
  for (const project of PROJECTS) {
    try {
      const info = await collectRepoInfo(project);
      repoInfos.push(info);
      log(`Collected ${project.name}: GH=${info.github.url ? 'ok' : 'missing'} Gitee=${info.gitee.url ? 'ok' : 'missing'}`);
    } catch (e) {
      log(`Failed to collect ${project.name}: ${e.message}`);
    }
  }

  // Generate content
  const content = generateAFDianContent(repoInfos);

  if (cmd === 'preview') {
    console.log('\n=== About ===');
    console.log(content.about);
    console.log('\n=== Sponsor Page ===');
    console.log(content.sponsorPage);
    console.log('\n=== Updates ===');
    console.log(content.updates);
  } else {
    // Write publish config
    const publishConfig = {
      version: 2,
      generatedAt: content.generatedAt,
      afdianUserId: CONFIG.afdianUserId,
      about: content.about,
      sponsorPage: content.sponsorPage,
      updates: content.updates,
      repos: repoInfos.map(r => ({
        name: r.name,
        github: r.github.url || null,
        gitee: r.gitee.url || null,
        stars: (r.github.stars || 0) + (r.gitee.stars || 0),
        language: r.github.language || null,
        updated: r.github.updated || r.gitee.updated || null,
      })),
      stats: {
        totalRepos: repoInfos.length,
        totalStars: repoInfos.reduce((a, r) => a + (r.github.stars || 0) + (r.gitee.stars || 0), 0),
        withGitHub: repoInfos.filter(r => r.github.url).length,
        withGitee: repoInfos.filter(r => r.gitee.url).length,
      },
    };

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PUBLISH_FILE, JSON.stringify(publishConfig, null, 2));
    log(`Written to ${PUBLISH_FILE}`);
    log(`Repos: ${publishConfig.stats.totalRepos}, Stars: ${publishConfig.stats.totalStars}, GH: ${publishConfig.stats.withGitHub}, Gitee: ${publishConfig.stats.withGitee}`);
  }
}

main().catch(e => log('Error: ' + e.message));
