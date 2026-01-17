/**
 * 数据自动补全服务
 * 功能：每天自动检查所有彩种的数据完整性，并补全缺失数据
 */

import cron from 'node-cron';
import { EventEmitter } from 'events';
import logger from '../utils/Logger.js';
import database from '../db/Database.js';

class DataCompletionService extends EventEmitter {
  constructor() {
    super();
    this.cronJob = null;
    this.isRunning = false;
    this.lastRunTime = null;
    this.stats = {
      totalChecks: 0,
      totalFilled: 0,
      lastRunResults: {}
    };
    this.initialized = false;
  }

  /**
   * 初始化服务（创建数据库表）
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const pool = database._initPool();
      const createTableSQL = `
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据自动补全历史记录'
      `;

      await pool.query(createTableSQL);
      this.initialized = true;
      logger.info('[DataCompletion] 数据库表初始化成功');
    } catch (error) {
      logger.error('[DataCompletion] 数据库表初始化失败:', error.message);
    }
  }

  /**
   * 启动定时补全任务
   * @param {string} cronExpression - Cron表达式，默认每天凌晨2点执行
   * @param {Object} options - 启动选项
   * @param {boolean} options.runOnStartup - 启动时立即执行一次检查
   * @param {number} options.startupCheckDays - 启动时检查最近N天的数据（默认7天）
   */
  async start(cronExpression = '0 2 * * *', options = {}) {
    if (this.cronJob) {
      logger.warn('[DataCompletion] 定时任务已在运行中');
      return;
    }

    const { runOnStartup = true, startupCheckDays = 7 } = options;

    // 初始化数据库表
    await this.initialize();

    // 🔥 启动时检查最近N天的数据完整性
    if (runOnStartup) {
      logger.info(`[DataCompletion] 🚀 启动检查：将检查最近${startupCheckDays}天的数据完整性...`);

      // 延迟5秒执行，确保其他服务都已启动
      setTimeout(async () => {
        try {
          await this.runStartupCheck(startupCheckDays);
        } catch (error) {
          logger.error('[DataCompletion] 启动检查失败:', error.message);
        }
      }, 5000);
    }

    // 启动定时任务
    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.runCompletion();
    });

    logger.info(`[DataCompletion] ✅ 定时补全任务已启动 (Cron: ${cronExpression})`);
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('[DataCompletion] 定时补全任务已停止');
    }
  }

  /**
   * 手动执行一次补全任务
   */
  async runCompletion() {
    if (this.isRunning) {
      logger.warn('[DataCompletion] 补全任务正在运行中，跳过本次执行');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    logger.info('[DataCompletion] 🔄 开始执行数据补全任务...');

    try {
      const results = {
        success: [],
        failed: [],
        skipped: [],
        totalFilled: 0
      };

      // 获取所有需要检查的彩种配置
      const lotteriesToCheck = await this.getLotteriesToCheck();
      logger.info(`[DataCompletion] 📊 需要检查的彩种数量: ${lotteriesToCheck.length}`);

      // 发送开始事件
      this.emit('progress', {
        type: 'start',
        total: lotteriesToCheck.length,
        timestamp: new Date().toISOString()
      });

      // 逐个检查并补全
      let currentIndex = 0;
      for (const lottery of lotteriesToCheck) {
        currentIndex++;

        try {
          const result = await this.checkAndFillLottery(lottery);

          if (result.filled > 0) {
            results.success.push({
              lotCode: lottery.lotCode,
              name: lottery.name,
              filled: result.filled,
              message: result.message
            });
            results.totalFilled += result.filled;
          } else if (result.skipped) {
            results.skipped.push({
              lotCode: lottery.lotCode,
              name: lottery.name,
              reason: result.reason
            });
          } else {
            results.success.push({
              lotCode: lottery.lotCode,
              name: lottery.name,
              filled: 0,
              message: '数据完整，无需补全'
            });
          }

          // 发送进度更新事件
          this.emit('progress', {
            type: 'lottery_checked',
            current: currentIndex,
            total: lotteriesToCheck.length,
            lottery: {
              lotCode: lottery.lotCode,
              name: lottery.name
            },
            result: result,
            totalFilled: results.totalFilled,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          logger.error(`[DataCompletion] ❌ ${lottery.name} 补全失败: ${error.message}`);
          results.failed.push({
            lotCode: lottery.lotCode,
            name: lottery.name,
            error: error.message
          });

          // 发送失败事件
          this.emit('progress', {
            type: 'lottery_failed',
            current: currentIndex,
            total: lotteriesToCheck.length,
            lottery: {
              lotCode: lottery.lotCode,
              name: lottery.name
            },
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }

        // 每个彩种之间等待500ms，避免API请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const duration = Date.now() - startTime;
      this.lastRunTime = new Date();
      this.stats.totalChecks++;
      this.stats.totalFilled += results.totalFilled;
      this.stats.lastRunResults = results;

      logger.info(`[DataCompletion] ✅ 补全任务完成 (${(duration / 1000).toFixed(1)}秒)`);
      logger.info(`[DataCompletion] 📊 统计: 成功${results.success.length}个 | 失败${results.failed.length}个 | 跳过${results.skipped.length}个 | 补全${results.totalFilled}条数据`);

      if (results.failed.length > 0) {
        logger.warn(`[DataCompletion] ⚠️ 失败的彩种: ${results.failed.map(r => r.name).join(', ')}`);
      }

      // 保存补全历史记录
      await this.saveHistory({
        runTime: this.lastRunTime,
        duration: Math.floor(duration / 1000), // 转换为秒
        totalChecked: lotteriesToCheck.length,
        totalFilled: results.totalFilled,
        successCount: results.success.length,
        failedCount: results.failed.length,
        skippedCount: results.skipped.length,
        details: results
      });

      // 发送完成事件
      this.emit('progress', {
        type: 'complete',
        duration: Math.floor(duration / 1000),
        totalChecked: lotteriesToCheck.length,
        totalFilled: results.totalFilled,
        successCount: results.success.length,
        failedCount: results.failed.length,
        skippedCount: results.skipped.length,
        timestamp: new Date().toISOString()
      });

      return results;

    } catch (error) {
      logger.error('[DataCompletion] ❌ 补全任务执行失败:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 执行自定义补全任务
   * @param {Object} options - 补全选项
   * @param {Array} options.lotCodes - 指定彩种代码数组（可选）
   * @param {Number} options.year - 指定年份（可选）
   * @param {String} options.startDate - 开始日期（可选）
   * @param {String} options.endDate - 结束日期（可选）
   */
  async runCustomCompletion(options = {}) {
    if (this.isRunning) {
      logger.warn('[DataCompletion] 补全任务正在运行中，跳过本次执行');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const { lotCodes, year, startDate, endDate } = options;

    logger.info('[DataCompletion] 🔄 开始执行自定义补全任务...');
    logger.info(`[DataCompletion] 📋 参数: ${JSON.stringify({ lotCodes, year, startDate, endDate })}`);

    try {
      const results = {
        success: [],
        failed: [],
        skipped: [],
        totalFilled: 0
      };

      // 获取所有彩种配置
      const allLotteries = await this.getLotteriesToCheck();

      // 根据lotCodes过滤彩种
      const lotteriesToCheck = lotCodes && lotCodes.length > 0
        ? allLotteries.filter(l => lotCodes.includes(l.lotCode))
        : allLotteries;

      logger.info(`[DataCompletion] 📊 需要检查的彩种数量: ${lotteriesToCheck.length}`);

      // 发送开始事件
      this.emit('progress', {
        type: 'start',
        total: lotteriesToCheck.length,
        custom: true,
        options,
        timestamp: new Date().toISOString()
      });

      // 逐个检查并补全
      let currentIndex = 0;
      for (const lottery of lotteriesToCheck) {
        currentIndex++;

        try {
          // 如果指定了年份，使用指定年份；否则使用当前年份
          const targetYear = year || new Date().getFullYear();
          const result = await this.checkAndFillLottery(lottery, targetYear);

          if (result.filled > 0) {
            results.success.push({
              lotCode: lottery.lotCode,
              name: lottery.name,
              filled: result.filled,
              message: result.message
            });
            results.totalFilled += result.filled;
          } else if (result.skipped) {
            results.skipped.push({
              lotCode: lottery.lotCode,
              name: lottery.name,
              reason: result.reason
            });
          } else {
            results.success.push({
              lotCode: lottery.lotCode,
              name: lottery.name,
              filled: 0,
              message: '数据完整，无需补全'
            });
          }

          // 发送进度更新事件
          this.emit('progress', {
            type: 'lottery_checked',
            current: currentIndex,
            total: lotteriesToCheck.length,
            lottery: {
              lotCode: lottery.lotCode,
              name: lottery.name
            },
            result: result,
            totalFilled: results.totalFilled,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          logger.error(`[DataCompletion] ❌ ${lottery.name} 补全失败: ${error.message}`);
          results.failed.push({
            lotCode: lottery.lotCode,
            name: lottery.name,
            error: error.message
          });

          // 发送失败事件
          this.emit('progress', {
            type: 'lottery_failed',
            current: currentIndex,
            total: lotteriesToCheck.length,
            lottery: {
              lotCode: lottery.lotCode,
              name: lottery.name
            },
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }

        // 每个彩种之间等待500ms，避免API请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const duration = Date.now() - startTime;
      this.lastRunTime = new Date();
      this.stats.totalChecks++;
      this.stats.totalFilled += results.totalFilled;
      this.stats.lastRunResults = results;

      logger.info(`[DataCompletion] ✅ 自定义补全任务完成 (${(duration / 1000).toFixed(1)}秒)`);
      logger.info(`[DataCompletion] 📊 统计: 成功${results.success.length}个 | 失败${results.failed.length}个 | 跳过${results.skipped.length}个 | 补全${results.totalFilled}条数据`);

      // 保存补全历史记录
      await this.saveHistory({
        runTime: this.lastRunTime,
        duration: Math.floor(duration / 1000),
        totalChecked: lotteriesToCheck.length,
        totalFilled: results.totalFilled,
        successCount: results.success.length,
        failedCount: results.failed.length,
        skippedCount: results.skipped.length,
        details: { ...results, custom: true, options }
      });

      // 发送完成事件
      this.emit('progress', {
        type: 'complete',
        duration: Math.floor(duration / 1000),
        totalChecked: lotteriesToCheck.length,
        totalFilled: results.totalFilled,
        successCount: results.success.length,
        failedCount: results.failed.length,
        skippedCount: results.skipped.length,
        custom: true,
        timestamp: new Date().toISOString()
      });

      return results;

    } catch (error) {
      logger.error('[DataCompletion] ❌ 自定义补全任务执行失败:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 获取需要检查的彩种列表
   */
  async getLotteriesToCheck() {
    const lotteryConfigsPath = './data/lottery-configs.json';
    const fs = await import('fs/promises');
    const configData = await fs.readFile(lotteryConfigsPath, 'utf-8');
    const configs = JSON.parse(configData);

    // 只检查启用的彩种，排除极高频彩种（5分钟以下开奖间隔）
    const lotteries = configs.lotteries
      .filter(lottery => lottery.enabled !== false)
      .map(lottery => ({
        lotCode: lottery.lotCode,
        name: lottery.name,
        category: lottery.category,
        drawSchedule: lottery.drawSchedule
      }));

    return lotteries;
  }

  /**
   * 检查并补全单个彩种的数据
   */
  async checkAndFillLottery(lottery) {
    const { lotCode, name, category } = lottery;

    // 跳过极高频彩种（每分钟开奖的彩种数据量太大，且调度器已自动采集）
    const highFrequencyCategories = ['极速彩', 'SG彩', 'UK彩', 'AU彩'];
    if (highFrequencyCategories.some(cat => category?.includes(cat))) {
      return {
        skipped: true,
        reason: '高频彩种，调度器已自动采集'
      };
    }

    logger.info(`[DataCompletion] 🔍 检查 ${name} (${lotCode})`);

    // 获取当前年份和昨天的日期
    const now = new Date();
    const currentYear = now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // 检查当年数据完整性
    const dbRecords = await this.getYearRecords(lotCode, currentYear);
    const actualCount = dbRecords ? dbRecords.length : 0;

    // 计算预期期数
    const expectedCount = this.calculateExpectedCount(lottery, currentYear);

    // 完整性阈值
    const threshold = 0.85; // 85%阈值
    const isComplete = actualCount >= expectedCount * threshold;

    if (isComplete) {
      logger.info(`[DataCompletion] ✅ ${name} 数据完整 (${actualCount}/${expectedCount}期, ${(actualCount/expectedCount*100).toFixed(1)}%)`);
      return {
        filled: 0,
        message: '数据完整，无需补全'
      };
    }

    logger.info(`[DataCompletion] ⚠️ ${name} 数据不完整 (${actualCount}/${expectedCount}期, ${(actualCount/expectedCount*100).toFixed(1)}%)，开始补全...`);

    // 调用补全逻辑
    const filledCount = await this.fillMissingData(lottery, currentYear);

    return {
      filled: filledCount,
      message: `补全完成，新增${filledCount}条数据`
    };
  }

  /**
   * 获取指定年份的数据库记录
   */
  async getYearRecords(lotCode, year) {
    try {
      const pool = database._initPool();
      const sql = `
        SELECT * FROM lottery_results
        WHERE lot_code = ? AND YEAR(draw_time) = ?
        ORDER BY draw_time DESC
      `;
      const [records] = await pool.query(sql, [lotCode, year]);
      return records;
    } catch (error) {
      logger.error(`[DataCompletion] 查询数据库失败: ${lotCode} ${year}年`, error.message);
      return null;
    }
  }

  /**
   * 计算预期期数
   */
  calculateExpectedCount(lottery, year) {
    const { lotCode, drawSchedule } = lottery;
    const currentYear = new Date().getFullYear();
    const now = new Date();

    // 如果是当前年份，计算到昨天的期数
    if (year === currentYear) {
      const dayOfYear = Math.floor((now - new Date(year, 0, 0)) / (1000 * 60 * 60 * 24));
      const daysUntilYesterday = Math.max(1, dayOfYear - 1);

      // 每天开奖的彩种
      const dailyLotteries = ['100003', '100005', '100006', '100008', '70002', '70004', '80002', '80003'];
      if (dailyLotteries.includes(lotCode)) {
        return daysUntilYesterday; // 约等于天数（扣除休市日）
      }

      // 每周2-3期的彩种
      const weeklyLotteries = ['100001', '100002', '100009', '70001', '70003', '80001', '80004', '60001'];
      if (weeklyLotteries.includes(lotCode)) {
        const weeks = Math.floor(daysUntilYesterday / 7);
        return weeks * 2; // 每周2期
      }

      // 台湾宾果：每5分钟1期
      if (lotCode === '100007') {
        return daysUntilYesterday * 288; // 每天288期
      }

      // 默认估算
      return Math.floor(daysUntilYesterday * 0.9);
    }

    // 历史年份：返回全年预期期数
    const dailyLotteries = ['100003', '100005', '100006', '100008', '70002', '70004', '80002', '80003'];
    if (dailyLotteries.includes(lotCode)) {
      return 310; // 扣除节假日约310期
    }

    const weeklyLotteries = ['100001', '100002', '100009', '70001', '70003', '80001', '80004', '60001'];
    if (weeklyLotteries.includes(lotCode)) {
      return 104; // 每周2期，全年104期
    }

    if (lotCode === '100007') {
      return 105000; // 台湾宾果全年约10万期
    }

    return 100; // 默认
  }

  /**
   * 补全缺失数据
   */
  async fillMissingData(lottery, year) {
    const { lotCode, name, category } = lottery;
    let totalFilled = 0;

    try {
      // 台湾彩票
      if (lotCode.startsWith('100') && lotCode !== '100007') {
        totalFilled = await this.fillTaiwanLottery(lotCode, name, year);
      }
      // 福彩
      else if (lotCode.startsWith('700')) {
        totalFilled = await this.fillChinaWelfareLottery(lotCode, name, year);
      }
      // 体彩
      else if (lotCode.startsWith('800')) {
        totalFilled = await this.fillChinaSportsLottery(lotCode, name, year);
      }
      // 香港六合彩
      else if (lotCode === '60001') {
        totalFilled = await this.fillHongKongMarkSix(lotCode, name, year);
      }
      // 其他彩种暂不支持自动补全
      else {
        logger.info(`[DataCompletion] ⏭️ ${name} 暂不支持自动补全`);
      }

      return totalFilled;

    } catch (error) {
      logger.error(`[DataCompletion] ${name} 补全失败:`, error.message);
      throw error;
    }
  }

  /**
   * 补全台湾彩票数据
   */
  async fillTaiwanLottery(lotCode, name, year) {
    const currentYear = new Date().getFullYear();
    let allRecords = [];

    // 动态导入爬虫（这些都导出单例，直接使用）
    let scraper;
    if (lotCode === '100008') {
      scraper = (await import('../scrapers/Taiwan39M5Scraper.js')).default;
    } else if (lotCode === '100009') {
      scraper = (await import('../scrapers/Taiwan49M6Scraper.js')).default;
    } else {
      scraper = (await import('../scrapers/TaiwanLotteryScraper.js')).default;
    }

    // 确定需要获取的月份范围
    const endMonth = (year === currentYear) ? new Date().getMonth() + 1 : 12;

    // 逐月获取数据
    for (let month = 1; month <= endMonth; month++) {
      const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

      try {
        logger.info(`[DataCompletion] 📥 获取 ${name} ${yearMonth} 数据...`);
        const monthData = await scraper.fetchHistoryData(lotCode, yearMonth);

        if (monthData && monthData.length > 0) {
          allRecords.push(...monthData);
          logger.info(`[DataCompletion] ✅ ${name} ${yearMonth}: ${monthData.length}期`);
        }
      } catch (error) {
        logger.error(`[DataCompletion] ❌ ${name} ${yearMonth} 获取失败:`, error.message);
      }

      // 等待200ms，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 保存到数据库
    if (allRecords.length > 0) {
      const savedCount = await this.saveRecordsToDatabase(lotCode, name, allRecords);
      logger.info(`[DataCompletion] 💾 ${name} 保存${savedCount}条新数据`);
      return savedCount;
    }

    return 0;
  }

  /**
   * 补全福彩数据
   */
  async fillChinaWelfareLottery(lotCode, name, year) {
    // CWLFreeScraper 导出单例，直接使用
    const scraper = (await import('../scrapers/CWLFreeScraper.js')).default;

    try {
      logger.info(`[DataCompletion] 📥 获取 ${name} ${year}年 数据...`);
      const yearData = await scraper.fetchHistoryData(lotCode, { year: String(year) });

      if (yearData && yearData.length > 0) {
        const savedCount = await this.saveRecordsToDatabase(lotCode, name, yearData);
        logger.info(`[DataCompletion] 💾 ${name} 保存${savedCount}条新数据`);
        return savedCount;
      }
    } catch (error) {
      logger.error(`[DataCompletion] ❌ ${name} ${year}年 获取失败:`, error.message);
    }

    return 0;
  }

  /**
   * 补全体彩数据
   */
  async fillChinaSportsLottery(lotCode, name, year) {
    const SportsLotteryScraper = (await import('../scrapers/SportsLotteryScraper.js')).default;
    const scraper = new SportsLotteryScraper();

    try {
      logger.info(`[DataCompletion] 📥 获取 ${name} ${year}年 数据...`);
      const yearData = await scraper.fetchHistoryData(lotCode, { year: String(year) });

      if (yearData && yearData.length > 0) {
        const savedCount = await this.saveRecordsToDatabase(lotCode, name, yearData);
        logger.info(`[DataCompletion] 💾 ${name} 保存${savedCount}条新数据`);
        return savedCount;
      }
    } catch (error) {
      logger.error(`[DataCompletion] ❌ ${name} ${year}年 获取失败:`, error.message);
    }

    return 0;
  }

  /**
   * 补全香港六合彩数据
   */
  async fillHongKongMarkSix(lotCode, name, year) {
    const HKJCScraper = (await import('../scrapers/HKJCScraper.js')).default;
    const scraper = new HKJCScraper();

    try {
      logger.info(`[DataCompletion] 📥 获取 ${name} ${year}年 数据...`);
      const yearData = await scraper.fetchHistoryData(String(year));

      if (yearData && yearData.length > 0) {
        const savedCount = await this.saveRecordsToDatabase(lotCode, name, yearData);
        logger.info(`[DataCompletion] 💾 ${name} 保存${savedCount}条新数据`);
        return savedCount;
      }
    } catch (error) {
      logger.error(`[DataCompletion] ❌ ${name} ${year}年 获取失败:`, error.message);
    }

    return 0;
  }

  /**
   * 保存记录到数据库（去重）
   */
  async saveRecordsToDatabase(lotCode, name, records) {
    const pool = database._initPool();
    let savedCount = 0;

    for (const record of records) {
      try {
        // 检查是否已存在
        const checkSql = `
          SELECT id FROM lottery_results
          WHERE lot_code = ? AND issue = ?
          LIMIT 1
        `;
        const [existing] = await pool.query(checkSql, [lotCode, record.issue]);

        if (existing && existing.length > 0) {
          // 已存在，跳过
          continue;
        }

        // 插入新记录
        const insertSql = `
          INSERT INTO lottery_results
          (lot_code, issue, draw_code, special_numbers, draw_time, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        `;

        await pool.query(insertSql, [
          lotCode,
          record.issue,
          record.draw_code || record.drawCode,
          record.special_numbers || '',
          record.draw_time || record.drawTime
        ]);

        savedCount++;

      } catch (error) {
        logger.error(`[DataCompletion] 保存失败: ${lotCode} ${record.issue}`, error.message);
      }
    }

    return savedCount;
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      totalChecks: this.stats.totalChecks,
      totalFilled: this.stats.totalFilled,
      lastRunResults: this.stats.lastRunResults
    };
  }

  /**
   * 保存补全历史记录
   */
  async saveHistory(record) {
    try {
      const pool = database._initPool();
      const sql = `
        INSERT INTO data_completion_history
        (run_time, duration, total_checked, total_filled, success_count, failed_count, skipped_count, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await pool.query(sql, [
        record.runTime,
        record.duration,
        record.totalChecked,
        record.totalFilled,
        record.successCount,
        record.failedCount,
        record.skippedCount,
        JSON.stringify(record.details)
      ]);

      logger.info('[DataCompletion] 📝 历史记录已保存');
    } catch (error) {
      logger.error('[DataCompletion] 保存历史记录失败:', error.message);
    }
  }

  /**
   * 启动时检查最近N天的数据完整性
   * @param {number} days - 检查最近N天
   */
  async runStartupCheck(days = 7) {
    logger.info(`[DataCompletion] 🔍 启动检查开始：检查最近${days}天的数据...`);

    try {
      const results = {
        success: [],
        failed: [],
        skipped: [],
        totalFilled: 0
      };

      // 获取需要检查的彩种
      const lotteriesToCheck = await this.getLotteriesToCheck();
      logger.info(`[DataCompletion] 📊 启动检查：需要检查的彩种数量: ${lotteriesToCheck.length}`);

      // 计算日期范围（最近N天，但不包括今天）
      const today = new Date();
      const datesToCheck = [];
      for (let i = 1; i <= days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        datesToCheck.push(date.toISOString().split('T')[0]);
      }

      logger.info(`[DataCompletion] 📅 启动检查：检查日期范围: ${datesToCheck[datesToCheck.length - 1]} ~ ${datesToCheck[0]}`);

      // 逐个彩种检查
      for (const lottery of lotteriesToCheck) {
        try {
          let lotteryFilled = 0;

          // 检查每个日期
          for (const date of datesToCheck) {
            const result = await this.checkAndFillDate(lottery, date);
            if (result.filled > 0) {
              lotteryFilled += result.filled;
              logger.info(`[DataCompletion] ✅ ${lottery.name} ${date}: 补全${result.filled}条数据`);
            }
          }

          if (lotteryFilled > 0) {
            results.success.push({
              lotCode: lottery.lotCode,
              name: lottery.name,
              filled: lotteryFilled,
              message: `启动检查补全${lotteryFilled}条`
            });
            results.totalFilled += lotteryFilled;
          } else {
            results.skipped.push({
              lotCode: lottery.lotCode,
              name: lottery.name,
              reason: '数据完整'
            });
          }

        } catch (error) {
          logger.error(`[DataCompletion] ❌ ${lottery.name} 启动检查失败: ${error.message}`);
          results.failed.push({
            lotCode: lottery.lotCode,
            name: lottery.name,
            error: error.message
          });
        }

        // 每个彩种之间等待500ms
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      logger.info(`[DataCompletion] ✅ 启动检查完成！`);
      logger.info(`[DataCompletion] 📊 统计: 成功${results.success.length}个 | 失败${results.failed.length}个 | 跳过${results.skipped.length}个 | 补全${results.totalFilled}条数据`);

      return results;

    } catch (error) {
      logger.error('[DataCompletion] 启动检查失败:', error.message);
      throw error;
    }
  }

  /**
   * 检查并补全指定彩种的指定日期数据
   * @param {Object} lottery - 彩种配置
   * @param {string} date - 日期 (YYYY-MM-DD)
   */
  async checkAndFillDate(lottery, date) {
    const pool = database._initPool();

    // 查询数据库中该日期的数据
    const [records] = await pool.query(
      `SELECT * FROM lottery_results
       WHERE lot_code = ?
         AND DATE(draw_time) = ?
       ORDER BY draw_time DESC`,
      [lottery.lotCode, date]
    );

    // 判断是否完整
    const expectedCount = this.getExpectedCount(lottery);
    const actualCount = records.length;
    const isComplete = this.isDataComplete(lottery, actualCount, expectedCount);

    if (isComplete) {
      return { filled: 0, skipped: true, reason: '数据完整' };
    }

    // 数据不完整，从官网补全
    logger.info(`[DataCompletion] 📊 ${lottery.name} ${date}: 数据不完整 (${actualCount}/${expectedCount}条)，开始补全...`);

    try {
      // 调用历史数据API触发爬取
      const newRecords = await this.fetchHistoryData(lottery, date);

      if (newRecords && newRecords.length > 0) {
        // 保存到数据库（替换模式）
        await database.saveHistoryData(lottery.lotCode, newRecords, { replaceExisting: true });
        const filled = newRecords.length - actualCount;
        return { filled: filled > 0 ? filled : newRecords.length, message: `补全成功` };
      }

      return { filled: 0, message: '无法获取数据' };

    } catch (error) {
      logger.error(`[DataCompletion] ❌ ${lottery.name} ${date} 补全失败: ${error.message}`);
      return { filled: 0, error: error.message };
    }
  }

  /**
   * 获取单日预期期数（用于启动检查）
   */
  getExpectedCount(lottery) {
    const { lotCode, source } = lottery;

    // 极速彩种：每75秒1期，一天1152期
    if (source === 'speedylot88') {
      return 1152;
    }

    // 幸运时时彩：每天120期
    if (source === 'luckysscai') {
      return 120;
    }

    // SG彩种：每5分钟1期，一天288期
    if (source === 'sglotteries') {
      return 288;
    }

    // AU彩种：每5分钟1期，一天288期
    if (source === 'auluckylotteries') {
      return 288;
    }

    // UK彩种：每2.5分钟1期，一天576期
    if (source === 'uklottos') {
      return 576;
    }

    // 幸运飞艇：每天180期
    if (source === 'luckylottoz') {
      return 180;
    }

    // 台湾宾果：每天202期
    if (lotCode === '100007') {
      return 202;
    }

    // 每天开奖的彩种：约1期
    const dailyLotteries = ['100003', '100005', '100006', '100008', '70002', '70004', '80002', '80003'];
    if (dailyLotteries.includes(lotCode)) {
      return 1;
    }

    // 默认返回1（低频彩种）
    return 1;
  }

  /**
   * 判断数据是否完整（用于启动检查）
   */
  isDataComplete(lottery, actualCount, expectedCount) {
    const { lotCode, source } = lottery;

    // 今天的数据判断
    const today = new Date().toISOString().split('T')[0];

    // 极速彩种、高频彩种：90%阈值
    if (source === 'speedylot88' || source === 'sglotteries' ||
        source === 'auluckylotteries' || source === 'uklottos' ||
        source === 'luckysscai' || source === 'luckylottoz') {
      return actualCount >= expectedCount * 0.9;
    }

    // 低频彩种：只要有数据就认为完整
    return actualCount > 0;
  }

  /**
   * 从官网获取历史数据（用于启动检查）
   */
  async fetchHistoryData(lottery, date) {
    const { lotCode, source } = lottery;

    try {
      if (source === 'speedylot88') {
        const SpeedyLot88Scraper = (await import('../scrapers/SpeedyLot88Scraper.js')).default;
        const scraperKey = this.getScraperKey(lotCode);
        if (scraperKey) {
          return await SpeedyLot88Scraper.fetchHistoryData(scraperKey, date);
        }
      } else if (source === 'sglotteries') {
        const SGLotteriesScraper = (await import('../scrapers/SGLotteriesScraper.js')).default;
        const scraperKey = this.getScraperKey(lotCode);
        if (scraperKey) {
          return await SGLotteriesScraper.fetchHistoryData(scraperKey, date);
        }
      } else if (source === 'auluckylotteries') {
        const AULuckyLotteriesScraper = (await import('../scrapers/AULuckyLotteriesScraper.js')).default;
        const scraperKey = this.getScraperKey(lotCode);
        const lotteryConfigManager = (await import('../managers/LotteryConfigManager.js')).default;
        const config = lotteryConfigManager.getLottery(lotCode);
        if (scraperKey && config) {
          return await AULuckyLotteriesScraper.fetchHistoryData(scraperKey, config.apiEndpoint, date);
        }
      } else if (source === 'luckysscai') {
        const LuckySscaiScraper = (await import('../scrapers/LuckySscaiScraper.js')).default;
        const scraperKey = this.getScraperKey(lotCode);
        if (scraperKey) {
          return await LuckySscaiScraper.fetchHistoryData(scraperKey, { date });
        }
      } else if (source === 'luckylottoz') {
        const LuckyLottozScraper = (await import('../scrapers/LuckyLottozScraper.js')).default;
        return await LuckyLottozScraper.fetchHistoryData(date);
      } else if (source === 'uklottos') {
        const UKLottosScraper = (await import('../scrapers/UKLottosScraper.js')).default;
        const ukLottosScraper = new UKLottosScraper();
        return await ukLottosScraper.fetchHistoryData(lotCode, { date });
      }

      throw new Error(`不支持的数据源: ${source}`);

    } catch (error) {
      logger.error(`[DataCompletion] 获取历史数据失败: ${lottery.name} ${date}`, error.message);
      throw error;
    }
  }

  /**
   * 获取彩种的scraperKey（用于API调用）
   */
  getScraperKey(lotCode) {
    const lotteryConfigManager = require('../managers/LotteryConfigManager.js').default;
    return lotteryConfigManager.getScraperKey(lotCode);
  }

  /**
   * 获取补全历史记录
   */
  async getHistory(options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;
      const pool = database._initPool();

      const sql = `
        SELECT * FROM data_completion_history
        ORDER BY run_time DESC
        LIMIT ? OFFSET ?
      `;

      const [records] = await pool.query(sql, [limit, offset]);

      // 解析JSON details
      records.forEach(record => {
        if (record.details && typeof record.details === 'string') {
          record.details = JSON.parse(record.details);
        }
      });

      return records;
    } catch (error) {
      logger.error('[DataCompletion] 获取历史记录失败:', error.message);
      return [];
    }
  }
}

// 单例模式
let instance = null;

export default {
  getInstance() {
    if (!instance) {
      instance = new DataCompletionService();
    }
    return instance;
  }
};
