import database from './Database.js';
import logger from '../utils/Logger.js';

/**
 * 数据库维护工具 - 数据清理、优化、归档
 */
class DatabaseMaintenance {
  /**
   * 清理重复数据
   * 保留最新的记录，删除重复的旧记录
   */
  async cleanDuplicates(options = {}) {
    const { dryRun = true } = options;

    try {
      const pool = database._initPool();

      // 查找重复数据
      const [duplicates] = await pool.query(`
        SELECT lot_code, issue, COUNT(*) as count, MIN(id) as keep_id
        FROM lottery_results
        GROUP BY lot_code, issue
        HAVING count > 1
      `);

      if (duplicates.length === 0) {
        logger.info('✅ 未发现重复数据');
        return { cleaned: 0, duplicates: [] };
      }

      logger.info(`🔍 发现 ${duplicates.length} 组重复数据`);

      let totalCleaned = 0;

      for (const dup of duplicates) {
        // 获取该组的所有记录ID
        const [records] = await pool.query(`
          SELECT id, created_at
          FROM lottery_results
          WHERE lot_code = ? AND issue = ?
          ORDER BY created_at DESC
        `, [dup.lot_code, dup.issue]);

        // 保留最新的，删除其他的
        const idsToDelete = records.slice(1).map(r => r.id);

        if (idsToDelete.length > 0) {
          if (dryRun) {
            logger.info(`  [模拟] 将删除 ${dup.lot_code}-${dup.issue} 的 ${idsToDelete.length} 条重复记录 (保留ID: ${records[0].id})`);
          } else {
            await pool.query(`
              DELETE FROM lottery_results WHERE id IN (?)
            `, [idsToDelete]);
            logger.info(`  ✅ 已删除 ${dup.lot_code}-${dup.issue} 的 ${idsToDelete.length} 条重复记录`);
          }
          totalCleaned += idsToDelete.length;
        }
      }

      const result = {
        cleaned: totalCleaned,
        duplicates: duplicates.map(d => ({
          lotCode: d.lot_code,
          issue: d.issue,
          count: d.count
        }))
      };

      if (dryRun) {
        logger.info(`\n💡 这是模拟运行，实际未删除数据。使用 { dryRun: false } 执行真实清理。`);
      } else {
        logger.success(`✅ 清理完成，共删除 ${totalCleaned} 条重复记录`);
      }

      return result;
    } catch (error) {
      logger.error('清理重复数据失败', error);
      throw error;
    }
  }

  /**
   * 清理老旧测试数据
   * 清理超过指定天数的数据（默认保留最近365天）
   */
  async cleanOldData(options = {}) {
    const { dryRun = true, daysToKeep = 365, excludeLotCodes = [] } = options;

    try {
      const pool = database._initPool();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // 查找要删除的数据
      const [oldRecords] = await pool.query(`
        SELECT
          lot_code,
          COUNT(*) as count,
          MIN(draw_time) as earliest,
          MAX(draw_time) as latest
        FROM lottery_results
        WHERE draw_time < ?
          ${excludeLotCodes.length > 0 ? 'AND lot_code NOT IN (?)' : ''}
        GROUP BY lot_code
      `, excludeLotCodes.length > 0 ? [cutoffDate, excludeLotCodes] : [cutoffDate]);

      if (oldRecords.length === 0) {
        logger.info(`✅ 未发现超过 ${daysToKeep} 天的老数据`);
        return { cleaned: 0, records: [] };
      }

      const totalCount = oldRecords.reduce((sum, r) => sum + r.count, 0);
      logger.info(`🔍 发现 ${totalCount} 条超过 ${daysToKeep} 天的数据，涉及 ${oldRecords.length} 个彩种`);

      oldRecords.forEach(record => {
        logger.info(`  - ${record.lot_code}: ${record.count} 条 (${record.earliest} ~ ${record.latest})`);
      });

      if (dryRun) {
        logger.info(`\n💡 这是模拟运行，实际未删除数据。使用 { dryRun: false } 执行真实清理。`);
        return { cleaned: 0, records: oldRecords };
      }

      // 执行删除
      const [result] = await pool.query(`
        DELETE FROM lottery_results
        WHERE draw_time < ?
          ${excludeLotCodes.length > 0 ? 'AND lot_code NOT IN (?)' : ''}
      `, excludeLotCodes.length > 0 ? [cutoffDate, excludeLotCodes] : [cutoffDate]);

      logger.success(`✅ 清理完成，共删除 ${result.affectedRows} 条老数据`);

      return {
        cleaned: result.affectedRows,
        records: oldRecords
      };
    } catch (error) {
      logger.error('清理老数据失败', error);
      throw error;
    }
  }

  /**
   * 优化表（碎片整理）
   */
  async optimizeTable() {
    try {
      const pool = database._initPool();

      logger.info('🔧 开始优化表...');

      const start = Date.now();
      await pool.query('OPTIMIZE TABLE lottery_results');
      const duration = Date.now() - start;

      logger.success(`✅ 表优化完成，耗时 ${duration}ms`);

      // 获取优化后的统计
      const [stats] = await pool.query(`
        SELECT
          ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb,
          ROUND(data_free / 1024 / 1024, 2) AS free_mb,
          table_rows
        FROM information_schema.TABLES
        WHERE table_schema = DATABASE() AND table_name = 'lottery_results'
      `);

      logger.info(`表大小: ${stats[0].size_mb}MB, 空闲空间: ${stats[0].free_mb}MB, 行数: ${stats[0].table_rows}`);

      return stats[0];
    } catch (error) {
      logger.error('表优化失败', error);
      throw error;
    }
  }

  /**
   * 分析表统计信息（更新索引统计）
   */
  async analyzeTable() {
    try {
      const pool = database._initPool();

      logger.info('📊 开始分析表统计信息...');

      const start = Date.now();
      await pool.query('ANALYZE TABLE lottery_results');
      const duration = Date.now() - start;

      logger.success(`✅ 表分析完成，耗时 ${duration}ms`);

      return { duration };
    } catch (error) {
      logger.error('表分析失败', error);
      throw error;
    }
  }

  /**
   * 备份表数据
   */
  async backupData(options = {}) {
    const { lotCode, startDate, endDate } = options;

    try {
      const pool = database._initPool();

      let query = 'SELECT * FROM lottery_results WHERE 1=1';
      const params = [];

      if (lotCode) {
        query += ' AND lot_code = ?';
        params.push(lotCode);
      }

      if (startDate) {
        query += ' AND draw_time >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND draw_time <= ?';
        params.push(endDate);
      }

      const [records] = await pool.query(query, params);

      logger.info(`✅ 导出 ${records.length} 条记录`);

      return records;
    } catch (error) {
      logger.error('数据备份失败', error);
      throw error;
    }
  }

  /**
   * 清理空值和异常数据
   */
  async cleanInvalidData(options = {}) {
    const { dryRun = true } = options;

    try {
      const pool = database._initPool();

      // 查找异常数据
      const [invalidRecords] = await pool.query(`
        SELECT id, lot_code, issue, draw_code, draw_time
        FROM lottery_results
        WHERE draw_code IS NULL
          OR draw_code = ''
          OR issue IS NULL
          OR issue = ''
          OR lot_code IS NULL
          OR lot_code = ''
      `);

      if (invalidRecords.length === 0) {
        logger.info('✅ 未发现异常数据');
        return { cleaned: 0 };
      }

      logger.warn(`⚠️  发现 ${invalidRecords.length} 条异常数据`);

      invalidRecords.slice(0, 5).forEach(record => {
        logger.info(`  ID: ${record.id}, 彩种: ${record.lot_code}, 期号: ${record.issue}`);
      });

      if (invalidRecords.length > 5) {
        logger.info(`  ... 还有 ${invalidRecords.length - 5} 条`);
      }

      if (dryRun) {
        logger.info(`\n💡 这是模拟运行，实际未删除数据。使用 { dryRun: false } 执行真实清理。`);
        return { cleaned: 0 };
      }

      const [result] = await pool.query(`
        DELETE FROM lottery_results
        WHERE draw_code IS NULL
          OR draw_code = ''
          OR issue IS NULL
          OR issue = ''
          OR lot_code IS NULL
          OR lot_code = ''
      `);

      logger.success(`✅ 清理完成，共删除 ${result.affectedRows} 条异常记录`);

      return { cleaned: result.affectedRows };
    } catch (error) {
      logger.error('清理异常数据失败', error);
      throw error;
    }
  }

  /**
   * 执行完整的数据库维护
   */
  async performFullMaintenance(options = {}) {
    const { dryRun = true } = options;

    logger.info('\n🔧 ========== 开始数据库维护 ==========\n');

    const results = {};

    try {
      // 1. 清理重复数据
      logger.info('📌 步骤 1/5: 清理重复数据');
      results.duplicates = await this.cleanDuplicates({ dryRun });

      // 2. 清理异常数据
      logger.info('\n📌 步骤 2/5: 清理异常数据');
      results.invalid = await this.cleanInvalidData({ dryRun });

      // 3. 分析表
      logger.info('\n📌 步骤 3/5: 分析表统计信息');
      results.analyze = await this.analyzeTable();

      // 4. 优化表
      logger.info('\n📌 步骤 4/5: 优化表');
      results.optimize = await this.optimizeTable();

      // 5. 生成报告
      logger.info('\n📌 步骤 5/5: 生成维护报告');
      const summary = this._generateMaintenanceSummary(results);

      logger.info('\n✅ ========== 数据库维护完成 ==========\n');
      logger.info(summary);

      return results;
    } catch (error) {
      logger.error('\n❌ 数据库维护失败', error);
      throw error;
    }
  }

  /**
   * 生成维护摘要
   */
  _generateMaintenanceSummary(results) {
    const lines = [];

    lines.push('维护摘要:');
    lines.push(`  - 清理重复数据: ${results.duplicates?.cleaned || 0} 条`);
    lines.push(`  - 清理异常数据: ${results.invalid?.cleaned || 0} 条`);
    lines.push(`  - 表分析耗时: ${results.analyze?.duration || 0}ms`);
    lines.push(`  - 表优化完成，当前大小: ${results.optimize?.size_mb || 0}MB`);

    return lines.join('\n');
  }
}

export default new DatabaseMaintenance();
