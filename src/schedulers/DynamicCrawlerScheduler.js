import sourceManager from '../crawlers/SourceManager.js';
import database from '../db/Database.js';
import logger from '../utils/Logger.js';
import configManager from '../config/ConfigManager.js';
import { lotteryConfigs } from '../config/crawlerConfig.js';
import multiSourceDataManager from '../services/MultiSourceDataManager.js';
import timeZoneHelper from '../utils/TimeZoneHelper.js';

/**
 * 动态爬虫调度器 - 基于开奖倒计时的智能调度
 * 每个彩种根据实际开奖时间动态调度，而不是固定间隔
 */
class DynamicCrawlerScheduler {
  constructor() {
    this.timers = new Map(); // 存储每个彩种的定时器
    this.lotteryStates = new Map(); // 存储每个彩种的状态
    this.stats = {
      totalCrawls: 0,
      successfulCrawls: 0,
      failedCrawls: 0,
      lastCrawlTime: null
    };
    this.isRunning = false;
    this.crawlQueue = []; // 爬取队列
    this.activeCrawls = 0; // 当前正在爬取的任务数
    this.timeDrift = 0; // 时间偏移（毫秒），正数表示系统时间慢了

    // 配置参数
    this.config = {
      drawDelay: -5000,         // 普通彩种：开奖后5秒再爬取
      speedyDrawDelay: 1000,    // 🚀🚀 极速彩种：开奖前1秒开始轮询（最佳时机）
      speedyPollingInterval: 300, // 🚀 极速彩种轮询间隔300ms（更频繁）
      speedyPollingCount: 15,   // 🚀 轮询次数（开奖前1秒开始，每300ms一次，共15次 = 4.5秒覆盖T-1到T+3.5）
      maxCountdown: 259200000,  // 最大倒计时3天（支持低频官方彩）
      fallbackInterval: 60000,  // 回退间隔60秒（当倒计时异常时）
      maxRetries: 5,            // 🚀 增加重试次数到5次，提高成功率
      retryDelay: 1500,         // 🚀 重试间隔1.5秒（快速重试获取新数据）
      longIntervalThreshold: 3600000, // 1小时，超过此时间视为长间隔彩种
      longIntervalCheckInterval: 1800000, // 长间隔彩种每30分钟检查一次
      maxConcurrent: 30,        // 最大并发爬取数（提高到30，确保倒计时结束时能立即执行）
      initBatchSize: 5,         // 初始化批次大小
      initBatchDelay: 1000,     // 批次之间的延迟(毫秒)
      staleDataMaxRetries: 8,   // 🚀 旧数据最大重试次数（8次 * 400ms = 3.2秒）
      staleDataRetryInterval: 400  // 🚀 旧数据重试间隔400ms（极速重试获取新数据）
    };
  }

  /**
   * 启动调度器
   */
  async start() {
    if (this.isRunning) {
      logger.warn('动态调度器已经在运行中');
      return;
    }

    logger.info('🚀 启动动态爬虫调度器（基于倒计时）...');

    // 测试数据库连接
    const dbConnected = await database.testConnection();
    if (!dbConnected) {
      logger.error('数据库连接失败，无法启动调度器');
      return;
    }

    this.isRunning = true;

    // 检查是否启用自动爬取
    const autoEnabled = configManager.getAutoCrawlEnabled();

    if (!autoEnabled) {
      logger.info('⏸️ 自动爬取已禁用（监控模式）');
      logger.success('✅ 动态调度器启动成功（监控模式）');
      return;
    }

    // 初始化所有彩种的动态调度
    await this.initializeAllLotteries();

    logger.success('✅ ✅ 动态爬虫调度器启动成功');
    logger.info(`📌 调度模式: 基于开奖倒计时的智能调度`);
    logger.info(
      `⏰ 极速彩种策略: 开奖前${this.config.speedyDrawDelay / 1000}秒开始 + ` +
      `高频轮询(每${this.config.speedyPollingInterval}ms × ${this.config.speedyPollingCount}次) = ` +
      `覆盖T-${this.config.speedyDrawDelay / 1000}到T+${(this.config.speedyPollingCount * this.config.speedyPollingInterval - this.config.speedyDrawDelay) / 1000}秒`
    );
    logger.info(`⏰ 普通彩种延迟: 开奖后${Math.abs(this.config.drawDelay / 1000)}秒`);
  }

  /**
   * 初始化所有彩种的动态调度（分批初始化，避免并发过高）
   */
  async initializeAllLotteries() {
    logger.info('📡 初始化所有彩种的动态调度...');

    const { initBatchSize, initBatchDelay } = this.config;
    let successCount = 0;

    // 分批处理
    for (let i = 0; i < lotteryConfigs.length; i += initBatchSize) {
      const batch = lotteryConfigs.slice(i, i + initBatchSize);

      const promises = batch.map(config =>
        this.initializeLottery(config.lotCode, config.name, config.interval)
      );

      const results = await Promise.allSettled(promises);
      successCount += results.filter(r => r.status === 'fulfilled').length;

      // 批次之间延迟，避免瞬间并发过高
      if (i + initBatchSize < lotteryConfigs.length) {
        await new Promise(resolve => setTimeout(resolve, initBatchDelay));
      }
    }

    logger.success(`✅ 初始化完成: ${successCount}/${lotteryConfigs.length} 个彩种`);

    // 启动队列处理器
    this.startQueueProcessor();
  }

  /**
   * 初始化单个彩种的动态调度
   */
  async initializeLottery(lotCode, name, interval) {
    try {
      // 初始化彩种状态
      this.lotteryStates.set(lotCode, {
        name,
        interval,
        retryCount: 0,
        lastCrawlTime: null,
        nextDrawTime: null,
        countdown: null,
        serverTime: null,
        isCrawling: false,
        mode: 'countdown',  // 默认使用倒计时模式
        pollingCount: 0,    // 🚀 轮询计数器
        lastIssue: null     // 🚀 上次期号（用于检测新数据）
      });

      // 立即执行第一次爬取，获取倒计时信息
      await this.crawlAndScheduleNext(lotCode);

      logger.debug(`✓ 初始化彩种: ${name} (${lotCode})`);
    } catch (error) {
      logger.error(`❌ 初始化彩种失败: ${name}`, error);
      // 初始化失败时使用固定间隔作为回退
      this.scheduleFallback(lotCode, name, interval);
    }
  }

  /**
   * 队列处理器 - 控制并发爬取数量
   */
  startQueueProcessor() {
    setInterval(() => {
      this.processQueue();
    }, 500); // 每500ms检查一次队列
  }

  /**
   * 处理队列中的任务（用于处理爬取中时加入队列的任务）
   */
  async processQueue() {
    // 如果队列为空，不处理
    if (this.crawlQueue.length === 0) {
      return;
    }

    // 从队列取出任务
    const lotCode = this.crawlQueue.shift();
    const state = this.lotteryStates.get(lotCode);

    // 检查该彩种是否还在爬取中
    if (state && !state.isCrawling) {
      // 已经不在爬取了，立即执行
      this.executeCrawl(lotCode);
    } else if (state && state.isCrawling) {
      // 仍在爬取中，重新加入队列尾部
      this.crawlQueue.push(lotCode);
    }
  }

  /**
   * 更新时间偏移（基于最新的爬取数据）
   */
  updateTimeDrift(state, serverTime) {
    if (!serverTime || !state.lastCrawlTime) {
      return;
    }

    try {
      const lastCrawl = new Date(state.lastCrawlTime).getTime();
      const timeSinceCrawl = Date.now() - lastCrawl;

      // 只使用30秒内刚爬取的数据来校准（保证新鲜度）
      if (timeSinceCrawl < 30000) {
        // 爬虫源的服务器时间
        const crawlerServerTime = new Date(serverTime).getTime();
        // 我们系统当前时间
        const ourSystemTime = Date.now();

        // 考虑爬取时刻到现在的时间流逝
        const elapsedSinceCrawl = ourSystemTime - lastCrawl;
        const adjustedCrawlerTime = crawlerServerTime + elapsedSinceCrawl;

        // 计算时间差（正数=我们的时间慢了）
        const drift = adjustedCrawlerTime - ourSystemTime;

        // 只更新超过2秒的偏移
        if (Math.abs(drift) > 2000) {
          this.timeDrift = drift;
          logger.info(`⏰ 时间校准 [${state.name}]: 偏移=${Math.round(drift/1000)}秒`);
        }
      }
    } catch (error) {
      logger.debug('时间校准失败', error.message);
    }
  }

  /**
   * 爬取数据并调度下一次爬取
   */
  async crawlAndScheduleNext(lotCode) {
    const state = this.lotteryStates.get(lotCode);
    if (!state) return;

    // 防止重复爬取 - 如果正在爬取，加入队列等待
    if (state.isCrawling) {
      // 检查是否已在队列中
      if (!this.crawlQueue.includes(lotCode)) {
        this.crawlQueue.push(lotCode);
        logger.debug(`📋 ${state.name} 正在爬取中，加入队列`);
      }
      return;
    }

    // 立即执行（移除并发限制检查，因为Node.js异步I/O可以处理大量并发）
    // 原因：网络请求本身不占用CPU，限制并发反而导致倒计时结束无法及时获取数据
    await this.executeCrawl(lotCode);
  }

  /**
   * 执行实际的爬取任务
   */
  async executeCrawl(lotCode) {
    const state = this.lotteryStates.get(lotCode);
    if (!state || state.isCrawling) return;

    state.isCrawling = true;
    this.activeCrawls++;

    try {
      this.stats.totalCrawls++;
      this.stats.lastCrawlTime = new Date();

      logger.debug(`📡 [${this.activeCrawls}/${this.config.maxConcurrent}] 开始爬取: ${state.name}`);

      // 🚀 使用多数据源管理器获取实时数据（自动选择最优数据源）
      const result = await multiSourceDataManager.fetchLotteryData(
        lotCode,
        sourceManager // 传入168爬虫实例作为备用数据源
      );

      // 提取数据（兼容多数据源返回格式）
      let realtimeData = result.success ? result.data : null;

      // 🔧 数据字段标准化（数据库兼容性）
      if (realtimeData) {
        // 1. 统一字段命名：period/issue, opencode/drawCode
        realtimeData.issue = realtimeData.issue || realtimeData.period;
        realtimeData.drawCode = realtimeData.drawCode || realtimeData.opencode;
        realtimeData.nextTime = realtimeData.nextTime || realtimeData.nextDrawTime;

        // 2. 时间格式转换（统一使用TimeZoneHelper处理，自动检测并修复UTC时间）
        if (realtimeData.drawTime) {
          const originalDrawTime = realtimeData.drawTime;
          const converted = timeZoneHelper.toMySQLDateTime(realtimeData.drawTime);
          if (converted) {
            realtimeData.drawTime = converted;
            // 🐛 调试：记录时间转换情况（仅体彩）
            if (lotCode.startsWith('800')) {
              logger.info(`🕐 [${state.name}] drawTime转换: ${originalDrawTime} → ${converted}`);
            }
          } else {
            logger.warn(`⚠️ 时间格式转换失败: ${realtimeData.drawTime}`);
          }
        }
      }

      // 记录数据源信息
      if (result.success && result.source) {
        const sourceEmoji = result.source === 'cache' ? '📦' :
          result.source === 'speedylot88' ? '⚡' : '🌐';
        logger.info(
          `${sourceEmoji} ${state.name} 数据来源: ${result.source} ` +
          `${result.responseTime ? `(${result.responseTime}ms)` : ''}`
        );

        // 🔧 将source信息保存到realtimeData，供后续使用
        if (realtimeData) {
          realtimeData._source = result.source;
          realtimeData._responseTime = result.responseTime;
        }
      }

      if (realtimeData) {
        // 检测是否返回了旧数据（期号未变化）
        if (state.lastIssue && state.lastIssue === realtimeData.issue) {
          // API 还没更新，返回的是旧期号
          if (!state.staleDataRetries) {
            state.staleDataRetries = 0;
          }
          state.staleDataRetries++;

          // 🚀 优化：快速重试，每500ms一次，最多6次（共3秒）
          const maxRetries = this.config.staleDataMaxRetries;
          const retryInterval = this.config.staleDataRetryInterval;

          if (state.staleDataRetries <= maxRetries) {
            const remainingRetries = maxRetries + 1 - state.staleDataRetries;
            logger.warn(
              `⚠️ ${state.name} API返回旧期号 ${realtimeData.issue}，` +
              `${retryInterval}ms后重试 (剩余${remainingRetries}次)`
            );

            // 快速重试
            state.timer = setTimeout(() => {
              this.crawlAndScheduleNext(lotCode);
            }, retryInterval);

            return; // 不保存旧数据，直接返回
          } else {
            // 重试用完，记录警告但继续处理
            logger.warn(`⚠️ ${state.name} API持续${(maxRetries * retryInterval) / 1000}秒返回旧数据，停止重试，使用旧数据调度`);
            state.staleDataRetries = 0;
          }
        } else {
          // 期号变化了，说明是新数据
          state.staleDataRetries = 0;
        }

        // 保存到数据库前检查数据完整性
        if (!realtimeData.drawCode) {
          logger.warn(`⚠️ ${state.name} drawCode为空，数据: ${JSON.stringify(realtimeData)}`);
        }

        const saved = await database.saveRealtimeData(lotCode, realtimeData);

        if (saved) {
          this.stats.successfulCrawls++;
          state.retryCount = 0; // 重置重试计数
          state.mode = 'countdown'; // 恢复倒计时模式
          state.lastCrawlTime = new Date();
          state.lastIssue = realtimeData.issue; // 保存期号用于下次比对

          logger.info(
            `✅ ${state.name} - 期号 ${realtimeData.issue} | ` +
            `下期: ${realtimeData.nextIssue} | ` +
            `倒计时: ${realtimeData.countdown}秒`
          );

          // 智能补全历史数据（降低频率，仅在记录数不足时执行）
          this.smartBackfill(lotCode, state.name);

          // 根据返回的倒计时信息调度下一次爬取
          this.scheduleNextCrawl(lotCode, realtimeData);
        } else {
          this.handleCrawlFailure(lotCode, '保存失败');
        }
      } else {
        this.handleCrawlFailure(lotCode, '爬取失败');
      }
    } catch (error) {
      this.handleCrawlFailure(lotCode, error.message);
    } finally {
      state.isCrawling = false;
      this.activeCrawls--;
    }
  }

  /**
   * 🚀 极速彩种高频轮询 - 开奖前3秒开始，每500ms检查一次
   */
  async startSpeedyPolling(lotCode) {
    const state = this.lotteryStates.get(lotCode);
    if (!state || state.isCrawling) {
      logger.debug(`⏩ ${state?.name || lotCode} 正在爬取中或状态异常，跳过轮询`);
      return;
    }

    state.pollingCount++;

    try {
      state.isCrawling = true;

      logger.debug(
        `🔍 ${state.name} 高频轮询第${state.pollingCount}次/共${this.config.speedyPollingCount}次`
      );

      // 执行爬取
      const result = await multiSourceDataManager.fetchLotteryData(lotCode);

      if (result && result.success && result.data) {
        const newIssue = result.data.issue || result.data.period;

        // 检测到新期号（数据更新了）
        if (!state.lastIssue || newIssue !== state.lastIssue) {
          logger.success(
            `🎯 ${state.name} 高频轮询成功获取新数据！期号: ${newIssue} ` +
            `(轮询${state.pollingCount}次，用时${state.pollingCount * this.config.speedyPollingInterval}ms)`
          );

          // 数据字段标准化
          result.data.issue = result.data.issue || result.data.period;
          result.data.drawCode = result.data.drawCode || result.data.opencode;
          result.data.nextTime = result.data.nextTime || result.data.nextDrawTime;

          // 时间格式转换
          if (result.data.drawTime) {
            const converted = timeZoneHelper.toMySQLDateTime(result.data.drawTime);
            if (converted) {
              result.data.drawTime = converted;
            }
          }

          // 保存数据
          const saved = await database.saveRealtimeData(lotCode, result.data);

          if (saved) {
            // 重置状态
            state.lastIssue = newIssue;
            state.pollingCount = 0;
            state.retryCount = 0;
            state.mode = 'countdown';
            state.lastCrawlTime = new Date();

            // 更新统计
            this.stats.successfulCrawls++;
            this.stats.totalCrawls++;

            logger.info(
              `✅ ${state.name} - 期号 ${result.data.issue} | ` +
              `下期: ${result.data.nextIssue} | ` +
              `倒计时: ${result.data.countdown}秒`
            );

            // 调度下一期（scheduleNextCrawl会处理倒计时过小的情况）
            this.scheduleNextCrawl(lotCode, result.data);
            return;
          }
        } else {
          // 期号未变化，说明API还没更新
          logger.debug(`⏳ ${state.name} 轮询第${state.pollingCount}次: 期号${newIssue}未更新`);
        }
      }

      // 继续轮询（如果未超限）
      if (state.pollingCount < this.config.speedyPollingCount) {
        const timer = setTimeout(() => {
          this.startSpeedyPolling(lotCode);
        }, this.config.speedyPollingInterval);

        this.timers.set(lotCode, timer);
      } else {
        // 轮询用完，切换到普通模式重试
        logger.warn(
          `⚠️ ${state.name} 轮询${state.pollingCount}次未获取新数据，` +
          `切换到普通重试模式`
        );

        state.pollingCount = 0;

        // 使用普通重试策略
        const timer = setTimeout(() => {
          this.crawlAndScheduleNext(lotCode);
        }, this.config.staleDataRetryInterval);

        this.timers.set(lotCode, timer);
      }

    } catch (error) {
      logger.error(`❌ ${state.name} 高频轮询失败:`, error.message);

      // 继续轮询或降级
      if (state.pollingCount < this.config.speedyPollingCount) {
        const timer = setTimeout(() => {
          this.startSpeedyPolling(lotCode);
        }, this.config.speedyPollingInterval);

        this.timers.set(lotCode, timer);
      } else {
        // 降级到普通爬取
        state.pollingCount = 0;
        this.handleCrawlFailure(lotCode, '高频轮询失败');
      }
    } finally {
      state.isCrawling = false;
    }
  }

  /**
   * 根据倒计时调度下一次爬取
   */
  scheduleNextCrawl(lotCode, realtimeData) {
    const state = this.lotteryStates.get(lotCode);
    if (!state) return;

    // 清除现有定时器
    this.clearTimer(lotCode);

    // 🚀 根据彩种类型选择延迟策略（在函数开始处统一计算）
    // 极速彩种（js开头）：开奖后1秒立即获取（官网即时更新）
    // 普通彩种：开奖后5秒延迟（给API充分更新时间）
    // 需要先映射lotCode到彩种代码，再判断是否为极速彩种
    const mappedCode = multiSourceDataManager.lotCodeMapping[lotCode] || lotCode;
    const drawDelay = multiSourceDataManager.isSpeedyLottery(mappedCode)
      ? this.config.speedyDrawDelay
      : this.config.drawDelay;

    // 获取下期开奖时间
    let { countdown, nextDrawTime, serverTime } = realtimeData;

    // 🔧 修复：SpeedyLot88不返回nextDrawTime，根据drawTime和间隔计算
    const dataSource = realtimeData._source || 'unknown';
    logger.debug(`[Debug] ${state.name} - nextDrawTime: ${nextDrawTime}, drawTime: ${realtimeData.drawTime}, source: ${dataSource}`);

    if (!nextDrawTime && dataSource === 'speedylot88') {
      // 🚀 使用官网实时倒计时（最准确！）
      if (realtimeData.officialCountdown != null && realtimeData.officialCountdown > 10) {
        // 倒计时>10秒，直接使用
        countdown = realtimeData.officialCountdown;

        // 基于官网倒计时计算下期开奖时间
        const now = Date.now() + this.timeDrift;
        const nextDrawTimeMs = now + (countdown * 1000);
        const d = new Date(nextDrawTimeMs);
        nextDrawTime = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;

        logger.info(
          `[SpeedyLot88官网倒计时] ${state.name} ` +
          `下期: ${nextDrawTime} | 倒计时: ${countdown}秒 🎯`
        );
      } else {
        // 倒计时<=10秒或不可用，使用固定间隔75秒计算
        // 原理：刚获取到数据的时间 + 75秒 = 下期开奖
        const intervalSeconds = state.interval || 75;
        const now = Date.now() + this.timeDrift;
        const nextDrawTimeMs = now + (intervalSeconds * 1000);
        const d = new Date(nextDrawTimeMs);
        nextDrawTime = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
        countdown = intervalSeconds;

        logger.info(
          `[SpeedyLot88固定周期] ${state.name} ` +
          `倒计时${realtimeData.officialCountdown}秒过小，使用75秒周期 | ` +
          `下期: ${nextDrawTime} 🎯`
        );
      }
    }

    // 保存服务器时间和倒计时
    state.countdown = countdown;
    state.serverTime = serverTime;

    // 只有当API返回的nextDrawTime是未来时间时才使用，否则保留当前值（避免覆盖预测值）
    if (nextDrawTime) {
      const apiDrawTime = new Date(nextDrawTime).getTime();
      const now = Date.now() + this.timeDrift; // 使用校准后的系统时间
      // 如果API返回的时间在未来(至少2秒后)，才使用它
      if (apiDrawTime - now > 2000) {
        state.nextDrawTime = nextDrawTime;
      }
      // 如果是过期时间，保留state.nextDrawTime不变（让后续预测逻辑更新）
    }

    // 更新时间偏移（基于最新的爬取数据）
    this.updateTimeDrift(state, serverTime);

    // 优先使用nextDrawTime来计算精确的爬取时间（与官方开奖时间同步）
    let nextCrawlDelay;

    if (nextDrawTime) {
      // 基于官方开奖时间同步
      const nextDrawTimeMs = new Date(nextDrawTime).getTime();
      // 使用校准后的系统时间（加上时间偏移）
      const now = Date.now() + this.timeDrift;

      // 开奖后N秒爬取（drawDelay为负数表示开奖后，正数表示开奖前）
      // 例如：drawDelay=-3000 表示开奖后3秒爬取，drawDelay=0 表示立即爬取
      nextCrawlDelay = nextDrawTimeMs - now - drawDelay;

      // 如果计算出的延迟为负数或太小（<2秒），说明已经过了开奖时间或即将开奖
      if (nextCrawlDelay < 2000) {
        // 初始化重试计数器
        if (!state.zeroCountdownRetries) {
          state.zeroCountdownRetries = 0;
        }
        state.zeroCountdownRetries++;

        // 立即使用间隔推算，不等待多次重试
        if (state.interval) {
          // 根据间隔推算下一期开奖时间
          const estimatedNextDrawTime = nextDrawTimeMs + (state.interval * 1000);
          const estimatedDelay = estimatedNextDrawTime - now - drawDelay;

          if (estimatedDelay > 0) {
            logger.info(
              `💡 ${state.name} API返回过期时间，根据间隔推算：开奖 ${new Date(estimatedNextDrawTime).toLocaleTimeString('zh-CN')}`
            );
            nextCrawlDelay = estimatedDelay;
            // 手动格式化为本地时间字符串，避免toLocaleString的时区问题
            const d = new Date(estimatedNextDrawTime);
            state.nextDrawTime = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
            state.zeroCountdownRetries = 0; // 重置计数器
          } else {
            // 推算的时间也已过期，继续推算直到找到未来的时间
            let attempts = 0;
            let futureTime = nextDrawTimeMs;
            while (futureTime - now < 0 && attempts < 100) {
              futureTime += (state.interval * 1000);
              attempts++;
            }

            if (futureTime - now > 0) {
              const delay = futureTime - now - drawDelay;
              logger.info(
                `💡 ${state.name} 多次推算后找到未来时间：开奖 ${new Date(futureTime).toLocaleTimeString('zh-CN')}`
              );
              nextCrawlDelay = delay;
              // 手动格式化为本地时间字符串
              const d = new Date(futureTime);
              state.nextDrawTime = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
              state.zeroCountdownRetries = 0;
            } else {
              // 实在推算不出，使用固定30秒重试
              nextCrawlDelay = 30000;
              logger.warn(`⚠️ ${state.name} 无法推算未来时间，30秒后重试`);
            }
          }
        } else {
          // 没有间隔信息，使用固定30秒重试
          nextCrawlDelay = 30000;
          logger.debug(
            `⏰ ${state.name} 开奖时间已过且无间隔信息，30秒后重新爬取 (${state.zeroCountdownRetries}次)`
          );
        }
      } else {
        // 重置重试计数器
        state.zeroCountdownRetries = 0;
      }
    } else if (countdown != null && countdown >= 0 && countdown <= this.config.maxCountdown / 1000) {
      // 如果没有nextDrawTime，回退到使用countdown
      logger.debug(`⚠️ ${state.name} 没有下期开奖时间，使用倒计时: ${countdown}秒`);

      if (countdown <= 5) {
        nextCrawlDelay = drawDelay;
      } else {
        state.zeroCountdownRetries = 0;
        nextCrawlDelay = (countdown * 1000) + drawDelay;
      }
    } else {
      // 倒计时和开奖时间都异常，使用固定间隔
      logger.warn(
        `⚠️ ${state.name} 开奖时间和倒计时都异常，使用固定间隔`
      );
      this.scheduleFallback(lotCode, state.name, state.interval);
      return;
    }

    // 判断是否为长间隔彩种
    const isLongInterval = nextCrawlDelay > this.config.longIntervalThreshold;

    if (isLongInterval) {
      // 长间隔彩种（>1小时）：使用混合策略
      // 1. 保存完整的下次开奖时间用于显示
      // 2. 但每30分钟检查一次，防止倒计时不准确
      const checkInterval = this.config.longIntervalCheckInterval;
      const triggerTime = new Date(Date.now() + nextCrawlDelay);

      logger.info(
        `⏰ ${state.name} [长间隔] 开奖时间: ${nextDrawTime || triggerTime.toLocaleString('zh-CN')} ` +
        `(${Math.round(nextCrawlDelay / 3600000)}小时后)，每30分钟检查一次`
      );

      // 设置定期检查定时器（每30分钟）
      const timer = setInterval(() => {
        this.crawlAndScheduleNext(lotCode);
      }, checkInterval);

      this.timers.set(lotCode, timer);
    } else {
      // 短间隔彩种（<1小时）：使用精准倒计时同步
      const crawlTime = new Date(Date.now() + nextCrawlDelay);
      const secondsLeft = Math.round(nextCrawlDelay / 1000);

      // 检查是否为极速彩种，使用高频轮询策略
      const isSpeedyLottery = multiSourceDataManager.isSpeedyLottery(mappedCode);

      if (isSpeedyLottery && drawDelay > 0) {
        // 🚀🚀 极速彩种高频轮询策略：开奖前3秒开始，每500ms一次
        logger.info(
          `⏰ ${state.name} 开奖: ${nextDrawTime} | 高频轮询开始: ${crawlTime.toLocaleTimeString('zh-CN')} ` +
          `(${secondsLeft}秒后，开奖前${drawDelay / 1000}秒开始轮询)`
        );

        // 重置轮询计数器
        state.pollingCount = 0;

        // 设置第一次轮询定时器（开奖前3秒）
        const timer = setTimeout(() => {
          this.startSpeedyPolling(lotCode);
        }, nextCrawlDelay);

        this.timers.set(lotCode, timer);
      } else {
        // 普通彩种或极速彩种降级模式：单次精准调度
        const delayDesc = drawDelay < 0
          ? `开奖后${Math.abs(drawDelay / 1000)}秒`
          : drawDelay === 0
          ? `开奖后立即`
          : `开奖前${drawDelay / 1000}秒`;

        logger.info(
          `⏰ ${state.name} 开奖: ${nextDrawTime} | 爬取: ${crawlTime.toLocaleTimeString('zh-CN')} ` +
          `(${secondsLeft}秒后，${delayDesc})`
        );

        // 设置精准定时器
        const timer = setTimeout(() => {
          this.crawlAndScheduleNext(lotCode);
        }, nextCrawlDelay);

        this.timers.set(lotCode, timer);
      }
    }
  }

  /**
   * 处理爬取失败
   */
  handleCrawlFailure(lotCode, reason) {
    this.stats.failedCrawls++;
    const state = this.lotteryStates.get(lotCode);

    if (!state) return;

    state.retryCount++;
    logger.warn(`⚠️ ${state.name} ${reason} (重试 ${state.retryCount}/${this.config.maxRetries})`);

    // 如果重试次数超过限制，使用固定间隔
    if (state.retryCount >= this.config.maxRetries) {
      logger.warn(`⚠️ ${state.name} 重试次数过多，切换到固定间隔模式`);
      state.mode = 'fixed';  // 切换到固定间隔模式
      this.scheduleFallback(lotCode, state.name, state.interval);
    } else {
      // 快速重试获取新数据
      this.clearTimer(lotCode);
      const timer = setTimeout(() => {
        this.crawlAndScheduleNext(lotCode);
      }, this.config.retryDelay); // 使用配置的重试延迟（1.5秒）
      this.timers.set(lotCode, timer);
    }
  }

  /**
   * 回退到固定间隔调度（当倒计时异常时）
   */
  scheduleFallback(lotCode, name, interval) {
    this.clearTimer(lotCode);

    const fallbackDelay = interval ? interval * 1000 : this.config.fallbackInterval;

    logger.debug(`🔄 ${name} 使用固定间隔: ${fallbackDelay / 1000}秒`);

    const timer = setInterval(() => {
      this.crawlAndScheduleNext(lotCode);
    }, fallbackDelay);

    this.timers.set(lotCode, timer);
  }

  /**
   * 智能补全历史数据（降低调用频率）
   */
  async smartBackfill(lotCode, name) {
    try {
      // 检查是否最近已经补全过（避免频繁补全）
      const state = this.lotteryStates.get(lotCode);
      if (state.lastBackfillTime) {
        const timeSinceLastBackfill = Date.now() - state.lastBackfillTime;
        // 30分钟内不重复补全
        if (timeSinceLastBackfill < 1800000) {
          return;
        }
      }

      const integrity = await database.checkDataIntegrity(lotCode);

      if (integrity.needsHistory) {
        logger.info(`🔍 ${name} ${integrity.reason}，触发智能补全`);

        // 记录补全时间
        state.lastBackfillTime = Date.now();

        // 延迟执行，避免影响实时爬取
        setTimeout(async () => {
          try {
            await this.crawlHistory(lotCode, name);
            logger.success(`✅ ${name} 智能补全完成`);
          } catch (error) {
            logger.error(`❌ ${name} 智能补全失败`, error);
          }
        }, 5000); // 延迟5秒，降低并发压力
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
   * 清除定时器
   */
  clearTimer(lotCode) {
    const timer = this.timers.get(lotCode);
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
      this.timers.delete(lotCode);
    }
  }

  /**
   * 停止调度器
   */
  stop() {
    logger.info('🛑 停止动态爬虫调度器...');

    // 清除所有定时器
    this.timers.forEach((timer, lotCode) => {
      clearTimeout(timer);
      clearInterval(timer);
    });

    this.timers.clear();
    this.lotteryStates.clear();
    this.isRunning = false;

    logger.success('✅ 动态爬虫调度器已停止');
  }

  /**
   * 重启调度器
   */
  async restart() {
    logger.info('🔄 重启动态爬虫调度器...');

    this.stop();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.start();

    logger.success('✅ 动态爬虫调度器重启成功');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const activeLotteries = Array.from(this.lotteryStates.entries()).map(([lotCode, state]) => {
      // 确定彩种状态
      let status = 'waiting';
      if (state.isCrawling) {
        status = 'crawling';
      } else if (state.countdown !== undefined && state.countdown !== null) {
        if (state.countdown <= 0) {
          status = 'ready';
        } else if (state.countdown < 60) {
          status = 'upcoming';
        } else {
          status = 'waiting';
        }
      }

      return {
        lotCode,
        name: state.name,
        nextDrawTime: state.nextDrawTime,
        lastCrawlTime: state.lastCrawlTime,
        retryCount: state.retryCount,
        countdown: state.countdown,
        serverTime: state.serverTime,
        isCrawling: state.isCrawling,
        status: status,
        mode: state.mode || 'countdown'  // countdown 或 fixed
      };
    });

    return {
      ...this.stats,
      successRate: this.stats.totalCrawls > 0
        ? ((this.stats.successfulCrawls / this.stats.totalCrawls) * 100).toFixed(2) + '%'
        : '0%',
      activeLotteries: activeLotteries.length,
      isRunning: this.isRunning,
      activeCrawls: this.activeCrawls,
      queueLength: this.crawlQueue.length,
      maxConcurrent: this.config.maxConcurrent,
      lotteries: activeLotteries
    };
  }

  /**
   * 手动触发单个彩种爬取
   */
  async triggerManualCrawl(lotCode) {
    const state = this.lotteryStates.get(lotCode);
    if (!state) {
      throw new Error(`彩种不存在: ${lotCode}`);
    }

    logger.info(`🎯 手动触发爬取: ${state.name} (${lotCode})`);
    await this.crawlAndScheduleNext(lotCode);
  }
}

export default new DynamicCrawlerScheduler();
