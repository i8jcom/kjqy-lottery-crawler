#!/bin/bash
# 🔄 重启爬虫服务（使用Docker容器）
# ⚠️  此脚本已更新为使用Docker，不再直接启动本地node进程

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="lottery-crawler-compose"

# 清理本地node进程
LOCAL_PIDS=$(ps aux | grep "node src/index.js" | grep -v docker | grep -v grep | awk '{print $2}')

if [ -n "$LOCAL_PIDS" ]; then
  echo "⚠️  发现本地 node 进程，正在清理..."
  echo "$LOCAL_PIDS" | xargs kill -9 2>/dev/null || true
  echo "✅ 本地进程已清理"
  sleep 2
fi

# 重启Docker容器
cd "$SCRIPT_DIR"

echo "🔄 重启 Docker 容器..."
if docker ps -a | grep -q "$CONTAINER_NAME"; then
  docker restart "$CONTAINER_NAME"
  echo "✅ 容器已重启"
else
  echo "⚠️  容器不存在，正在启动..."
  docker-compose up -d
fi

echo "⏳ 等待服务启动..."
sleep 5

# 显示服务状态
echo ""
if docker ps | grep -q "$CONTAINER_NAME"; then
  echo "✅ Service restart complete!"
  echo "📌 Web interface: http://localhost:4000"
  echo "📋 View logs: docker logs -f $CONTAINER_NAME"
  echo ""
  echo "Recent logs:"
  docker logs --tail 30 "$CONTAINER_NAME"
else
  echo "❌ 容器启动失败"
  echo "📝 查看日志: docker logs $CONTAINER_NAME"
  exit 1
fi
