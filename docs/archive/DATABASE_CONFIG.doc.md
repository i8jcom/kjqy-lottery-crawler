# 数据库配置说明

## ✅ 当前配置（已更新）

### 采集系统专用数据库
- **容器名称**: `lottery-mysql-compose`
- **端口映射**: `3308:3306` (宿主机端口3308)
- **数据库**: `lottery_crawler`
- **用户**: `lottery / lottery123`
- **数据状态**:
  - 开奖数据：101,156条
  - 域名配置：18个（6个数据源 × 3个备用域名）

### 连接配置
```bash
# .env 文件配置
DB_HOST=lottery-mysql-compose
DB_PORT=3306
DB_NAME=lottery_crawler
DB_USER=lottery
DB_PASSWORD=lottery123
```

## 🔒 数据库隔离

### lottery-mysql-compose（采集系统专用）
- ✅ 用途：开发阶段采集系统独立数据库
- ✅ 数据：开奖数据 + 域名管理表
- ✅ 端口：3308
- 🚀 迁移：开发完成后整体迁移到生产服务器

### 1Panel-mysql-7kLA（主系统）
- ❌ 不应用于采集系统
- ✅ 已清理采集系统相关表
- 🔒 保持独立，避免干扰

## 📊 域名管理表（已部署）

### cwl_api_domains（域名配置表）
```sql
| source_type       | domain_url                    | priority | status |
|-------------------|-------------------------------|----------|--------|
| cwl               | https://www.gdlottery.cn     | 1        | active |
| speedylot88       | https://speedylot88.com      | 1        | active |
| sglotteries       | https://sglotteries.com      | 1        | active |
| auluckylotteries  | http://auluckylotteries.com  | 1        | active |
| luckysscai        | https://luckysscai.com       | 1        | active |
| luckylottoz       | https://luckylottoz.com      | 1        | active |
```

每个数据源配置3个域名（1主 + 2备）

### cwl_domain_switch_history（切换历史表）
- 记录所有域名切换事件
- 包含切换原因、时间、触发方式

### cwl_domain_health_logs（健康日志表）
- 记录所有健康检查结果
- 响应时间、成功率统计

## 🔄 服务重启

### 方法1：使用脚本（推荐）
```bash
# 需要 root 权限
sudo bash restart_service.sh
```

### 方法2：手动重启
```bash
# 1. 停止服务
OLD_PID=$(ps aux | grep "node.*src/index.js" | grep -v grep | awk '{print $2}')
sudo kill $OLD_PID

# 2. 启动服务
cd /home/i8/claude-demo/kjqy-deploy/crawler-service
nohup node src/index.js > logs/service.log 2>&1 &

# 3. 查看日志
tail -f logs/service.log
```

### 方法3：使用 PM2（生产推荐）
```bash
pm2 start src/index.js --name crawler-service
pm2 save
pm2 startup  # 开机自启
```

## 🚀 生产环境迁移

开发完成后，迁移步骤：

1. **导出数据**
```bash
docker exec lottery-mysql-compose mysqldump -ulottery -plottery123 lottery_crawler > lottery_crawler_backup.sql
```

2. **传输到生产服务器**
```bash
scp lottery_crawler_backup.sql user@production-server:/path/to/backup/
```

3. **生产服务器导入**
```bash
mysql -u lottery -p lottery_crawler < lottery_crawler_backup.sql
```

4. **更新生产环境配置**
- 修改 `.env` 中的 `DB_HOST` 为生产服务器 MySQL 地址
- 配置 PM2 或 systemd 服务

## ✅ 验证配置

### 1. 检查数据库连接
```bash
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e "
SELECT
  '开奖数据' as 类型, COUNT(*) as 记录数 FROM lottery_results
UNION ALL
SELECT
  '域名配置' as 类型, COUNT(*) as 记录数 FROM cwl_api_domains;
"
```

### 2. 查看域名配置
```bash
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e "
SELECT source_type, domain_url, priority, status
FROM cwl_api_domains
ORDER BY source_type, priority;
"
```

### 3. 验证服务连接
重启服务后，检查日志中是否有域名管理相关信息：
```bash
tail -f logs/crawler10.log | grep "域名"
```

期望看到类似：
```
[SpeedyLot88] 🚀 请求: https://speedylot88.com/... [域名: https://speedylot88.com]
[UniversalDomainManager] ✅ 域名健康检查完成
```

## 🎯 覆盖范围

- ✅ CWL（中国福彩）- 3个彩种
- ✅ SpeedyLot88 - 7个彩种
- ✅ SG Lotteries - 6个彩种
- ✅ AU Lucky Lotteries - 4个彩种
- ✅ Lucky Sscai - 1个彩种
- ✅ Lucky Lottoz - 1个彩种

**总计：6个数据源，23个彩种受保护**
