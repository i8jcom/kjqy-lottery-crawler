#!/bin/bash

# 彩票爬虫服务 - 前端重新构建并重启脚本
# 用途：修改 Vue 前端代码后，重新构建并重启服务
# 使用：./rebuild-and-restart.sh
#
# ⚠️  重要：此脚本使用 Docker 容器运行服务
# 不要直接启动本地 node 进程，否则会导致端口占用问题

set -e  # 遇到错误立即退出

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER_NAME="lottery-crawler-compose"

echo "========================================="
echo "🔧 彩票爬虫服务 - 重建与重启"
echo "========================================="

# 1. 清理可能存在的本地 node 进程
echo ""
echo "1️⃣  检查并清理本地 node 进程..."
LOCAL_PIDS=$(ps aux | grep "node.*src/index.js\|node.*WebServer.js" | grep -v docker | grep -v grep | awk '{print $2}')
if [ -n "$LOCAL_PIDS" ]; then
    echo "   ⚠️  发现本地 node 进程，正在停止..."
    echo "$LOCAL_PIDS" | xargs kill -9 2>/dev/null || true
    echo "   ✅ 本地进程已清理"
else
    echo "   ℹ️  没有本地 node 进程运行"
fi

# 2. 重新构建前端
echo ""
echo "2️⃣  重新构建 Vue 前端..."
cd "$SCRIPT_DIR/src/web/vue-app"
npm run build

# 3. 重启 Docker 容器
echo ""
echo "3️⃣  重启 Docker 容器..."
cd "$SCRIPT_DIR"

# 检查容器是否存在
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo "   🔄 重启容器 $CONTAINER_NAME..."
    docker restart "$CONTAINER_NAME"
else
    echo "   ⚠️  容器不存在，使用 docker-compose 启动..."
    docker-compose up -d
fi

sleep 5

# 4. 检查服务状态
echo ""
echo "4️⃣  检查服务状态..."

# 检查容器状态
if docker ps | grep -q "$CONTAINER_NAME"; then
    CONTAINER_STATUS=$(docker ps --filter "name=$CONTAINER_NAME" --format "{{.Status}}")
    echo "   ✅ Docker 容器运行正常"
    echo "   📊 容器状态: $CONTAINER_STATUS"
    echo "   🌐 访问地址: http://localhost:4000"
    echo "   📋 查看日志: docker logs -f $CONTAINER_NAME"

    # 测试 API 是否响应
    echo ""
    echo "   🧪 测试 API 连接..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/scheduler/lotteries | grep -q "200"; then
        echo "   ✅ API 响应正常"
    else
        echo "   ⚠️  API 暂未响应，容器可能还在初始化..."
    fi
else
    echo "   ❌ 容器启动失败，请检查："
    echo "   docker logs $CONTAINER_NAME"
    exit 1
fi

echo ""
echo "========================================="
echo "✅ 完成！"
echo "========================================="
echo ""
echo "💡 提示："
echo "   - 服务运行在 Docker 容器中"
echo "   - 永远不要直接运行 'node src/index.js' 或 'node src/web/WebServer.js'"
echo "   - 使用 'docker restart $CONTAINER_NAME' 重启服务"
echo "   - 使用 'docker logs -f $CONTAINER_NAME' 查看实时日志"
echo ""
