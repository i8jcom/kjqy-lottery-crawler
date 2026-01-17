# 🔄 服务重启检查清单

## 📋 重启前准备（已完成）

### ✅ 1. 数据库配置已更新
```bash
.env 文件:
DB_HOST=lottery-mysql-compose  ✅ 已改为采集系统专用数据库
DB_PORT=3306
DB_NAME=lottery_crawler
DB_USER=lottery
DB_PASSWORD=lottery123
```

### ✅ 2. 域名管理表已部署
```
lottery-mysql-compose 数据库:
- cwl_api_domains (18条记录) ✅
- cwl_domain_switch_history ✅
- cwl_domain_health_logs ✅
```

### ✅ 3. 代码已更新
```
已改造的 Scraper (5个):
- SpeedyLot88Scraper.js ✅
- SGLotteriesScraper.js ✅
- AULuckyLotteriesScraper.js ✅
- LuckySscaiScraper.js ✅
- LuckyLottozScraper.js ✅

域名管理器:
- UniversalDomainManager.js ✅ (默认数据库已更新)
```

### ✅ 4. 主系统数据库已隔离
```
1Panel-mysql-7kLA:
- 域名管理表已清理 ✅
- 保持独立，不受影响 ✅
```

---

## 🚀 通过 1Panel 重启容器

### 操作步骤：

1. **打开 1Panel 管理面板**
   - 访问 1Panel Web 界面
   - 进入「容器」管理页面

2. **找到采集服务容器**
   - 容器名称: `lottery-crawler-compose`
   - 容器ID: `77bbb7969ed1`
   - 当前状态: 运行中 (healthy)

3. **重启容器**
   - 点击容器操作菜单
   - 选择「重启」或「Restart」
   - 等待容器状态变为 healthy

4. **预计重启时间**
   - 停止: ~5秒
   - 启动: ~30-40秒
   - 健康检查: ~10秒
   - 总计: ~1分钟

---

## ✅ 重启后验证

### 1️⃣ 检查容器状态
```bash
docker ps | grep lottery-crawler-compose
# 预期: 状态为 Up，健康状态为 (healthy)
```

### 2️⃣ 查看启动日志
```bash
docker logs -f --tail 100 lottery-crawler-compose
```

**预期看到的关键日志：**
```
✅ 数据库连接成功
[UniversalDomainManager] 数据库连接池已初始化
[UniversalDomainManager] 🏥 启动全局健康检查（间隔：300秒）
🌐 通用域名管理器健康检查已启动
🚀 爬虫服务启动成功
📊 Web服务已启动: http://0.0.0.0:4000
```

### 3️⃣ 验证域名管理功能
```bash
# 检查日志中的域名信息
docker logs lottery-crawler-compose 2>&1 | grep "域名:" | tail -5
```

**预期日志格式：**
```
[SpeedyLot88] 🚀 请求: https://speedylot88.com/speedy10-result.php [域名: https://speedylot88.com]
[SGLotteries] 🚀 请求最新数据: https://sglotteries.com/api/result/load-ft.php [域名: https://sglotteries.com]
[SpeedyLot88] ✅ 成功获取 jspk10 第33857265期数据 (134ms)
```

### 4️⃣ 测试数据采集
```bash
# 测试获取彩种数据
curl -s http://localhost:4000/api/lottery/10036 | jq '.'
```

**预期返回：**
```json
{
  "success": true,
  "data": {
    "lotCode": "10036",
    "period": "xxxxx",
    "numbers": ["xx", "xx", ...],
    "drawTime": "2025-12-30 22:xx:xx",
    "source": "speedylot88"
  }
}
```

### 5️⃣ 检查域名健康状态
```bash
# 5分钟后查询域名健康日志
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e "
SELECT domain_url, is_success, response_time_ms, checked_at
FROM cwl_domain_health_logs
ORDER BY checked_at DESC
LIMIT 10;
" 2>&1 | grep -v Warning
```

### 6️⃣ 验证数据库连接
```bash
# 确认连接的是 lottery-mysql-compose
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e "
SELECT COUNT(*) as latest_records
FROM lottery_results
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR);
" 2>&1 | grep -v Warning
```

---

## ⚠️ 故障排查

### 问题1: 容器无法启动
**症状**: 容器状态为 Exited
**检查**:
```bash
docker logs lottery-crawler-compose --tail 50
```
**常见原因**:
- 数据库连接失败
- 端口4000被占用
- 代码语法错误

### 问题2: 健康检查失败
**症状**: 容器状态为 (unhealthy)
**检查**:
```bash
curl http://localhost:4000/api/health
docker exec lottery-crawler-compose wget --spider http://localhost:4000/api/health
```

### 问题3: 域名管理未生效
**症状**: 日志中没有 [域名: xxx] 信息
**检查**:
```bash
# 确认 .env 文件被正确挂载
docker exec lottery-crawler-compose cat /app/.env | grep DB_HOST

# 确认数据库表存在
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e "SHOW TABLES LIKE 'cwl%';"
```

---

## 📊 性能指标

### 正常运行指标：
- CPU: < 10%
- 内存: ~140MB
- 响应时间: 100-500ms
- 成功率: > 95%

### 监控命令：
```bash
# 实时监控
docker stats lottery-crawler-compose

# 查看资源使用
docker exec lottery-crawler-compose node -e "console.log(process.memoryUsage())"
```

---

## 🎯 完成标志

- ✅ 容器状态: Up + healthy
- ✅ 日志中有域名管理信息
- ✅ 数据采集正常工作
- ✅ 域名健康检查记录生成
- ✅ API接口正常响应
- ✅ 6个数据源都能获取数据

---

## 📞 技术支持

如遇问题，提供以下信息：
1. 容器日志: `docker logs lottery-crawler-compose --tail 200`
2. 容器状态: `docker inspect lottery-crawler-compose`
3. 数据库状态: 域名配置、健康日志
4. 错误截图
