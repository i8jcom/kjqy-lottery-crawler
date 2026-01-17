#!/bin/bash
# 🔄 重启爬虫服务（使用Docker容器）
# ⚠️  此脚本已更新为使用Docker，不再直接启动本地node进程

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="lottery-crawler-compose"

echo "🔍 检查本地 node 进程..."
LOCAL_PIDS=$(ps aux | grep "node.*src/index.js\|node.*WebServer.js" | grep -v docker | grep -v grep | awk '{print $2}')

if [ -n "$LOCAL_PIDS" ]; then
  echo "⚠️  发现本地 node 进程（错误状态），正在清理..."
  echo "$LOCAL_PIDS" | while read PID; do
    OWNER=$(ps -o user= -p $PID 2>/dev/null)
    echo "   清理进程 PID: $PID (所有者: $OWNER)"
    if [ "$OWNER" = "root" ]; then
      sudo kill -9 $PID 2>/dev/null || true
    else
      kill -9 $PID 2>/dev/null || true
    fi
  done
  echo "✅ 本地进程已清理"
  sleep 2
else
  echo "✅ 没有本地 node 进程运行"
fi

echo ""
echo "🔄 重启 Docker 容器..."
cd "$SCRIPT_DIR"

if docker ps -a | grep -q "$CONTAINER_NAME"; then
  docker restart "$CONTAINER_NAME"
  echo "✅ 容器已重启"
else
  echo "⚠️  容器不存在，正在启动..."
  docker-compose up -d
fi

sleep 5

echo ""
echo "🔍 检查服务状态..."
if docker ps | grep -q "$CONTAINER_NAME"; then
  echo "✅ Docker 容器运行正常"
  echo "📊 容器状态: $(docker ps --filter "name=$CONTAINER_NAME" --format "{{.Status}}")"
  echo "🌐 访问地址: http://localhost:4000"
  echo "📋 查看日志: docker logs -f $CONTAINER_NAME"
  echo ""
  echo "🎯 重启完成！"
else
  echo "❌ 容器启动失败"
  echo "📝 查看日志: docker logs $CONTAINER_NAME"
  exit 1
fi
