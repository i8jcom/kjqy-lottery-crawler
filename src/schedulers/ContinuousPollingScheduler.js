import database from '../db/Database.js';
import logger from '../utils/Logger.js';
import lotteryConfigManager from '../managers/LotteryConfigManager.js';
import multiSourceDataManager from '../services/MultiSourceDataManager.js';
import officialSourceManager from '../managers/OfficialSourceManager.js';
import WebSocketManager from '../web/WebSocketManager.js';
import alertServiceManager from '../services/AlertServiceManager.js'; // 🚨 告警服务管理器

/**
 * 持续轮询调度器 - 期号变化检测
 *
 * 核心思路：
 * 1. 每个彩种独立轮询（3-5秒间隔）
 * 2. 检测期号变化（新期号 = 新数据）
 * 3. 立即保存到数据库
 * 4. 数据库唯一索引自动去重
 *
 * 优势：
 * - ✅ 不依赖倒计时，永远不会"算错时间"
 * - ✅ 不会错过数据（持续监控）
 * - ✅ 简单可靠
 * - ✅ 自动适应官网任何时间变化
 */
class ContinuousPollingScheduler {
  constructor() {
    this.timers = new Map(); // 存储每个彩种的定时器
    this.lastPeriods = new Map(); // 记录每个彩种的最新期号
    this.lastDrawTimestamps = new Map(); // 🚀 记录每个彩种最后检测到新期号的时间戳

    // 🎯 新期号检测时间统计
    this.detectionStats = new Map(); // 每个彩种的检测时间统计

    this.stats = {
      totalPolls: 0,
      newDataFound: 0,
      duplicateData: 0,
      errors: 0
    };
    this.isRunning = false;

    // 配置参数
    this.config = {
      // 极速彩种：快速轮询（每3秒）
      speedyPollingInterval: 3000,

      // 普通彩种：常规轮询（每5秒）
      normalPollingInterval: 5000,

      // 错误后的重试延迟
      errorRetryDelay: 5000,

      // 连续错误次数上限（超过则降低轮询频率）
      maxConsecutiveErrors: 5,

      // 降级后的轮询间隔
      degradedPollingInterval: 10000
    };
  }

  /**
   * 启动调度器
   */
  async start() {
    if (this.isRunning) {
      logger.warn('持续轮询调度器已经在运行中');
      return;
    }

    logger.info('🚀 启动持续轮询调度器（期号变化检测）...');

    // 测试数据库连接
    const dbConnected = await database.testConnection();
    if (!dbConnected) {
      logger.error('数据库连接失败，无法启动调度器');
      return;
    }

    this.isRunning = true;

    // 从 LotteryConfigManager 获取已启用的彩种
    const enabledLotteries = lotteryConfigManager.getEnabledLotteries();
    logger.info(`📋 加载彩种配置: ${enabledLotteries.length} 个已启用彩种`);

    // 为每个彩种启动独立的轮询任务
    for (const lotteryConfig of enabledLotteries) {
      this.startPolling(lotteryConfig);
    }

    logger.success('✅ 持续轮询调度器启动成功 - 智能动态调度模式');
    logger.info(`📌 极速彩种基础间隔: ${this.config.speedyPollingInterval / 1000}秒`);
    logger.info(`📌 普通彩种基础间隔: ${this.config.normalPollingInterval / 1000}秒`);
    logger.info(`📌 智能调度策略:`);
    logger.info(`   🎯 低频彩种 (drawSchedule模式):`);
    logger.info(`      - 非开奖日/时段 → 暂停轮询，节省资源`);
    logger.info(`      - 开奖窗口内 → 按倒计时动态轮询`);
    logger.info(`   🎯 SpeedyLot88模式 (wait_for_zero, 倒计时最小13秒):`);
    logger.info(`      - 倒计时 ≤ 20秒 → 1秒轮询（超高频）`);
    logger.info(`      - 倒计时 21-40秒 → 2秒轮询`);
    logger.info(`      - 倒计时 41-60秒 → 3秒轮询`);
    logger.info(`      - 倒计时 >60秒 → 5秒轮询`);
    logger.info(`   🎯 SG Lotteries/UK Lottos/AU模式 (immediate_draw):`);
    logger.info(`      - 倒计时 >= justDrawnThreshold → 1秒轮询（刚开奖！）`);
    logger.info(`      - 倒计时 15-35秒 → 1秒轮询（🔍 API更新窗口）`);
    logger.info(`      - 倒计时 ≤ 14秒 → 1秒轮询（超高频）`);
    logger.info(`      - 其他时段 → 3-5秒轮询（动态计算）`);
  }

  /**
   * 启动单个彩种的轮询（智能动态调度）
   */
  startPolling(lotteryConfig) {
    const { lotCode, name } = lotteryConfig;

    // 判断是否为极速彩种
    const isSpeedy = this.isSpeedyLottery(lotCode);
    const baseInterval = isSpeedy
      ? this.config.speedyPollingInterval
      : this.config.normalPollingInterval;

    logger.info(`🔄 启动智能轮询: ${name} (${lotCode}) - 基础间隔${baseInterval / 1000}秒`);

    // 初始化状态
    const state = {
      lotCode,
      name,
      lotteryConfig,  // 🎯 保存完整配置，用于 drawSchedule 智能调度
      baseInterval,
      consecutiveErrors: 0,
      lastPollTime: null,
      lastSuccessTime: null,
      timeout: null,  // 使用setTimeout代替setInterval，支持动态调度
      nextPollDelay: baseInterval  // 保存下次轮询延迟（毫秒）
    };

    // 立即执行第一次轮询
    this.pollOnce(state);

    this.timers.set(lotCode, { state });
  }

  /**
   * 执行一次轮询（智能动态调度）
   * @param {Object} state - 彩种状态
   * @param {boolean} skipWindowCheck - 是否跳过窗口检查（手动触发时使用）
   */
  async pollOnce(state, skipWindowCheck = false) {
    const { lotCode, name, lotteryConfig } = state;
    state.lastPollTime = Date.now();

    let nextPollDelay = state.baseInterval; // 默认使用基础间隔

    // 🎯 智能窗口调度：检查是否在开奖窗口内（手动触发时跳过）
    if (!skipWindowCheck && lotteryConfig && lotteryConfig.drawSchedule && lotteryConfig.drawSchedule.mode === 'scheduled') {
      const inWindow = this.isInDrawWindow(lotteryConfig);

      if (!inWindow) {
        // 不在开奖窗口内，跳过轮询
        const delayToNextWindow = this.calculateNextDrawWindowDelay(lotteryConfig);
        const delayHours = (delayToNextWindow / 3600000).toFixed(1);
        const delayMinutes = (delayToNextWindow / 60000).toFixed(0);

        logger.info(
          `💤 ${name} [非开奖窗口] 跳过轮询 → ` +
          `下次${delayHours > 1 ? delayHours + '小时' : delayMinutes + '分钟'}后启动`
        );

        // 直接调度到下次窗口开始
        this.scheduleNextPoll(state, delayToNextWindow);
        return;
      } else {
        // 在开奖窗口内，记录日志
        logger.debug(`🎯 ${name} [开奖窗口内] 执行轮询`);
      }
    }

    this.stats.totalPolls++;

    try {
      // 获取最新数据
      const result = await multiSourceDataManager.fetchLotteryData(lotCode);

      if (!result.success || !result.data) {
        throw new Error(result.error || '获取数据失败');
      }

      const { period, numbers, opencode, officialCountdown } = result.data;

      // 🐛 Debug: 打印期号信息
      logger.info(`[${name}] 获取数据: period=${period}, opencode=${opencode ? opencode.substring(0, 20) + '...' : 'null'}`);

      // 🎯 获取数据源的调度策略
      const sourceConfig = officialSourceManager.getSourceForLottery(lotCode);
      const countdownBehavior = sourceConfig?.countdownBehavior || 'wait_for_zero'; // 默认为等待0模式
      const drawInterval = sourceConfig?.drawInterval || 75;

      // 🚀 计算用于调度的倒计时
      let calculatedCountdown = officialCountdown;
      const earlyFetch = sourceConfig?.earlyFetch || 0;

      if (countdownBehavior === 'wait_for_zero') {
        // SpeedyLot88模式：基于时间戳计算倒计时
        const lastDrawTime = this.lastDrawTimestamps.get(lotCode);
        if (lastDrawTime) {
          const now = Date.now();  // 毫秒级
          const elapsed = (now - lastDrawTime) / 1000;  // 转换为秒
          calculatedCountdown = Math.max(0, Math.round(drawInterval - elapsed));
        }
      } else if (countdownBehavior === 'immediate_draw' && earlyFetch !== 0) {
        // UK Lottos/SG/AU模式：减去earlyFetch，与前端显示一致
        // 这样前端显示倒计时10秒时，后端也认为是10秒，进入高频轮询
        // 支持负数earlyFetch（如AU幸运20的-9秒）
        calculatedCountdown = Math.max(0, officialCountdown - earlyFetch);
        logger.debug(`[${name}] 调度倒计时: ${calculatedCountdown}秒 (真实${officialCountdown}秒 - earlyFetch ${earlyFetch}秒)`);
      }

      // 🚀 智能调度：根据计算的倒计时和数据源行为计算下次轮询时机
      const countdown = calculatedCountdown !== undefined && calculatedCountdown !== null ? calculatedCountdown : officialCountdown;
      if (countdown !== undefined && countdown !== null) {
        if (countdownBehavior === 'immediate_draw') {
          // 📌 SG Lotteries/UK Lottos/AU模式：倒计时结束立即显示号码
          // 当倒计时接近最大值时，说明刚开奖，应快速轮询获取新数据
          // 考虑earlyFetch影响：countdown = 官方倒计时 - earlyFetch
          const justDrawnThreshold = drawInterval - earlyFetch - 10;
          if (countdown >= justDrawnThreshold) {
            // 刚开奖（倒计时接近最大值），快速轮询（1秒）
            nextPollDelay = 1000;
            logger.info(`🎰 ${name} 刚开奖（倒计时${countdown}秒 >= ${justDrawnThreshold}秒）→ 下次1.0秒后轮询（获取新期号）`);
          } else if (countdown >= 15 && countdown <= 35) {
            // 🔍 API更新窗口（倒计时15-35秒）：官方API通常在此时段更新新期号
            // UK Lottos官网在倒计时21秒左右更新，我们在15-35秒内高频轮询以准确捕获
            nextPollDelay = 1000;
            logger.info(`🔍 ${name} API更新窗口（倒计时${countdown}秒）→ 下次1.0秒后轮询（捕获新期号）`);
          } else if (countdown <= 14) {
            // 接近开奖（倒计时≤14秒），超高频轮询（1秒）
            nextPollDelay = 1000;
            logger.info(`⏱️ ${name} 即将开奖（倒计时${countdown}秒）→ 下次1.0秒后轮询`);
          } else {
            // 中间时段（36秒 到 justDrawnThreshold-1秒），使用计算延迟
            nextPollDelay = this.calculateNextPollDelay(countdown, state.baseInterval, countdownBehavior, lotCode);
            logger.info(`⏱️ ${name} 倒计时${countdown}秒 → 下次${(nextPollDelay / 1000).toFixed(1)}秒后轮询`);
          }
        } else {
          // 📌 SpeedyLot88模式：倒计时为0时才开奖
          if (countdown <= 20) {
            // 🔥 倒计时≤20秒 = 即将开奖！立即进入超高频轮询（1秒）
            nextPollDelay = 1000;
            logger.info(`🎰 ${name} 即将开奖（倒计时${countdown}秒）→ 下次1.0秒后轮询（等待新期号）`);
          } else if (countdown > 0) {
            nextPollDelay = this.calculateNextPollDelay(countdown, state.baseInterval, countdownBehavior, lotCode);
            logger.info(`⏱️ ${name} 倒计时${countdown}秒 → 下次${(nextPollDelay / 1000).toFixed(1)}秒后轮询`);
          }
        }
      }

      // 检查是否为新期号
      const lastPeriod = this.lastPeriods.get(lotCode);

      if (lastPeriod === period) {
        // 相同期号，跳过
        logger.debug(`⏭️ ${name} 期号${period} 未变化，跳过`);
        this.stats.duplicateData++;
        state.consecutiveErrors = 0; // 重置错误计数
      } else {
        // 🎉 新期号！保存到数据库
        logger.info(`🆕 ${name} 发现新期号: ${period} - 开奖号码: ${opencode}`);

        // 🔒 立即标记为已处理（防止并发轮询时重复推送）
        this.lastPeriods.set(lotCode, period);

        // 🎯 记录检测时间统计（仅针对 immediate_draw 模式彩种）
        if (countdownBehavior === 'immediate_draw' && countdown !== undefined && countdown !== null) {
          this.recordDetectionTime(lotCode, name, period, countdown, drawInterval, earlyFetch);
        }

        const saved = await this.saveToDatabase(lotCode, result.data);

        if (saved) {
          this.stats.newDataFound++;
          state.lastSuccessTime = Date.now();
          state.consecutiveErrors = 0;

          // 🔧 准备推送数据（可能需要校正倒计时）
          const pushData = { ...result.data };

          // 🚀 记录开奖时间戳（用于新期号检测）
          if (countdownBehavior === 'wait_for_zero') {
            // SpeedyLot88模式：记录开奖时间但直接使用爬虫返回的倒计时
            // ✅ 原因：爬虫返回的倒计时已经包含+13秒校正，是最准确的实时值
            // ❌ 不应该基于drawTime重新计算，因为检测延迟会导致倒计时异常增大
            if (result.data.drawTime) {
              const drawTimestamp = new Date(result.data.drawTime).getTime();
              this.lastDrawTimestamps.set(lotCode, drawTimestamp);
              logger.info(`🎯 ${name} 校准时间戳: ${drawTimestamp} (基于drawTime: ${result.data.drawTime})`);
            } else {
              // Fallback: 使用检测到新期号的当前时间作为基准
              this.lastDrawTimestamps.set(lotCode, Date.now());
              logger.info(`🎯 ${name} 校准时间戳: ${Date.now()} (基于检测时间)`);
            }

            // ✅ 直接使用爬虫返回的officialCountdown（已含+13秒校正）
            // 不重新计算，避免检测延迟导致倒计时异常
            logger.info(
              `[${name}] ✅ WebSocket使用爬虫实时倒计时: ${pushData.officialCountdown}秒 (已含+13秒校正)`
            );
          } else if (countdownBehavior === 'immediate_draw' && result.data.unixtime) {
            // SG/AU/UK模式：使用爬虫返回的精确unixtime（就是真实开奖时间）
            const accurateTimestamp = result.data.unixtime * 1000; // 秒 → 毫秒
            this.lastDrawTimestamps.set(lotCode, accurateTimestamp);
            logger.info(`🎯 ${name} 校准时间戳: ${accurateTimestamp} (基于爬虫unixtime ${result.data.unixtime})`);

            // 🔥 UK Lottos同步触发：当任一彩种检测到新期号，立即触发其他3个彩种轮询
            if (lotCode.startsWith('900')) {
              const ukLottos = ['90001', '90002', '90003', '90004'].filter(code => code !== lotCode);
              logger.info(`🔄 ${name} 触发其他UK Lottos同步轮询: ${ukLottos.join(', ')}`);
              ukLottos.forEach(siblingLotCode => {
                const siblingState = this.states.get(siblingLotCode);
                if (siblingState) {
                  // 清除现有定时器，立即轮询
                  if (siblingState.timeout) {
                    clearTimeout(siblingState.timeout);
                  }
                  // 延迟50ms避免同时并发（分散请求）
                  const delay = ukLottos.indexOf(siblingLotCode) * 50;
                  siblingState.timeout = setTimeout(() => this.pollOnce(siblingState), delay);
                }
              });
            }

            // 🔥 AU Lucky Lotteries同步触发：当任一彩种检测到新期号，立即触发其他3个彩种轮询
            if (lotCode.startsWith('300')) {
              const auLotteries = ['30001', '30002', '30003', '30004'].filter(code => code !== lotCode);
              logger.info(`🔄 ${name} 触发其他AU Lotteries同步轮询: ${auLotteries.join(', ')}`);
              auLotteries.forEach(siblingLotCode => {
                const siblingState = this.states.get(siblingLotCode);
                if (siblingState) {
                  // 清除现有定时器，立即轮询
                  if (siblingState.timeout) {
                    clearTimeout(siblingState.timeout);
                  }
                  // 延迟50ms避免同时并发（分散请求）
                  const delay = auLotteries.indexOf(siblingLotCode) * 50;
                  siblingState.timeout = setTimeout(() => this.pollOnce(siblingState), delay);
                }
              });
            }
          }

          // 🚀 立即推送新期号到WebSocket订阅者（使用校正后的倒计时）
          const wsManager = WebSocketManager.getInstance();
          if (wsManager) {
            logger.info(
              `[${name}] 🚀 WebSocket推送倒计时: ${pushData.officialCountdown}秒 (期号${pushData.period})`
            );
            wsManager.notifyNewPeriod(lotCode, pushData);
          }

          // 🚀 新期号获取成功！重新计算下次轮询时机
          // 刚开奖，倒计时应该在70-75秒左右
          if (countdownBehavior === 'immediate_draw') {
            // SG模式：刚开奖，继续快速轮询
            nextPollDelay = 1000;
          } else {
            // SpeedyLot88模式：刚开奖，倒计时约75秒，使用常规轮询间隔
            nextPollDelay = this.calculateNextPollDelay(drawInterval, state.baseInterval, countdownBehavior, lotCode);
          }

          logger.success(
            `✅ ✅ ${name} 新数据已保存: 期号${period} | ` +
            `号码:${opencode} | ` +
            `倒计时:${drawInterval}秒 | ` +
            `下次:${(nextPollDelay / 1000).toFixed(1)}秒后 | ` +
            `新数据总数:${this.stats.newDataFound}`
          );
        } else {
          // 保存失败（可能数据库已存在）
          this.lastPeriods.set(lotCode, period);
          logger.debug(`📝 ${name} 期号${period} 已存在于数据库`);
        }
      }

    } catch (error) {
      state.consecutiveErrors++;
      this.stats.errors++;

      logger.error(
        `❌ ${name} 轮询失败 (连续${state.consecutiveErrors}次): ${error.message}`
      );

      // 🚨 触发告警检查：爬取失败
      try {
        await alertServiceManager.checkCrawlFailure(
          lotCode,
          name,
          state.consecutiveErrors,
          this.config.errorRetryDelay / 1000 // 转换为秒
        );
      } catch (alertError) {
        logger.debug(`[告警] 检查爬取失败告警时出错: ${alertError.message}`);
      }

      // 如果连续错误太多，使用降级间隔
      if (state.consecutiveErrors >= this.config.maxConsecutiveErrors) {
        nextPollDelay = this.config.degradedPollingInterval;
      }
    }

    // 🎯 数据延迟窗口优化：台湾彩票、福彩、体彩等低频彩种在开奖后的数据延迟期间保持高频轮询
    if (lotteryConfig && this.isInDataDelayWindow(lotteryConfig)) {
      // 在数据延迟窗口内，使用固定的高频轮询间隔（30秒）
      // 台湾彩票：21:30开奖，官方API延迟最多90分钟，在此期间每30秒轮询一次
      // 福彩/体彩：开奖后官方API延迟10分钟，在此期间每30秒轮询一次
      const dataDelayPollingInterval = 30000; // 30秒
      if (nextPollDelay > dataDelayPollingInterval) {
        logger.info(
          `🔄 ${name} [数据延迟窗口] 使用高频轮询 → 下次30.0秒后（原${(nextPollDelay / 1000).toFixed(1)}秒被覆盖）`
        );
        nextPollDelay = dataDelayPollingInterval;
      }
    }

    // 调度下一次轮询
    this.scheduleNextPoll(state, nextPollDelay);
  }

  /**
   * 根据官网倒计时计算下次轮询延迟（智能调度算法）
   * @param {number} countdown - 倒计时（秒）
   * @param {number} baseInterval - 基础轮询间隔（毫秒）
   * @param {string} countdownBehavior - 倒计时行为模式 ('wait_for_zero' 或 'immediate_draw')
   * @param {string} lotCode - 彩种代码（用于特殊策略）
   */
  calculateNextPollDelay(countdown, baseInterval, countdownBehavior = 'wait_for_zero', lotCode = null) {
    // 🎯 香港六合彩特殊策略：基于开奖时间的智能轮询
    if (lotCode === '60001') {
      return this.calculateHKJCPollingDelay();
    }

    if (countdownBehavior === 'immediate_draw') {
      // 🎯 SG Lotteries模式：倒计时结束立即显示号码
      // 策略：倒计时越小，越接近下一次开奖，轮询越频繁
      if (countdown <= 10) {
        // 倒计时≤10秒：即将开奖，超高频轮询（1秒后）
        return 1000;
      } else if (countdown <= 20) {
        // 倒计时11-20秒：接近开奖，加速轮询（2秒后）
        return 2000;
      } else if (countdown <= 40) {
        // 倒计时21-40秒：提前轮询（3秒后）
        return 3000;
      } else if (countdown <= 60) {
        // 倒计时41-60秒：中频轮询（4秒后）
        return 4000;
      } else {
        // 倒计时>60秒：常规轮询（5秒后）
        return 5000;
      }
    } else {
      // 🎯 SpeedyLot88模式：倒计时为0时才开奖
      // 策略：越接近开奖（倒计时越小），轮询越频繁
      // 注意：我们的倒计时 = 官方倒计时 + 13秒，最小值约13秒
      if (countdown <= 20) {
        // 倒计时≤20秒：超高频轮询（1秒后）
        return 1000;
      } else if (countdown <= 40) {
        // 倒计时21-40秒：加速轮询（2秒后）
        return 2000;
      } else if (countdown <= 60) {
        // 倒计时41-60秒：中频轮询（3秒后）
        return 3000;
      } else {
        // 倒计时>60秒：常规轮询（5秒后）
        return 5000;
      }
    }
  }

  /**
   * 调度下一次轮询
   */
  scheduleNextPoll(state, delay) {
    if (!this.isRunning) return;

    // 清除旧的定时器
    if (state.timeout) {
      clearTimeout(state.timeout);
    }

    // 保存下次轮询延迟（用于状态判断）
    state.nextPollDelay = delay;

    // 调度下一次轮询
    state.timeout = setTimeout(() => {
      this.pollOnce(state);
    }, delay);
  }

  /**
   * 🎯 记录新期号检测时间统计
   * @param {string} lotCode - 彩种代码
   * @param {string} name - 彩种名称
   * @param {string} period - 期号
   * @param {number} countdown - 检测时的倒计时（秒，已减去earlyFetch）
   * @param {number} drawInterval - 开奖间隔（秒）
   * @param {number} earlyFetch - 提前获取秒数
   */
  recordDetectionTime(lotCode, name, period, countdown, drawInterval, earlyFetch) {
    // 计算真实倒计时（加回earlyFetch）
    const actualCountdown = countdown + earlyFetch;

    // 初始化彩种统计数据
    if (!this.detectionStats.has(lotCode)) {
      this.detectionStats.set(lotCode, {
        lotCode,
        name,
        totalDetections: 0,
        detections: [], // 最近20次检测记录
        avgCountdown: 0,
        minCountdown: Infinity,
        maxCountdown: -Infinity,
        drawInterval,
        earlyFetch
      });
    }

    const stats = this.detectionStats.get(lotCode);

    // 记录本次检测
    const detection = {
      period,
      countdown,           // 显示的倒计时（已减去earlyFetch）
      actualCountdown,     // 真实倒计时（加回earlyFetch）
      timestamp: Date.now(),
      timestampFormatted: new Date().toLocaleString('zh-CN')
    };

    stats.detections.unshift(detection); // 添加到开头
    if (stats.detections.length > 20) {
      stats.detections.pop(); // 只保留最近20次
    }

    stats.totalDetections++;

    // 更新统计值（基于真实倒计时）
    if (actualCountdown < stats.minCountdown) {
      stats.minCountdown = actualCountdown;
    }
    if (actualCountdown > stats.maxCountdown) {
      stats.maxCountdown = actualCountdown;
    }

    // 计算平均值（基于最近20次）
    const recentActualCountdowns = stats.detections.map(d => d.actualCountdown);
    stats.avgCountdown = (recentActualCountdowns.reduce((a, b) => a + b, 0) / recentActualCountdowns.length).toFixed(1);

    // 📊 输出检测统计日志
    logger.info(
      `📊 ${name} 检测统计: 倒计时${actualCountdown}秒 (显示${countdown}秒) | ` +
      `平均${stats.avgCountdown}秒 | ` +
      `最快${stats.minCountdown}秒 | ` +
      `最慢${stats.maxCountdown}秒 | ` +
      `总计${stats.totalDetections}次`
    );
  }

  /**
   * 保存数据到数据库
   */
  async saveToDatabase(lotCode, data) {
    try {
      const { period, issue, opencode, drawCode, drawTime, unixtime, extra, specialNumbers } = data;

      // 使用period或issue（兼容性）
      const finalIssue = (period || issue).toString();
      // 使用opencode或drawCode（兼容性）
      let finalDrawCode = opencode || drawCode;

      // 🎯 香港六合彩特殊处理：组合正码和特别号
      if (extra && lotCode === '60001') {
        finalDrawCode = `${finalDrawCode}|${extra}`;
      }

      // 🕐 时间处理：直接使用scraper返回的时间，或使用本地时区转换
      let mysqlDrawTime;
      if (drawTime && typeof drawTime === 'string') {
        // 检查是否已经是MySQL格式 (YYYY-MM-DD HH:MM:SS)
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(drawTime)) {
          // 已经是MySQL格式，直接使用（SG Lotteries）
          mysqlDrawTime = drawTime;
        } else {
          // 需要转换格式（SpeedyLot88的逗号分隔格式）
          try {
            const cleanedTime = drawTime.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
            const date = new Date(cleanedTime);

            if (!isNaN(date.getTime())) {
              // ✅ 使用本地时区方法，避免UTC转换
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              const seconds = String(date.getSeconds()).padStart(2, '0');
              mysqlDrawTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            } else {
              logger.warn(`时间解析失败: ${drawTime}，使用当前时间`);
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              const hours = String(now.getHours()).padStart(2, '0');
              const minutes = String(now.getMinutes()).padStart(2, '0');
              const seconds = String(now.getSeconds()).padStart(2, '0');
              mysqlDrawTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            }
          } catch (e) {
            logger.error(`时间转换异常: ${drawTime}`, e.message);
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            mysqlDrawTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
          }
        }
      } else {
        // 如果没有drawTime，使用当前时间
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        mysqlDrawTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }

      // 构建数据记录
      const dataToSave = {
        issue: finalIssue,
        drawCode: finalDrawCode,
        drawTime: mysqlDrawTime,
        unixtime: unixtime || null,  // 🚀 AU彩种特有：Unix时间戳，用于精确计算倒计时
        specialNumbers: specialNumbers || null  // 🎯 台湾宾果宾果等彩种的特码（超级奖号）
      };

      // 使用Database类的saveRealtimeData方法
      const saved = await database.saveRealtimeData(lotCode, dataToSave);
      return saved;

    } catch (error) {
      logger.error(`保存数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 降级轮询（降低频率）- 已整合到 pollOnce 中
   */
  degradePolling(state) {
    // 注意：降级逻辑已经整合到 pollOnce 中
    // 当连续错误达到阈值时，nextPollDelay 会自动使用 degradedPollingInterval
    logger.warn(
      `⚠️ ${state.name} 连续错误${state.consecutiveErrors}次，` +
      `将使用降级间隔${this.config.degradedPollingInterval / 1000}秒`
    );
  }

  /**
   * 🎯 香港六合彩智能轮询策略
   *
   * 开奖时间：每周二、四、六晚上 21:30
   * On.cc API延迟：通常3-10分钟后更新
   *
   * 轮询策略：
   * - 开奖日 21:25-21:45 → 每3秒（加密检测期）
   * - 开奖日 21:45-22:00 → 每10秒（延迟确认期）
   * - 开奖日其他时间 → 每5分钟（常规轮询）
   * - 非开奖日 → 每30分钟（低频检查）
   */
  calculateHKJCPollingDelay() {
    // 获取香港时间
    const now = new Date();
    const hkTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));

    const dayOfWeek = hkTime.getDay(); // 0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
    const hours = hkTime.getHours();
    const minutes = hkTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // 开奖日（周二、四、六）
    const isDrawDay = [2, 4, 6].includes(dayOfWeek);
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    if (isDrawDay) {
      // 开奖时段判断
      const drawTimeStart = 21 * 60 + 25; // 21:25
      const intensePeriodEnd = 21 * 60 + 45; // 21:45
      const delayPeriodEnd = 22 * 60; // 22:00

      if (totalMinutes >= drawTimeStart && totalMinutes < intensePeriodEnd) {
        // 21:25-21:45: 加密检测期，每3秒
        logger.info(`🔥 香港六合彩 [开奖日-加密期] ${dayNames[dayOfWeek]} ${currentTime} → 下次3.0秒后轮询`);
        return 3000;
      } else if (totalMinutes >= intensePeriodEnd && totalMinutes < delayPeriodEnd) {
        // 21:45-22:00: 延迟确认期，每10秒
        logger.info(`⏰ 香港六合彩 [开奖日-确认期] ${dayNames[dayOfWeek]} ${currentTime} → 下次10.0秒后轮询`);
        return 10000;
      } else {
        // 开奖日其他时间：每5分钟
        logger.info(`📅 香港六合彩 [开奖日-常规] ${dayNames[dayOfWeek]} ${currentTime} → 下次5.0分钟后轮询`);
        return 5 * 60 * 1000;
      }
    } else {
      // 非开奖日：每30分钟
      logger.info(`💤 香港六合彩 [非开奖日] ${dayNames[dayOfWeek]} ${currentTime} → 下次30.0分钟后轮询`);
      return 30 * 60 * 1000;
    }
  }

  /**
   * 🎯 检查彩种是否在开奖窗口内
   * @param {Object} lotteryConfig - 彩种配置
   * @returns {boolean} - 是否在开奖窗口内
   */
  isInDrawWindow(lotteryConfig) {
    const { drawSchedule } = lotteryConfig;

    // 如果没有 drawSchedule 或 mode 不是 'scheduled'，则不使用窗口调度
    if (!drawSchedule || drawSchedule.mode !== 'scheduled') {
      return true; // 默认总是轮询
    }

    const { drawDays, drawTime, triggerBeforeMinutes = 3, dataDelayMinutes = 10 } = drawSchedule;

    // 获取当前时间（上海时区）
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=周日, 1=周一, 2=周二...
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // 检查是否是开奖日
    if (!drawDays || !drawDays.includes(dayOfWeek)) {
      return false; // 非开奖日
    }

    // 解析开奖时间
    const [drawHour, drawMinute] = drawTime.split(':').map(Number);

    // 计算当前分钟数和开奖分钟数
    const currentMinutes = hours * 60 + minutes;
    const drawMinutes = drawHour * 60 + drawMinute;

    // 🎯 开奖窗口：开奖前N分钟到开奖后dataDelayMinutes分钟
    // 这确保在官方数据延迟期间持续轮询（台湾90分钟、福彩/体彩10分钟）
    const windowStart = drawMinutes - triggerBeforeMinutes;
    const windowEnd = drawMinutes + dataDelayMinutes;

    return currentMinutes >= windowStart && currentMinutes <= windowEnd;
  }

  /**
   * 🎯 检查彩种是否在数据延迟窗口内（开奖后等待官方数据发布）
   * @param {Object} lotteryConfig - 彩种配置
   * @returns {boolean} - 是否在数据延迟窗口内
   */
  isInDataDelayWindow(lotteryConfig) {
    const { drawSchedule } = lotteryConfig;

    if (!drawSchedule || drawSchedule.mode !== 'scheduled') {
      return false; // 非调度模式彩种不使用延迟窗口
    }

    const { drawDays, drawTime, dataDelayMinutes = 10 } = drawSchedule;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // 检查是否是开奖日
    if (!drawDays || !drawDays.includes(dayOfWeek)) {
      return false;
    }

    // 解析开奖时间
    const [drawHour, drawMinute] = drawTime.split(':').map(Number);

    const currentMinutes = hours * 60 + minutes;
    const drawMinutes = drawHour * 60 + drawMinute;

    // 数据延迟窗口：开奖时间到开奖后dataDelayMinutes分钟
    return currentMinutes >= drawMinutes && currentMinutes <= drawMinutes + dataDelayMinutes;
  }

  /**
   * 🎯 计算到下次开奖窗口的延迟时间
   * @param {Object} lotteryConfig - 彩种配置
   * @returns {number} - 延迟时间（毫秒）
   */
  calculateNextDrawWindowDelay(lotteryConfig) {
    const { drawSchedule } = lotteryConfig;

    if (!drawSchedule || drawSchedule.mode !== 'scheduled') {
      return 5000; // 默认5秒
    }

    const { drawDays, drawTime, triggerBeforeMinutes = 3, dataDelayMinutes = 10 } = drawSchedule;

    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();

    // 解析开奖时间
    const [drawHour, drawMinute] = drawTime.split(':').map(Number);

    // 计算到下一个开奖日的天数
    let daysUntilNextDraw = null;
    for (let i = 0; i <= 7; i++) {
      const checkDay = (currentDayOfWeek + i) % 7;
      if (drawDays.includes(checkDay)) {
        // 如果是今天，检查是否已过开奖窗口结束时间
        if (i === 0) {
          const currentTotalMinutes = currentHours * 60 + currentMinutes;
          const windowEnd = drawHour * 60 + drawMinute + dataDelayMinutes;
          if (currentTotalMinutes > windowEnd) {
            continue; // 今天的窗口已过，找下一个开奖日
          }
        }
        daysUntilNextDraw = i;
        break;
      }
    }

    if (daysUntilNextDraw === null) {
      // 理论上不应该到这里
      return 3600000; // 1小时后重试
    }

    // 计算到开奖窗口开始的时间
    const windowStartHour = drawHour;
    const windowStartMinute = drawMinute - triggerBeforeMinutes;

    // 构建目标时间
    const targetTime = new Date(now);
    targetTime.setDate(targetTime.getDate() + daysUntilNextDraw);
    targetTime.setHours(windowStartHour);
    targetTime.setMinutes(windowStartMinute);
    targetTime.setSeconds(0);
    targetTime.setMilliseconds(0);

    // 计算延迟（毫秒）
    const delay = targetTime.getTime() - now.getTime();

    // 最小1分钟，最大7天
    return Math.max(60000, Math.min(delay, 7 * 24 * 60 * 60 * 1000));
  }

  /**
   * 判断是否为极速彩种
   */
  isSpeedyLottery(lotCode) {
    // 极速彩种的lotCode特征
    const speedyLotCodes = ['10037', '10035', '10036', '10052', '10053', '10054', '10055'];
    return speedyLotCodes.includes(lotCode);
  }

  /**
   * 停止调度器
   */
  async stop() {
    logger.info('⏹️ 停止持续轮询调度器...');

    this.isRunning = false;

    // 清除所有定时器
    for (const [lotCode, timerInfo] of this.timers.entries()) {
      if (timerInfo.state && timerInfo.state.timeout) {
        clearTimeout(timerInfo.state.timeout);
      }
      logger.debug(`停止 ${timerInfo.state.name} 的轮询`);
    }

    this.timers.clear();

    logger.success('✅ 持续轮询调度器已停止');
  }

  /**
   * 重新加载彩种配置（热重载）
   */
  async reloadLotteries() {
    if (!this.isRunning) {
      logger.warn('调度器未运行，无需重载');
      return;
    }

    logger.info('🔄 重新加载彩种配置...');

    // 获取当前启用的彩种
    const enabledLotteries = lotteryConfigManager.getEnabledLotteries();
    const enabledLotCodes = new Set(enabledLotteries.map(l => l.lotCode));

    // 移除已禁用或删除的彩种
    for (const [lotCode, timerInfo] of this.timers.entries()) {
      if (!enabledLotCodes.has(lotCode)) {
        logger.info(`❌ 移除彩种: ${timerInfo.state.name} (${lotCode})`);
        if (timerInfo.state.timeout) {
          clearTimeout(timerInfo.state.timeout);
        }
        this.timers.delete(lotCode);
        this.lastPeriods.delete(lotCode);
      }
    }

    // 添加新彩种 或 更新现有彩种配置
    for (const lotteryConfig of enabledLotteries) {
      if (!this.timers.has(lotteryConfig.lotCode)) {
        // 新彩种：添加
        logger.info(`➕ 添加彩种: ${lotteryConfig.name} (${lotteryConfig.lotCode})`);
        this.startPolling(lotteryConfig);
      } else {
        // 已存在的彩种：更新配置（name、interval等）
        const timerInfo = this.timers.get(lotteryConfig.lotCode);
        const oldName = timerInfo.state.name;
        const oldInterval = timerInfo.state.baseInterval;

        // 更新配置
        timerInfo.state.name = lotteryConfig.name;
        timerInfo.state.baseInterval = lotteryConfig.interval * 1000;

        // 记录变化
        if (oldName !== lotteryConfig.name || oldInterval !== lotteryConfig.interval * 1000) {
          logger.info(`🔄 更新彩种配置: ${oldName} → ${lotteryConfig.name} (${lotteryConfig.lotCode})`);
        }
      }
    }

    logger.success(`✅ 彩种配置已重载 - 当前运行 ${this.timers.size} 个彩种`);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const lotteryStats = [];
    const now = Date.now();

    for (const [lotCode, timerInfo] of this.timers.entries()) {
      const { state } = timerInfo;
      const lastPeriod = this.lastPeriods.get(lotCode);

      // 计算距离上次轮询的秒数（用于显示活跃状态）
      const secondsSinceLastPoll = state.lastPollTime
        ? Math.floor((now - state.lastPollTime) / 1000)
        : 999;

      // 🎯 使用下次轮询延迟来判断状态（更准确）
      // 如果下次轮询延迟 <= 3秒，说明处于高频轮询阶段（刚开奖/即将开奖）→ "执行中"
      // 如果下次轮询延迟 > 3秒，说明处于常规轮询阶段 → "已调度"
      const nextPollDelaySeconds = (state.nextPollDelay || state.baseInterval) / 1000;
      const isHighFrequencyPolling = nextPollDelaySeconds <= 3;

      // 🎯 计算真实倒计时（对于有 drawSchedule 配置的彩种）
      let countdown = -1;
      let nextDrawTimeFormatted = `下次${nextPollDelaySeconds.toFixed(1)}秒后`;

      if (state.lotteryConfig && state.lotteryConfig.drawSchedule && state.lotteryConfig.drawSchedule.mode === 'scheduled') {
        const { drawSchedule } = state.lotteryConfig;
        const { drawDays, drawTime, triggerBeforeMinutes = 3 } = drawSchedule;

        const now = new Date();
        const currentDayOfWeek = now.getDay();
        const [drawHour, drawMinute] = drawTime.split(':').map(Number);

        // 找到下一个开奖日
        let daysUntilNextDraw = null;
        for (let i = 0; i <= 7; i++) {
          const checkDay = (currentDayOfWeek + i) % 7;
          if (drawDays.includes(checkDay)) {
            if (i === 0) {
              const currentHours = now.getHours();
              const currentMinutes = now.getMinutes();
              const currentTotalMinutes = currentHours * 60 + currentMinutes;
              const drawTotalMinutes = drawHour * 60 + drawMinute;
              if (currentTotalMinutes >= drawTotalMinutes + 10) {
                continue; // 今天的开奖已过，找下一个
              }
            }
            daysUntilNextDraw = i;
            break;
          }
        }

        if (daysUntilNextDraw !== null) {
          const nextDrawTime = new Date(now);
          nextDrawTime.setDate(nextDrawTime.getDate() + daysUntilNextDraw);
          nextDrawTime.setHours(drawHour);
          nextDrawTime.setMinutes(drawMinute);
          nextDrawTime.setSeconds(0);
          nextDrawTime.setMilliseconds(0);

          countdown = Math.max(0, Math.floor((nextDrawTime.getTime() - now.getTime()) / 1000));
          nextDrawTimeFormatted = `下次${countdown}秒后`;
        }
      }

      lotteryStats.push({
        lotCode,
        name: state.name,
        mode: '智能动态调度',
        baseInterval: state.baseInterval / 1000 + 's',
        lastPeriod: lastPeriod || '未知',
        consecutiveErrors: state.consecutiveErrors,
        lastPollTime: state.lastPollTime
          ? new Date(state.lastPollTime).toLocaleString('zh-CN')
          : '未轮询',
        lastSuccessTime: state.lastSuccessTime
          ? new Date(state.lastSuccessTime).toLocaleString('zh-CN')
          : '未成功',
        lastCrawlTimeFormatted: state.lastPollTime
          ? new Date(state.lastPollTime).toLocaleString('zh-CN')
          : '-',
        nextDrawTimeFormatted,  // 显示下次轮询/开奖时间
        retryCount: state.consecutiveErrors,
        countdown,  // 真实倒计时（有 drawSchedule 时）或 -1（动态调度模式）
        secondsSinceLastPoll,  // 距离上次轮询的秒数
        nextPollDelaySeconds,  // 下次轮询延迟（秒）
        status: state.consecutiveErrors > 0 ? 'error' :
                isHighFrequencyPolling ? 'crawling' :  // 高频轮询=执行中
                'scheduled'  // 常规轮询=已调度
      });
    }

    // 🎯 收集检测时间统计数据
    const detectionStatsArray = [];
    for (const [lotCode, stats] of this.detectionStats.entries()) {
      detectionStatsArray.push({
        lotCode: stats.lotCode,
        name: stats.name,
        totalDetections: stats.totalDetections,
        avgCountdown: parseFloat(stats.avgCountdown),
        minCountdown: stats.minCountdown === Infinity ? null : stats.minCountdown,
        maxCountdown: stats.maxCountdown === -Infinity ? null : stats.maxCountdown,
        drawInterval: stats.drawInterval,
        earlyFetch: stats.earlyFetch,
        recentDetections: stats.detections.slice(0, 10) // 最近10次
      });
    }

    return {
      isRunning: this.isRunning,  // 🐛 修复：添加 isRunning 字段，避免告警误报
      global: {
        totalPolls: this.stats.totalPolls,
        newDataFound: this.stats.newDataFound,
        duplicateData: this.stats.duplicateData,
        errors: this.stats.errors,
        successRate: (
          (this.stats.totalPolls - this.stats.errors) /
          (this.stats.totalPolls || 1) * 100
        ).toFixed(2) + '%'
      },
      lotteries: lotteryStats,
      detectionStats: detectionStatsArray  // 🎯 新期号检测时间统计
    };
  }

  /**
   * 获取彩种最后一次开奖的精确时间戳（毫秒）
   * @param {string} lotCode - 彩种代码
   * @returns {number|null} - 毫秒级时间戳，如果没有记录则返回null
   */
  getLastDrawTimestamp(lotCode) {
    return this.lastDrawTimestamps.get(lotCode) || null;
  }

  /**
   * 手动触发单个彩种轮询
   */
  async triggerPoll(lotCode) {
    const timerInfo = this.timers.get(lotCode);
    if (!timerInfo) {
      throw new Error(`彩种 ${lotCode} 未找到`);
    }

    logger.info(`🔄 手动触发轮询: ${timerInfo.state.name} (跳过窗口检查)`);
    await this.pollOnce(timerInfo.state, true); // skipWindowCheck = true
  }
}

// 导出单例
export default new ContinuousPollingScheduler();
