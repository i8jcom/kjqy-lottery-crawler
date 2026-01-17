# 爬虫系统部署指南

## 🎯 部署方案

### 方案1：与主系统同服务器部署（推荐入门）

```bash
# 服务器上的目录结构
/home/kjqy-deploy/
├── backend/           # 主彩票系统
├── crawler-service/   # 爬虫系统（新增）
└── frontend/          # 前端
```

**优点**：
- 成本低（无需额外服务器）
- 配置简单
- 共享数据库连接

**缺点**：
- 爬虫任务可能影响API性能（可通过资源限制缓解）

---

### 方案2：独立服务器部署（推荐生产）

```
服务器A（主服务器）:
- kjqy-backend (端口3001)
- PostgreSQL
- Redis

服务器B（爬虫服务器）:
- crawler-service
- 连接到服务器A的数据库
```

**优点**：
- 服务隔离，互不影响
- 爬虫崩溃不影响主系统
- 可独立重启和升级

**缺点**：
- 需要额外服务器成本（¥80-150/月）

---

## 📝 部署步骤

### 1. 准备环境

```bash
# 确保已安装 Node.js (v16+)
node --version

# 确保已安装 npm
npm --version
```

### 2. 配置数据库连接

编辑 `.env` 文件：

```bash
# 数据库配置（与主系统共享）
DB_HOST=localhost          # 如果独立部署，改为主服务器IP
DB_PORT=5432
DB_NAME=lottery_db
DB_USER=lottery_user
DB_PASSWORD=your_password  # 填写实际密码

# 爬虫配置
CRAWLER_MODE=production
LOG_LEVEL=info
MAX_RETRY_ATTEMPTS=3
REQUEST_TIMEOUT=10000
```

### 3. 安装依赖

```bash
cd crawler-service
npm install
```

### 4. 测试爬虫

运行测试脚本，确保爬虫可以正常工作：

```bash
npm test
```

预期输出：
```
✅ 实时数据获取成功
✅ 历史数据获取成功
成功率: 100%
```

### 5. 启动服务

#### 方式1：直接启动（开发模式）

```bash
npm start
```

#### 方式2：使用 PM2（生产模式，推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动爬虫服务
pm2 start src/index.js --name crawler-service

# 查看状态
pm2 status

# 查看日志
pm2 logs crawler-service

# 设置开机自启
pm2 startup
pm2 save
```

---

## 🔍 验证部署

### 1. 检查日志

```bash
# 查看爬虫日志
tail -f logs/crawler.log

# 查看错误日志
tail -f logs/error.log
```

预期输出：
```
[2025-12-21 14:00:00] INFO: 🚀 启动爬虫调度器...
[2025-12-21 14:00:01] INFO: ✅ 数据库连接成功
[2025-12-21 14:00:02] INFO: 📡 开始首次爬取所有彩种...
[2025-12-21 14:00:05] INFO: ✅ 爬取成功: 极速赛车 - 期号 33846500
```

### 2. 检查数据库

连接到 PostgreSQL，检查数据是否写入：

```sql
-- 查看实时数据
SELECT * FROM lottery_realtime_data
ORDER BY updated_at DESC
LIMIT 10;

-- 查看最近爬取的历史数据
SELECT * FROM lottery_history_data
ORDER BY created_at DESC
LIMIT 10;
```

### 3. 检查主系统

访问主系统前端，确认数据正常显示：
```
http://localhost:5173/lottery/racing/v2/jspk10
```

---

## 📊 监控和维护

### 查看统计

爬虫会每30分钟输出一次统计报告：

```
========== 爬虫统计报告 ==========
总爬取次数: 1234
成功次数: 1200
失败次数: 34
成功率: 97.24%
数据源状态:
  - 3650098: ✅ (成功率: 98.5%)
===================================
```

### 常用命令

```bash
# PM2 管理
pm2 status              # 查看状态
pm2 logs crawler-service  # 查看日志
pm2 restart crawler-service  # 重启服务
pm2 stop crawler-service     # 停止服务
pm2 delete crawler-service   # 删除服务

# 日志管理
pm2 flush               # 清空所有日志
```

---

## 🐛 故障排查

### 问题1：数据库连接失败

```
❌ 数据库连接失败
```

**解决**：
1. 检查 `.env` 文件中的数据库配置
2. 确保数据库服务正在运行
3. 检查防火墙设置（独立部署时）

### 问题2：爬虫数据源失效

```
⚠️ 数据源标记为不健康: 3650098 (连续失败 3 次)
```

**解决**：
1. 检查网络连接
2. 爬虫会自动切换到其他数据源
3. 等待5分钟后系统会自动尝试恢复

### 问题3：数据不更新

```
⚠️ 数据过期: 33846500, 已过去 10.5 分钟
```

**解决**：
1. 检查爬虫服务是否正在运行：`pm2 status`
2. 查看爬虫日志：`pm2 logs crawler-service`
3. 重启爬虫服务：`pm2 restart crawler-service`

---

## 🔄 升级和回滚

### 升级

```bash
# 1. 停止服务
pm2 stop crawler-service

# 2. 拉取最新代码
git pull

# 3. 更新依赖
npm install

# 4. 重启服务
pm2 restart crawler-service
```

### 回滚

如果爬虫系统出现问题，可以立即停止：

```bash
pm2 stop crawler-service
```

主系统会自动 fallback 到原来的 API 数据源，不影响服务。

---

## 📈 性能优化建议

### 1. 调整爬取频率

如果服务器资源紧张，可以降低爬取频率：

编辑 `src/config/crawlerConfig.js`：

```javascript
// 高频彩种：从75秒改为90秒
high: {
  realtimeInterval: 90,  // 原来是75
  ...
}
```

### 2. 限制并发数

避免同时爬取太多彩种：

```javascript
// 分批爬取
for (let i = 0; i < lotteries.length; i += 5) {
  const batch = lotteries.slice(i, i + 5);
  await Promise.all(batch.map(l => crawl(l)));
  await sleep(1000); // 批次间延迟
}
```

---

## 📞 支持

如有问题，查看日志文件：
- `logs/crawler.log` - 所有日志
- `logs/error.log` - 错误日志
