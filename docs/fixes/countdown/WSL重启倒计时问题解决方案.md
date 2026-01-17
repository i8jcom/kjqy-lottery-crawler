# 彩票爬虫服务 - WSL重启问题解决方案

## 问题描述

**症状：** 电脑重启（WSL重启）后，访问 http://localhost:4000/realtime 页面正常显示，但倒计时归零后一直显示"开奖中"，无法更新。

**根本原因：**
1. WSL重启后，系统残留一个旧的node进程（通常是root用户启动）
2. 这个旧进程占用了4000端口，但只提供前端页面，没有API和WebSocket服务
3. Docker容器中的真正爬虫服务无法被访问
4. 前端连接到本地进程的WebSocket，收不到新期号推送

## 解决方案

### ✅ 已实施的自动修复（推荐）

在 `~/.bashrc` 中添加了自动检查脚本，每次打开新终端时会：
1. 自动检测占用4000端口的本地node进程
2. 自动停止本地进程
3. 确保Docker容器正常运行

**使用方法：** 无需手动操作，重启WSL后打开任意bash终端即可自动修复。

### 手动修复方法（备用）

如果自动修复失败，可以手动执行：

```bash
# 1. 停止占用端口的本地进程
ps aux | grep "node.*src/index.js" | grep -v docker | grep -v grep | awk '{print $2}' | xargs kill -9

# 2. 重启Docker容器
cd /home/i8/claude-demo/kjqy-deploy/crawler-service
docker restart lottery-crawler-compose

# 3. 验证服务
curl http://localhost:4000/realtime
```

## 技术细节

### 正确的服务架构

- **Docker容器**: `lottery-crawler-compose` (端口4000)
  - 完整的爬虫服务
  - WebSocket实时推送
  - API接口
  - 前端页面

- **本地环境**: 不应该有node进程占用4000端口

### 服务验证

```bash
# 检查Docker容器状态
docker ps | grep lottery-crawler-compose

# 检查是否有本地进程占用端口
lsof -i:4000

# 查看爬虫日志
docker logs -f lottery-crawler-compose --tail 50
```

## 历史修复记录

- **2026-01-17**: 识别问题根源，创建自动修复脚本
- 此问题在多次修复后依然复现，证实是WSL启动时的系统残留进程问题

## 文件位置

- 自动修复脚本: `~/.bashrc.d/lottery-crawler-startup.sh`
- bashrc配置: `~/.bashrc` (最后几行)
- Docker配置: `/home/i8/claude-demo/kjqy-deploy/crawler-service/docker-compose.yml`

---

**注意**: 服务器环境不存在此问题，只在WSL环境下会出现。
