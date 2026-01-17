# 彩票爬虫系统 - 中等架构方案

## 🎯 设计目标

- **稳定性**: 95-98% 可用性
- **独立部署**: 不影响现有彩票系统
- **多数据源**: 支持3-5个数据源自动切换
- **自动监控**: 故障自动告警和切换

## 📁 项目结构

```
crawler-service/
├── src/
│   ├── crawlers/              # 爬虫实现
│   │   ├── BaseCrawler.js     # 基础爬虫类
│   │   ├── Source3650098.js   # 3650098.com 数据源
│   │   ├── Source168kai.js    # 168kai.com 数据源
│   │   └── SourceBackup.js    # 备用数据源
│   ├── schedulers/            # 定时调度
│   │   └── CrawlerScheduler.js
│   ├── validators/            # 数据验证
│   │   └── DataValidator.js
│   ├── db/                    # 数据库
│   │   └── Database.js
│   ├── utils/                 # 工具函数
│   │   └── Logger.js
│   ├── config/                # 配置
│   │   └── crawlerConfig.js
│   └── index.js               # 入口
├── logs/                      # 日志文件
├── .env                       # 环境配置
├── package.json
└── README.md
```

## 🔄 工作流程

```
1. 定时任务触发 → 2. 选择数据源 → 3. 爬取数据
                ↓
4. 数据验证 → 5. 多源对比 → 6. 写入数据库
                ↓
7. 现有彩票系统读取数据库 → 8. 提供给前端
```

## 🚀 启动方式

```bash
# 安装依赖
npm install

# 启动爬虫服务
npm start

# 开发模式（自动重启）
npm run dev

# 测试单个爬虫
npm test
```

## 🌐 Web管理界面

启动服务后，访问管理界面：

```
http://localhost:4000
```

**功能**：
- 📊 实时系统状态监控
- 📡 数据源健康检查
- 🎲 彩种列表查看
- 🔄 手动触发爬取
- 📝 系统日志查看
- ⏱️ 自动刷新（30秒）

详细使用说明：[WEB-ADMIN-GUIDE.md](./WEB-ADMIN-GUIDE.md)

## 📊 监控指标

- 每分钟爬取成功率
- 数据源可用性
- 数据新鲜度检查
- 失败自动重试次数

## 🔧 维护说明

- 日志位置: `./logs/`
- 数据库: 与主系统共享 PostgreSQL
- 部署: 可与主系统同服务器或独立部署
