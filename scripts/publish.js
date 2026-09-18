#!/usr/bin/env node
'use strict';
/**
 * Publish tri-link packages to npm
 *
 * Requires NPM_TOKEN to be set in environment:
 *   export NPM_TOKEN=npm_xxxxxxxx
 *   node scripts/publish.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES = [
  'packages/afdian-mcp',
  'packages/github-api-v2',
  'packages/dashboard',
];

function checkNpmToken() {
  const token = process.env.NPM_TOKEN;
  if (!token) {
    console.error('Error: NPM_TOKEN environment variable is not set.');
    console.error('Generate one at: https://www.npmjs.com/settings/Zeon7744/tokens');
    console.error('Then run: export NPM_TOKEN=npm_xxxxxxxx');
    process.exit(1);
  }
  console.log('NPM_TOKEN found, proceeding...');
}

function publishPackage(pkgPath, label) {
  const fullPath = path.join(ROOT, pkgPath);
  const pkgJson = JSON.parse(fs.readFileSync(path.join(fullPath, 'package.json'), 'utf8'));
  const name = pkgJson.name;
  const version = pkgJson.version;

  console.log(`\n Publishing ${label} (${name}@${version})...`);

  try {
    // Create .npmrc in package dir
    const npmrc = `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`;
    fs.writeFileSync(path.join(fullPath, '.npmrc'), npmrc);

    execSync('npm publish', {
      cwd: fullPath,
      stdio: 'inherit',
      env: { ...process.env, NPM_TOKEN: process.env.NPM_TOKEN },
    });

    console.log(` OK: ${name}@${version} published`);

    // Cleanup .npmrc
    try { fs.unlinkSync(path.join(fullPath, '.npmrc')); } catch {}
  } catch (err) {
    console.error(` FAILED: ${name} - ${err.message}`);
  }
}

async function main() {
  checkNpmToken();

  console.log('\n=== Tri-Link NPM Publish ===');
  console.log(`Root: ${ROOT}`);
  console.log(`Packages: ${PACKAGES.length}`);

  for (let i = 0; i < PACKAGES.length; i++) {
    const pkg = PACKAGES[i];
    const label = pkg.replace('packages/', '');
    publishPackage(pkg, label);
  }

  console.log('\n=== Publish Complete ===');
}

main().catch(err => {
  console.error('Publish failed:', err.message);
  process.exit(1);
});
