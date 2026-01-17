-- 台湾彩票域名初始化脚本
-- 运行方式: mysql -h lottery-mysql-compose -u lottery -plottery123 lottery_crawler < data/init-taiwan-lottery-domain.sql

-- 添加台湾彩票域名
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status, health_score, success_count, failure_count, total_requests, avg_response_time, consecutive_failures, last_check_time, last_success_time, notes, created_at, updated_at)
VALUES
('taiwanlottery', 'https://www.taiwanlottery.com', 1, TRUE, 'active', 100, 0, 0, 0, 0, 0, NOW(), NOW(), '台湾彩票官方网站', NOW(), NOW())
ON DUPLICATE KEY UPDATE
  updated_at = NOW(),
  enabled = TRUE,
  status = 'active';

-- 验证插入结果
SELECT id, source_type, domain_url, status, health_score
FROM cwl_api_domains
WHERE source_type = 'taiwanlottery';
