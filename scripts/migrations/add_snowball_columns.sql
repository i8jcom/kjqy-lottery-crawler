-- 金多寶智能识别数据库迁移脚本
-- 创建日期: 2025-12-29
-- 说明: 为 lottery_results 表添加金多寶识别字段

-- 1. 添加金多寶相关字段
ALTER TABLE lottery_results
ADD COLUMN IF NOT EXISTS snowball_name VARCHAR(100) DEFAULT NULL COMMENT '金多寶名称 (如: 新春金多寶, 中秋金多寶)',
ADD COLUMN IF NOT EXISTS snowball_type VARCHAR(50) DEFAULT NULL COMMENT '金多寶类型代码 (如: CHINESE_NEW_YEAR, MID_AUTUMN)',
ADD COLUMN IF NOT EXISTS snowball_category VARCHAR(30) DEFAULT NULL COMMENT '金多寶分类 (festival/commemorative/special)',
ADD COLUMN IF NOT EXISTS snowball_confidence DECIMAL(3,2) DEFAULT NULL COMMENT '识别置信度 (0.00-1.00)';

-- 2. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_snowball_type ON lottery_results(snowball_type);
CREATE INDEX IF NOT EXISTS idx_snowball_name ON lottery_results(snowball_name);
CREATE INDEX IF NOT EXISTS idx_is_snowball ON lottery_results((snowball_name IS NOT NULL));

-- 3. 创建组合索引 (用于按类型和时间查询)
CREATE INDEX IF NOT EXISTS idx_snowball_type_time ON lottery_results(snowball_type, draw_time);

-- 4. 显示更新后的表结构
SHOW CREATE TABLE lottery_results;

-- 5. 查询当前金多寶数据统计
SELECT
  COUNT(*) as total_records,
  SUM(CASE WHEN snowball_name IS NOT NULL THEN 1 ELSE 0 END) as snowball_records,
  ROUND(SUM(CASE WHEN snowball_name IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as snowball_percentage
FROM lottery_results
WHERE lot_code = '60001';
