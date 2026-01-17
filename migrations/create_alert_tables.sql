-- =====================================================
-- 告警系统数据库表结构
-- 创建时间: 2026-01-11
-- =====================================================

-- 1. 告警规则表
CREATE TABLE IF NOT EXISTS alert_rules (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '规则ID',
  name VARCHAR(100) NOT NULL COMMENT '规则名称',
  rule_type VARCHAR(50) NOT NULL COMMENT '规则类型: crawl_fail, timeout, data_missing, http_error, data_completeness, websocket_error, lottery_stale, system_error',
  condition_config JSON NOT NULL COMMENT '触发条件配置 {"threshold": 3, "timeWindow": 300, "operator": ">="}',
  level VARCHAR(20) NOT NULL COMMENT '告警级别: critical, error, warning, info',
  enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用: 1-启用, 0-禁用',
  notification_channels JSON COMMENT '通知渠道 ["email", "dingtalk", "webhook"]',
  notification_config JSON COMMENT '通知配置 {"email": ["admin@example.com"], "dingtalk": "webhook_url"}',
  description TEXT COMMENT '规则描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_rule_type (rule_type),
  INDEX idx_enabled (enabled),
  INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警规则表';

-- 2. 告警历史记录表
CREATE TABLE IF NOT EXISTS alert_history (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '告警ID',
  rule_id INT NOT NULL COMMENT '关联规则ID',
  rule_name VARCHAR(100) NOT NULL COMMENT '规则名称（冗余字段，便于查询）',
  level VARCHAR(20) NOT NULL COMMENT '告警级别',
  message VARCHAR(500) NOT NULL COMMENT '告警消息',
  details TEXT COMMENT '详细信息（JSON格式）',
  lot_code VARCHAR(50) COMMENT '关联彩种代码',
  lot_name VARCHAR(100) COMMENT '关联彩种名称',
  metric_value VARCHAR(100) COMMENT '触发指标值',
  status VARCHAR(20) DEFAULT 'pending' COMMENT '处理状态: pending-待处理, resolved-已解决, ignored-已忽略',
  resolved_at TIMESTAMP NULL COMMENT '解决时间',
  resolved_by VARCHAR(100) COMMENT '解决人',
  notification_sent TINYINT(1) DEFAULT 0 COMMENT '是否已发送通知',
  notification_channels JSON COMMENT '已发送的通知渠道',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '告警时间',
  INDEX idx_rule_id (rule_id),
  INDEX idx_level (level),
  INDEX idx_status (status),
  INDEX idx_lot_code (lot_code),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警历史记录表';

-- 3. 告警统计视图（便于快速查询）
CREATE OR REPLACE VIEW alert_stats_today AS
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
  SUM(CASE WHEN level = 'critical' THEN 1 ELSE 0 END) as critical_count,
  SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as error_count,
  SUM(CASE WHEN level = 'warning' THEN 1 ELSE 0 END) as warning_count,
  ROUND(SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as resolve_rate
FROM alert_history
WHERE DATE(created_at) = CURDATE();

-- 插入默认告警规则
INSERT INTO alert_rules (name, rule_type, condition_config, level, enabled, notification_channels, description) VALUES
('爬取失败告警', 'crawl_fail', '{"threshold": 3, "timeWindow": 600, "operator": ">="}', 'critical', 1, '["email", "dingtalk"]', '连续失败 >= 3次时触发'),
('响应超时告警', 'timeout', '{"threshold": 10000, "operator": ">"}', 'warning', 1, '["email"]', '响应时间 > 10秒时触发'),
('数据缺失告警', 'data_missing', '{"threshold": 2, "operator": ">="}', 'error', 1, '["email", "dingtalk", "webhook"]', '期号连续缺失 >= 2期时触发'),
('系统异常告警', 'system_error', '{"cpuThreshold": 90, "memThreshold": 90}', 'error', 0, '["email"]', 'CPU或内存使用率 > 90%时触发'),
('数据源502/503告警', 'http_error', '{"threshold": 5, "timeWindow": 300, "statusCodes": [502, 503]}', 'error', 1, '["email", "dingtalk"]', '连续502/503错误 >= 5次时触发'),
('数据完整性告警', 'data_completeness', '{"threshold": 90, "operator": "<"}', 'warning', 1, '["email"]', '单日数据完整率 < 90%时触发'),
('WebSocket连接异常告警', 'websocket_error', '{"threshold": 300, "operator": ">"}', 'warning', 1, '["email", "webhook"]', 'WebSocket断开超过5分钟时触发'),
('彩种长时间无更新告警', 'lottery_stale', '{"threshold": 600, "highFreqOnly": true}', 'warning', 1, '["email"]', '高频彩超过10分钟无新期号时触发');

-- 创建索引优化查询性能
CREATE INDEX idx_alert_history_composite ON alert_history(created_at DESC, level, status);
