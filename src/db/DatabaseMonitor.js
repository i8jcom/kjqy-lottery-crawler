import database from './Database.js';
import logger from '../utils/Logger.js';

/**
 * 数据库监控工具 - 监控数据库状态、表大小、索引效率
 */
class DatabaseMonitor {
  /**
   * 获取数据库统计信息
   */
  async getStatistics() {
    try {
      const pool = database._initPool();

      // 1. 基础统计
      const [basicStats] = await pool.query(`
        SELECT
          COUNT(*) as total_records,
          COUNT(DISTINCT lot_code) as total_lotteries,
          MIN(draw_time) as earliest_record,
          MAX(draw_time) as latest_record,
          DATEDIFF(MAX(draw_time), MIN(draw_time)) as days_span
        FROM lottery_results
      `);

      // 2. 每个彩种的统计
      const [lotteryStats] = await pool.query(`
        SELECT
          lot_code,
          COUNT(*) as record_count,
          MIN(draw_time) as earliest,
          MAX(draw_time) as latest,
          DATEDIFF(MAX(draw_time), MIN(draw_time)) as days_span
        FROM lottery_results
        GROUP BY lot_code
        ORDER BY record_count DESC
      `);

      // 3. 表大小和索引信息
      const [tableInfo] = await pool.query(`
        SELECT
          table_name,
          ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb,
          ROUND(data_length / 1024 / 1024, 2) AS data_mb,
          ROUND(index_length / 1024 / 1024, 2) AS index_mb,
          table_rows
        FROM information_schema.TABLES
        WHERE table_schema = DATABASE()
          AND table_name = 'lottery_results'
      `);

      // 4. 索引统计
      const [indexStats] = await pool.query(`
        SELECT
          index_name,
          column_name,
          seq_in_index,
          cardinality,
          nullable
        FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE()
          AND table_name = 'lottery_results'
        ORDER BY index_name, seq_in_index
      `);

      // 5. 最近24小时的数据增长
      const [recentGrowth] = await pool.query(`
        SELECT
          COUNT(*) as records_24h,
          COUNT(DISTINCT lot_code) as lotteries_24h,
          MIN(created_at) as first_record,
          MAX(created_at) as last_record
        FROM lottery_results
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      return {
        basic: basicStats[0],
        lotteries: lotteryStats,
        table: tableInfo[0],
        indexes: this._groupIndexes(indexStats),
        growth: recentGrowth[0]
      };
    } catch (error) {
      logger.error('获取数据库统计失败', error);
      return null;
    }
  }

  /**
   * 检查数据库健康状况
   */
  async checkHealth() {
    try {
      const pool = database._initPool();

      const health = {
        status: 'healthy',
        issues: [],
        warnings: []
      };

      // 1. 检查连接
      try {
        await pool.query('SELECT 1');
      } catch (error) {
        health.status = 'error';
        health.issues.push('数据库连接失败');
        return health;
      }

      // 2. 检查表大小
      const [tableSize] = await pool.query(`
        SELECT ROUND((data_length + index_length) / 1024 / 1024 / 1024, 2) AS size_gb
        FROM information_schema.TABLES
        WHERE table_schema = DATABASE() AND table_name = 'lottery_results'
      `);

      if (tableSize[0].size_gb > 5) {
        health.warnings.push(`表大小已达 ${tableSize[0].size_gb}GB，建议考虑归档`);
      }

      if (tableSize[0].size_gb > 10) {
        health.status = 'warning';
        health.issues.push(`表大小过大 (${tableSize[0].size_gb}GB)，需要立即优化`);
      }

      // 3. 检查重复数据
      const [duplicates] = await pool.query(`
        SELECT COUNT(*) as duplicate_count
        FROM (
          SELECT lot_code, issue, COUNT(*) as cnt
          FROM lottery_results
          GROUP BY lot_code, issue
          HAVING cnt > 1
        ) as dups
      `);

      if (duplicates[0].duplicate_count > 0) {
        health.warnings.push(`发现 ${duplicates[0].duplicate_count} 组重复数据`);
      }

      // 4. 检查数据完整性
      const [missingIssues] = await pool.query(`
        SELECT lot_code, COUNT(*) as record_count
        FROM lottery_results
        WHERE draw_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY lot_code
        HAVING record_count < 10
      `);

      if (missingIssues.length > 0) {
        const codes = missingIssues.map(r => r.lot_code).join(', ');
        health.warnings.push(`近7天数据不足的彩种: ${codes}`);
      }

      // 5. 检查索引效率
      const [indexCheck] = await pool.query(`
        SELECT
          index_name,
          SUM(cardinality) as total_cardinality
        FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE()
          AND table_name = 'lottery_results'
        GROUP BY index_name
      `);

      const hasLowCardinality = indexCheck.some(idx =>
        idx.index_name !== 'PRIMARY' && idx.total_cardinality < 100
      );

      if (hasLowCardinality) {
        health.warnings.push('部分索引基数较低，可能影响查询效率');
      }

      logger.info(`数据库健康检查完成: ${health.status}`);
      return health;
    } catch (error) {
      logger.error('数据库健康检查失败', error);
      return {
        status: 'error',
        issues: [`检查失败: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * 获取索引使用统计
   */
  async getIndexUsageStats() {
    try {
      const pool = database._initPool();

      const [stats] = await pool.query(`
        SELECT
          index_name,
          GROUP_CONCAT(column_name ORDER BY seq_in_index) as columns,
          MAX(cardinality) as cardinality
        FROM information_schema.STATISTICS
        WHERE table_schema = DATABASE()
          AND table_name = 'lottery_results'
        GROUP BY index_name
        ORDER BY index_name
      `);

      return stats;
    } catch (error) {
      logger.error('获取索引统计失败', error);
      return [];
    }
  }

  /**
   * 分析查询性能
   */
  async analyzeQueryPerformance() {
    try {
      const pool = database._initPool();

      // 测试常用查询
      const queries = [
        {
          name: '按彩种查询最新数据',
          sql: 'SELECT * FROM lottery_results WHERE lot_code = "10037" ORDER BY draw_time DESC LIMIT 1'
        },
        {
          name: '按日期范围查询',
          sql: 'SELECT * FROM lottery_results WHERE lot_code = "10037" AND draw_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)'
        },
        {
          name: '统计查询',
          sql: 'SELECT lot_code, COUNT(*) FROM lottery_results GROUP BY lot_code'
        }
      ];

      const results = [];

      for (const query of queries) {
        const start = Date.now();
        await pool.query(query.sql);
        const duration = Date.now() - start;

        // 执行EXPLAIN分析
        const [explain] = await pool.query(`EXPLAIN ${query.sql}`);

        results.push({
          name: query.name,
          duration: `${duration}ms`,
          explain: explain[0]
        });
      }

      return results;
    } catch (error) {
      logger.error('查询性能分析失败', error);
      return [];
    }
  }

  /**
   * 生成优化建议
   */
  async generateOptimizationSuggestions() {
    const stats = await this.getStatistics();
    const health = await this.checkHealth();
    const suggestions = [];

    if (!stats) {
      return ['无法获取数据库统计信息'];
    }

    // 1. 根据数据量建议
    const totalRecords = stats.basic.total_records;

    if (totalRecords > 10000000) {
      suggestions.push('数据量已超过1000万，强烈建议启用表分区');
    } else if (totalRecords > 5000000) {
      suggestions.push('数据量超过500万，建议考虑表分区或数据归档');
    } else if (totalRecords > 1000000) {
      suggestions.push('数据量超过100万，建议定期监控查询性能');
    }

    // 2. 根据表大小建议
    if (stats.table && stats.table.size_mb > 5000) {
      suggestions.push('表大小超过5GB，建议启用InnoDB压缩或数据归档');
    }

    // 3. 根据健康检查建议
    if (health.warnings.length > 0) {
      suggestions.push(...health.warnings);
    }

    // 4. 根据数据分布建议
    const hasOldData = stats.lotteries.some(lot =>
      lot.days_span > 365 && lot.record_count < 1000
    );

    if (hasOldData) {
      suggestions.push('发现少量老数据，建议清理测试数据或异常数据');
    }

    // 5. 根据增长速度建议
    if (stats.growth && stats.growth.records_24h > 20000) {
      suggestions.push('数据增长快速，建议设置自动归档策略');
    }

    if (suggestions.length === 0) {
      suggestions.push('数据库状态良好，暂无优化建议');
    }

    return suggestions;
  }

  /**
   * 组织索引信息
   */
  _groupIndexes(indexStats) {
    const indexes = {};

    indexStats.forEach(stat => {
      if (!indexes[stat.index_name]) {
        indexes[stat.index_name] = {
          name: stat.index_name,
          columns: [],
          cardinality: 0
        };
      }

      indexes[stat.index_name].columns.push(stat.column_name);
      indexes[stat.index_name].cardinality = Math.max(
        indexes[stat.index_name].cardinality,
        stat.cardinality || 0
      );
    });

    return Object.values(indexes);
  }

  /**
   * 打印监控报告
   */
  async printMonitoringReport() {
    logger.info('========== 数据库监控报告 ==========');

    const stats = await this.getStatistics();
    if (stats) {
      logger.info(`总记录数: ${stats.basic.total_records.toLocaleString()}`);
      logger.info(`彩种数量: ${stats.basic.total_lotteries}`);
      logger.info(`数据时间跨度: ${stats.basic.days_span} 天`);
      logger.info(`表大小: ${stats.table.size_mb} MB (数据: ${stats.table.data_mb}MB, 索引: ${stats.table.index_mb}MB)`);
      logger.info(`24小时新增: ${stats.growth.records_24h} 条`);

      logger.info('\n索引信息:');
      stats.indexes.forEach(idx => {
        logger.info(`  - ${idx.name}: [${idx.columns.join(', ')}] (基数: ${idx.cardinality})`);
      });
    }

    const health = await this.checkHealth();
    logger.info(`\n健康状态: ${health.status.toUpperCase()}`);

    if (health.issues.length > 0) {
      logger.warn('问题:');
      health.issues.forEach(issue => logger.warn(`  ⚠️  ${issue}`));
    }

    if (health.warnings.length > 0) {
      logger.info('警告:');
      health.warnings.forEach(warning => logger.info(`  💡 ${warning}`));
    }

    const suggestions = await this.generateOptimizationSuggestions();
    logger.info('\n优化建议:');
    suggestions.forEach(suggestion => logger.info(`  📌 ${suggestion}`));

    logger.info('=====================================\n');
  }
}

export default new DatabaseMonitor();
