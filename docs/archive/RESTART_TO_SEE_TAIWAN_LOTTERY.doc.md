# ⚠️ 重启服务器以查看台湾彩票数据源

## 📝 已完成的配置

✅ **OfficialSourceManager.js** - 台湾彩票数据源已添加
- ID: `taiwanlottery`
- 名称: 台湾彩票官网
- URL: https://www.taiwanlottery.com
- 状态: healthy (健康)
- 总数据源: 10个

## 🔄 需要重启服务器

由于服务器以root用户运行，需要手动重启以加载新配置：

### 方法1: 使用root权限重启
```bash
sudo kill 1524376
sudo npm start
```

### 方法2: 使用PM2重启（如果使用PM2）
```bash
pm2 restart crawler-service
```

### 方法3: 手动停止并启动
```bash
# 停止当前进程
sudo kill 1524376

# 等待2秒
sleep 2

# 启动服务器
cd /home/i8/claude-demo/kjqy-deploy/crawler-service
npm start
```

## ✅ 重启后验证

打开浏览器访问前端页面的**数据源管理**：
- 应该能看到 **台湾彩票官网** 数据源
- URL: `https://www.taiwanlottery.com`
- 描述: 🇹🇼 台湾彩票官方数据源（威力彩、大乐透、今彩539、38樂合彩、3D、4D）

---
**创建时间**: 2026-01-04
**服务器PID**: 1524376
