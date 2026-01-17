-- =====================================================
-- 域名管理系统数据库架构
-- 用于UniversalDomainManager的多数据源域名池管理
-- =====================================================

-- 1. 域名配置表
CREATE TABLE IF NOT EXISTS cwl_api_domains (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '域名ID',
  source_type VARCHAR(50) NOT NULL COMMENT '数据源类型（cwl, speedylot88, sglotteries等）',
  domain_url VARCHAR(255) NOT NULL COMMENT '域名URL',
  priority INT DEFAULT 1 COMMENT '优先级（数字越小优先级越高）',
  enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  status ENUM('active', 'degraded', 'failed') DEFAULT 'active' COMMENT '状态：active-正常，degraded-性能降级，failed-故障',

  -- 统计字段
  total_requests INT DEFAULT 0 COMMENT '总请求数',
  success_requests INT DEFAULT 0 COMMENT '成功请求数',
  failed_requests INT DEFAULT 0 COMMENT '失败请求数',
  success_rate DECIMAL(5,2) DEFAULT 100.00 COMMENT '成功率（%）',
  response_time_ms INT DEFAULT 0 COMMENT '平均响应时间（毫秒）',
  consecutive_failures INT DEFAULT 0 COMMENT '连续失败次数',

  -- 时间戳
  last_check_at DATETIME NULL COMMENT '最后检查时间',
  last_success_at DATETIME NULL COMMENT '最后成功时间',
  last_failure_at DATETIME NULL COMMENT '最后失败时间',
  failure_reason TEXT NULL COMMENT '失败原因',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  INDEX idx_source_type (source_type),
  INDEX idx_enabled (enabled),
  INDEX idx_status (status),
  INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='API域名配置表';

-- 2. 域名健康检查日志表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='域名健康检查日志';

-- 3. 域名切换历史表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='域名切换历史记录';

-- =====================================================
-- 初始数据：各数据源的域名配置
-- =====================================================

-- 中国福彩免费API
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('cwl', 'https://auluckylotteries.com', 1, TRUE, 'active');

-- SpeedyLot88（极速彩）
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('speedylot88', 'https://speedylot88.com', 1, TRUE, 'active');

-- SG Lotteries
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('sglotteries', 'https://sglotteries.com', 1, TRUE, 'active');

-- AU Lucky Lotteries
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('auluckylotteries', 'https://auluckylotteries.com', 1, TRUE, 'active');

-- Lucky Sscai（幸运时时彩）
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('luckysscai', 'https://luckysscai.com', 1, TRUE, 'active');

-- Lucky Lottoz（幸运飞艇）
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('luckylottoz', 'https://luckylottoz.com', 1, TRUE, 'active');

-- UK Lottos
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('uklottos', 'https://www.uklottos.com', 1, TRUE, 'active');

-- 香港六合彩（On.cc 东网）
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('hkjc', 'https://win.on.cc', 1, TRUE, 'active');

-- 中国体彩官网
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status) VALUES
('sportslottery', 'https://webapi.sporttery.cn', 1, TRUE, 'active');
