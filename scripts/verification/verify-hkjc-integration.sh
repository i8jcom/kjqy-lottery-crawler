#!/bin/bash

# 香港六合彩集成验证脚本

echo "═══════════════════════════════════════════════════════"
echo "  香港六合彩 (HKJC) 集成验证"
echo "═══════════════════════════════════════════════════════"
echo ""

# 1. 检查服务状态
echo "📋 1. 检查服务状态"
echo "───────────────────────────────────────────────────────"
docker ps --filter name=lottery-crawler --format "{{.Names}}: {{.Status}}"
echo ""

# 2. 测试 API 健康检查
echo "📋 2. 测试系统健康检查"
echo "───────────────────────────────────────────────────────"
curl -s http://localhost:4000/api/health | jq '.status, .uptime'
echo ""

# 3. 测试香港六合彩实时数据
echo "📋 3. 获取香港六合彩实时数据"
echo "───────────────────────────────────────────────────────"
curl -s "http://localhost:4000/api/realtime-data?lotCode=60001" | jq '{
  success,
  data: {
    期号: .data.issue,
    正码: .data.drawCode,
    特别号: .data.extra,
    开奖时间: .data.drawTime,
    倒计时秒数: .data.countdown,
    数据源: .data.source
  }
}'
echo ""

# 4. 查看最近日志
echo "📋 4. 查看 HKJC 爬虫日志（最近10条）"
echo "───────────────────────────────────────────────────────"
docker logs lottery-crawler-compose 2>&1 | grep -E "HKJC|香港|60001" | tail -10
echo ""

# 5. 验证数据完整性
echo "📋 5. 数据完整性验证"
echo "───────────────────────────────────────────────────────"
RESPONSE=$(curl -s "http://localhost:4000/api/realtime-data?lotCode=60001")
ISSUE=$(echo $RESPONSE | jq -r '.data.issue')
DRAW_CODE=$(echo $RESPONSE | jq -r '.data.drawCode')
EXTRA=$(echo $RESPONSE | jq -r '.data.extra')
DRAW_TIME=$(echo $RESPONSE | jq -r '.data.drawTime')

if [ "$ISSUE" != "null" ] && [ "$DRAW_CODE" != "null" ] && [ "$EXTRA" != "null" ]; then
  echo "✅ 期号: $ISSUE"
  echo "✅ 正码: $DRAW_CODE"
  echo "✅ 特别号: $EXTRA"
  echo "✅ 开奖时间: $DRAW_TIME"
  echo ""
  echo "🎉 所有数据字段完整！"
else
  echo "❌ 数据不完整，请检查日志"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ 验证完成！"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📖 查看完整报告: cat HKJC-Integration-Report.md"
echo "🧪 运行测试脚本: node test-hkjc-oncc.js"
echo ""
