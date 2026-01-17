import logger from '../utils/Logger.js';

/**
 * 🕐 倒计时管理器
 *
 * 核心职责：
 * 1. 存储每个彩种的倒计时基准值（由Scraper更新）
 * 2. 每秒递减倒计时并推送给WebSocket订阅者
 * 3. 提供倒计时查询接口
 *
 * 设计原则：
 * - 后端是唯一权威源（Scraper监控官网倒计时）
 * - 前端不做任何倒计时计算，只展示后端推送的值
 * - 每秒主动推送，确保实时同步
 */
class CountdownManager {
  static instance = null; // 🎯 单例实例

  constructor(webSocketManager) {
    this.webSocketManager = webSocketManager;

    /**
     * 倒计时状态存储
     * Map<lotCode, { countdown, lastUpdate, period, drawTime }>
     */
    this.countdowns = new Map();

    /**
     * 定时器ID
     */
    this.intervalId = null;

    /**
     * 是否已启动
     */
    this.isRunning = false;

    // 🎯 保存单例实例
    CountdownManager.instance = this;
  }

  /**
   * 获取CountdownManager单例实例
   */
  static getInstance() {
    return CountdownManager.instance;
  }

  /**
   * 启动倒计时管理器
   */
  start() {
    if (this.isRunning) {
      logger.warn('[CountdownManager] 倒计时管理器已经在运行');
      return;
    }

    logger.info('[CountdownManager] 🚀 启动倒计时管理器（每秒推送一次）');

    // 每1000ms（1秒）执行一次
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);

    this.isRunning = true;
  }

  /**
   * 停止倒计时管理器
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('[CountdownManager] 🛑 停止倒计时管理器');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
  }

  /**
   * 更新彩种倒计时（由Scraper调用）
   *
   * @param {string} lotCode - 彩种代码
   * @param {object} data - 彩种数据
   * @param {number} data.officialCountdown - 官方倒计时（秒）
   * @param {string} data.period - 期号
   * @param {string} data.drawTime - 开奖时间
   */
  updateCountdown(lotCode, data) {
    const { officialCountdown, period, drawTime } = data;

    // 📝 记录倒计时基准值
    const oldState = this.countdowns.get(lotCode);
    this.countdowns.set(lotCode, {
      countdown: officialCountdown || 0,
      lastUpdate: Date.now(),
      period: period,
      drawTime: drawTime
    });

    // 📊 日志：记录倒计时更新
    if (oldState && oldState.period !== period) {
      logger.info(
        `[CountdownManager] 🆕 ${lotCode} 新期号: ${period}, 倒计时重置为 ${officialCountdown}秒`
      );
    } else {
      logger.debug(
        `[CountdownManager] 🔄 ${lotCode} 倒计时更新: ${officialCountdown}秒 (期号: ${period})`
      );
    }
  }

  /**
   * 获取彩种当前倒计时
   *
   * @param {string} lotCode - 彩种代码
   * @returns {number|null} 倒计时（秒），不存在返回null
   */
  getCountdown(lotCode) {
    const state = this.countdowns.get(lotCode);
    return state ? state.countdown : null;
  }

  /**
   * 获取彩种倒计时状态
   *
   * @param {string} lotCode - 彩种代码
   * @returns {object|null} 倒计时状态对象
   */
  getState(lotCode) {
    return this.countdowns.get(lotCode) || null;
  }

  /**
   * 定时器tick：递减倒计时并推送
   *
   * 🎯 稀疏推送策略（针对5000+客户端优化）：
   * - 倒计时 > 60秒：每60秒推送1次
   * - 倒计时 30-60秒：每30秒推送1次
   * - 倒计时 10-30秒：每10秒推送1次
   * - 倒计时 < 10秒：每秒推送1次
   * - 关键时刻：0秒（开奖）、10秒、30秒、60秒必推送
   */
  async tick() {
    const now = Date.now();
    const updates = [];

    // 🔄 遍历所有彩种，递减倒计时
    for (const [lotCode, state] of this.countdowns.entries()) {
      // 倒计时大于0才递减
      if (state.countdown > 0) {
        state.countdown--;
        state.lastUpdate = now;

        // 🎯 智能推送策略：只在关键时刻推送（减少95%消息量）
        const shouldPush =
          state.countdown === 0 ||               // 倒计时归零（必推送）
          state.countdown === 10 ||              // 即将开奖（10秒提醒）
          state.countdown === 30 ||              // 30秒提醒
          state.countdown === 60 ||              // 1分钟提醒
          (state.countdown > 60 && state.countdown % 60 === 0) || // 每整分钟同步
          (state.countdown > 30 && state.countdown <= 60 && state.countdown % 30 === 0) || // 30-60秒：每30秒
          (state.countdown > 10 && state.countdown <= 30 && state.countdown % 10 === 0) || // 10-30秒：每10秒
          (state.countdown < 10);                 // 最后10秒：每秒推送

        if (shouldPush) {
          // 📦 收集需要推送的更新
          updates.push({
            lotCode,
            countdown: state.countdown,
            period: state.period,
            drawTime: state.drawTime
          });
        }

        // 📊 倒计时归零时记录日志
        if (state.countdown === 0) {
          logger.info(
            `[CountdownManager] ⏰ ${lotCode} 倒计时归零 (期号: ${state.period})`
          );
        }
      }
    }

    // 📡 批量推送倒计时更新
    if (updates.length > 0) {
      await this.broadcastCountdownUpdates(updates);

      // 📊 性能日志（仅在DEBUG模式）
      if (updates.length > 0 && updates.some(u => u.countdown % 60 === 0)) {
        logger.debug(
          `[CountdownManager] 📊 推送${updates.length}个彩种更新（稀疏推送策略）`
        );
      }
    }
  }

  /**
   * 批量推送倒计时更新（优化：一次性推送所有彩种）
   *
   * @param {Array} updates - 更新列表 [{ lotCode, countdown, period, drawTime }]
   */
  async broadcastCountdownUpdates(updates) {
    if (updates.length === 0) return;

    // 🎯 优化：批量推送所有彩种的倒计时（减少消息数量）
    // 从"每秒N条消息"优化为"每秒1条批量消息"
    const batchData = {
      type: 'countdown_batch',
      timestamp: Date.now(),
      countdowns: updates.map(update => ({
        lotCode: update.lotCode,
        countdown: update.countdown,
        period: update.period,
        drawTime: update.drawTime
      }))
    };

    try {
      // 广播批量倒计时更新给所有WebSocket客户端
      await this.webSocketManager.broadcastCountdownBatch(batchData);

      logger.debug(
        `[CountdownManager] 📤 批量推送 ${updates.length} 个彩种倒计时`
      );
    } catch (error) {
      logger.error(
        `[CountdownManager] ❌ 批量推送倒计时失败:`,
        error.message
      );
    }
  }

  /**
   * 获取所有彩种倒计时状态（用于调试）
   */
  getAllStates() {
    const states = {};
    for (const [lotCode, state] of this.countdowns.entries()) {
      states[lotCode] = { ...state };
    }
    return states;
  }

  /**
   * 清除彩种倒计时状态
   */
  clearCountdown(lotCode) {
    this.countdowns.delete(lotCode);
    logger.debug(`[CountdownManager] 🗑️ 清除 ${lotCode} 倒计时状态`);
  }

  /**
   * 清除所有倒计时状态
   */
  clearAll() {
    this.countdowns.clear();
    logger.info('[CountdownManager] 🗑️ 清除所有倒计时状态');
  }
}

export default CountdownManager;
