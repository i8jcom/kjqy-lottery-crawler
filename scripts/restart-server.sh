#!/bin/bash
# 🔄 重启爬虫服务器（使用Docker容器）
# ⚠️  此脚本已更新为使用Docker，不再直接启动本地node进程

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="lottery-crawler-compose"

echo "🔄 正在重启爬虫服务器..."
echo ""

# 清理可能存在的本地进程
LOCAL_PIDS=$(ps aux | grep "node.*index\.js" | grep -v docker | grep -v grep | awk '{print $2}')
if [ -n "$LOCAL_PIDS" ]; then
  echo "⚠️  发现本地 node 进程，正在清理..."
  echo "$LOCAL_PIDS" | xargs kill -9 2>/dev/null || true
  sleep 2
fi

# 重启Docker容器
cd "$SCRIPT_DIR"

echo "🔄 重启 Docker 容器..."
if docker ps -a | grep -q "$CONTAINER_NAME"; then
  docker restart "$CONTAINER_NAME"
  echo "✅ 容器已重启"
else
  echo "❌ 未找到容器 $CONTAINER_NAME"
  echo "📝 手动启动: cd $SCRIPT_DIR && docker-compose up -d"
  exit 1
fi

sleep 5

echo ""
echo "🔍 验证服务状态..."
if docker ps | grep -q "$CONTAINER_NAME"; then
  echo "✅ 服务器已启动！"
  echo "📊 容器状态: $(docker ps --filter "name=$CONTAINER_NAME" --format "{{.Status}}")"
  echo ""
  echo "🌐 访问地址: http://localhost:4000"
  echo "📋 查看日志: docker logs -f $CONTAINER_NAME"
else
  echo "❌ 启动失败"
  echo "📝 查看日志: docker logs $CONTAINER_NAME"
  exit 1
fi
