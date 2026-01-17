-- =====================================================
-- 彩票爬虫系统完整数据库初始化脚本
-- =====================================================
-- 创建时间: 2026-01-17
-- 说明: 包含所有10个表的完整定义，基于生产环境架构生成
-- 用途: Docker容器初始化、新环境搭建
-- =====================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

USE lottery_crawler;

-- =====================================================
-- 1. 核心数据表
-- =====================================================

-- 1.1 彩票开奖结果表（含金多寶识别字段）
CREATE TABLE IF NOT EXISTS lottery_results (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  lot_code VARCHAR(50) NOT NULL COMMENT '彩种代码',
  issue VARCHAR(50) NOT NULL COMMENT '期号',
  draw_code VARCHAR(500) NOT NULL COMMENT '开奖号码',
  special_numbers VARCHAR(100) DEFAULT NULL COMMENT '特别号码',
  draw_time DATETIME NOT NULL COMMENT '开奖时间',
  unixtime INT DEFAULT NULL COMMENT 'Unix时间戳(秒) - AU彩种特有，用于精确计算倒计时',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  -- 金多寶智能识别字段（香港六合彩专用）
  snowball_name VARCHAR(100) DEFAULT NULL COMMENT '金多寶名称（如：新春金多寶、中秋金多寶）',
  snowball_type VARCHAR(50) DEFAULT NULL COMMENT '金多寶类型代码（如：CHINESE_NEW_YEAR、MID_AUTUMN）',
  snowball_category VARCHAR(30) DEFAULT NULL COMMENT '金多寶分类（festival/commemorative/special）',
  snowball_confidence DECIMAL(3,2) DEFAULT NULL COMMENT '识别置信度（0.00-1.00）',
  
  -- 索引
  UNIQUE KEY uk_lot_issue (lot_code, issue),
  KEY idx_lot_code (lot_code),
  KEY idx_draw_time (draw_time),
  KEY idx_created_at (created_at),
  KEY idx_snowball_type (snowball_type),
  KEY idx_snowball_name (snowball_name),
  KEY idx_snowball_type_time (snowball_type, draw_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='彩票开奖结果表';

-- 1.2 爬虫任务日志表
CREATE TABLE IF NOT EXISTS crawler_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  lot_code VARCHAR(50) NOT NULL COMMENT '彩种代码',
  task_type VARCHAR(50) NOT NULL COMMENT '任务类型: realtime/history',
  status VARCHAR(20) NOT NULL COMMENT '状态: success/failed',
  source VARCHAR(100) COMMENT '数据源',
  error_message TEXT COMMENT '错误信息',
  records_count INT DEFAULT 0 COMMENT '采集记录数',
  start_time DATETIME NOT NULL COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',
  duration INT COMMENT '耗时(毫秒)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  KEY idx_lot_code (lot_code),
  KEY idx_status (status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='爬虫任务日志表';

-- =====================================================
-- 2. 告警系统（3个表 + 1个视图）
-- =====================================================

-- 2.1 告警规则表
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

-- 2.2 告警历史记录表
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
  INDEX idx_alert_history_composite (created_at DESC, level, status),
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警历史记录表';

-- 2.3 告警统计视图（便于快速查询今日告警统计）
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

-- =====================================================
-- 3. 域名管理系统（3个表）
-- =====================================================

-- 3.1 API域名配置表
CREATE TABLE IF NOT EXISTS cwl_api_domains (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '域名ID',
  source_type VARCHAR(50) NOT NULL DEFAULT 'cwl' COMMENT '数据源类型（cwl, speedylot88, sglotteries等）',
  domain_url VARCHAR(255) NOT NULL COMMENT '域名URL',
  domain_type ENUM('primary', 'backup') DEFAULT 'backup' COMMENT '域名类型',
  priority INT DEFAULT 100 COMMENT '优先级（数字越小优先级越高）',
  status ENUM('active', 'degraded', 'failed', 'disabled') DEFAULT 'active' COMMENT '状态',
  enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  
  -- 统计字段
  response_time_ms INT DEFAULT 0 COMMENT '平均响应时间（毫秒）',
  success_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT '成功率（%）',
  last_check_at DATETIME DEFAULT NULL COMMENT '最后检查时间',
  last_success_at DATETIME DEFAULT NULL COMMENT '最后成功时间',
  last_failure_at DATETIME DEFAULT NULL COMMENT '最后失败时间',
  failure_reason TEXT COMMENT '失败原因',
  consecutive_failures INT DEFAULT 0 COMMENT '连续失败次数',
  total_requests BIGINT DEFAULT 0 COMMENT '总请求数',
  success_requests BIGINT DEFAULT 0 COMMENT '成功请求数',
  failed_requests BIGINT DEFAULT 0 COMMENT '失败请求数',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  notes TEXT COMMENT '备注',
  
  UNIQUE KEY uk_source_domain (source_type, domain_url),
  INDEX idx_source_type (source_type),
  INDEX idx_status (status),
  INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通用API域名管理表';

-- 3.2 域名健康检查日志表
CREATE TABLE IF NOT EXISTS cwl_domain_health_logs (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
  source_type VARCHAR(50) NOT NULL COMMENT '数据源类型',
  domain_id INT NOT NULL COMMENT '域名ID',
  domain_url VARCHAR(255) NOT NULL COMMENT '域名URL',
  check_result ENUM('success', 'timeout', 'error') NOT NULL COMMENT '检查结果',
  response_time_ms INT DEFAULT 0 COMMENT '响应时间（毫秒）',
  http_status INT NULL COMMENT 'HTTP状态码',
  error_message TEXT NULL COMMENT '错误信息',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '检查时间',
  
  INDEX idx_source_type (source_type),
  INDEX idx_domain_id (domain_id),
  INDEX idx_check_result (check_result),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='域名健康检查日志';

-- 3.3 域名切换历史表
CREATE TABLE IF NOT EXISTS cwl_domain_switch_history (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  source_type VARCHAR(50) NOT NULL COMMENT '数据源类型',
  old_domain_id INT NOT NULL COMMENT '旧域名ID',
  new_domain_id INT NOT NULL COMMENT '新域名ID',
  old_domain_url VARCHAR(255) NOT NULL COMMENT '旧域名URL',
  new_domain_url VARCHAR(255) NOT NULL COMMENT '新域名URL',
  switch_reason VARCHAR(100) NOT NULL COMMENT '切换原因（auto_failover, manual等）',
  trigger_type VARCHAR(50) NOT NULL COMMENT '触发类型（system, user等）',
  operator VARCHAR(50) DEFAULT 'system' COMMENT '操作者',
  failure_info TEXT NULL COMMENT '故障信息',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '切换时间',
  
  INDEX idx_source_type (source_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='域名切换历史记录';

-- =====================================================
-- 4. 业务辅助表
-- =====================================================

-- 4.1 数据自动补全历史记录表
CREATE TABLE IF NOT EXISTS data_completion_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_time DATETIME NOT NULL COMMENT '执行时间',
  duration INT NOT NULL COMMENT '执行时长（秒）',
  total_checked INT NOT NULL DEFAULT 0 COMMENT '检查的彩种总数',
  total_filled INT NOT NULL DEFAULT 0 COMMENT '补全的记录总数',
  success_count INT NOT NULL DEFAULT 0 COMMENT '成功的彩种数',
  failed_count INT NOT NULL DEFAULT 0 COMMENT '失败的彩种数',
  skipped_count INT NOT NULL DEFAULT 0 COMMENT '跳过的彩种数',
  details JSON COMMENT '详细结果（JSON格式）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_run_time (run_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据自动补全历史记录';

-- 4.2 系统配置表
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL COMMENT '配置键',
  setting_value TEXT COMMENT '配置值（JSON格式）',
  description VARCHAR(255) DEFAULT NULL COMMENT '配置说明',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY setting_key (setting_key),
  INDEX idx_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- =====================================================
-- 5. 初始数据插入
-- =====================================================

-- 5.1 插入默认告警规则
INSERT INTO alert_rules (name, rule_type, condition_config, level, enabled, notification_channels, description) VALUES
('爬取失败告警', 'crawl_fail', '{"threshold": 3, "timeWindow": 600, "operator": ">="}', 'critical', 1, '["email", "dingtalk"]', '连续失败 >= 3次时触发'),
('响应超时告警', 'timeout', '{"threshold": 10000, "operator": ">"}', 'warning', 1, '["email"]', '响应时间 > 10秒时触发'),
('数据缺失告警', 'data_missing', '{"threshold": 2, "operator": ">="}', 'error', 1, '["email", "dingtalk", "webhook"]', '期号连续缺失 >= 2期时触发'),
('系统异常告警', 'system_error', '{"cpuThreshold": 90, "memThreshold": 90}', 'error', 0, '["email"]', 'CPU或内存使用率 > 90%时触发'),
('数据源502/503告警', 'http_error', '{"threshold": 5, "timeWindow": 300, "statusCodes": [502, 503]}', 'error', 1, '["email", "dingtalk"]', '连续502/503错误 >= 5次时触发'),
('数据完整性告警', 'data_completeness', '{"threshold": 90, "operator": "<"}', 'warning', 1, '["email"]', '单日数据完整率 < 90%时触发'),
('WebSocket连接异常告警', 'websocket_error', '{"threshold": 300, "operator": ">"}', 'warning', 1, '["email", "webhook"]', 'WebSocket断开超过5分钟时触发'),
('彩种长时间无更新告警', 'lottery_stale', '{"threshold": 600, "highFreqOnly": true}', 'warning', 1, '["email"]', '高频彩超过10分钟无新期号时触发')
ON DUPLICATE KEY UPDATE name=name;

-- 5.2 插入初始域名配置（示例）
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('cwl', 'https://auluckylotteries.com', 1, TRUE, 'active'),
('speedylot88', 'https://speedylot88.com', 1, TRUE, 'active'),
('sglotteries', 'https://sglotteries.com', 1, TRUE, 'active'),
('auluckylotteries', 'https://auluckylotteries.com', 1, TRUE, 'active'),
('luckysscai', 'https://luckysscai.com', 1, TRUE, 'active'),
('luckylottoz', 'https://luckylottoz.com', 1, TRUE, 'active'),
('uklottos', 'https://www.uklottos.com', 1, TRUE, 'active'),
('hkjc', 'https://win.on.cc', 1, TRUE, 'active'),
('sportslottery', 'https://webapi.sporttery.cn', 1, TRUE, 'active')
ON DUPLICATE KEY UPDATE domain_url=domain_url;

-- 5.3 插入初始化完成标记
INSERT INTO lottery_results (lot_code, issue, draw_code, draw_time)
VALUES ('SYSTEM', 'INIT', 'Database initialized', NOW())
ON DUPLICATE KEY UPDATE draw_code = 'Database re-initialized';

-- =====================================================
-- 初始化完成
-- =====================================================

SELECT '✅ 数据库初始化完成！' as status;
SELECT '📊 已创建10个表：' as info;
SELECT '   - lottery_results (彩票开奖结果)' as tables;
SELECT '   - crawler_logs (爬虫日志)' as tables;
SELECT '   - alert_rules (告警规则)' as tables;
SELECT '   - alert_history (告警历史)' as tables;
SELECT '   - alert_stats_today (告警统计视图)' as tables;
SELECT '   - cwl_api_domains (域名配置)' as tables;
SELECT '   - cwl_domain_health_logs (域名健康日志)' as tables;
SELECT '   - cwl_domain_switch_history (域名切换历史)' as tables;
SELECT '   - data_completion_history (数据补全历史)' as tables;
SELECT '   - system_settings (系统配置)' as tables;

