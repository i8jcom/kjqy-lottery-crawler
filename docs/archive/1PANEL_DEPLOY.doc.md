# 彩票爬虫服务 - 1Panel 部署指南

## 📋 部署前准备

### 1. 系统要求
- 操作系统: Linux (推荐 Ubuntu 20.04+)
- 已安装 1Panel 控制面板
- Docker 和 Docker Compose (1Panel会自动安装)

### 2. 项目文件准备
确保项目目录包含以下文件:
```
crawler-service/
├── src/                  # 源代码
├── Dockerfile           # Docker镜像配置 ✅
├── docker-compose.yml   # Docker编排配置 ✅
├── .dockerignore        # Docker忽略文件 ✅
├── init.sql             # 数据库初始化脚本 ✅
├── my.cnf               # MySQL配置文件 ✅
├── package.json         # Node.js依赖
└── 1PANEL_DEPLOY.md     # 本文档
```

## 🚀 1Panel 部署步骤

### 方式一：通过1Panel Web界面部署 (推荐)

#### 1. 上传项目文件
```bash
# 1. 打包项目
cd /home/i8/claude-demo/kjqy-deploy
tar -czf crawler-service.tar.gz crawler-service/

# 2. 下载到本地
# 使用SFTP或其他方式将 crawler-service.tar.gz 下载到本地

# 3. 在服务器上上传并解压
# 通过1Panel文件管理器上传tar.gz文件到 /opt/1panel/apps/
# 然后通过SSH解压:
cd /opt/1panel/apps/
tar -xzf crawler-service.tar.gz
```

#### 2. 在1Panel中部署

1. **打开1Panel控制面板**
   - 访问: http://172.24.221.238:7397
   - 登录你的1Panel账号

2. **进入容器管理**
   - 左侧菜单: 容器 → Compose

3. **创建Compose项目**
   - 点击 "创建" 按钮
   - 项目名称: `lottery-crawler`
   - 项目路径: 选择 `/opt/1panel/apps/crawler-service`
   - 或者直接粘贴 docker-compose.yml 内容

4. **配置环境变量 (可选)**
   在docker-compose.yml中修改以下配置:
   ```yaml
   environment:
     # 数据库配置
     - DB_HOST=mysql
     - DB_PORT=3306
     - DB_USER=lottery
     - DB_PASSWORD=your_secure_password  # 修改为安全密码
     - DB_NAME=lottery_crawler

     # 爬虫配置
     - CRAWLER_PORT=4000
     - CRAWLER_INTERVAL=300000  # 5分钟检查一次
   ```

5. **启动服务**
   - 点击 "启动" 按钮
   - 等待容器启动完成 (约30-60秒)

#### 3. 验证部署

1. **检查容器状态**
   - 在1Panel的容器列表中查看
   - 确保两个容器都显示 "运行中"
     - `lottery-crawler` (爬虫服务)
     - `lottery-mysql` (数据库)

2. **查看日志**
   - 点击容器的 "日志" 按钮
   - 查看是否有错误信息

3. **访问Web管理界面**
   ```
   http://服务器IP:4000
   ```

### 方式二：通过SSH命令行部署

```bash
# 1. 进入项目目录
cd /opt/1panel/apps/crawler-service

# 2. 构建并启动服务
docker-compose up -d

# 3. 查看容器状态
docker-compose ps

# 4. 查看日志
docker-compose logs -f crawler-service

# 5. 停止服务
docker-compose down

# 6. 重启服务
docker-compose restart
```

## 🔧 配置说明

### 端口映射
- `4000` - Web管理界面和API服务
- `3306` - MySQL数据库端口

### 数据持久化
以下目录会自动持久化:
- `/app/logs` - 服务日志
- `/app/config` - 配置文件
- `/app/data` - 数据文件
- MySQL数据卷 - 数据库数据

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_HOST` | 数据库主机 | mysql |
| `DB_PORT` | 数据库端口 | 3306 |
| `DB_USER` | 数据库用户名 | lottery |
| `DB_PASSWORD` | 数据库密码 | lottery123 |
| `DB_NAME` | 数据库名称 | lottery_crawler |
| `CRAWLER_PORT` | 服务端口 | 4000 |
| `CRAWLER_INTERVAL` | 爬取间隔(毫秒) | 300000 |
| `NODE_ENV` | 运行环境 | production |

## 📊 使用指南

### 1. 访问Web管理界面
```
http://服务器IP:4000
```

### 2. 功能模块
- **仪表盘** - 系统概览和快捷操作
- **调度器状态** - 查看定时任务运行情况
- **历史查询** - 查询历史开奖数据
- **数据管理** - 数据导出和管理
- **告警管理** - 配置告警规则和通知
- **数据源管理** - 管理数据源
- **彩种配置** - 配置爬取的彩种
- **系统日志** - 查看系统运行日志

### 3. 在1Panel中重启服务

**方法1: 通过Web界面**
1. 进入 容器 → Compose
2. 找到 `lottery-crawler` 项目
3. 点击 "重启" 按钮

**方法2: 通过容器管理**
1. 进入 容器 → 容器
2. 找到 `lottery-crawler` 容器
3. 点击 "重启" 按钮

**方法3: 通过命令行**
```bash
# 重启整个项目
docker-compose restart

# 只重启爬虫服务
docker-compose restart crawler-service

# 只重启数据库
docker-compose restart mysql
```

## 🔍 故障排查

### 1. 容器无法启动
```bash
# 查看详细日志
docker-compose logs

# 查看特定服务日志
docker-compose logs crawler-service
docker-compose logs mysql
```

### 2. 无法访问Web界面
- 检查防火墙是否开放 4000 端口
- 检查容器是否正常运行: `docker-compose ps`
- 检查日志: `docker-compose logs crawler-service`

### 3. 数据库连接失败
```bash
# 进入MySQL容器
docker-compose exec mysql mysql -u lottery -plottery123

# 检查数据库是否创建
SHOW DATABASES;

# 检查表是否创建
USE lottery_crawler;
SHOW TABLES;
```

### 4. 查看实时日志
```bash
# 爬虫服务日志
docker-compose logs -f --tail=100 crawler-service

# 数据库日志
docker-compose logs -f --tail=100 mysql
```

## 🛡️ 安全建议

1. **修改默认密码**
   - 修改 `docker-compose.yml` 中的数据库密码
   - 修改 `MYSQL_ROOT_PASSWORD` 和 `DB_PASSWORD`

2. **配置防火墙**
   ```bash
   # 只允许本地访问MySQL
   # 在docker-compose.yml中删除MySQL的ports映射
   ```

3. **定期备份**
   ```bash
   # 备份数据库
   docker-compose exec mysql mysqldump -u lottery -plottery123 lottery_crawler > backup.sql

   # 恢复数据库
   docker-compose exec -T mysql mysql -u lottery -plottery123 lottery_crawler < backup.sql
   ```

## 📈 性能优化

### 1. MySQL配置优化
编辑 `my.cnf` 文件，根据服务器配置调整:
```ini
innodb_buffer_pool_size=512M  # 可用内存的50-70%
max_connections=500           # 根据需要调整
```

### 2. 容器资源限制
在 `docker-compose.yml` 中添加:
```yaml
services:
  crawler-service:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## 🔄 更新部署

### 1. 更新代码
```bash
# 停止服务
docker-compose down

# 更新代码
# ... 上传新代码 ...

# 重新构建并启动
docker-compose up -d --build
```

### 2. 不停机更新 (Rolling Update)
```bash
# 仅重启爬虫服务
docker-compose up -d --no-deps --build crawler-service
```

## 📞 技术支持

- **Web界面**: http://服务器IP:4000
- **API文档**: http://服务器IP:4000/api
- **健康检查**: http://服务器IP:4000/api/health

## ✅ 部署检查清单

- [ ] 1Panel已安装并正常运行
- [ ] Docker和Docker Compose已安装
- [ ] 项目文件已上传到服务器
- [ ] docker-compose.yml配置已检查
- [ ] 数据库密码已修改
- [ ] 容器成功启动
- [ ] Web界面可以访问
- [ ] 数据库连接正常
- [ ] 日志无错误信息
- [ ] 防火墙规则已配置
- [ ] 定期备份已设置

---

## 🔄 重新部署指南

### 情况1: 在1Panel中重新部署 (使用docker-compose)

如果要完全删除并重新搭建，按以下步骤操作：

```bash
# 1. 停止并删除当前容器（如果存在）
cd /home/i8/claude-demo/kjqy-deploy/crawler-service
docker stop lottery-crawler lottery-crawler-compose 2>/dev/null
docker rm lottery-crawler lottery-crawler-compose 2>/dev/null

# 2. 使用docker-compose部署（包含独立MySQL）
docker-compose down -v  # 删除旧容器和数据卷（如果存在）
docker-compose up -d --build

# 3. 查看日志确认启动成功
docker-compose logs -f

# 4. 访问服务
# http://服务器IP:4000
```

**优势**：
- ✅ 包含独立的MySQL容器，无需手动配置数据库
- ✅ 自动执行init.sql初始化数据库
- ✅ 所有配置通过环境变量管理
- ✅ 一键启动，数据库和应用自动关联
- ✅ MySQL数据持久化到docker volume

### 情况2: 使用现有1Panel MySQL

如果要使用1Panel已有的MySQL容器（当前方案）：

**步骤**：

1. **确保数据库已创建**
```bash
# 检查数据库是否存在
docker exec 1Panel-mysql-7kLA mysql -uroot -p[密码] -e "SHOW DATABASES LIKE 'lottery_crawler';"

# 如果不存在，创建数据库和用户
docker exec 1Panel-mysql-7kLA mysql -uroot -p[密码] << EOF
CREATE DATABASE IF NOT EXISTS lottery_crawler CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'lottery'@'%' IDENTIFIED BY 'lottery123';
GRANT ALL PRIVILEGES ON lottery_crawler.* TO 'lottery'@'%';
FLUSH PRIVILEGES;
EOF

# 执行初始化脚本
docker exec -i 1Panel-mysql-7kLA mysql -uroot -p[密码] lottery_crawler < init.sql
```

2. **配置.env文件**
```bash
# 编辑 /home/i8/claude-demo/kjqy-deploy/crawler-service/.env
DB_HOST=1Panel-mysql-7kLA
DB_PORT=3306
DB_NAME=lottery_crawler
DB_USER=lottery
DB_PASSWORD=lottery123
```

3. **在1Panel中创建Node.js项目**
   - 应用类型: Node.js
   - 项目路径: `/home/i8/claude-demo/kjqy-deploy/crawler-service`
   - 端口: 4000
   - 启动脚本: `npm run dev`

4. **重启容器**
```bash
docker restart lottery-crawler
```

### 重新部署不会出问题的前提条件

✅ **使用docker-compose方案（推荐）**：
- 所有配置已内置在docker-compose.yml中
- 数据库自动初始化
- 直接运行 `docker-compose up -d` 即可

✅ **使用1Panel MySQL方案**：
- .env文件配置正确（DB_HOST=1Panel-mysql-7kLA）
- 数据库和用户已创建
- init.sql已执行
- 容器在同一Docker网络中

### 快速验证

```bash
# 检查容器状态
docker ps --filter "name=lottery"

# 检查容器日志
docker logs --tail=50 lottery-crawler-compose  # docker-compose方案
# 或
docker logs --tail=50 lottery-crawler  # 1Panel方案

# 检查数据库连接
docker exec lottery-crawler-compose node -e "
const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log('✅ 数据库连接成功');
    await conn.end();
  } catch(err) {
    console.log('❌ 数据库连接失败:', err.message);
  }
})();
"

# 检查数据
docker exec 1Panel-mysql-7kLA mysql -uroot -p[密码] lottery_crawler -e "SELECT COUNT(*) FROM lottery_results;"
```

---

**部署完成后，请访问 http://服务器IP:4000 开始使用！** 🎉
