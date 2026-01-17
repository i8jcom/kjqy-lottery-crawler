import dotenv from 'dotenv';
import logger from '../utils/Logger.js';
import dynamicScheduler from '../schedulers/DynamicCrawlerScheduler.js';
import fixedScheduler from '../schedulers/CrawlerScheduler.js';
import continuousScheduler from '../schedulers/ContinuousPollingScheduler.js';
import database from '../db/Database.js';

dotenv.config();

/**
 * 调度器相关API
 */
class SchedulerAPI {
  constructor() {
    this.schedulerMode = process.env.SCHEDULER_MODE || 'continuous';
    this.scheduler =
      this.schedulerMode === 'fixed' ? fixedScheduler :
      this.schedulerMode === 'dynamic' ? dynamicScheduler :
      continuousScheduler;
  }

  /**
   * 获取调度器模式和状态
   */
  getSchedulerStatus() {
    const stats = this.scheduler.getStats();

    const modeNames = {
      'fixed': '固定间隔调度',
      'dynamic': '动态倒计时调度',
      'continuous': '持续轮询调度(期号检测)'
    };

    return {
      mode: this.schedulerMode,
      modeName: modeNames[this.schedulerMode] || '未知模式',
      isRunning: this.scheduler.isRunning,
      ...stats
    };
  }

  /**
   * 计算系统时间校准值
   * 使用爬虫源返回的 serverTime 与我们的系统时间对比来计算偏移
   */
  calculateTimeDrift() {
    try {
      const stats = dynamicScheduler.getStats();

      // 查找最近爬取成功的彩种
      for (const lottery of stats.lotteries) {
        if (lottery.lastCrawlTime && lottery.serverTime) {
          const lastCrawl = new Date(lottery.lastCrawlTime).getTime();
          const timeSinceCrawl = Date.now() - lastCrawl;

          // 只使用30秒内刚爬取的数据来校准（保证新鲜度）
          if (timeSinceCrawl < 30000) {
            // 爬虫源的服务器时间
            const crawlerServerTime = new Date(lottery.serverTime).getTime();
            // 我们系统当前时间
            const ourSystemTime = Date.now();

            // 考虑爬取时刻到现在的时间流逝
            const elapsedSinceCrawl = ourSystemTime - lastCrawl;
            const adjustedCrawlerTime = crawlerServerTime + elapsedSinceCrawl;

            // 计算时间差（正数=我们的时间慢了）
            const drift = adjustedCrawlerTime - ourSystemTime;

            logger.info(`⏰ 时间校准 [${lottery.name}]: 爬虫源时间=${new Date(adjustedCrawlerTime).toLocaleTimeString('zh-CN')}, 系统时间=${new Date(ourSystemTime).toLocaleTimeString('zh-CN')}, 偏移=${Math.round(drift/1000)}秒`);

            if (Math.abs(drift) > 2000) {
              logger.info(`✅ 应用时间校准: 偏移 ${Math.round(drift/1000)} 秒`);
              return drift;
            }

            return 0; // 找到新鲜数据，即使差值<2秒也返回0
          }
        }
      }
    } catch (error) {
      logger.debug('时间校准失败，使用系统时间', error.message);
    }

    return 0; // 默认无偏移
  }

  /**
   * 获取动态调度器的详细信息（每个彩种的下次爬取时间）
   */
  getDynamicSchedulerDetails() {
    if (this.schedulerMode === 'continuous') {
      // Continuous模式：返回统一格式的调度器统计
      const stats = this.scheduler.getStats();
      return {
        mode: this.schedulerMode,
        modeName: '智能动态调度',
        isRunning: true,
        activeLotteries: stats.lotteries ? stats.lotteries.length : 0,
        totalCrawls: stats.global?.totalPolls || 0,
        successfulCrawls: (stats.global?.totalPolls || 0) - (stats.global?.errors || 0),
        failedCrawls: stats.global?.errors || 0,
        successRate: stats.global?.successRate || '0%',
        queueLength: 0,
        activeCrawls: 0,
        lotteries: stats.lotteries || [],
        global: stats.global,
        serverTime: Date.now(),
        timeDrift: 0
      };
    }

    if (this.schedulerMode !== 'dynamic') {
      return {
        mode: this.schedulerMode,
        message: '当前使用固定间隔调度模式'
      };
    }

    const stats = dynamicScheduler.getStats();

    // 计算系统时间校准值（基于最新爬取数据）
    const timeDrift = this.calculateTimeDrift();

    // 计算每个彩种的剩余时间
    // 注意：使用校准后的时间重新计算倒计时，确保与官方时间同步
    const now = Date.now() + timeDrift;
    const lotteriesWithCountdown = stats.lotteries.map(lottery => {
      let countdown = 0;
      let status = 'pending';

      // 优先检查是否正在爬取中（来自调度器状态）
      if (lottery.isCrawling) {
        status = 'crawling';
      }

      if (lottery.nextDrawTime) {
        // 基于我们的服务器时间重新计算精确倒计时
        // 将 "2025-12-22 15:02:15" 转换为 "2025-12-22T15:02:15" 确保正确解析
        const formattedTime = lottery.nextDrawTime.replace(' ', 'T');
        const nextTime = new Date(formattedTime).getTime();
        // 允许负数倒计时，用于判断是否超时
        const actualCountdown = Math.round((nextTime - now) / 1000);
        // 显示用的倒计时不显示负数
        countdown = Math.max(0, actualCountdown);

        // 如果不是正在爬取，则根据倒计时判断状态
        if (!lottery.isCrawling) {
          // 优化策略：当倒计时<=10秒时，始终显示scheduled
          // 这样可以避免开奖前后由于时间偏移导致的状态闪烁
          if (countdown <= 10) {
            status = 'scheduled';
          } else if (actualCountdown >= -10) {
            // actualCountdown >= -10: 包括开奖后10秒内（定时器触发+重试+网络延迟）
            status = 'scheduled';
          } else {
            // actualCountdown < -10: 超时10秒以上，可能延迟或等待重试
            status = 'ready';
          }
        }
      }

      return {
        ...lottery,
        countdown,
        status,
        nextDrawTimeFormatted: lottery.nextDrawTime
          ? new Date(lottery.nextDrawTime).toLocaleString('zh-CN', {
              hour12: false,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })
          : '-',
        lastCrawlTimeFormatted: lottery.lastCrawlTime
          ? new Date(lottery.lastCrawlTime).toLocaleString('zh-CN', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })
          : '-'
      };
    });

    // 按倒计时排序
    lotteriesWithCountdown.sort((a, b) => {
      if (a.countdown === 0 && b.countdown === 0) return 0;
      if (a.countdown === 0) return 1;
      if (b.countdown === 0) return -1;
      return a.countdown - b.countdown;
    });

    return {
      mode: this.schedulerMode,
      modeName: '动态倒计时调度',
      ...stats,
      lotteries: lotteriesWithCountdown,
      timestamp: new Date().toISOString(),
      serverTime: Date.now() + timeDrift, // 校准后的服务器时间
      timeDrift: timeDrift // 时间偏移量（毫秒）
    };
  }

  /**
   * 注册Express路由
   */
  registerRoutes(app) {
    // API: 获取调度器状态
    app.get('/api/scheduler/status', (req, res) => {
      try {
        const status = this.getSchedulerStatus();
        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        logger.error('获取调度器状态失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取动态调度器详细信息
    app.get('/api/scheduler/details', (req, res) => {
      try {
        const details = this.getDynamicSchedulerDetails();
        res.json({
          success: true,
          data: details
        });
      } catch (error) {
        logger.error('获取调度器详情失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 🎯 API: 获取新期号检测时间统计
    app.get('/api/scheduler/detection-stats', (req, res) => {
      try {
        if (this.schedulerMode !== 'continuous') {
          return res.json({
            success: false,
            message: '检测时间统计仅在持续轮询调度模式下可用'
          });
        }

        const stats = this.scheduler.getStats();

        // 提取检测统计数据
        const detectionStats = stats.detectionStats || [];

        // 计算整体统计
        const summary = {
          totalLotteries: detectionStats.length,
          totalDetections: detectionStats.reduce((sum, s) => sum + s.totalDetections, 0),
          avgCountdownOverall: detectionStats.length > 0
            ? (detectionStats.reduce((sum, s) => sum + parseFloat(s.avgCountdown || 0), 0) / detectionStats.length).toFixed(1)
            : 0,
          fastestDetection: Math.min(...detectionStats.map(s => s.minCountdown).filter(c => c !== null)),
          slowestDetection: Math.max(...detectionStats.map(s => s.maxCountdown).filter(c => c !== null))
        };

        res.json({
          success: true,
          data: {
            summary,
            lotteries: detectionStats,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        logger.error('获取检测统计失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 🎯 API: 获取单个彩种的详细检测记录
    app.get('/api/scheduler/detection-stats/:lotCode', (req, res) => {
      try {
        if (this.schedulerMode !== 'continuous') {
          return res.json({
            success: false,
            message: '检测时间统计仅在持续轮询调度模式下可用'
          });
        }

        const { lotCode } = req.params;
        const detectionStats = continuousScheduler.detectionStats.get(lotCode);

        if (!detectionStats) {
          return res.status(404).json({
            success: false,
            message: `未找到彩种 ${lotCode} 的检测统计数据`
          });
        }

        res.json({
          success: true,
          data: detectionStats
        });
      } catch (error) {
        logger.error('获取彩种检测统计失败', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    logger.info('✅ 调度器API已注册');
  }
}

export default new SchedulerAPI();
