import database from './Database.js';
import logger from '../utils/Logger.js';
import lotteryConfigManager from '../managers/LotteryConfigManager.js';
import speedyLot88Scraper from '../scrapers/SpeedyLot88Scraper.js';
import sgLotteriesScraper from '../scrapers/SGLotteriesScraper.js';
import luckySscaiScraper from '../scrapers/LuckySscaiScraper.js';

/**
 * 历史数据回填工具
 * 按日期范围或期数范围智能回填历史数据
 */
class HistoryBackfill {
  constructor() {
    this.backfillTasks = new Map(); // 跟踪正在进行的回填任务
  }

  /**
   * 检查指定日期是否有数据
   */
  async checkDateHasData(lotCode, date) {
    try {
      const pool = database._initPool();

      // 由于数据可能跨时区，使用LIKE查询匹配日期部分
      const pattern = `${date}%`;

      logger.debug(`🔍 SQL查询: lotCode=${lotCode}, pattern=${pattern}`);

      const [rows] = await pool.query(`
        SELECT COUNT(*) as count
        FROM lottery_results
        WHERE lot_code = ?
          AND draw_time LIKE ?
      `, [lotCode, pattern]);

      const hasData = rows[0].count > 0;
      logger.info(`📊 检查日期数据: ${lotCode} ${date} - ${hasData ? '有' : '无'}数据 (${rows[0].count}条)`);
      return hasData;
    } catch (error) {
      logger.error(`检查日期数据失败: ${lotCode} ${date}`, error);
      return false;
    }
  }

  /**
   * 获取数据库中最早和最新的记录日期
   */
  async getDataRange(lotCode) {
    try {
      const pool = database._initPool();

      const [rows] = await pool.query(`
        SELECT
          MIN(draw_time) as earliest,
          MAX(draw_time) as latest,
          COUNT(*) as count
        FROM lottery_results
        WHERE lot_code = ?
      `, [lotCode]);

      if (rows[0].count === 0) {
        return null;
      }

      return {
        earliest: rows[0].earliest,
        latest: rows[0].latest,
        count: rows[0].count
      };
    } catch (error) {
      logger.error(`获取数据范围失败: ${lotCode}`, error);
      return null;
    }
  }

  /**
   * 按日期回填历史数据
   * @param {string} lotCode - 彩种代码
   * @param {string} targetDate - 目标日期 (YYYY-MM-DD)
   * @param {object} options - 选项
   */
  async backfillByDate(lotCode, targetDate, options = {}) {
    const {
      name = lotCode,
      maxPages = 100,  // 最多翻页次数
      pageSize = 100,  // 每页记录数
      force = false    // 是否强制重新爬取
    } = options;

    const taskKey = `${lotCode}-${targetDate}`;

    // 检查是否已有正在进行的任务
    if (this.backfillTasks.has(taskKey)) {
      logger.info(`📌 ${name} (${lotCode}) 的回填任务已在进行中`);
      return this.backfillTasks.get(taskKey);
    }

    // 如果已有数据且不是强制模式，直接返回
    if (!force) {
      const hasData = await this.checkDateHasData(lotCode, targetDate);
      if (hasData) {
        logger.info(`✅ ${name} (${lotCode}) 在 ${targetDate} 已有数据，无需回填`);
        return { success: true, message: '已有数据', fetchedRecords: 0 };
      }
    }

    // 创建回填任务
    const task = this._executeBackfill(lotCode, name, targetDate, maxPages, pageSize);
    this.backfillTasks.set(taskKey, task);

    // 任务完成后清理
    task.finally(() => {
      this.backfillTasks.delete(taskKey);
    });

    return task;
  }

  /**
   * 执行回填任务
   */
  async _executeBackfill(lotCode, name, targetDate, maxPages, pageSize) {
    try {
      logger.info(`🔄 开始回填 ${name} (${lotCode}) 在 ${targetDate} 的历史数据`);

      // 获取彩种配置
      const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
      if (!lotteryConfig) {
        throw new Error(`彩种配置不存在: ${lotCode}`);
      }

      const source = lotteryConfig.source || 'speedylot88';
      const scraperKey = lotteryConfigManager.getScraperKey(lotCode);

      // 检查数据源是否支持历史数据回填 (luckysscai不需要scraperKey)
      if (!scraperKey && source !== 'luckysscai') {
        throw new Error(`彩种 ${name} (${lotCode}) 缺少scraperKey配置`);
      }

      let historyData = null;

      if (source === 'speedylot88') {
        // SpeedyLot88 官网数据源
        logger.info(`📥 使用 SpeedyLot88 (${scraperKey}) 回填 ${targetDate} 的历史数据`);
        historyData = await speedyLot88Scraper.fetchHistoryData(scraperKey, targetDate);

      } else if (source === 'sglotteries') {
        // SG Lotteries 官网数据源
        logger.info(`📥 使用 SG Lotteries (${scraperKey}) 回填 ${targetDate} 的历史数据`);
        historyData = await sgLotteriesScraper.fetchHistoryData(scraperKey, targetDate);

      } else if (source === 'luckysscai') {
        // LuckySscai 官网数据源
        logger.info(`📥 使用 LuckySscai 回填 ${targetDate} 的历史数据`);
        historyData = await luckySscaiScraper.fetchFullDayHistory(targetDate);

      } else {
        throw new Error(`彩种 ${name} (${lotCode}) 不支持历史数据回填。数据源: ${source}`);
      }

      if (!historyData || historyData.length === 0) {
        logger.info(`📌 ${targetDate} 无历史数据`);
        return {
          success: true,
          message: '无数据',
          fetchedRecords: 0,
          date: targetDate
        };
      }

      // 保存数据到数据库
      await database.saveHistoryData(lotCode, historyData);
      const totalFetched = historyData.length;

      const result = {
        success: true,
        message: '回填成功',
        fetchedRecords: totalFetched,
        date: targetDate
      };

      logger.success(`✅ ${name} 回填完成: ${targetDate} 共${totalFetched}条记录`);
      return result;

    } catch (error) {
      logger.error(`❌ 回填失败: ${name} (${lotCode})`, error);
      throw error;
    }
  }

  /**
   * 批量回填最近N天的数据
   */
  async backfillRecentDays(lotCode, days, options = {}) {
    const { name = lotCode } = options;

    logger.info(`🔄 开始回填 ${name} 最近 ${days} 天的历史数据`);

    try {
      // 获取彩种配置
      const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
      if (!lotteryConfig) {
        throw new Error(`彩种配置不存在: ${lotCode}`);
      }

      const source = lotteryConfig.source || 'speedylot88';
      const scraperKey = lotteryConfigManager.getScraperKey(lotCode);

      // 检查数据源是否支持历史数据回填 (luckysscai不需要scraperKey)
      if (!scraperKey && source !== 'luckysscai') {
        throw new Error(`彩种 ${name} (${lotCode}) 缺少scraperKey配置`);
      }

      if (source !== 'speedylot88' && source !== 'sglotteries' && source !== 'luckysscai') {
        throw new Error(`彩种 ${name} (${lotCode}) 不支持历史数据回填。数据源: ${source}`);
      }

      let totalFetched = 0;

      // 逐日回填
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        try {
          logger.info(`📥 回填 ${dateStr}...`);

          let historyData = null;
          if (source === 'speedylot88') {
            historyData = await speedyLot88Scraper.fetchHistoryData(scraperKey, dateStr);
          } else if (source === 'sglotteries') {
            historyData = await sgLotteriesScraper.fetchHistoryData(scraperKey, dateStr);
          } else if (source === 'luckysscai') {
            historyData = await luckySscaiScraper.fetchFullDayHistory(dateStr);
          }

          if (historyData && historyData.length > 0) {
            await database.saveHistoryData(lotCode, historyData);
            totalFetched += historyData.length;
            logger.info(`✅ ${dateStr}: ${historyData.length} 条记录`);
          } else {
            logger.info(`⚠️ ${dateStr}: 无数据`);
          }

          // 延迟避免请求过快
          if (i < days - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          logger.error(`❌ ${dateStr} 回填失败:`, error.message);
        }
      }

      logger.success(`✅ ${name} 最近${days}天回填完成: 共${totalFetched}条记录`);

      return {
        success: true,
        fetchedRecords: totalFetched,
        pages: currentPage,
        oldestDate: oldestDate ? oldestDate.toISOString().split('T')[0] : null
      };

    } catch (error) {
      logger.error(`❌ 批量回填失败: ${name}`, error);
      throw error;
    }
  }

  /**
   * 检测缺失的日期范围
   * @param {string} lotCode - 彩种代码
   * @param {number} days - 检查最近N天
   * @returns {Array} 缺失的日期列表
   */
  async detectMissingDates(lotCode, days = 7) {
    try {
      const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
      if (!lotteryConfig) {
        logger.warn(`彩种配置不存在: ${lotCode}`);
        return [];
      }

      // 🎯 HKJC特殊处理：使用官方API对比，而非固定星期检测
      const isHKJC = lotCode === '60001';
      if (isHKJC) {
        return await this.detectMissingDatesForHKJC(days);
      }

      // 其他彩种：按日期检测
      const missingDates = [];
      const today = new Date();

      logger.info(`🔍 检测 ${lotteryConfig.name} 最近${days}天的缺失数据...`);

      // 从今天往前检查N天
      for (let i = 0; i < days; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];

        const hasData = await this.checkDateHasData(lotCode, dateStr);
        if (!hasData) {
          missingDates.push(dateStr);
        }
      }

      if (missingDates.length > 0) {
        logger.warn(`⚠️  ${lotteryConfig.name} 缺失${missingDates.length}天数据: ${missingDates.join(', ')}`);
      } else {
        logger.success(`✅ ${lotteryConfig.name} 数据完整`);
      }

      return missingDates;
    } catch (error) {
      logger.error(`检测缺失日期失败: ${lotCode}`, error);
      return [];
    }
  }

  /**
   * 🎯 HKJC特殊检测逻辑：使用官方API对比期号
   * 因为节假日会调整开奖时间，不能假设固定的周二四六
   *
   * @param {number} days - 检查最近N天
   * @returns {Array} 缺失的日期列表
   */
  async detectMissingDatesForHKJC(days = 7) {
    try {
      logger.info(`🔍 检测香港六合彩缺失数据（基于官方API，自动适配节假日调整）...`);

      // 1. 导入HKJCScraper获取官方数据
      const HKJCScraper = (await import('../scrapers/HKJCScraper.js')).default;
      const scraper = new HKJCScraper();

      // 2. 获取官方最近N期数据
      const officialData = await scraper.fetchHistoryData('60001', 20); // 获取20期，确保覆盖最近N天
      if (!officialData || officialData.length === 0) {
        logger.warn('⚠️  无法获取官方数据，跳过检测');
        return [];
      }

      // 3. 过滤最近N天的官方数据
      const nDaysAgo = new Date();
      nDaysAgo.setDate(nDaysAgo.getDate() - days);
      const nDaysAgoStr = nDaysAgo.toISOString().split('T')[0];

      const recentOfficialData = officialData.filter(item => {
        const drawDate = item.opentime.split(' ')[0]; // 提取日期部分
        return drawDate >= nDaysAgoStr;
      });

      logger.info(`📊 官方API返回最近${days}天内的数据: ${recentOfficialData.length}期`);

      // 4. 检查每期数据是否在数据库中
      const missingDates = [];
      const pool = database._initPool();

      for (const officialItem of recentOfficialData) {
        const period = officialItem.period;
        const drawDate = officialItem.opentime ? officialItem.opentime.split(' ')[0] : null;

        if (!drawDate) {
          logger.warn(`⚠️  跳过无效数据: 期号 ${period} 缺少开奖时间`);
          continue;
        }

        // 查询数据库是否有该期数据
        const [rows] = await pool.query(
          'SELECT COUNT(*) as count FROM lottery_results WHERE lot_code = ? AND issue = ?',
          ['60001', period]
        );

        if (rows[0].count === 0) {
          missingDates.push(drawDate);
          logger.warn(`⚠️  缺失期号: ${period} (${drawDate})`);
        } else {
          logger.debug(`✅ 期号 ${period} (${drawDate}) 数据库已有`);
        }
      }

      // 5. 返回结果
      if (missingDates.length > 0) {
        logger.warn(`⚠️  香港六合彩 缺失 ${missingDates.length} 天开奖数据:\n${missingDates.join(', ')}`);
      } else {
        logger.success(`✅ 香港六合彩 数据完整（最近${days}天）`);
      }

      return missingDates;

    } catch (error) {
      logger.error('❌ HKJC缺失检测失败:', error.message);
      logger.error('错误堆栈:', error.stack);
      return [];
    }
  }

  /**
   * 自动回填所有缺失的日期
   * @param {string} lotCode - 彩种代码
   * @param {number} days - 检查最近N天
   */
  async autoBackfillMissingDates(lotCode, days = 7) {
    try {
      const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
      if (!lotteryConfig) {
        throw new Error(`彩种配置不存在: ${lotCode}`);
      }

      logger.info(`🔄 开始自动回填 ${lotteryConfig.name} 缺失的数据...`);

      // 检测缺失的日期
      const missingDates = await this.detectMissingDates(lotCode, days);

      if (missingDates.length === 0) {
        return {
          success: true,
          message: '数据完整，无需回填',
          missingDates: [],
          totalFetched: 0
        };
      }

      // 回填每个缺失的日期
      const results = [];
      let totalFetched = 0;

      for (const date of missingDates) {
        logger.info(`📅 回填日期: ${date}`);

        try {
          const result = await this.backfillByDate(lotCode, date, {
            name: lotteryConfig.name,
            maxPages: 50,
            pageSize: 100
          });

          results.push({ date, success: true, ...result });
          totalFetched += result.fetchedRecords || 0;

          // 延迟避免请求过快
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error(`回填失败: ${date}`, error);
          results.push({ date, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;

      logger.success(`✅ ${lotteryConfig.name} 自动回填完成: ${successCount}/${missingDates.length}天, 共${totalFetched}条记录`);

      return {
        success: true,
        message: `回填完成: ${successCount}/${missingDates.length}天`,
        missingDates,
        results,
        totalFetched
      };
    } catch (error) {
      logger.error(`自动回填失败: ${lotCode}`, error);
      throw error;
    }
  }

  /**
   * 批量自动回填所有彩种的缺失数据
   * @param {number} days - 检查最近N天
   */
  async autoBackfillAllLotteries(days = 7) {
    try {
      const lotteries = lotteryConfigManager.getEnabledLotteries();
      logger.info(`🔄 开始批量回填 ${lotteries.length} 个彩种的缺失数据...`);

      const results = [];

      for (const lottery of lotteries) {
        try {
          logger.info(`\n📦 处理: ${lottery.name} (${lottery.lotCode})`);

          const result = await this.autoBackfillMissingDates(lottery.lotCode, days);
          results.push({
            lotCode: lottery.lotCode,
            name: lottery.name,
            ...result
          });

          // 延迟避免请求过快
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          logger.error(`处理失败: ${lottery.name}`, error);
          results.push({
            lotCode: lottery.lotCode,
            name: lottery.name,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const totalFetched = results.reduce((sum, r) => sum + (r.totalFetched || 0), 0);

      logger.success(`\n✅ 批量回填完成: ${successCount}/${lotteries.length}个彩种, 共${totalFetched}条记录`);

      return {
        success: true,
        processedLotteries: lotteries.length,
        successCount,
        totalFetched,
        results
      };
    } catch (error) {
      logger.error('批量回填失败', error);
      throw error;
    }
  }

  /**
   * 获取正在进行的回填任务
   */
  getActiveTasks() {
    return Array.from(this.backfillTasks.keys());
  }
}

export default new HistoryBackfill();
