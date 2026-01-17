# init.sql 更新说明

## 更新时间
2026-01-17 09:02

## 更新原因
旧版 init.sql 严重过时，只包含 2 个基础表，而生产环境已有 10 个表。

## 更新内容对比

### 旧版 init.sql（48行）
```
✅ lottery_results - 基础版本（8个字段）
✅ crawler_logs - 完整版本
❌ 缺少 8 个表
```

### 新版 init.sql（278行）
```
✅ lottery_results - 完整版本（13个字段，含金多寶识别）
✅ crawler_logs - 完整版本
✅ alert_rules - 告警规则表
✅ alert_history - 告警历史表
✅ alert_stats_today - 告警统计视图
✅ cwl_api_domains - 域名配置表
✅ cwl_domain_health_logs - 域名健康日志表
✅ cwl_domain_switch_history - 域名切换历史表
✅ data_completion_history - 数据补全历史表
✅ system_settings - 系统配置表
```

## 新增功能

### 1. lottery_results 表新增字段（5个）
- `special_numbers` - 特别号码
- `snowball_name` - 金多寶名称
- `snowball_type` - 金多寶类型代码
- `snowball_category` - 金多寶分类
- `snowball_confidence` - 识别置信度

### 2. 告警系统（新增）
- 8 条预置告警规则
- 支持 critical/error/warning/info 四个级别
- 支持邮件、钉钉、Webhook 通知

### 3. 域名管理系统（新增）
- 多数据源域名池管理
- 自动故障转移
- 健康检查日志
- 切换历史追踪

### 4. 数据补全系统（新增）
- 自动补全历史记录
- 详细执行统计

### 5. 系统配置（新增）
- 灵活的键值对配置
- JSON 格式存储

## 初始数据

### 告警规则（8条）
1. 爬取失败告警（critical）
2. 响应超时告警（warning）
3. 数据缺失告警（error）
4. 系统异常告警（error，默认禁用）
5. 数据源502/503告警（error）
6. 数据完整性告警（warning）
7. WebSocket连接异常告警（warning）
8. 彩种长时间无更新告警（warning）

### 域名配置（9个数据源）
- cwl（中国福彩）
- speedylot88（极速彩）
- sglotteries（新加坡彩）
- auluckylotteries（澳洲彩）
- luckysscai（幸运时时彩）
- luckylottoz（幸运飞艇）
- uklottos（英国彩票）
- hkjc（香港六合彩）
- sportslottery（中国体彩）

## 文件对比

| 项目 | 旧版 | 新版 | 说明 |
|------|------|------|------|
| 文件大小 | 2.1K | 15K | 增加 7倍 |
| 代码行数 | 48 行 | 278 行 | 增加 5.8 倍 |
| 表数量 | 2 个 | 10 个 | 增加 8 个 |
| lottery_results 字段 | 8 个 | 13 个 | 增加 5 个 |
| 初始数据 | 1 条 | 18 条 | 8个告警规则 + 9个域名 + 1个标记 |

## 使用方法

### Docker 容器初始化（自动）
```bash
# docker-compose.yml 中已配置
- ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro

# 容器首次启动时会自动执行
docker-compose up -d
```

### 手动执行（新环境）
```bash
# 在容器内执行
docker exec lottery-mysql-compose mysql -uroot -proot123456 lottery_crawler < init.sql

# 或在宿主机执行
mysql -h localhost -P 3308 -uroot -proot123456 lottery_crawler < init.sql
```

## 备份说明

- 旧版文件已备份为: `init.sql.old`
- 可通过 Git 历史恢复任意版本

## 测试验证

执行后应该看到：
```
✅ 数据库初始化完成！
📊 已创建10个表
```

可以验证：
```sql
SHOW TABLES;  -- 应该看到 10 个表
SELECT COUNT(*) FROM alert_rules;  -- 应该有 8 条规则
SELECT COUNT(*) FROM cwl_api_domains;  -- 应该有 9 个域名
```

## 注意事项

1. **幂等性**: 使用 `CREATE TABLE IF NOT EXISTS` 和 `ON DUPLICATE KEY UPDATE`，可安全重复执行
2. **数据保护**: 不会删除现有数据，只会创建缺失的表和插入默认数据
3. **兼容性**: 与现有生产环境完全兼容
4. **版本控制**: 建议提交到 Git 并打标签

## 相关文件清理

可以归档或删除以下文件（已在 init.sql 中包含）：
- ✅ `create-completion-history-table.sql` - 已整合
- ✅ `migrations/create_alert_tables.sql` - 已整合
- ✅ `schema/domain-management.sql` - 已整合
- ✅ `scripts/migrations/add_snowball_columns.sql` - 已整合

---

**生成者**: Claude Code  
**生成时间**: 2026-01-17 09:02  
**基于**: 生产环境数据库架构
