#!/usr/bin/env node
'use strict';
// Fix Gitee API to include access token
const fs = require('fs');
const p = 'D:/项目/开发部/github/tri-link-test/bin/auto-maintain.js';
let c = fs.readFileSync(p, 'utf8');

// Replace the giteeAPI function to append token
const oldGitee = `function giteeAPI(path) {
  return new Promise((resolve) => {
    const req = require('https').get({
      hostname: 'gitee.com',
      path,
      headers: { 'User-Agent': 'tri-link-maintain' },
    }`;

const newGitee = `function giteeAPI(path) {
  return new Promise((resolve) => {
    const token = CONFIG.giteeToken;
    const req = require('https').get({
      hostname: 'gitee.com',
      path: path + (path.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + token,
      headers: { 'User-Agent': 'tri-link-maintain' },
    }`;

if (c.indexOf(oldGitee) !== -1) {
  c = c.replace(oldGitee, newGitee);
  fs.writeFileSync(p, c);
  console.log('Fixed giteeAPI');
} else {
  console.log('Pattern not found, trying line-by-line...');
  const lines = c.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("hostname: 'gitee.com'") && lines[i+1] && lines[i+1].trim() === 'path,') {
      lines[i+1] = "      path: path + (path.indexOf('?') >= 0 ? '&' : '?') + 'access_token=' + CONFIG.giteeToken,";
      console.log('Fixed line', i+1);
      break;
    }
  }
  fs.writeFileSync(p, lines.join('\n'));
}
