# API 接口完整参考文档

本文档详细列出了彩票爬虫系统的全部 89 个 REST API 接口。

## 目录
- [数据查询接口 (10个)](#数据查询接口)
- [数据管理接口 (8个)](#数据管理接口)
- [数据库管理接口 (10个)](#数据库管理接口)
- [系统监控接口 (15个)](#系统监控接口)
- [告警系统接口 (10个)](#告警系统接口)
- [域名管理接口 (8个)](#域名管理接口)
- [调度器接口 (6个)](#调度器接口)
- [数据源管理接口 (5个)](#数据源管理接口)
- [倒计时接口 (4个)](#倒计时接口)
- [彩种配置接口 (6个)](#彩种配置接口)
- [系统设置接口 (4个)](#系统设置接口)
- [WebSocket接口 (3个)](#websocket接口)

---

## 数据查询接口

### 1. GET /api/lotteries
获取所有彩种配置列表

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "code": "10001",
      "name": "香港六合彩",
      "enabled": true,
      "source": "官方",
      "updateInterval": 300
    }
  ]
}
```

### 2. GET /api/realtime-data
获取所有彩种的实时最新开奖数据

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "lotteryCode": "10001",
      "lotteryName": "香港六合彩",
      "drawNumber": "2026001",
      "drawTime": "2026-01-17T21:30:00.000Z",
      "result": "01,12,23,34,45,49+08",
      "lastUpdate": "2026-01-17T21:35:12.000Z"
    }
  ],
  "timestamp": "2026-01-17T21:35:15.000Z"
}
```

### 3. GET /api/latest-data
获取指定彩种的最新一期开奖数据

**请求参数**:
- `lotteryCode` (可选): 彩种代码，不传则返回所有彩种

**响应示例**:
```json
{
  "success": true,
  "data": {
    "lotteryCode": "10001",
    "drawNumber": "2026001",
    "drawTime": "2026-01-17T21:30:00.000Z",
    "result": "01,12,23,34,45,49+08"
  }
}
```

### 4. GET /api/history-data
查询历史开奖数据（支持分页）

**请求参数**:
- `lotteryCode` (必需): 彩种代码
- `startDate` (可选): 开始日期 (YYYY-MM-DD)
- `endDate` (可选): 结束日期 (YYYY-MM-DD)
- `page` (可选): 页码，默认1
- `pageSize` (可选): 每页数量，默认20

**响应示例**:
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "drawNumber": "2026001",
        "drawTime": "2026-01-17T21:30:00.000Z",
        "result": "01,12,23,34,45,49+08"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1152,
      "totalPages": 58
    }
  }
}
```

### 5. GET /api/lottery/:code
获取指定彩种的详细信息

**请求参数**:
- `code` (路径参数): 彩种代码

**响应示例**:
```json
{
  "success": true,
  "data": {
    "code": "10001",
    "name": "香港六合彩",
    "nameEn": "Hong Kong Mark Six",
    "category": "官方彩票",
    "country": "中国香港",
    "enabled": true,
    "scheduleType": "LOW_FREQUENCY",
    "updateInterval": 300,
    "dataSource": "官方API",
    "lastDrawTime": "2026-01-17T21:30:00.000Z",
    "nextDrawTime": "2026-01-19T21:30:00.000Z"
  }
}
```

### 6. GET /api/lottery/:code/latest
获取指定彩种的最新开奖（带统计信息）

**请求参数**:
- `code` (路径参数): 彩种代码

**响应示例**:
```json
{
  "success": true,
  "data": {
    "current": {
      "drawNumber": "2026001",
      "result": "01,12,23,34,45,49+08"
    },
    "statistics": {
      "totalDraws": 1152,
      "lastUpdateTime": "2026-01-17T21:35:12.000Z",
      "dataCompleteness": 100
    }
  }
}
```

### 7. GET /api/lottery/:code/history
获取指定彩种的历史记录（分页）

**请求参数**:
- `code` (路径参数): 彩种代码
- `page`, `pageSize`, `startDate`, `endDate` (查询参数)

### 8. GET /api/lottery/:code/statistics
获取指定彩种的统计数据

**请求参数**:
- `code` (路径参数): 彩种代码
- `days` (可选): 统计天数，默认30

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalDraws": 1152,
    "period": {
      "start": "2025-12-18",
      "end": "2026-01-17"
    },
    "frequency": {
      "daily": 48,
      "weekly": 336
    },
    "dataQuality": {
      "completeness": 99.8,
      "missingCount": 2
    }
  }
}
```

### 9. GET /api/export/csv
导出历史数据为CSV文件

**请求参数**:
- `lotteryCode` (必需): 彩种代码
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期

**响应**: CSV文件下载

### 10. GET /api/status
获取系统整体运行状态

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "status": "healthy",
  "data": {
    "uptime": 86400,
    "activeLotteries": 15,
    "schedulerRunning": true,
    "databaseConnected": true,
    "websocketConnections": 12,
    "lastCrawlTime": "2026-01-17T21:35:00.000Z"
  }
}
```

---

## 数据管理接口

### 11. POST /api/crawl
手动触发爬取指定彩种的最新数据

**请求参数**:
```json
{
  "lotteryCode": "10001"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "爬取任务已启动",
  "taskId": "crawl-10001-1705502115"
}
```

### 12. POST /api/crawl-history
手动触发爬取历史数据

**请求参数**:
```json
{
  "lotteryCode": "10001",
  "date": "2026-01-16"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "历史数据爬取已启动",
  "recordsFetched": 48
}
```

### 13. POST /api/history/backfill-date
回填指定日期的数据

**请求参数**:
```json
{
  "lotteryCode": "10035",
  "date": "2026-01-15"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "数据回填完成",
  "inserted": 1152,
  "updated": 0
}
```

### 14. POST /api/history/backfill-recent
回填最近N天的数据

**请求参数**:
```json
{
  "lotteryCode": "10035",
  "days": 7
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "最近7天数据回填完成",
  "totalInserted": 8064,
  "datesProcessed": ["2026-01-11", "2026-01-12", "..."]
}
```

### 15. POST /api/history/auto-backfill
自动检测并回填缺失数据

**请求参数**:
```json
{
  "lotteryCode": "10035",
  "startDate": "2026-01-01",
  "endDate": "2026-01-17"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "自动回填完成",
  "missingDates": ["2026-01-05", "2026-01-10"],
  "totalInserted": 2304
}
```

### 16. POST /api/history/auto-backfill-all
自动回填所有彩种的缺失数据

**请求参数**:
```json
{
  "days": 7
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "所有彩种自动回填完成",
  "results": [
    {
      "lotteryCode": "10035",
      "inserted": 1152
    }
  ]
}
```

### 17. GET /api/history/detect-missing
检测缺失的历史数据

**请求参数**:
- `lotteryCode` (必需): 彩种代码
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "missingDates": ["2026-01-05", "2026-01-10"],
    "totalMissing": 2,
    "expectedRecords": 2304,
    "actualRecords": 0
  }
}
```

### 18. DELETE /api/lottery/:code/data
删除指定彩种的数据

**请求参数**:
- `code` (路径参数): 彩种代码
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期

**响应示例**:
```json
{
  "success": true,
  "message": "数据删除成功",
  "deletedCount": 1152
}
```

---

## 数据库管理接口

### 19. GET /api/database/statistics
获取数据库统计信息

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tables": {
      "lottery_results": {
        "rows": 550234,
        "size": "128 MB",
        "indexes": 5
      },
      "alert_history": {
        "rows": 1234,
        "size": "2.5 MB",
        "indexes": 3
      }
    },
    "totalSize": "256 MB",
    "totalRows": 551468
  }
}
```

### 20. GET /api/database/health
检查数据库健康状态

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "health": "good",
  "checks": {
    "connection": "ok",
    "diskSpace": "ok",
    "queryPerformance": "ok",
    "indexHealth": "ok"
  },
  "warnings": []
}
```

### 21. GET /api/database/suggestions
获取数据库优化建议

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "suggestions": [
    {
      "type": "index",
      "table": "lottery_results",
      "message": "建议在draw_time列上添加索引",
      "priority": "medium"
    },
    {
      "type": "cleanup",
      "message": "建议清理90天前的告警历史",
      "priority": "low"
    }
  ]
}
```

### 22. POST /api/database/clean-duplicates
清理重复数据

**请求参数**:
```json
{
  "lotteryCode": "10001",
  "dryRun": true
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "重复数据已清理",
  "duplicatesFound": 12,
  "duplicatesRemoved": 12
}
```

### 23. POST /api/database/clean-old-data
清理过期数据

**请求参数**:
```json
{
  "table": "alert_history",
  "daysToKeep": 90
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "过期数据已清理",
  "deletedRows": 456
}
```

### 24. POST /api/database/optimize
优化数据库表

**请求参数**:
```json
{
  "tables": ["lottery_results", "alert_history"]
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "数据库优化完成",
  "results": [
    {
      "table": "lottery_results",
      "status": "optimized",
      "sizeBefore": "128 MB",
      "sizeAfter": "115 MB"
    }
  ]
}
```

### 25. POST /api/database/full-maintenance
执行完整的数据库维护（清理+优化）

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "message": "数据库维护完成",
  "duplicatesRemoved": 12,
  "oldDataRemoved": 456,
  "tablesOptimized": 10,
  "spaceSaved": "25 MB"
}
```

### 26. POST /api/database/backup
创建数据库备份

**请求参数**:
```json
{
  "tables": ["lottery_results"],
  "compress": true
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "备份创建成功",
  "backupFile": "backup-2026-01-17-143025.sql.gz",
  "size": "45 MB"
}
```

### 27. POST /api/database/restore
恢复数据库备份

**请求参数**:
```json
{
  "backupFile": "backup-2026-01-17-143025.sql.gz"
}
```

### 28. POST /api/cleanup-sg-data
清理新加坡彩票特定数据

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "message": "SG数据清理完成",
  "deletedCount": 234
}
```

---

## 系统监控接口

### 29. GET /api/scheduler/stats
获取调度器统计信息

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "running": true,
    "uptime": 86400,
    "activeJobs": 15,
    "completedToday": 1728,
    "failedToday": 3,
    "nextScheduledJobs": [
      {
        "lotteryCode": "10001",
        "nextRun": "2026-01-17T22:00:00.000Z"
      }
    ]
  }
}
```

### 30. GET /api/countdown/stats
获取倒计时统计信息

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "activeCountdowns": 15,
    "syncStatus": "synced",
    "averageDelay": 120,
    "lastSyncTime": "2026-01-17T14:28:45.000Z"
  }
}
```

### 31. GET /api/system/overview
获取系统总览信息

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "version": "2.5.0",
    "environment": "production",
    "uptime": 86400,
    "performance": {
      "cpu": 25.5,
      "memory": {
        "used": "512 MB",
        "total": "2048 MB",
        "percentage": 25
      }
    },
    "services": {
      "scheduler": "running",
      "websocket": "running",
      "database": "connected"
    },
    "statistics": {
      "totalLotteries": 15,
      "totalRecords": 550234,
      "todaysCrawls": 1728
    }
  }
}
```

### 32. POST /api/system/restart
重启系统服务

**请求参数**:
```json
{
  "service": "scheduler"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "调度器服务已重启"
}
```

### 33. GET /api/health
健康检查接口

**请求参数**: 无

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T14:30:00.000Z",
  "checks": {
    "database": "ok",
    "scheduler": "ok",
    "websocket": "ok"
  }
}
```

### 34. GET /api/logs
获取系统日志

**请求参数**:
- `level` (可选): 日志级别 (info/warn/error)
- `limit` (可选): 返回数量，默认100
- `offset` (可选): 偏移量，默认0

**响应示例**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "2026-01-17T14:29:12.000Z",
        "level": "info",
        "message": "香港六合彩数据爬取成功",
        "lotteryCode": "10001"
      }
    ],
    "total": 1234
  }
}
```

### 35. GET /api/logs/crawler
获取爬虫日志

**请求参数**:
- `lotteryCode` (可选): 彩种代码
- `level` (可选): 日志级别
- `startTime` (可选): 开始时间
- `endTime` (可选): 结束时间

### 36. GET /api/logs/error
获取错误日志

**请求参数**:
- `limit` (可选): 返回数量
- `startTime` (可选): 开始时间

### 37. GET /api/performance/metrics
获取性能指标

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "requestsPerMinute": 120,
    "averageResponseTime": 45,
    "slowestEndpoints": [
      {
        "path": "/api/history-data",
        "averageTime": 1200
      }
    ],
    "errorRate": 0.5
  }
}
```

### 38. GET /api/performance/crawler
获取爬虫性能指标

**请求参数**:
- `lotteryCode` (可选): 彩种代码

**响应示例**:
```json
{
  "success": true,
  "data": {
    "averageCrawlTime": 2500,
    "successRate": 98.5,
    "failureRate": 1.5,
    "lastHourCrawls": 72
  }
}
```

### 39. GET /api/monitor/websocket
监控WebSocket连接状态

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalConnections": 12,
    "activeConnections": 10,
    "messagesSentToday": 8640,
    "averageLatency": 15
  }
}
```

### 40. GET /api/monitor/database
监控数据库连接状态

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "activeConnections": 5,
    "maxConnections": 100,
    "slowQueries": 2,
    "averageQueryTime": 12
  }
}
```

### 41. GET /api/monitor/resources
监控系统资源使用

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "cpu": {
      "usage": 25.5,
      "cores": 4
    },
    "memory": {
      "used": 536870912,
      "total": 2147483648,
      "percentage": 25
    },
    "disk": {
      "used": "15 GB",
      "total": "100 GB",
      "percentage": 15
    }
  }
}
```

### 42. GET /api/monitor/alerts
监控告警系统状态

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalRules": 25,
    "activeRules": 20,
    "alertsToday": 5,
    "lastAlertTime": "2026-01-17T12:15:00.000Z"
  }
}
```

### 43. GET /api/monitor/domains
监控域名健康状态

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalDomains": 15,
    "healthyDomains": 12,
    "unhealthyDomains": 3,
    "lastHealthCheck": "2026-01-17T14:25:00.000Z"
  }
}
```

---

## 告警系统接口

### 44. GET /api/alerts/history
获取告警历史记录

**请求参数**:
- `page` (可选): 页码，默认1
- `pageSize` (可选): 每页数量，默认20
- `level` (可选): 告警级别 (info/warning/error/critical)
- `startTime` (可选): 开始时间
- `endTime` (可选): 结束时间

**响应示例**:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": 123,
        "level": "warning",
        "type": "爬取失败",
        "message": "香港六合彩数据源连接超时",
        "lotteryCode": "10001",
        "timestamp": "2026-01-17T12:15:00.000Z",
        "acknowledged": false
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 156
    }
  }
}
```

### 45. POST /api/alerts/acknowledge
确认告警

**请求参数**:
```json
{
  "alertId": 123,
  "note": "已处理，域名已切换"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "告警已确认"
}
```

### 46. GET /api/alerts/rules
获取告警规则列表

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "爬取失败告警",
      "type": "CRAWL_FAILURE",
      "enabled": true,
      "conditions": {
        "consecutiveFailures": 3
      },
      "actions": {
        "notifyDingTalk": true,
        "notifyEmail": false
      }
    }
  ]
}
```

### 47. POST /api/alerts/rules
创建告警规则

**请求参数**:
```json
{
  "name": "数据延迟告警",
  "type": "DATA_DELAY",
  "enabled": true,
  "conditions": {
    "delayMinutes": 10
  },
  "actions": {
    "notifyDingTalk": true
  }
}
```

### 48. PUT /api/alerts/rules/:id
更新告警规则

**请求参数**:
- `id` (路径参数): 规则ID
- 请求体同创建规则

### 49. DELETE /api/alerts/rules/:id
删除告警规则

**请求参数**:
- `id` (路径参数): 规则ID

### 50. GET /api/alerts/statistics
获取告警统计信息

**请求参数**:
- `days` (可选): 统计天数，默认7

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalAlerts": 45,
    "byLevel": {
      "info": 20,
      "warning": 15,
      "error": 8,
      "critical": 2
    },
    "byType": {
      "CRAWL_FAILURE": 12,
      "DATA_DELAY": 8,
      "DOMAIN_DOWN": 5
    },
    "acknowledgedRate": 85.5
  }
}
```

### 51. GET /api/alerts/active
获取当前活跃告警

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 156,
      "level": "error",
      "message": "新加坡彩数据源已失联2小时",
      "startTime": "2026-01-17T12:00:00.000Z"
    }
  ]
}
```

### 52. POST /api/alerts/test
测试告警配置

**请求参数**:
```json
{
  "type": "dingTalk",
  "message": "这是一条测试告警"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "测试告警已发送"
}
```

### 53. GET /api/alerts/config
获取告警配置

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "dingTalk": {
      "enabled": true,
      "webhook": "https://..."
    },
    "email": {
      "enabled": false
    },
    "wechat": {
      "enabled": true,
      "webhook": "https://..."
    }
  }
}
```

---

## 域名管理接口

### 54. GET /api/domains/health
获取所有域名的健康状态

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "domain": "https://api1.lottery.com",
      "status": "healthy",
      "responseTime": 120,
      "lastCheck": "2026-01-17T14:28:00.000Z",
      "successRate": 99.5
    },
    {
      "domain": "https://api2.lottery.com",
      "status": "down",
      "lastError": "Connection timeout",
      "lastCheck": "2026-01-17T14:28:00.000Z"
    }
  ]
}
```

### 55. POST /api/domains/switch
手动切换域名

**请求参数**:
```json
{
  "lotteryCode": "10001",
  "fromDomain": "https://api1.lottery.com",
  "toDomain": "https://api2.lottery.com",
  "reason": "主域名响应超时"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "域名切换成功",
  "newActiveDomain": "https://api2.lottery.com"
}
```

### 56. GET /api/domains/switch-history
获取域名切换历史

**请求参数**:
- `page` (可选): 页码
- `pageSize` (可选): 每页数量
- `lotteryCode` (可选): 彩种代码

**响应示例**:
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": 45,
        "lotteryCode": "10001",
        "fromDomain": "https://api1.lottery.com",
        "toDomain": "https://api2.lottery.com",
        "reason": "主域名响应超时",
        "switchTime": "2026-01-17T10:30:00.000Z",
        "switchType": "auto"
      }
    ],
    "pagination": {
      "page": 1,
      "total": 45
    }
  }
}
```

### 57. POST /api/domains/health-check
手动触发域名健康检查

**请求参数**:
```json
{
  "domain": "https://api1.lottery.com"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "domain": "https://api1.lottery.com",
    "status": "healthy",
    "responseTime": 125,
    "checkTime": "2026-01-17T14:30:15.000Z"
  }
}
```

### 58. GET /api/domains/statistics
获取域名统计信息

**请求参数**:
- `days` (可选): 统计天数，默认7

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalDomains": 15,
    "healthyDomains": 12,
    "averageResponseTime": 135,
    "totalSwitches": 8,
    "autoSwitches": 6,
    "manualSwitches": 2
  }
}
```

### 59. POST /api/domains/add
添加新域名

**请求参数**:
```json
{
  "lotteryCode": "10001",
  "domain": "https://api3.lottery.com",
  "priority": 3,
  "enabled": true
}
```

### 60. PUT /api/domains/:id
更新域名配置

**请求参数**:
- `id` (路径参数): 域名ID

### 61. DELETE /api/domains/:id
删除域名

**请求参数**:
- `id` (路径参数): 域名ID

---

## 调度器接口

### 62. GET /api/scheduler/status
获取调度器运行状态

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "running": true,
    "startTime": "2026-01-16T14:30:00.000Z",
    "uptime": 86400,
    "mode": "production"
  }
}
```

### 63. POST /api/scheduler/start
启动调度器

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "message": "调度器已启动"
}
```

### 64. POST /api/scheduler/stop
停止调度器

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "message": "调度器已停止"
}
```

### 65. POST /api/scheduler/restart
重启调度器

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "message": "调度器已重启"
}
```

### 66. GET /api/scheduler/jobs
获取当前调度任务列表

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "lotteryCode": "10001",
      "lotteryName": "香港六合彩",
      "interval": 300,
      "lastRun": "2026-01-17T14:25:00.000Z",
      "nextRun": "2026-01-17T14:30:00.000Z",
      "status": "scheduled"
    }
  ]
}
```

### 67. PUT /api/scheduler/jobs/:code
更新调度任务配置

**请求参数**:
- `code` (路径参数): 彩种代码
```json
{
  "interval": 180,
  "enabled": true
}
```

---

## 数据源管理接口

### 68. GET /api/sources
获取所有数据源配置

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "lotteryCode": "10001",
      "sourceType": "official",
      "apiUrl": "https://api.lottery.com",
      "enabled": true,
      "priority": 1,
      "lastSuccess": "2026-01-17T14:25:00.000Z"
    }
  ]
}
```

### 69. POST /api/sources/update
更新数据源配置

**请求参数**:
```json
{
  "lotteryCode": "10001",
  "apiUrl": "https://new-api.lottery.com",
  "enabled": true
}
```

### 70. POST /api/sources/test
测试数据源连接

**请求参数**:
```json
{
  "lotteryCode": "10001",
  "apiUrl": "https://api.lottery.com"
}
```

**响应示��**:
```json
{
  "success": true,
  "data": {
    "connected": true,
    "responseTime": 150,
    "dataAvailable": true
  }
}
```

### 71. GET /api/sources/:code/history
获取数据源使用历史

**请求参数**:
- `code` (路径参数): 彩种代码

### 72. POST /api/sources/refresh
刷新数据源配置

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "message": "数据源配置已刷新",
  "updatedCount": 15
}
```

---

## 倒计时接口

### 73. GET /api/countdown/:code
获取指定彩种的倒计时信息

**请求参数**:
- `code` (路径参数): 彩种代码

**响应示例**:
```json
{
  "success": true,
  "data": {
    "lotteryCode": "10001",
    "nextDrawTime": "2026-01-19T21:30:00.000Z",
    "countdown": 172800,
    "currentTime": "2026-01-17T14:30:00.000Z"
  }
}
```

### 74. GET /api/countdown/all
获取所有彩种的倒计时信息

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "lotteryCode": "10001",
      "lotteryName": "香港六合彩",
      "nextDrawTime": "2026-01-19T21:30:00.000Z",
      "countdown": 172800
    }
  ]
}
```

### 75. POST /api/countdown/sync
手动同步倒计时

**请求参数**:
```json
{
  "lotteryCode": "10001"
}
```

### 76. GET /api/countdown/status
获取倒计时同步状态

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "syncEnabled": true,
    "lastSyncTime": "2026-01-17T14:28:45.000Z",
    "syncInterval": 60,
    "activeLotteries": 15
  }
}
```

---

## 彩种配置接口

### 77. GET /api/lottery-configs
获取所有彩种配置

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "code": "10001",
      "name": "香港六合彩",
      "enabled": true,
      "scheduleType": "LOW_FREQUENCY",
      "updateInterval": 300
    }
  ]
}
```

### 78. GET /api/lottery-configs/:code
获取指定彩种配置

**请求参数**:
- `code` (路径参数): 彩种代码

### 79. POST /api/lottery-configs
创建新彩种配置

**请求参数**:
```json
{
  "code": "10050",
  "name": "新彩种",
  "nameEn": "New Lottery",
  "enabled": true,
  "scheduleType": "HIGH_FREQUENCY",
  "updateInterval": 75
}
```

### 80. PUT /api/lottery-configs/:code
更新彩种配置

**请求参数**:
- `code` (路径参数): 彩种代码

### 81. DELETE /api/lottery-configs/:code
删除彩种配置

**请求参数**:
- `code` (路径参数): 彩种代码

### 82. POST /api/lottery-configs/:code/toggle
启用/禁用彩种

**请求参数**:
- `code` (路径参数): 彩种代码
```json
{
  "enabled": false
}
```

---

## 系统设置接口

### 83. GET /api/settings
获取系统设置

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "systemName": "彩票爬虫系统",
    "timezone": "Asia/Shanghai",
    "language": "zh-CN",
    "features": {
      "autoBackfill": true,
      "domainAutoSwitch": true,
      "alertEnabled": true
    }
  }
}
```

### 84. PUT /api/settings
更新系统设置

**请求参数**:
```json
{
  "timezone": "Asia/Shanghai",
  "features": {
    "autoBackfill": true
  }
}
```

### 85. GET /api/settings/:key
获取指定设置项

**请求参数**:
- `key` (路径参数): 设置键名

### 86. PUT /api/settings/:key
更新指定设置项

**请求参数**:
- `key` (路径参数): 设置键名

---

## WebSocket接口

### 87. WS /ws
WebSocket连接端点

**连接参数**: 无

**接收消息格式**:
```json
{
  "type": "NEW_DRAW",
  "data": {
    "lotteryCode": "10035",
    "lotteryName": "极速飞艇",
    "drawNumber": "202601171440",
    "drawTime": "2026-01-17T14:40:00.000Z",
    "result": "01,03,05,07,09,10,12,15,18,20"
  }
}
```

**消息类型**:
- `NEW_DRAW` - 新开奖数据
- `ALERT` - 系统告警
- `STATUS_UPDATE` - 状态更新
- `HEARTBEAT` - 心跳包

### 88. GET /api/websocket/connections
获取WebSocket连接列表

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalConnections": 12,
    "connections": [
      {
        "id": "conn-1",
        "ip": "192.168.1.100",
        "connectedAt": "2026-01-17T14:00:00.000Z",
        "messagesSent": 145
      }
    ]
  }
}
```

### 89. POST /api/websocket/broadcast
广播消息到所有WebSocket连接

**请求参数**:
```json
{
  "type": "SYSTEM_ANNOUNCEMENT",
  "message": "系统将于今晚22:00进行维护"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "消息已广播",
  "recipientCount": 12
}
```

---

## 认证与授权

当前版本暂未实现认证机制，所有接口均为公开访问。建议在生产环境中：

1. 使用 API Key 认证
2. 配置 IP 白名单
3. 启用 HTTPS
4. 实施请求频率限制

## 错误响应格式

所有接口的错误响应遵循统一格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {}
  }
}
```

常见错误代码：
- `INVALID_PARAMS` - 参数错误
- `NOT_FOUND` - 资源不存在
- `DATABASE_ERROR` - 数据库错误
- `EXTERNAL_API_ERROR` - 外部API调用失败
- `INTERNAL_ERROR` - 内部服务器错误

## 接口版本

当前API版本：`v1`

所有接口路径均基于根路径 `/api`，未来版本可能使用 `/api/v2` 等路径。
