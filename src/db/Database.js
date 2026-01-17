import mysql from 'mysql2/promise';
import logger from '../utils/Logger.js';
import lotteryConfigManager from '../managers/LotteryConfigManager.js';

/**
 * 数据库连接类（使用MySQL - 复用现有系统的数据库）
 */
class Database {
  constructor() {
    this.pool = null;
  }

  /**
   * 初始化连接池（延迟初始化，确保环境变量已加载）
   */
  _initPool() {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT) || 3306,
        database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'kjqy_lottery',
        user: process.env.DB_USER || process.env.MYSQL_USER || 'kjqy_user',
        password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        dateStrings: true  // ✅ 返回日期为字符串，避免自动转换为UTC
      });

      logger.debug(`数据库连接池已初始化: ${(process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1')}:${(process.env.DB_PORT || process.env.MYSQL_PORT || '3306')}`);
    }
    return this.pool;
  }

  /**
   * 测试数据库连接
   */
  async testConnection() {
    try {
      const pool = this._initPool();
      const [rows] = await pool.query('SELECT NOW() as now');
      logger.success(`数据库连接成功: ${rows[0].now}`);
      return true;
    } catch (error) {
      logger.error('数据库连接失败', error);
      return false;
    }
  }

  getCurrentConfig() {
    return {
      host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT) || 3306,
      database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'kjqy_lottery',
      user: process.env.DB_USER || process.env.MYSQL_USER || 'kjqy_user'
    };
  }

  async reinitialize(config = {}) {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      if (config.host) process.env.DB_HOST = config.host;
      if (config.port) process.env.DB_PORT = String(config.port);
      if (config.database) process.env.DB_NAME = config.database;
      if (config.user) process.env.DB_USER = config.user;
      if (config.password !== undefined) process.env.DB_PASSWORD = config.password;
      this._initPool();
      const ok = await this.testConnection();
      return ok;
    } catch (error) {
      logger.error('重新初始化数据库连接失败', error);
      return false;
    }
  }

  /**
   * 保存实时数据（使用现有的lottery_results表）
   */
  async saveRealtimeData(lotCode, data) {
    const query = `
      INSERT INTO lottery_results
      (lot_code, issue, draw_code, special_numbers, draw_time, unixtime, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        draw_code = VALUES(draw_code),
        special_numbers = VALUES(special_numbers),
        draw_time = VALUES(draw_time),
        unixtime = VALUES(unixtime),
        updated_at = NOW()
    `;

    try {
      const pool = this._initPool();

      // 提取特码（针对台湾宾果宾果等有特码的彩种）
      const specialNumbers = data.specialNumbers && data.specialNumbers.length > 0
        ? data.specialNumbers.join(',')
        : null;

      // 🐛 调试：台湾宾果宾果打印特码
      if (lotCode === '100007') {
        logger.info(`[DB] 🎯 宾果保存: specialNumbers=${JSON.stringify(data.specialNumbers)}, 转换后=${specialNumbers}`);
      }

      // 🐛 调试：随机打印10%的保存请求
      if (Math.random() < 0.1) {
        logger.info(`[DB] 💾 保存样例: ${lotCode} - 期号=${data.issue}, 号码=${data.drawCode}${specialNumbers ? `, 特码=${specialNumbers}` : ''}${data.unixtime ? `, unixtime=${data.unixtime}` : ''}`);
      }

      await pool.query(query, [
        lotCode,
        data.issue,
        data.drawCode,
        specialNumbers,
        data.drawTime,
        data.unixtime || null
      ]);
      logger.debug(`✅ 保存实时数据成功: ${lotCode} - 期号 ${data.issue}`);
      return true;
    } catch (error) {
      logger.error(`❌ 保存实时数据失败: ${lotCode}`);
      logger.error(`   错误详情: ${error.message}`);
      logger.error(`   SQL: ${error.sql}`);
      logger.error(`   数据: ${JSON.stringify({lotCode, issue: data.issue, drawCode: data.drawCode, drawTime: data.drawTime})}`);
      return false;
    }
  }

  /**
   * 保存历史数据（使用现有的lottery_results表）
   */
  async saveHistoryData(lotCode, records, options = {}) {
    if (!records || records.length === 0) return true;

    const { replaceExisting = false, date = null } = options;

    const pool = this._initPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 如果需要替换已有数据
      if (replaceExisting) {
        if (date) {
          // 删除指定日期的记录
          const deleteQuery = `
            DELETE FROM lottery_results
            WHERE lot_code = ? AND DATE(draw_time) = ?
          `;
          await connection.query(deleteQuery, [lotCode, date]);
          logger.info(`🗑️ 已删除 ${lotCode} ${date} 的旧数据，准备保存新数据`);
        } else {
          // 删除整个年份范围的记录（用于批量年份数据）
          const minDate = records.reduce((min, r) => r.drawTime < min ? r.drawTime : min, records[0].drawTime);
          const maxDate = records.reduce((max, r) => r.drawTime > max ? r.drawTime : max, records[0].drawTime);
          const deleteQuery = `
            DELETE FROM lottery_results
            WHERE lot_code = ? AND draw_time >= ? AND draw_time <= ?
          `;
          const [result] = await connection.query(deleteQuery, [lotCode, minDate, maxDate]);
          logger.info(`🗑️ 已删除 ${lotCode} ${minDate} ~ ${maxDate} 的旧数据 (${result.affectedRows}条)，准备保存新数据`);
        }
      }

      // 插入新数据 - 使用 INSERT IGNORE 避免主键冲突
      const insertQuery = `
        INSERT IGNORE INTO lottery_results
        (lot_code, issue, draw_code, special_numbers, draw_time, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `;

      let insertedCount = 0;
      for (const record of records) {
        // 提取特码（针对台湾宾果宾果等有特码的彩种）
        const specialNumbers = record.specialNumbers && record.specialNumbers.length > 0
          ? record.specialNumbers.join(',')
          : null;

        const [result] = await connection.query(insertQuery, [
          lotCode,
          record.issue,
          record.drawCode,
          specialNumbers,
          record.drawTime
        ]);
        if (result.affectedRows > 0) insertedCount++;
      }

      await connection.commit();
      logger.info(`✅ 保存历史数据成功: ${lotCode} - 新增${insertedCount}/${records.length}条记录，日期范围: ${records[0]?.drawTime} ~ ${records[records.length-1]?.drawTime}`);
      return true;
    } catch (error) {
      await connection.rollback();
      logger.error(`❌ 保存历史数据失败: ${lotCode}`, error);
      return false;
    } finally {
      connection.release();
    }
  }

  /**
   * 查询最新数据（从lottery_results表）
   */
  async getLatestData(lotCode) {
    const query = `
      SELECT * FROM lottery_results
      WHERE lot_code = ?
      ORDER BY draw_time DESC, id DESC
      LIMIT 1
    `;

    try {
      const pool = this._initPool();
      const [rows] = await pool.query(query, [lotCode]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`查询最新数据失败: ${lotCode}`, error);
      return null;
    }
  }

  /**
   * 批量查询所有彩种的最新数据
   */
  async getAllLatestData(lotCodes) {
    if (!lotCodes || lotCodes.length === 0) return [];

    // 🎯 逐个查询每个彩种的最新数据（确保按draw_time排序）
    try {
      const results = [];
      const pool = this._initPool();

      for (const lotCode of lotCodes) {
        const query = `
          SELECT * FROM lottery_results
          WHERE lot_code = ?
          ORDER BY draw_time DESC, id DESC
          LIMIT 1
        `;
        const [rows] = await pool.query(query, [lotCode]);
        if (rows && rows.length > 0) {
          results.push(rows[0]);
        }
      }

      // 按updated_at降序排序
      results.sort((a, b) => {
        const timeA = new Date(a.updated_at || 0).getTime();
        const timeB = new Date(b.updated_at || 0).getTime();
        return timeB - timeA;
      });

      return results;
    } catch (error) {
      logger.error('批量查询最新数据失败', error);
      return [];
    }
  }

  /**
   * 获取历史数据（分页，支持日期过滤）
   * 支持自然日和销售日两种模式
   */
  async getHistoryData(lotCode, options = {}) {
    const { pageNo = 1, pageSize = 50, date = null } = options;
    const offset = (pageNo - 1) * pageSize;

    let query = `
      SELECT * FROM lottery_results
      WHERE lot_code = ?
    `;

    let countQuery = `
      SELECT COUNT(*) as total FROM lottery_results
      WHERE lot_code = ?
    `;

    const params = [lotCode];
    const countParams = [lotCode];

    // 如果指定了日期，添加日期过滤条件（计算UTC时间范围）
    if (date) {
      // 获取彩种配置，检查是否使用销售日模式
      const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
      const salesDayStart = lotteryConfig?.salesDayStart;
      const salesDayEnd = lotteryConfig?.salesDayEnd;

      let startTime, endTime;

      if (salesDayStart && salesDayEnd) {
        // 销售日模式：从指定时间开始到次日指定时间结束
        // 例如：salesDayStart="13:09", salesDayEnd="04:04"
        // 表示 12/21 13:09 ~ 12/22 04:04（包含04:04）
        startTime = new Date(date + `T${salesDayStart}:00+08:00`);

        // 结束时间是次日，并且+1分钟确保包含结束时间的那一分钟
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];
        endTime = new Date(nextDayStr + `T${salesDayEnd}:00+08:00`);
        endTime.setMinutes(endTime.getMinutes() + 1); // +1分钟，确保包含04:04:xx

        logger.debug(`📅 [销售日模式] ${lotCode} ${date} (${salesDayStart}~${salesDayEnd}): ${startTime.toISOString()} ~ ${endTime.toISOString()}`);
      } else {
        // 自然日模式：00:00 ~ 次日00:00（不包含次日00:00）
        // 查询条件：draw_time >= startTime AND draw_time < endTime
        // 范围：[2025-12-30 00:00:00, 2025-12-31 00:00:00)
        startTime = new Date(date + 'T00:00:00+08:00');
        endTime = new Date(startTime);
        endTime.setDate(endTime.getDate() + 1);
        // 不需要 +1秒，使用严格的 < 比较即可排除次日00:00:00

        logger.debug(`📅 [自然日模式] ${lotCode} ${date}: ${startTime.toISOString()} ~ ${endTime.toISOString()}`);
      }

      query += ` AND draw_time >= ? AND draw_time < ?`;
      countQuery += ` AND draw_time >= ? AND draw_time < ?`;

      params.push(startTime, endTime);
      countParams.push(startTime, endTime);
    }

    query += ` ORDER BY draw_time DESC, id DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);

    try {
      const pool = this._initPool();
      const [rows] = await pool.query(query, params);
      const [countRows] = await pool.query(countQuery, countParams);

      return {
        records: rows,
        total: countRows[0].total,
        pageNo,
        pageSize,
        totalPages: Math.ceil(countRows[0].total / pageSize)
      };
    } catch (error) {
      logger.error(`查询历史数据失败: ${lotCode}`, error);
      return {
        records: [],
        total: 0,
        pageNo,
        pageSize,
        totalPages: 0
      };
    }
  }

  /**
   * 检查彩种数据完整性
   * 返回 { needsHistory: boolean, recordCount: number, reason: string }
   */
  async checkDataIntegrity(lotCode) {
    const countQuery = `
      SELECT COUNT(*) as count FROM lottery_results
      WHERE lot_code = ?
    `;

    const oldestQuery = `
      SELECT MIN(draw_time) as oldest_time FROM lottery_results
      WHERE lot_code = ?
    `;

    try {
      const pool = this._initPool();
      const [countRows] = await pool.query(countQuery, [lotCode]);
      const recordCount = countRows[0].count;

      // 如果记录少于10条，需要补全历史
      if (recordCount < 10) {
        return {
          needsHistory: true,
          recordCount,
          reason: `记录数量不足 (${recordCount} < 10)`
        };
      }

      // 检查最早记录时间
      const [oldestRows] = await pool.query(oldestQuery, [lotCode]);
      const oldestTime = oldestRows[0].oldest_time;

      if (oldestTime) {
        const hoursSinceOldest = (Date.now() - new Date(oldestTime).getTime()) / (1000 * 60 * 60);

        // 如果最早记录距今不到6小时，认为数据不完整（高频彩应该有更多历史）
        if (hoursSinceOldest < 6) {
          return {
            needsHistory: true,
            recordCount,
            reason: `历史时间跨度太短 (${hoursSinceOldest.toFixed(1)}小时 < 6小时)`
          };
        }
      }

      return {
        needsHistory: false,
        recordCount,
        reason: '数据完整'
      };
    } catch (error) {
      logger.error(`检查数据完整性失败: ${lotCode}`, error);
      return {
        needsHistory: true,
        recordCount: 0,
        reason: '检查失败，建议补全'
      };
    }
  }

  /**
   * 获取所有彩种的数据统计
   */
  async getDataStats() {
    const query = `
      SELECT
        COUNT(DISTINCT lot_code) as total_lotteries,
        COUNT(*) as total_records,
        MAX(updated_at) as last_update
      FROM lottery_results
      WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `;

    try {
      const pool = this._initPool();
      const [rows] = await pool.query(query);
      return rows[0] || { total_lotteries: 0, total_records: 0, last_update: null };
    } catch (error) {
      logger.error('查询数据统计失败', error);
      return { total_lotteries: 0, total_records: 0, last_update: null };
    }
  }

  /**
   * 关闭连接池
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('数据库连接池已关闭');
    }
  }
}

export default new Database();
