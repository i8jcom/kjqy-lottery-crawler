# 🚀 快速重启指南

## 当前状态
```
✅ 数据库配置已更新 → lottery-mysql-compose
✅ 域名管理表已部署 → 18个域名配置
✅ 5个Scraper已改造完成
✅ 主系统数据库已隔离
```

## 📍 通过1Panel重启容器

### 步骤1: 在1Panel中重启
1. 打开 1Panel → 容器管理
2. 找到容器: **lottery-crawler-compose**
3. 点击「重启」
4. 等待约1分钟至状态变为 healthy

### 步骤2: 重启后验证
```bash
# 在服务器上运行验证脚本
cd /home/i8/claude-demo/kjqy-deploy/crawler-service
bash verify_after_restart.sh
```

## ✅ 预期结果

### 日志中应该看到：
```
[UniversalDomainManager] 数据库连接池已初始化
[UniversalDomainManager] 🏥 启动全局健康检查
[SpeedyLot88] 🚀 请求: xxx [域名: https://speedylot88.com]
[SGLotteries] 🚀 请求最新数据: xxx [域名: https://sglotteries.com]
```

### 关键特征：
- ✅ 日志中包含 `[域名: xxx]` 信息
- ✅ 使用 lottery-mysql-compose 数据库
- ✅ 域名健康检查自动启动
- ✅ 6个数据源全部正常工作

## 🔧 快速查看日志
```bash
# 实时日志
docker logs -f lottery-crawler-compose

# 查找域名相关
docker logs lottery-crawler-compose 2>&1 | grep "域名:"

# 查找错误
docker logs lottery-crawler-compose 2>&1 | grep -i error
```

## 📊 生产就绪清单
- [x] 数据库独立（lottery-mysql-compose）
- [x] 域名管理功能完整
- [x] 23个彩种受保护
- [x] 自动故障转移机制
- [x] 健康检查和监控
- [x] 完整的文档和脚本

## 🎯 下一步
开发完成后，使用 `DATABASE_CONFIG.md` 中的迁移指南将整个系统迁移到生产服务器。
