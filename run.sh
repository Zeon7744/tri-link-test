#!/usr/bin/env bash
# run.sh — tri-link-test 一键启动演示
set -uo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ 需要 node 18+，请先安装：https://nodejs.org/"
  exit 1
fi

echo "🔗 tri-link-test 三端联动 demo"
echo "  GitHub:  https://github.com/Zeon7744/tri-link-test"
echo "  Gitee:   https://gitee.com/Zeon7744/tri-link-test"
echo "  GitCode: https://gitcode.com/Zeon7744/tri-link-test"
echo
echo "📦 Running smoke test..."
./smoke_test.sh

echo
echo "🚀 Running agent-cli (三端同步检查 + 收款门控状态)..."
timeout 30 node bin/agent-cli.js --check || echo "⚠️ agent-cli 部分功能依赖网络/secret，冒烟测试通过即视为正常"
