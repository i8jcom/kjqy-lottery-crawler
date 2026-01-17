#!/bin/bash

# Vue 3 爬虫管理系统 - 部署验证脚本
# 快速验证部署是否成功

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo "======================================================"
echo "🔍 Vue 3 爬虫管理系统 - 部署验证"
echo "======================================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0

# 测试函数
test_item() {
  local name="$1"
  local command="$2"

  echo -n "测试: $name ... "

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 通过${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ 失败${NC}"
    ((FAILED++))
    return 1
  fi
}

echo "📋 第1部分: 文件存在性检查"
echo ""

# 检查关键文件
test_item "dist/index.html存在" "test -f src/web/dist/index.html"
test_item "Vue vendor.js存在" "ls src/web/dist/assets/js/vue-vendor-*.js"
test_item "主CSS文件存在" "ls src/web/dist/assets/css/index-*.css"
test_item "LogsPro.js存在" "ls src/web/dist/assets/js/LogsPro-*.js"

echo ""
echo "📋 第2部分: Web服务器检查"
echo ""

# 检查Web服务器
test_item "Web服务器响应" "curl -s -o /dev/null -w '%{http_code}' http://localhost:4000 | grep -q 200"
test_item "HTML标题正确" "curl -s http://localhost:4000 | grep -q '爬虫管理系统'"
test_item "Vue 3脚本加载" "curl -s http://localhost:4000 | grep -q 'vue-vendor'"
test_item "CSS文件加载" "curl -s http://localhost:4000 | grep -q 'index-.*\.css'"

echo ""
echo "📋 第3部分: 静态资源检查"
echo ""

# 检查静态资源
test_item "主JS文件可访问" "curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/assets/js/vue-vendor-ch-9tCwc.js | grep -q 200"
test_item "主CSS文件可访问" "curl -s -o /dev/null -w '%{http_code}' http://localhost:4000/assets/css/index-BtgsRVAN.css | grep -q 200"

echo ""
echo "📋 第4部分: API端点检查（可选）"
echo ""

# 检查API（如果可用）
if curl -s http://localhost:4000/api/status > /dev/null 2>&1; then
  test_item "API /status响应" "curl -s http://localhost:4000/api/status | grep -q '{'"
else
  echo -e "${YELLOW}⚠️  API端点未运行（可能需要单独启动后端服务）${NC}"
fi

echo ""
echo "======================================================"
echo "📊 验证结果汇总"
echo "======================================================"
echo ""

TOTAL=$((PASSED + FAILED))
PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($PASSED/$TOTAL)*100}")

echo -e "✅ 通过: ${GREEN}$PASSED${NC}/$TOTAL"
echo -e "❌ 失败: ${RED}$FAILED${NC}/$TOTAL"
echo -e "📊 通过率: ${GREEN}${PASS_RATE}%${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 所有检查通过！部署成功！${NC}"
  echo ""
  echo "下一步："
  echo "1. 在浏览器访问: http://localhost:4000"
  echo "2. 运行浏览器测试: /quick-test.js"
  echo "3. 检查所有页面能正常访问"
  echo ""
  exit 0
else
  echo -e "${RED}❌ 部署验证失败，请检查以上失败项${NC}"
  echo ""
  echo "排查建议："
  echo "1. 确认构建完成: npm run build"
  echo "2. 确认Web服务器运行: ps aux | grep WebServer"
  echo "3. 查看服务器日志: tail -f logs/web-server.log"
  echo ""
  exit 1
fi
