# 🔄 服务重启指南

## ⚠️ 当前状态

- **旧服务PID**: 774315 (root权限运行)
- **端口占用**: 4000 (被旧服务占用)
- **新代码状态**: ✅ 已更新（WebServer.js + WebSocketManager.js + LogsPro.vue）
- **构建状态**: ✅ 已完成

---

## 🚀 方式1：手动重启（推荐）

请在**终端**中执行以下命令（需要sudo密码）：

```bash
# 1. 停止旧服务
sudo kill 774315

# 2. 等待3秒确保端口释放
sleep 3

# 3. 启动新服务
cd /home/i8/claude-demo/kjqy-deploy/crawler-service
nohup node src/index.js > logs/service.log 2>&1 &

# 4. 查看新服务PID
echo "新服务PID: $!"

# 5. 验证服务启动
sleep 3
tail -20 logs/service.log
```

---

## 🛠️ 方式2：一键脚本（需要sudo权限）

```bash
cd /home/i8/claude-demo/kjqy-deploy/crawler-service

# 执行重启脚本（会提示输入sudo密码）
sudo bash -c '
  echo "🔄 停止旧服务..."
  kill 774315
  sleep 3

  echo "🚀 启动新服务..."
  cd /home/i8/claude-demo/kjqy-deploy/crawler-service
  nohup node src/index.js > logs/service.log 2>&1 &
  NEW_PID=$!

  echo "✅ 新服务已启动 PID: $NEW_PID"
  sleep 3

  echo "📋 服务日志（最后20行）："
  tail -20 logs/service.log

  echo ""
  echo "🎯 验证服务状态："
  curl -s http://localhost:4000/api/health | jq
'
```

---

## ✅ 验证步骤

### 1. 检查服务是否启动成功

```bash
# 查看进程
ps aux | grep "node.*src/index.js" | grep -v grep

# 应该看到类似输出：
# i8  新PID  0.0  1.3  xxxxx  node src/index.js
```

### 2. 测试后端API

```bash
# 测试健康检查
curl http://localhost:4000/api/health

# 测试日志API（应该返回真实日志）
curl "http://localhost:4000/api/logs?lines=10" | jq '.data | length'

# 测试日志过滤（搜索ERROR）
curl "http://localhost:4000/api/logs?level=error&lines=5" | jq '.stats'
```

### 3. 测试WebSocket

```bash
# 安装wscat（如果没有）
npm install -g wscat

# 连接WebSocket
wscat -c ws://localhost:4000

# 连接成功后，发送订阅消息：
{"type":"subscribe_logs"}

# 应该收到：
# {"type":"log_subscribed","data":{"status":"subscribed","timestamp":...}}
# 然后会实时接收新日志
```

### 4. 访问前端页面

打开浏览器访问：

```
http://localhost:4000/v2/logs
```

**应该看到**：
- ✅ 统计面板（INFO/WARN/ERROR/DEBUG计数）
- ✅ 过滤控制面板
- ✅ 真实日志显示（非mock数据）
- ✅ WebSocket连接状态：🟢 已连接

---

## 📊 预期效果

### 启动日志应包含：

```
✅ 官方数据源管理器初始化完成
✅ 调度器API已注册
=========================================
   彩票爬虫系统 - 中等架构方案
=========================================
启动时间: 2026/1/2 08:xx:xx
运行模式: production
调度器模式: 动态倒计时调度
日志级别: info
=========================================
✅ ✅ 时区配置验证完成
📡 WebSocket服务器已启动: ws://localhost:4000
📜 日志监听已启动 (2秒/次)  ← 🆕 新功能！
🌐 Web服务器已启动: http://localhost:4000
✅ 静态文件服务: http://localhost:4000/ → public/index.html
✅ Vue应用服务: http://localhost:4000/v2/ → dist/
```

---

## 🎯 功能验证清单

启动后，请验证以下功能：

### 后端
- [ ] `/api/logs` 返回真实日志（非空数组）
- [ ] `/api/logs?level=error` 正确过滤
- [ ] `/api/logs?keyword=数据库` 关键词搜索有效
- [ ] WebSocket连接成功
- [ ] WebSocket接收到日志消息

### 前端
- [ ] 统计面板显示实时计数
- [ ] WebSocket状态显示🟢（已连接）
- [ ] 日志列表显示真实内容
- [ ] 过滤器工作正常
- [ ] 关键词高亮正常
- [ ] 多行选择和复制工作
- [ ] 导出TXT/JSON功能正常
- [ ] 详情模态框显示正常
- [ ] 快捷键（Ctrl+F, F11）响应
- [ ] 全屏模式正常

---

## ❌ 故障排除

### 问题1：端口仍被占用

```bash
# 检查占用端口的进程
lsof -i :4000

# 或
netstat -tlnp | grep 4000

# 强制杀死进程
sudo kill -9 <PID>
```

### 问题2：WebSocket连接失败

- 检查日志是否包含 `📡 WebSocket服务器已启动`
- 检查浏览器控制台是否有错误
- 尝试重新加载页面

### 问题3：日志API返回空数组

- 检查 `logs/` 目录是否有日志文件
- 检查日志文件权限（应该可读）
- 查看服务器日志中的错误信息

---

## 📞 需要帮助？

如果重启后遇到任何问题，请提供：
1. 服务启动日志（`tail -50 logs/service.log`）
2. 浏览器控制台错误（F12 → Console）
3. API测试结果（`curl http://localhost:4000/api/logs`）

---

**准备好重启了吗？** 执行上述"方式1"或"方式2"即可！🚀
