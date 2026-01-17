# 📢 监控告警系统使用说明

## 概述

爬虫系统已集成完整的监控告警功能，可实时检测系统状态并通过多种渠道发送告警通知。

## 功能特性

### ✅ 已实现功能

- ✅ **告警管理器**：统一管理所有告警和通知
- ✅ **多通知渠道**：支持邮件、钉钉、企业微信
- ✅ **8种告警规则**：覆盖爬取、数据源、数据库、性能等场景
- ✅ **告警抑制**：防止刷屏（5分钟内相同告警只发一次）
- ✅ **告警历史**：记录最近1000条告警
- ✅ **REST API**：完整的API接口管理告警
- ✅ **自动检测**：每分钟自动检查规则

## 告警规则

| 规则ID | 规则名称 | 级别 | 默认状态 | 说明 |
|--------|---------|------|---------|------|
| `crawl-failure` | 爬取失败告警 | error | ✅启用 | 检测到爬取失败时触发 |
| `continuous-failure` | 连续爬取失败告警 | critical | ✅启用 | 连续5次爬取失败时触发 |
| `datasource-error` | 数据源异常告警 | warning | ✅启用 | 数据源健康状况异常时触发 |
| `database-error` | 数据库连接失败告警 | critical | ✅启用 | 数据库连接失败时触发 |
| `missing-data` | 缺失数据检测告警 | warning | ✅启用 | 检测到缺失数据时触发（每小时检查） |
| `scheduler-stopped` | 调度器停止告警 | error | ✅启用 | 调度器意外停止时触发 |
| `low-success-rate` | 爬取成功率低告警 | warning | ✅启用 | 成功率低于80%时触发 |
| `performance-warning` | 系统性能告警 | warning | ❌禁用 | CPU>80%或内存>90%时触发（每5分钟检查） |

## 配置方法

### 1. 配置环境变量

复制配置示例文件：
```bash
cp .env.alert.example .env
```

### 2. 邮件通知配置

编辑 `.env` 文件，添加以下配置：

```bash
# 启用邮件告警
ALERT_EMAIL_ENABLED=true

# SMTP服务器配置
SMTP_HOST=smtp.gmail.com          # 例如：smtp.gmail.com, smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password       # Gmail需要使用应用专用密码

# 发件人和收件人
SMTP_FROM=crawler@example.com
ALERT_EMAIL=admin@example.com     # 接收告警的邮箱
```

**Gmail配置示例**：
1. 开启两步验证
2. 生成应用专用密码：https://myaccount.google.com/apppasswords
3. 使用应用密码作为 SMTP_PASS

**QQ邮箱配置示例**：
```bash
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-qq@qq.com
SMTP_PASS=授权码              # 在QQ邮箱设置中获取授权码
```

### 3. 钉钉通知配置

```bash
# 启用钉钉告警
ALERT_DINGTALK_ENABLED=true

# 钉钉机器人Webhook（必填）
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN

# 钉钉机器人密钥（可选，推荐配置）
DINGTALK_SECRET=SECxxxxxxxxxxxxxxxxxxxxxxx
```

**获取钉钉Webhook**：
1. 打开钉钉群 → 群设置 → 智能群助手
2. 添加机器人 → 选择"自定义"
3. 复制Webhook地址
4. 如果启用了"加签"，复制密钥

### 4. 企业微信通知配置

```bash
# 启用企业微信告警
ALERT_WECHAT_ENABLED=true

# 企业微信机器人Webhook
WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY
```

**获取企业微信Webhook**：
1. 打开企业微信群 → 群设置
2. 添加群机器人 → 创建新机器人
3. 复制Webhook地址

## API接口

### 获取告警历史

```bash
GET /api/alerts/history?level=error&limit=50&offset=0
```

**参数**：
- `level`：告警级别（info, warning, error, critical）
- `limit`：返回数量
- `offset`：偏移量

**响应**：
```json
{
  "success": true,
  "data": {
    "total": 100,
    "records": [
      {
        "id": 1766381441513,
        "timestamp": "2025-12-22T05:30:41.513Z",
        "level": "error",
        "title": "爬取失败告警",
        "message": "检测到爬取失败！失败次数: 5/100",
        "data": {},
        "notifiers": ["all"]
      }
    ]
  }
}
```

### 获取告警统计

```bash
GET /api/alerts/stats?hours=24
```

**响应**：
```json
{
  "success": true,
  "data": {
    "total": 15,
    "byLevel": {
      "critical": 2,
      "error": 5,
      "warning": 8,
      "info": 0
    },
    "byHour": {
      "0": 3,
      "1": 5,
      "2": 7
    }
  }
}
```

### 获取告警规则

```bash
GET /api/alerts/rules
```

### 更新告警规则

```bash
PUT /api/alerts/rules/:ruleId
Content-Type: application/json

{
  "enabled": false
}
```

### 测试通知渠道

```bash
POST /api/alerts/test/email
POST /api/alerts/test/dingtalk
POST /api/alerts/test/wechat
```

### 手动触发告警

```bash
POST /api/alerts/trigger
Content-Type: application/json

{
  "level": "info",
  "title": "测试告警",
  "message": "这是一条测试消息",
  "notifiers": ["email", "dingtalk"]
}
```

## 使用示例

### 1. 启动系统后查看告警状态

```bash
# 查看最近的告警
curl http://localhost:4000/api/alerts/history

# 查看所有规则状态
curl http://localhost:4000/api/alerts/rules
```

### 2. 测试邮件通知

```bash
curl -X POST http://localhost:4000/api/alerts/test/email
```

如果配置正确，您将收到一封测试邮件。

### 3. 测试钉钉通知

```bash
curl -X POST http://localhost:4000/api/alerts/test/dingtalk
```

钉钉群会收到测试消息。

### 4. 禁用某个告警规则

```bash
curl -X PUT http://localhost:4000/api/alerts/rules/performance-warning \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### 5. 手动触发自定义告警

```bash
curl -X POST http://localhost:4000/api/alerts/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "level": "warning",
    "title": "磁盘空间不足",
    "message": "服务器磁盘使用率已达85%",
    "data": {"usage": "85%", "available": "150GB"},
    "notifiers": ["email", "dingtalk"]
  }'
```

## 告警级别说明

| 级别 | 图标 | 颜色 | 使用场景 |
|------|------|------|---------|
| **critical** | 🔴 | 红色 | 严重错误，需立即处理 |
| **error** | ❌ | 红色 | 错误，需要尽快处理 |
| **warning** | ⚠️ | 橙色 | 警告，需要关注 |
| **info** | ℹ️ | 蓝色 | 信息，仅供参考 |

## 最佳实践

### 1. 告警通知优先级

建议配置：
- **Critical级别**：邮件 + 钉钉 + 企业微信（全部通知）
- **Error级别**：钉钉 + 企业微信
- **Warning级别**：钉钉
- **Info级别**：仅记录，不发送通知

### 2. 合理设置抑制时间

默认5分钟内相同告警只发一次，避免刷屏。可根据需求调整：

```javascript
// 在 src/alerts/AlertManager.js 中修改
this.config = {
  suppressionTime: 300000, // 5分钟，可调整为其他值
};
```

### 3. 监控告警本身

定期检查告警历史，确保告警系统正常工作：

```bash
# 查看最近24小时的告警统计
curl http://localhost:4000/api/alerts/stats?hours=24
```

### 4. 清理历史记录

告警历史会占用内存，定期清理：

```bash
curl -X DELETE http://localhost:4000/api/alerts/history
```

## 故障排查

### 邮件无法发送

1. 检查SMTP配置是否正确
2. 确认使用的是应用专用密码（不是邮箱登录密码）
3. 检查防火墙是否阻止SMTP端口（通常是587或465）
4. 查看系统日志：`tail -f /tmp/crawler-alert-test.log`

### 钉钉消息发送失败

1. 检查Webhook地址是否正确
2. 如果配置了密钥，确认格式正确（以SEC开头）
3. 检查机器人是否被群管理员禁用
4. 测试Webhook：`curl -X POST http://localhost:4000/api/alerts/test/dingtalk`

### 告警未触发

1. 检查规则是否启用：`GET /api/alerts/rules`
2. 查看lastCheck时间，确认规则在运行
3. 检查条件是否满足（例如：成功率必须<80%才会触发）
4. 查看系统日志确认无错误

## 扩展开发

### 添加自定义告警规则

编辑 `src/alerts/AlertRules.js`：

```javascript
export const customRule = {
  name: '自定义告警',
  level: 'warning',
  enabled: true,
  notifiers: ['all'],
  checkInterval: 300000, // 5分钟检查一次
  condition: (context) => {
    // 返回true时触发告警
    return context.someValue > threshold;
  },
  message: (context) => {
    return `自定义告警消息: ${context.someValue}`;
  }
};

// 添加到默认规则
export const defaultRules = {
  // ... 其他规则
  'custom-rule': customRule
};
```

### 添加新的通知渠道

1. 创建 `src/alerts/notifiers/CustomNotifier.js`
2. 实现 `send(alert)` 方法
3. 在 `src/alerts/AlertService.js` 中注册

示例：

```javascript
class CustomNotifier {
  constructor(config) {
    this.enabled = config.enabled;
    this.webhook = config.webhook;
  }

  async send(alert) {
    // 发送通知逻辑
    await fetch(this.webhook, {
      method: 'POST',
      body: JSON.stringify(alert)
    });
  }
}
```

## 总结

监控告警系统已完全集成到爬虫服务中，可以实时监控系统状态并及时发送告警。建议：

1. ✅ **至少配置一种通知方式**（推荐钉钉，配置最简单）
2. ✅ **定期查看告警历史**，了解系统运行状况
3. ✅ **根据实际需求调整规则**，避免过度告警
4. ✅ **保持告警系统启用**，确保及时发现问题

如有问题，请查看系统日志或联系技术支持。
