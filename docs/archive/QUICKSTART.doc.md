# 快速开始

## 5分钟快速测试

### 1. 安装依赖
```bash
cd crawler-service
npm install
```

### 2. 配置数据库

编辑 `.env` 文件，填写数据库密码：
```bash
DB_PASSWORD=your_actual_password
```

### 3. 测试爬虫

运行测试脚本：
```bash
npm test
```

如果看到：
```
✅ 实时数据获取成功
✅ 历史数据获取成功
成功率: 100%
```

说明爬虫工作正常！

### 4. 启动服务

```bash
# 方式1：直接启动
npm start

# 方式2：使用 PM2（推荐）
npm install -g pm2
pm2 start src/index.js --name crawler-service
pm2 logs crawler-service
```

### 5. 验证数据

打开主系统前端，检查数据是否更新：
```
http://localhost:5173/lottery/racing/v2/jspk10
```

---

## 常见问题

### Q: 如何停止爬虫？
```bash
# 如果用 npm start 启动，按 Ctrl+C

# 如果用 PM2 启动
pm2 stop crawler-service
```

### Q: 如何查看日志？
```bash
# PM2 日志
pm2 logs crawler-service

# 文件日志
tail -f logs/crawler.log
```

### Q: 爬虫会影响主系统吗？
不会。爬虫和主系统是独立的进程，数据通过数据库传递。即使爬虫崩溃，主系统也能正常运行（会使用备用API）。

---

## 下一步

✅ 阅读完整部署文档：[DEPLOYMENT.md](./DEPLOYMENT.md)
✅ 了解架构设计：[README.md](./README.md)
✅ 添加更多数据源（提高稳定性）
