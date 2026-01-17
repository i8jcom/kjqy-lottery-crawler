#!/bin/bash

echo "═══════════════════════════════════════════════════════════════"
echo "  香港六合彩双数据源系统验证"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# 1. 检查服务状态
echo "📋 1. 检查爬虫服务状态"
echo "───────────────────────────────────────────────────────────────"
docker ps --filter name=lottery-crawler --format "{{.Names}}: {{.Status}}"
echo ""

# 2. 测试 On.cc API (实时数据)
echo "📋 2. 测试 On.cc API（实时数据源）"
echo "───────────────────────────────────────────────────────────────"
ONCC_DATA=$(curl -s "http://localhost:4000/api/realtime-data?lotCode=60001")
ISSUE=$(echo $ONCC_DATA | jq -r '.data.issue' 2>/dev/null)
DRAW_CODE=$(echo $ONCC_DATA | jq -r '.data.drawCode' 2>/dev/null)
EXTRA=$(echo $ONCC_DATA | jq -r '.data.extra' 2>/dev/null)

if [ "$ISSUE" != "null" ] && [ -n "$ISSUE" ]; then
  echo "✅ On.cc API 正常"
  echo "   期号: $ISSUE"
  echo "   正码: $DRAW_CODE"
  echo "   特别号: $EXTRA"
else
  echo "❌ On.cc API 异常"
fi
echo ""

# 3. 查看最近日志
echo "📋 3. 查看 HKJC 爬虫日志（最近5条）"
echo "───────────────────────────────────────────────────────────────"
docker logs lottery-crawler-compose 2>&1 | grep -E "HKJC|香港|60001" | tail -5
echo ""

# 4. 检查文件
echo "📋 4. 检查核心文件"
echo "───────────────────────────────────────────────────────────────"
files=(
  "src/scrapers/HKJCScraper.js"
  "src/scrapers/CPZhanHistoryScraper.js"
  "scripts/importHKJCHistory.js"
  "test-dual-source.js"
  "verify-cpzhan-accuracy.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file (缺失)"
  fi
done
echo ""

# 5. 总结
echo "═══════════════════════════════════════════════════════════════"
echo "  验证完成"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$ISSUE" != "null" ] && [ -n "$ISSUE" ]; then
  echo "✅ 系统运行正常！"
  echo ""
  echo "📊 当前数据："
  echo "   彩种: 香港六合彩 (60001)"
  echo "   期号: $ISSUE"
  echo "   正码: $DRAW_CODE"
  echo "   特别号: $EXTRA"
  echo ""
  echo "🚀 下一步操作："
  echo "   1. 测试双数据源: node test-dual-source.js"
  echo "   2. 导入历史数据: docker exec -it lottery-crawler-compose node scripts/importHKJCHistory.js 2011 2025"
  echo "   3. 查看文档: cat QUICKSTART-双数据源.md"
else
  echo "⚠️  系统可能存在问题，请检查日志"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
