import cron from 'node-cron';
import sourceManager from '../crawlers/SourceManager.js';
import database from '../db/Database.js';
import logger from '../utils/Logger.js';
import configManager from '../config/ConfigManager.js';
import { lotteryConfigs, crawlStrategies, monitoringConfig } from '../config/crawlerConfig.js';

/**
 * 爬虫调度器 - 管理所有彩种的定时爬取任务
 */
class CrawlerScheduler {
  constructor() {
    this.tasks = new Map();
    this.stats = {
      totalCrawls: 0,
      successfulCrawls: 0,
      failedCrawls: 0,
      lastCrawlTime: null
    };
    this.isRunning = false;
  }

  /**
   * 启动调度器
   */
  async start() {
    if (this.isRunning) {
      logger.warn('调度器已经在运行中');
      return;
    }

    logger.info('🚀 启动爬虫调度器...');

    // 测试数据库连接
    const dbConnected = await database.testConnection();
    if (!dbConnected) {
      logger.error('数据库连接失败，无法启动调度器');
      return;
    }

    this.isRunning = true;

    // 检查是否启用自动爬取（优先使用配置文件，其次使用环境变量）
    const autoEnabled = configManager.getAutoCrawlEnabled();

    if (!autoEnabled) {
      logger.info('⏸️ 自动爬取已禁用（监控模式）- 仅保留手动触发功能');
      logger.info('💡 提示：Web界面将显示主系统的数据');
      logger.success('✅ 爬虫调度器启动成功（监控模式）');
      return;
    }

    // 立即执行一次所有彩种的爬取
    await this.crawlAllLotteriesOnce();

    // 设置定时任务
    this.scheduleHighFrequencyLotteries();
    this.scheduleMediumFrequencyLotteries();
    this.scheduleLowFrequencyLotteries();

    // 设置健康检查
    this.scheduleHealthCheck();

    // 设置统计报告
    this.scheduleStatsReport();

    logger.success('✅ 爬虫调度器启动成功');
  }

  /**
   * 立即爬取所有彩种一次（启动时执行）
   */
  async crawlAllLotteriesOnce() {
    logger.info('📡 开始首次爬取所有彩种...');

    const promises = lotteryConfigs.map(config =>
      this.crawlLottery(config.lotCode, config.name)
    );

    await Promise.allSettled(promises);

    logger.success('✅ 首次爬取完成');
  }

  /**
   * 调度高频彩种（75秒、60秒）
   */
  scheduleHighFrequencyLotteries() {
    const highFreqLotteries = lotteryConfigs.filter(c => c.priority === 'high');

    logger.info(`⏱️ 调度 ${highFreqLotteries.length} 个高频彩种`);

    // 60秒彩种：每分钟爬取
    const sixtySecLotteries = highFreqLotteries.filter(c => c.interval === 60);
    if (sixtySecLotteries.length > 0) {
      const task = cron.schedule('*/60 * * * * *', async () => {
        for (const lottery of sixtySecLotteries) {
          await this.crawlLottery(lottery.lotCode, lottery.name);
        }
      });
      this.tasks.set('high-60s', task);
    }

    // 75秒彩种：每75秒爬取
    const seventyFiveSecLotteries = highFreqLotteries.filter(c => c.interval === 75);
    if (seventyFiveSecLotteries.length > 0) {
      const task = cron.schedule('*/75 * * * * *', async () => {
        for (const lottery of seventyFiveSecLotteries) {
          await this.crawlLottery(lottery.lotCode, lottery.name);
        }
      });
      this.tasks.set('high-75s', task);
    }
  }

  /**
   * 调度中频彩种（5分钟）
   */
  scheduleMediumFrequencyLotteries() {
    const mediumFreqLotteries = lotteryConfigs.filter(c => c.priority === 'medium');

    logger.info(`⏱️ 调度 ${mediumFreqLotteries.length} 个中频彩种`);

    const task = cron.schedule('*/5 * * * *', async () => {
      for (const lottery of mediumFreqLotteries) {
        await this.crawlLottery(lottery.lotCode, lottery.name);
      }
    });

    this.tasks.set('medium-5min', task);
  }

  /**
   * 调度低频彩种（每小时）
   */
  scheduleLowFrequencyLotteries() {
    const lowFreqLotteries = lotteryConfigs.filter(c => c.priority === 'low');

    logger.info(`⏱️ 调度 ${lowFreqLotteries.length} 个低频彩种`);

    const task = cron.schedule('0 * * * *', async () => {
      for (const lottery of lowFreqLotteries) {
        await this.crawlLottery(lottery.lotCode, lottery.name);
      }
    });

    this.tasks.set('low-hourly', task);
  }

  /**
   * 爬取单个彩种
   */
  async crawlLottery(lotCode, name) {
    try {
      this.stats.totalCrawls++;
      this.stats.lastCrawlTime = new Date();

      logger.debug(`📡 开始爬取: ${name} (${lotCode})`);

      // 获取实时数据
      const realtimeData = await sourceManager.fetchRealtimeData(lotCode);

      if (realtimeData) {
        // 保存到数据库
        const saved = await database.saveRealtimeData(lotCode, realtimeData);

        if (saved) {
          this.stats.successfulCrawls++;
          logger.debug(`✅ 爬取成功: ${name} - 期号 ${realtimeData.issue}`);

          // 智能补全：检查数据完整性
          await this.smartBackfill(lotCode, name);
        } else {
          this.stats.failedCrawls++;
          logger.warn(`⚠️ 保存失败: ${name}`);
        }
      } else {
        this.stats.failedCrawls++;
        logger.warn(`⚠️ 爬取失败: ${name}`);
      }
    } catch (error) {
      this.stats.failedCrawls++;
      logger.error(`❌ 爬取出错: ${name}`, error);
    }
  }

  /**
   * 智能补全历史数据
   * 检查数据完整性，如有需要自动获取历史数据
   */
  async smartBackfill(lotCode, name) {
    try {
      // 检查数据完整性
      const integrity = await database.checkDataIntegrity(lotCode);

      if (integrity.needsHistory) {
        logger.info(`🔍 检测到 ${name} (${lotCode}) ${integrity.reason}，触发智能补全`);

        // 延迟2秒执行，避免频繁调用API
        setTimeout(async () => {
          try {
            await this.crawlHistory(lotCode, name);
            logger.success(`✅ ${name} 智能补全完成`);
          } catch (error) {
            logger.error(`❌ ${name} 智能补全失败`, error);
          }
        }, 2000);
      } else {
        logger.debug(`✓ ${name} 数据完整 (${integrity.recordCount}条记录)`);
      }
    } catch (error) {
      logger.error(`❌ 智能补全检测失败: ${name}`, error);
    }
  }

  /**
   * 爬取历史数据
   */
  async crawlHistory(lotCode, name) {
    try {
      logger.info(`📚 开始爬取历史数据: ${name} (${lotCode})`);

      const historyData = await sourceManager.fetchHistoryData(lotCode, {
        pageNo: 1,
        pageSize: 50
      });

      if (historyData && historyData.length > 0) {
        const saved = await database.saveHistoryData(lotCode, historyData);

        if (saved) {
          logger.success(`✅ 历史数据保存成功: ${name} - ${historyData.length}条记录`);
        }
      }
    } catch (error) {
      logger.error(`❌ 历史数据爬取失败: ${name}`, error);
    }
  }

  /**
   * 健康检查定时任务
   */
  scheduleHealthCheck() {
    const task = cron.schedule('*/5 * * * *', async () => {
      await sourceManager.healthCheck();
    });

    this.tasks.set('health-check', task);
    logger.info('⏱️ 健康检查任务已调度（每5分钟）');
  }

  /**
   * 统计报告定时任务
   */
  scheduleStatsReport() {
    const task = cron.schedule('*/30 * * * *', () => {
      this.printStats();
    });

    this.tasks.set('stats-report', task);
    logger.info('⏱️ 统计报告任务已调度（每30分钟）');
  }

  /**
   * 打印统计信息
   */
  printStats() {
    const successRate = this.stats.totalCrawls > 0
      ? ((this.stats.successfulCrawls / this.stats.totalCrawls) * 100).toFixed(2)
      : 0;

    const sourcesStatus = sourceManager.getSourcesStatus();

    logger.info('📊 ========== 爬虫统计报告 ==========');
    logger.info(`总爬取次数: ${this.stats.totalCrawls}`);
    logger.info(`成功次数: ${this.stats.successfulCrawls}`);
    logger.info(`失败次数: ${this.stats.failedCrawls}`);
    logger.info(`成功率: ${successRate}%`);
    logger.info(`上次爬取: ${this.stats.lastCrawlTime}`);
    logger.info('数据源状态:');
    sourcesStatus.forEach(status => {
      logger.info(`  - ${status.name}: ${status.healthy ? '✅' : '❌'} (成功率: ${status.successRate})`);
    });
    logger.info('===================================');
  }

  /**
   * 停止调度器
   */
  stop() {
    logger.info('🛑 停止爬虫调度器...');

    this.tasks.forEach((task, name) => {
      task.stop();
      logger.debug(`停止任务: ${name}`);
    });

    this.tasks.clear();
    this.isRunning = false;

    logger.success('✅ 爬虫调度器已停止');
  }

  /**
   * 重启调度器（用于切换自动爬取模式）
   */
  async restart() {
    logger.info('🔄 重启爬虫调度器...');

    // 先停止所有任务
    this.stop();

    // 等待一小段时间确保所有任务已停止
    await new Promise(resolve => setTimeout(resolve, 500));

    // 重新启动
    await this.start();

    logger.success('✅ 爬虫调度器重启成功');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalCrawls > 0
        ? ((this.stats.successfulCrawls / this.stats.totalCrawls) * 100).toFixed(2) + '%'
        : '0%',
      activeTasks: this.tasks.size,
      isRunning: this.isRunning
    };
  }
}

export default new CrawlerScheduler();
