#!/bin/bash
# 🔄 重启爬虫服务（使用Docker容器）
# ⚠️  此脚本已更新为使用Docker，不再直接启动本地node进程

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="lottery-crawler-compose"

echo "🔄 正在重启爬虫服务..."
echo ""

# 清理本地node进程
LOCAL_PIDS=$(ps aux | grep "node src/index.js" | grep -v docker | grep -v grep | awk '{print $2}')

if [ -n "$LOCAL_PIDS" ]; then
  echo "⚠️  发现本地 node 进程，正在清理..."
  echo "$LOCAL_PIDS" | xargs sudo kill -9 2>/dev/null || true
  echo "✅ 已清理本地进程"
  sleep 2
fi

# 重启Docker容器
cd "$SCRIPT_DIR"

echo "🚀 重启 Docker 容器..."
if docker ps -a | grep -q "$CONTAINER_NAME"; then
  docker restart "$CONTAINER_NAME"
else
  echo "⚠️  容器不存在，正在启动..."
  docker-compose up -d
fi

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

echo ""
if docker ps | grep -q "$CONTAINER_NAME"; then
  echo "✅ 服务运行正常！"
  echo ""
  echo "🎉 重启完成！"
  echo "🌐 访问地址: http://localhost:4000"
  echo "📋 查看日志: docker logs -f $CONTAINER_NAME"
else
  echo "❌ 服务启动失败，请检查日志"
  echo "📝 查看日志: docker logs $CONTAINER_NAME"
  exit 1
fi
