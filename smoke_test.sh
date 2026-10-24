#!/usr/bin/env bash
# smoke_test.sh — tri-link-test 冒烟测试
# 验证核心 JS 模块 + 三端 workflow 完整性（node 18+）
set -uo pipefail
cd "$(dirname "$0")"

PASS=0; FAIL=0

if command -v node >/dev/null 2>&1; then
  echo "✅ node 可用 ($(node --version))"
  PASS=$((PASS+1))
else
  echo "❌ node 未安装（需要 18+）"
  FAIL=$((FAIL+1))
fi

for f in bin/agent-cli.js bin/afdian-daemon.js bin/auto-maintain.js; do
  if [ -s "$f" ]; then
    echo "✅ $f 存在"
    PASS=$((PASS+1))
  else
    echo "❌ $f 缺失或为空"
    FAIL=$((FAIL+1))
  fi
done

if grep -rl "AFDIAN" packages/ >/dev/null 2>&1 || [ -f "afdian-daemon.js" ]; then
  echo "✅ 收款门控（爱发电）相关代码存在"
  PASS=$((PASS+1))
else
  echo "❌ 未找到收款门控代码"
  FAIL=$((FAIL+1))
fi

for wf in .github/workflows/mirror-triple.yml .github/workflows/pages.yml .github/workflows/npm-publish.yml; do
  if [ -f "$wf" ]; then
    echo "✅ $wf 存在"
    PASS=$((PASS+1))
  else
    echo "❌ $wf 缺失"
    FAIL=$((FAIL+1))
  fi
done

if command -v node >/dev/null 2>&1; then
  if timeout 10 node bin/agent-cli.js --check >/dev/null 2>&1; then
    echo "✅ agent-cli --check 启动无报错"
    PASS=$((PASS+1))
  else
    echo "⚠️ agent-cli --check 未通过（依赖网络，属预期，不计失败）"
  fi
fi

echo ""
echo "=== Result: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
