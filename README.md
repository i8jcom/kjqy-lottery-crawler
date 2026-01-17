# 🎲 彩票爬虫系统

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com)

> 企业级多彩种数据采集与管理系统，支持30+彩种实时爬取、数据补全、智能告警和Web管理界面

## ✨ 核心特性

- 🎯 **多彩种支持**: 30+ 彩种（中国福彩/体彩、香港六合彩、新加坡彩、澳洲彩、台湾彩票等）
- 🔄 **15个爬虫**: 多数据源自动切换、负载均衡、故障转移
- 📊 **89个API接口**: 完整的REST API，涵盖数据查询、系统管理、监控告警
- 💻 **Vue 3管理界面**: 23个页面组件，Element Plus UI，深色/亮色主题
- 🚨 **智能告警系统**: 实时监控、自动告警、支持邮件/钉钉/Webhook通知
- 📦 **55万+开奖记录**: 自动数据补全，确保历史数据完整
- ⚡ **WebSocket实时推送**: 开奖数据实时更新
- 🐳 **Docker部署**: 一键启动，包含数据库和Web服务

## 📸 界面预览

```
系统仪表盘         实时开奖数据         历史数据查询
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ 📊 统计图表 │   │ 🎲 实时号码 │   │ 🔍 日期筛选 │
│ 📈 成功率   │   │ ⏱️ 倒计时   │   │ 📄 分页查询 │
│ 🎰 彩种状态 │   │ 🔔 新开奖   │   │ 💾 导出功能 │
└─────────────┘   └─────────────┘   └─────────────┘

告警管理           日志查看             系统监控
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ 🚨 告警规则 │   │ 📝 爬虫日志 │   │ 💻 CPU/内存 │
│ 📧 通知设置 │   │ 🔎 搜索筛选 │   │ 🌐 网络状态 │
│ 📋 历史记录 │   │ 📊 级别分类 │   │ 📡 健康检查 │
└─────────────┘   └─────────────┘   └─────────────┘
```

## 🚀 快速开始

### 使用 Docker Compose（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/i8jcom/kjqy-lottery-crawler.git
cd kjqy-lottery-crawler

# 2. 启动所有服务（数据库 + 爬虫 + Web）
docker-compose up -d

# 3. 访问管理界面
open http://localhost:4000
```

服务启动后：
- **Web管理界面**: http://localhost:4000
- **MySQL数据库**: localhost:3307（如需外部访问）
- **健康检查**: http://localhost:4000/api/status

### 手动安装

```bash
# 1. 安装依赖
npm install

# 2. 配置数据库（编辑 .env）
cp .env.example .env
# 修改数据库连接信息

# 3. 启动服务
npm start

# 开发模式（自动重启）
npm run dev
```

## 📊 系统能力

| 指标 | 数值 |
|------|------|
| 支持彩种 | 30+ |
| 爬虫实现 | 15个 |
| API接口 | 89个 |
| 前端页面 | 23个 |
| 已存储记录 | 550,000+ |
| 系统可用率 | 95-98% |
| 爬取频率 | 高频75秒/次，低频5分钟/次 |

## 📁 项目结构

```
crawler-service/
├── src/
│   ├── scrapers/              # 15���爬虫实现
│   │   ├── SpeedyLot88Scraper.js       # SpeedyLot88数据源
│   │   ├── Lot168kaiScraper.js         # 168kai数据源
│   │   ├── Singapore3650098Scraper.js  # 新加坡彩官方源
│   │   ├── HKJCScraper.js              # 香港赛马会官方源
│   │   └── ...                         # 其他11个爬虫
│   ├── managers/              # 管理器层
│   │   ├── UniversalDomainManager.js   # 通用域名管理器
│   │   ├── LotteryPollingManager.js    # 彩种轮询管理器
│   │   └── HealthCheckManager.js       # 健康检查管理器
│   ├── services/              # 服务层
│   │   ├── DataCompletionService.js    # 数据补全服务
│   │   ├── AlertManager.js             # 告警管理服务
│   │   └── SchedulerMonitor.js         # 调度监控服务
│   ├── schedulers/            # 调度器
│   │   └── CrawlerScheduler.js         # 核心调度器
│   ├── validators/            # 数据验证
│   │   └── DataValidator.js            # 数据完整性验证
│   ├── db/                    # 数据库
│   │   └── Database.js                 # MySQL连接池
│   ├── web/                   # Web服务
│   │   ├── WebServer.js                # Express服务器
│   │   ├── routes/                     # API路由（89个接口）
│   │   └── vue-app/                    # Vue 3前端（23个页面）
│   ├── config/                # 配置
│   │   ├── crawlerConfig.js            # 爬虫配置
│   │   └── lotteryTypes.js             # 彩种定义
│   └── index.js               # 入口文件
├── data/                      # 运行时数据
│   ├── official-sources.json           # 数据源配置
│   └── runtime-config.json             # 运行时配置
├── scripts/                   # 脚本工具
│   ├── rebuild-and-restart.sh          # 构建并重启
│   └── migrations/                     # 数据库迁移
├── docs/                      # 文档
│   ├── API_REFERENCE.md                # API接口文档（89个接口）
│   └── database/                       # 数据库设计文档
├── docker-compose.yml         # Docker编排配置
├── Dockerfile                 # Docker镜像构建
├── 项目架构说明.md            # 完整架构文档
├── 前端架构说明.md            # Vue前端架构文档
└── package.json
```

## 🔧 Web管理界面

启动服务后访问: **http://localhost:4000**

### 核心功能页面

| 页面 | 功能说明 |
|------|---------|
| **系统仪表盘** | 彩种总览、今日统计、成功率图表 |
| **实时开奖** | WebSocket实时推送、倒计时、最新开奖 |
| **历史查询** | 日期筛选、分页查询、数据导出 |
| **数据补全** | 缺失检测、自动回填、手动补全 |
| **数据源管理** | 启用/禁用、优先级调整、健康状态 |
| **域名管理** | 健康检查、自动切换、切换历史 |
| **告警管理** | 告警规则、历史记录、通知设置 |
| **日志查看** | 爬虫日志、级别筛选、关键词搜索 |
| **系统监控** | CPU/内存使用率、网络状态、进程监控 |

详细使用说明: [WEB-ADMIN-GUIDE.md](./WEB-ADMIN-GUIDE.md)

## 📡 API接口

系统提供 **89个REST API接口**，完整文档请查看: [docs/API_REFERENCE.md](./docs/API_REFERENCE.md)

### 核心接口示例

```bash
# 系统状态
GET /api/status

# 实时开奖数据
GET /api/realtime-data

# 历史数据查询
GET /api/history-data?code=10001&date=2026-01-17

# 数据源管理
GET /api/sources
PUT /api/sources/:id/toggle

# 告警管理
GET /api/alerts
POST /api/alerts/rules

# 数据补全
POST /api/data-completion/check-missing
POST /api/data-completion/backfill
```

完整接口列表包括:
- **数据查询接口** (12个): 实时数据、历史数据、统计分析
- **系统管理接口** (23个): 调度器、数据源、域名、彩种配置
- **告警接口** (15个): 告警规则、历史记录、通知设置
- **日志接口** (8个): 爬虫日志、系统日志、审计日志
- **监控接口** (11个): 健康检查、性能指标、WebSocket状态
- **数据完整性接口** (9个): 缺失检测、数据补全、验证
- **工具接口** (11个): 测试、备份、导出、维护

## 🎯 支持的彩种

### 中国彩票
- 时时彩类: 重庆时时彩、新疆时时彩、天津时时彩
- 11选5类: 广东11选5、江西11选5、山东11选5
- 快3类: 江苏快3、安徽快3、湖北快3
- 福彩/体彩: 双色球、大乐透、3D、排列3/5

### 国际彩票
- 香港: 六合彩
- 新加坡: 4D彩、TOTO
- 澳洲: Powerball、Oz Lotto
- 台湾: 威力彩、大乐透

## 🔄 数据流程

```
定时任务触发
    ↓
选择健康数据源 ──→ 域名健康检查
    ↓
爬取开奖数据 ──→ 失败自动重试
    ↓
数据格式验证 ──→ 多源数据对比
    ↓
存入MySQL ──→ 重复数据检测
    ↓
WebSocket推送 ──→ 前端实时更新
    ↓
告警检测 ──→ 异常自动通知
```

## 🐳 Docker部署

### Docker Compose（推荐）

```yaml
version: '3.8'
services:
  lottery-crawler:
    build: .
    ports:
      - "4000:4000"
    environment:
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=lottery
      - DB_PASSWORD=lottery123
    depends_on:
      - mysql
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    ports:
      - "3307:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=root123
      - MYSQL_DATABASE=lottery_db
      - MYSQL_USER=lottery
      - MYSQL_PASSWORD=lottery123
    volumes:
      - mysql-data:/var/lib/mysql
    restart: unless-stopped

volumes:
  mysql-data:
```

### 单独构建

```bash
# 构建镜像
docker build -t lottery-crawler .

# 运行容器
docker run -d \
  --name lottery-crawler \
  -p 4000:4000 \
  -e DB_HOST=mysql \
  -e DB_PORT=3306 \
  lottery-crawler
```

## 🔍 监控与告警

### 监控指标
- ✅ 每分钟爬取成功率
- 📊 数据源可用性统计
- ⏱️ 数据新鲜度检查
- 🔄 自动重试次数
- 💾 数据库存储量
- 🌐 网络延迟监控

### 告警类型
- 🚨 数据源全部失败
- ⚠️ 连续爬取失败超过阈值
- 🔴 数据超过10分钟未更新
- ⚡ 系统资源使用率过高
- 📉 成功率低于90%

### 告警通知
- 📧 邮件通知
- 💬 钉钉机器人
- 🔗 Webhook自定义

## 📚 文档

- [📖 项目架构说明](./项目架构说明.md) - 完整架构设计文档
- [🎨 前端架构说明](./前端架构说明.md) - Vue 3前端详细文档
- [🔌 API接口文档](./docs/API_REFERENCE.md) - 89个接口完整参考
- [💾 数据库设计](./docs/database/) - 数据库表结构设计
- [🖥️ Web管理指南](./WEB-ADMIN-GUIDE.md) - 管理界面使用说明

## 🛠️ 开发指南

### 添加新彩种

1. 在 `src/config/lotteryTypes.js` 添加彩种定义
2. 在 `src/scrapers/` 创建对应的Scraper
3. 在 `src/config/crawlerConfig.js` 配置爬取策略
4. 重启服务生效

### 添加新数据源

1. 继承 `BaseScraper` 创建新Scraper
2. 实现 `getCurrentIssue()` 方法
3. 在 `data/official-sources.json` 添加源配置
4. 重启服务生效

### 运行测试

```bash
# 测试单个爬虫
npm run test:scraper -- SpeedyLot88

# 测试数据补全
npm run test:backfill

# 测试API接口
npm run test:api
```

## 🔐 环境变量

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=lottery
DB_PASSWORD=lottery123
DB_NAME=lottery_db

# Web服务
WEB_PORT=4000

# 日志级别
LOG_LEVEL=info

# 告警配置
ALERT_EMAIL=admin@example.com
ALERT_DINGTALK_WEBHOOK=https://...
```

## 📈 性能指标

- **爬取成功率**: 99.5%+
- **系统可用率**: 95-98%
- **数据延迟**: < 2分钟
- **API响应时间**: < 500ms
- **数据库记录**: 550,000+
- **并发支持**: 30+ 彩种同时爬取

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 License

[MIT License](LICENSE)

## 👨‍💻 作者

[i8jcom](https://github.com/i8jcom)

---

**⚠️ 免责声明**: 本项目仅供学习交流使用，请勿用于非法用途。使用者需遵守当地法律法规。
