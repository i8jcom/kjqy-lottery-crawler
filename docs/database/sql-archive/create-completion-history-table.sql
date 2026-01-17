-- 数据补全历史记录表
CREATE TABLE IF NOT EXISTS `data_completion_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `run_time` DATETIME NOT NULL COMMENT '执行时间',
  `duration` INT NOT NULL COMMENT '执行时长（秒）',
  `total_checked` INT NOT NULL DEFAULT 0 COMMENT '检查的彩种总数',
  `total_filled` INT NOT NULL DEFAULT 0 COMMENT '补全的记录总数',
  `success_count` INT NOT NULL DEFAULT 0 COMMENT '成功的彩种数',
  `failed_count` INT NOT NULL DEFAULT 0 COMMENT '失败的彩种数',
  `skipped_count` INT NOT NULL DEFAULT 0 COMMENT '跳过的彩种数',
  `details` JSON COMMENT '详细结果（JSON格式）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_run_time` (`run_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据自动补全历史记录';
