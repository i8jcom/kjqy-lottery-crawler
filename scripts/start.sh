#!/bin/bash

# 彩票爬虫服务启动脚本

echo "========================================="
echo "   彩票爬虫系统启动脚本"
echo "========================================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未安装 npm"
    exit 1
fi

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到 .env 文件，使用默认配置"
fi

# 创建日志目录
mkdir -p logs

echo ""
echo "🚀 启动爬虫服务..."
echo ""

# 启动服务
npm start
