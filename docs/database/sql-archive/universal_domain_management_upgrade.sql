-- ==========================================
-- 通用域名管理系统 - 数据库升级脚本
-- ==========================================
-- 升级现有cwl_*表支持多数据源
-- ==========================================

-- 1. 添加source_type字段到域名配置表
ALTER TABLE `cwl_api_domains`
ADD COLUMN `source_type` VARCHAR(50) NOT NULL DEFAULT 'cwl' COMMENT '数据源类型' AFTER `id`,
ADD INDEX `idx_source_type` (`source_type`);

-- 2. 更新现有数据的source_type
UPDATE `cwl_api_domains` SET `source_type` = 'cwl' WHERE `source_type` = 'cwl';

-- 3. 修改唯一索引（支持多数据源）
ALTER TABLE `cwl_api_domains`
DROP INDEX `domain_url`,
ADD UNIQUE INDEX `uk_source_domain` (`source_type`, `domain_url`);

-- 4. 添加source_type到切换历史表
ALTER TABLE `cwl_domain_switch_history`
ADD COLUMN `source_type` VARCHAR(50) NOT NULL DEFAULT 'cwl' COMMENT '数据源类型' AFTER `id`,
ADD INDEX `idx_source_type` (`source_type`);

-- 5. 添加source_type到健康检查日志表
ALTER TABLE `cwl_domain_health_logs`
ADD COLUMN `source_type` VARCHAR(50) NOT NULL DEFAULT 'cwl' COMMENT '数据源类型' AFTER `id`,
ADD INDEX `idx_source_type` (`source_type`);

-- ==========================================
-- 初始化其他免费API数据源的默认域名
-- ==========================================

-- SpeedyLot88（优先级1 - 7个彩种）
INSERT INTO `cwl_api_domains`
(`source_type`, `domain_url`, `domain_type`, `priority`, `status`, `enabled`)
VALUES
('speedylot88', 'https://speedylot88.com', 'primary', 1, 'active', TRUE),
('speedylot88', 'https://speedylot88.net', 'backup', 10, 'active', TRUE),
('speedylot88', 'https://speedylot-backup.com', 'backup', 20, 'disabled', FALSE)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- SGLotteries（优先级1 - 6个彩种）
INSERT INTO `cwl_api_domains`
(`source_type`, `domain_url`, `domain_type`, `priority`, `status`, `enabled`)
VALUES
('sglotteries', 'https://sglotteries.com', 'primary', 1, 'active', TRUE),
('sglotteries', 'https://sglotteries.net', 'backup', 10, 'active', TRUE),
('sglotteries', 'https://sg-lottery-backup.com', 'backup', 20, 'disabled', FALSE)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- AULuckyLotteries（优先级1 - 4个彩种）
INSERT INTO `cwl_api_domains`
(`source_type`, `domain_url`, `domain_type`, `priority`, `status`, `enabled`)
VALUES
('auluckylotteries', 'http://auluckylotteries.com', 'primary', 1, 'active', TRUE),
('auluckylotteries', 'http://auluckylotteries.net', 'backup', 10, 'active', TRUE),
('auluckylotteries', 'http://au-lottery-backup.com', 'backup', 20, 'disabled', FALSE)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- LuckySscai（优先级2 - 1个彩种）
INSERT INTO `cwl_api_domains`
(`source_type`, `domain_url`, `domain_type`, `priority`, `status`, `enabled`)
VALUES
('luckysscai', 'https://luckysscai.com', 'primary', 1, 'active', TRUE),
('luckysscai', 'https://luckysscai.net', 'backup', 10, 'active', TRUE),
('luckysscai', 'https://lucky-sscai-backup.com', 'backup', 20, 'disabled', FALSE)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- LuckyLottoz（优先级2 - 1个彩种）
INSERT INTO `cwl_api_domains`
(`source_type`, `domain_url`, `domain_type`, `priority`, `status`, `enabled`)
VALUES
('luckylottoz', 'https://luckylottoz.com', 'primary', 1, 'active', TRUE),
('luckylottoz', 'https://luckylottoz.net', 'backup', 10, 'active', TRUE),
('luckylottoz', 'https://lucky-lottoz-backup.com', 'backup', 20, 'disabled', FALSE)
ON DUPLICATE KEY UPDATE `updated_at` = NOW();

-- ==========================================
-- 验证数据
-- ==========================================

-- 查看所有数据源的域名配置
SELECT
    source_type,
    COUNT(*) as domain_count,
    SUM(CASE WHEN enabled = TRUE THEN 1 ELSE 0 END) as enabled_count
FROM cwl_api_domains
GROUP BY source_type
ORDER BY source_type;

-- ==========================================
-- 使用说明
-- ==========================================
--
-- 1. 查询某个数据源的所有域名：
--    SELECT * FROM cwl_api_domains WHERE source_type = 'speedylot88';
--
-- 2. 查看某个数据源的切换历史：
--    SELECT * FROM cwl_domain_switch_history
--    WHERE source_type = 'speedylot88'
--    ORDER BY created_at DESC LIMIT 10;
--
-- 3. 查看所有数据源的健康状况：
--    SELECT source_type, domain_url, status, success_rate, response_time_ms
--    FROM cwl_api_domains
--    WHERE enabled = TRUE
--    ORDER BY source_type, priority;
--
-- ==========================================
