import dotenv from 'dotenv';
import logger from './utils/Logger.js';
import fixedScheduler from './schedulers/CrawlerScheduler.js';
import dynamicScheduler from './schedulers/DynamicCrawlerScheduler.js';
import continuousScheduler from './schedulers/ContinuousPollingScheduler.js';
import officialSourceManager from './managers/OfficialSourceManager.js';
import lotteryConfigManager from './managers/LotteryConfigManager.js';
import WebServer from './web/WebServer.js';
import alertService from './alerts/AlertService.js';
import database from './db/Database.js';
import timeZoneHelper from './utils/TimeZoneHelper.js';
import cwlDomainManager from './managers/CWLDomainManager.js';
import dataCompletionService from './services/DataCompletionService.js';

// 加载环境变量
dotenv.config();

// 根据配置选择调度器（默认使用持续轮询调度器）
const SCHEDULER_MODE = process.env.SCHEDULER_MODE || 'continuous'; // 'fixed', 'dynamic', 或 'continuous'
const scheduler =
  SCHEDULER_MODE === 'fixed' ? fixedScheduler :
  SCHEDULER_MODE === 'dynamic' ? dynamicScheduler :
  continuousScheduler;

// 导出调度器和模式供WebServer使用
export { scheduler, fixedScheduler, dynamicScheduler, continuousScheduler, SCHEDULER_MODE };

/**
 * 爬虫服务主入口
 */
class CrawlerService {
  constructor() {
    this.startTime = new Date();
    this.webServer = new WebServer(process.env.WEB_PORT || process.env.PORT || 4000);
  }

  /**
   * 启动服务
   */
  async start() {
    try {
      logger.info('');
      logger.info('=========================================');
      logger.info('   彩票爬虫系统 - 中等架构方案');
      logger.info('=========================================');
      logger.info(`启动时间: ${this.startTime.toLocaleString('zh-CN')}`);
      logger.info(`运行模式: ${process.env.CRAWLER_MODE || 'development'}`);
      logger.info(`调度器模式: ${
        SCHEDULER_MODE === 'dynamic' ? '动态倒计时调度' :
        SCHEDULER_MODE === 'fixed' ? '固定间隔调度' :
        '持续轮询调度(期号变化检测)'
      }`);
      logger.info(`日志级别: ${process.env.LOG_LEVEL || 'info'}`);
      logger.info('=========================================');
      logger.info('');

      // 🔧 验证时区配置
      await this.verifyTimezone();

      // 启动Web管理界面
      await this.webServer.start();

      // 初始化告警系统
      await this.initializeAlertSystem();

      // 🔥 注入告警服务到域名管理器并启动健康检查
      cwlDomainManager.setAlertService(alertService);
      cwlDomainManager.startHealthCheck();
      logger.info('🌐 福彩域名管理器健康检查已启动');

      // 启动官方数据源管理器的自动健康检查
      officialSourceManager.startHealthCheck();

      // 启动调度器
      await scheduler.start();

      // 启动数据自动补全服务（每天凌晨2点执行）
      await this.initializeDataCompletion();

      // 监听进程退出信号
      this.setupSignalHandlers();

      logger.success('🎉 爬虫服务启动完成！');
      logger.info('');
      logger.info('📌 访问管理界面: http://localhost:' + (process.env.WEB_PORT || process.env.PORT || 4000));
      logger.info('');
    } catch (error) {
      logger.error('❌ 爬虫服务启动失败', error);
      process.exit(1);
    }
  }

  /**
   * 🔧 验证时区配置和时间同步
   */
  async verifyTimezone() {
    try {
      logger.info('🕐 检测系统时区配置...');

      // 1. 显示当前时区信息
      const systemTime = new Date();
      const mysqlTime = timeZoneHelper.now();

      logger.info(`   系统时间: ${systemTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
      logger.info(`   MySQL格式: ${mysqlTime}`);
      logger.info(`   时区偏移: UTC${timeZoneHelper.getOffsetHours()}`);

      // 2. 测试数据库时间同步
      const dbConnected = await database.testConnection();
      if (dbConnected) {
        logger.success('✅ 数据库时间同步正常');
      } else {
        logger.warn('⚠️ 数据库连接失败，无法验证时间同步');
      }

      // 3. 测试时区转换功能
      const testTime = 'Tuesday,Dec 23,2025 06:26:45 pm';
      const converted = timeZoneHelper.toMySQLDateTime(testTime);
      logger.debug(`   时区转换测试: "${testTime}" → "${converted}"`);

      // 4. 检测并警告可能的UTC时间问题
      const autoFixResult = timeZoneHelper.autoFixUTC('2025-12-23 10:00:00');
      if (autoFixResult.fixed) {
        logger.warn(`⚠️ 检测到历史UTC时间数据，建议运行数据库时间修复`);
      }

      logger.success('✅ 时区配置验证完成');
      logger.info('');

    } catch (error) {
      logger.error('❌ 时区验证失败', error);
      // 不中断启动，但记录警告
      logger.warn('⚠️ 时区验证失败，但服务将继续启动');
    }
  }

  /**
   * 初始化数据自动补全服务
   */
  async initializeDataCompletion() {
    try {
      const service = dataCompletionService.getInstance();

      // 启动定时任务（每天凌晨2点执行）
      const cronExpression = process.env.DATA_COMPLETION_CRON || '0 2 * * *';

      // 🔥 启动选项
      const options = {
        runOnStartup: process.env.DATA_COMPLETION_RUN_ON_STARTUP !== 'false', // 默认true
        startupCheckDays: parseInt(process.env.DATA_COMPLETION_STARTUP_DAYS) || 7 // 默认检查最近7天
      };

      service.start(cronExpression, options);

      logger.info(`📊 数据自动补全服务已启动 (Cron: ${cronExpression})`);
      if (options.runOnStartup) {
        logger.info(`📊 启动检查已启用：将检查最近${options.startupCheckDays}天的数据完整性`);
      }
    } catch (error) {
      logger.error('数据自动补全服务初始化失败，但不影响主服务运行', error);
    }
  }

  /**
   * 初始化告警系统
   */
  async initializeAlertSystem() {
    try {
      // 初始化告警服务
      await alertService.initialize({
        email: {
          enabled: process.env.ALERT_EMAIL_ENABLED === 'true'
        },
        dingtalk: {
          enabled: process.env.ALERT_DINGTALK_ENABLED === 'true'
        },
        wechat: {
          enabled: process.env.ALERT_WECHAT_ENABLED === 'true'
        }
      });

      // 注册上下文提供者
      alertService.registerContextProvider('scheduler', async () => ({
        scheduler: scheduler.getStats(),
        autoCrawlEnabled: true
      }));

      alertService.registerContextProvider('dataSources', async () => ({
        dataSources: officialSourceManager.getSources()
      }));

      alertService.registerContextProvider('database', async () => {
        try {
          const connected = await database.testConnection();
          return { database: { connected } };
        } catch (error) {
          return { database: { connected: false, error: error.message } };
        }
      });

      // 注册彩种更新状态提供者（检测彩种停更）
      alertService.registerContextProvider('lotteryUpdateStatus', async () => {
        const lotteries = lotteryConfigManager.getEnabledLotteries();

        // 🎯 异步获取每个彩种的实时倒计时
        const updateStatusPromises = lotteries.map(async (lottery) => {
          const lastTimestamp = scheduler.lastDrawTimestamps?.get(lottery.lotCode);
          let countdown = -1;

          // 🚀 从官方数据源获取实时倒计时
          try {
            const realtimeData = await multiSourceDataManager.fetchLotteryData(lottery.lotCode);
            if (realtimeData && realtimeData.success && realtimeData.data) {
              countdown = realtimeData.data.officialCountdown || -1;
            }
          } catch (error) {
            // 获取失败时使用-1（不影响告警逻辑）
          }

          return {
            lotCode: lottery.lotCode,
            name: lottery.name,
            lastUpdateTime: lastTimestamp || Date.now(), // 如果没有记录，使用当前时间（避免误报）
            salesDayStart: lottery.salesDayStart, // 销售开始时间（如"13:09"）
            salesDayEnd: lottery.salesDayEnd, // 销售结束时间（如"04:04"）
            tags: lottery.tags || [], // ✅ 添加标签（用于识别低频彩）
            countdown: countdown // ✅ 添加官方倒计时（用于智能告警）
          };
        });

        const updateStatus = await Promise.all(updateStatusPromises);
        return { lotteryUpdateStatus: updateStatus };
      });

      // 注册期号连续性检测提供者（检测期号跳跃）
      alertService.registerContextProvider('periodGaps', async () => {
        const gaps = [];
        try {
          const lotteries = lotteryConfigManager.getEnabledLotteries();

          for (const lottery of lotteries) {
            try {
              // 获取最近两条数据
              const recentData = await database.query(
                `SELECT expect FROM lottery_data WHERE lotCode = ? ORDER BY opentime DESC LIMIT 2`,
                [lottery.lotCode]
              );

              if (recentData && recentData.length === 2) {
                const currentPeriod = parseInt(recentData[0].expect);
                const lastPeriod = parseInt(recentData[1].expect);

                // 检查期号是否连续（差值应该为1）
                // ⚠️ 注意：有些彩种期号不是简单的+1递增（如20251227-036格式），需要特殊处理
                if (!isNaN(currentPeriod) && !isNaN(lastPeriod)) {
                  const diff = currentPeriod - lastPeriod;
                  if (diff > 1) {
                    gaps.push({
                      lotCode: lottery.lotCode,
                      name: lottery.name,
                      lastPeriod: lastPeriod,
                      currentPeriod: currentPeriod,
                      gapSize: diff - 1
                    });
                  }
                }
              }
            } catch (err) {
              logger.debug(`期号连续性检测单个彩种失败: ${lottery.name}(${lottery.lotCode})`, err.message);
            }
          }
        } catch (error) {
          logger.error('期号连续性检测失败', error.message || error);
        }
        return { periodGaps: gaps };
      });

      // 注册倒计时异常检测提供者（检测倒计时跳跃）
      alertService.registerContextProvider('countdownAnomalies', async () => {
        const anomalies = [];
        // 这个检测需要在调度器中实现倒计时历史记录
        // 暂时返回空数组
        // TODO: 在调度器中记录倒计时历史，检测异常跳跃
        return { countdownAnomalies: anomalies };
      });

      // 启动告警检查（每分钟检查一次）
      await alertService.start(60000);

      logger.info('📢 告警系统已启动');
    } catch (error) {
      logger.error('告警系统初始化失败，但不影响主服务运行', error);
    }
  }

  /**
   * 设置信号处理
   */
  setupSignalHandlers() {
    // 优雅退出
    const gracefulShutdown = async (signal) => {
      logger.info(`\n收到 ${signal} 信号，准备关闭服务...`);

      // 停止数据补全服务
      try {
        const service = dataCompletionService.getInstance();
        service.stop();
      } catch (error) {
        logger.error('停止数据补全服务失败', error);
      }

      // 停止告警服务
      alertService.stop();

      // 停止数据源健康检查
      officialSourceManager.stopHealthCheck();

      // 停止调度器
      scheduler.stop();

      // 停止Web服务器
      await this.webServer.stop();

      // 打印最终统计
      const stats = scheduler.getStats();
      logger.info('最终统计:');
      logger.info(JSON.stringify(stats, null, 2));

      const runtime = (new Date() - this.startTime) / 1000 / 60;
      logger.info(`总运行时间: ${runtime.toFixed(2)} 分钟`);

      logger.success('👋 爬虫服务已关闭');
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // 未捕获的异常
    process.on('uncaughtException', (error) => {
      logger.error('未捕获的异常:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('未处理的Promise拒绝:', reason);
    });
  }
}

// 启动服务
const service = new CrawlerService();
service.start();
