# 使用Node.js 20 LTS版本（兼容undici v7+）
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装必要工具和时区数据
RUN apk add --no-cache \
    tzdata \
    wget

# 设置时区为上海
RUN cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制项目文件
COPY . .

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 4000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# 启动命令
CMD ["node", "src/index.js"]
