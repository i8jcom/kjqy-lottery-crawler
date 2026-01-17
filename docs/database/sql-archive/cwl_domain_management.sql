-- ==========================================
-- 中国福彩API域名管理系统 - 数据库表
-- ==========================================
-- 创建时间: 2025-12-30
-- 用途: 支持多域名管理、自动故障转移、历史追踪
-- ==========================================

-- 1. 域名配置表
CREATE TABLE IF NOT EXISTS `cwl_api_domains` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '域名ID',
  `domain_url` VARCHAR(255) NOT NULL UNIQUE COMMENT '域名URL',
  `domain_type` ENUM('primary', 'backup') DEFAULT 'backup' COMMENT '域名类型',
  `priority` INT DEFAULT 100 COMMENT '优先级（数字越小越优先）',
  `status` ENUM('active', 'degraded', 'failed', 'disabled') DEFAULT 'active' COMMENT '当前状态',
  `response_time_ms` INT DEFAULT 0 COMMENT '平均响应时间(毫秒)',
  `success_rate` DECIMAL(5,2) DEFAULT 0.00 COMMENT '成功率(%)',
  `total_requests` INT DEFAULT 0 COMMENT '总请求数',
  `success_requests` INT DEFAULT 0 COMMENT '成功请求数',
  `failed_requests` INT DEFAULT 0 COMMENT '失败请求数',
  `consecutive_failures` INT DEFAULT 0 COMMENT '连续失败次数',
  `last_check_at` DATETIME COMMENT '最后检查时间',
  `last_success_at` DATETIME COMMENT '最后成功时间',
  `last_failure_at` DATETIME COMMENT '最后失败时间',
  `failure_reason` TEXT COMMENT '最后失败原因',
  `enabled` BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_status_priority` (`status`, `priority`),
  INDEX `idx_enabled` (`enabled`),
  INDEX `idx_domain_type` (`domain_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='福彩API域名配置表';

-- 2. 域名切换历史表
CREATE TABLE IF NOT EXISTS `cwl_domain_switch_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '历史记录ID',
  `old_domain_id` INT COMMENT '旧域名ID',
  `new_domain_id` INT COMMENT '新域名ID',
  `old_domain_url` VARCHAR(255) COMMENT '旧域名URL',
  `new_domain_url` VARCHAR(255) COMMENT '新域名URL',
  `switch_reason` ENUM('manual', 'auto_failover', 'health_check_failed', 'performance_degraded', 'domain_expired') NOT NULL COMMENT '切换原因',
  `trigger_type` ENUM('user', 'system') NOT NULL COMMENT '触发类型',
  `operator` VARCHAR(50) DEFAULT 'system' COMMENT '操作人',
  `failure_info` TEXT COMMENT '故障详情',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '切换时间',
  FOREIGN KEY (`old_domain_id`) REFERENCES `cwl_api_domains`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`new_domain_id`) REFERENCES `cwl_api_domains`(`id`) ON DELETE SET NULL,
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_trigger_type` (`trigger_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='域名切换历史记录表';

-- 3. 域名健康检查日志表
CREATE TABLE IF NOT EXISTS `cwl_domain_health_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
  `domain_id` INT NOT NULL COMMENT '域名ID',
  `domain_url` VARCHAR(255) COMMENT '域名URL',
  `check_result` ENUM('success', 'timeout', 'error', 'dns_failed') NOT NULL COMMENT '检查结果',
  `response_time_ms` INT COMMENT '响应时间(毫秒)',
  `http_status` INT COMMENT 'HTTP状态码',
  `error_message` TEXT COMMENT '错误信息',
  `checked_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '检查时间',
  FOREIGN KEY (`domain_id`) REFERENCES `cwl_api_domains`(`id`) ON DELETE CASCADE,
  INDEX `idx_domain_checked` (`domain_id`, `checked_at`),
  INDEX `idx_check_result` (`check_result`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='域名健康检查日志（保留最近30天）';

-- ==========================================
-- 初始化默认数据
-- ==========================================

-- 插入默认域名配置
INSERT INTO `cwl_api_domains`
(`domain_url`, `domain_type`, `priority`, `status`, `enabled`, `created_at`)
VALUES
('https://api.apiose188.com', 'primary', 1, 'active', TRUE, NOW()),
('https://api2.apiose188.com', 'backup', 10, 'active', TRUE, NOW()),
('https://api-backup.example.com', 'backup', 20, 'disabled', FALSE, NOW())
ON DUPLICATE KEY UPDATE
  `updated_at` = NOW();

-- ==========================================
-- 数据维护计划
-- ==========================================

-- 建议定期清理健康检查日志（保留30天）
-- 可以通过cron或数据库事件自动执行：
-- DELETE FROM `cwl_domain_health_logs`
-- WHERE `checked_at` < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- ==========================================
-- 使用说明
-- ==========================================
--
-- 1. 查询当前激活的域名：
--    SELECT * FROM cwl_api_domains
--    WHERE enabled = TRUE AND status = 'active'
--    ORDER BY priority ASC LIMIT 1;
--
-- 2. 查看域名切换历史：
--    SELECT * FROM cwl_domain_switch_history
--    ORDER BY created_at DESC LIMIT 20;
--
-- 3. 分析域名健康状况：
--    SELECT domain_url, check_result,
--           COUNT(*) as count,
--           AVG(response_time_ms) as avg_response_time
--    FROM cwl_domain_health_logs
--    WHERE checked_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
--    GROUP BY domain_url, check_result;
--
-- ==========================================
