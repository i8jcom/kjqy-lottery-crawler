import logger from './Logger.js';

/**
 * 智能倒计时计算器
 * 根据历史开奖时间自动计算和修正倒计时
 */
class CountdownCalculator {
  constructor() {
    // 缓存每个彩种的实际开奖间隔
    this.intervalCache = new Map();
    // 缓存过期时间（10分钟）
    this.cacheExpiry = 10 * 60 * 1000;
  }

  /**
   * 智能计算倒计时
   * @param {string} lotCode - 彩种代码
   * @param {number} lastDrawUnixtime - 最新一期开奖Unix时间戳（秒）
   * @param {number} expectedInterval - 预期开奖间隔（秒），默认300
   * @param {Array} recentDrawTimes - 最近几期的开奖时间数组（可选，用于计算实际间隔）
   * @returns {Object} {countdown, actualInterval, isAdjusted}
   */
  calculateCountdown(lotCode, lastDrawUnixtime, expectedInterval = 300, recentDrawTimes = null) {
    const currentTime = Math.floor(Date.now() / 1000);

    // 1. 获取实际开奖间隔
    let actualInterval = this.getActualInterval(lotCode, expectedInterval, recentDrawTimes);

    // 2. 计算下一期开奖时间
    const nextDrawTime = lastDrawUnixtime + actualInterval;

    // 3. 计算倒计时
    const countdown = Math.max(0, nextDrawTime - currentTime);

    // 4. 判断是否进行了调整
    const isAdjusted = actualInterval !== expectedInterval;

    if (isAdjusted) {
      logger.debug(
        `[CountdownCalculator] ${lotCode} 倒计时已调整: ` +
        `预期间隔=${expectedInterval}秒, 实际间隔=${actualInterval}秒, ` +
        `倒计时=${countdown}秒`
      );
    }

    return {
      countdown,
      actualInterval,
      isAdjusted,
      nextDrawTime,
      lastDrawTime: lastDrawUnixtime,
      currentTime
    };
  }

  /**
   * 获取实际开奖间隔（带缓存和智能计算）
   * @param {string} lotCode - 彩种代码
   * @param {number} expectedInterval - 预期间隔
   * @param {Array} recentDrawTimes - 最近几期的开奖时间（Unix时间戳数组）
   * @returns {number} 实际间隔（秒）
   */
  getActualInterval(lotCode, expectedInterval, recentDrawTimes) {
    // 1. 检查缓存
    const cached = this.intervalCache.get(lotCode);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.interval;
    }

    // 2. 如果提供了最近开奖时间，计算实际间隔
    if (recentDrawTimes && recentDrawTimes.length >= 3) {
      const calculatedInterval = this.calculateAverageInterval(recentDrawTimes);

      // 3. 如果实际间隔与预期偏差超过10秒，使用实际间隔
      const deviation = Math.abs(calculatedInterval - expectedInterval);
      if (deviation > 10) {
        logger.info(
          `[CountdownCalculator] ${lotCode} 检测到开奖间隔偏差${deviation}秒，` +
          `使用实际间隔${calculatedInterval}秒（预期${expectedInterval}秒）`
        );

        // 缓存实际间隔
        this.intervalCache.set(lotCode, {
          interval: calculatedInterval,
          timestamp: Date.now()
        });

        return calculatedInterval;
      }
    }

    // 4. 使用预期间隔
    return expectedInterval;
  }

  /**
   * 计算平均开奖间隔
   * @param {Array} drawTimes - 开奖时间数组（Unix时间戳，从旧到新排序）
   * @returns {number} 平均间隔（秒）
   */
  calculateAverageInterval(drawTimes) {
    if (!drawTimes || drawTimes.length < 2) {
      return null;
    }

    // 计算相邻期次的时间间隔
    const intervals = [];
    for (let i = 1; i < drawTimes.length; i++) {
      const interval = drawTimes[i] - drawTimes[i - 1];

      // 过滤异常值（小于60秒或大于600秒的间隔）
      if (interval >= 60 && interval <= 600) {
        intervals.push(interval);
      }
    }

    if (intervals.length === 0) {
      return null;
    }

    // 计算平均值
    const sum = intervals.reduce((a, b) => a + b, 0);
    const average = Math.round(sum / intervals.length);

    logger.debug(
      `[CountdownCalculator] 计算平均间隔: ` +
      `样本=${intervals.length}个, 间隔=[${intervals.join(',')}]秒, ` +
      `平均=${average}秒`
    );

    return average;
  }

  /**
   * 从数据库记录计算实际间隔
   * @param {Array} dbRecords - 数据库记录数组 [{draw_time, unixtime}, ...]
   * @returns {number} 平均间隔（秒）
   */
  calculateIntervalFromDB(dbRecords) {
    if (!dbRecords || dbRecords.length < 2) {
      return null;
    }

    // 提取Unix时间戳
    const unixtimes = dbRecords
      .map(r => r.unixtime || this.parseDrawTimeToUnix(r.draw_time))
      .filter(t => t !== null)
      .sort((a, b) => a - b); // 从旧到新排序

    return this.calculateAverageInterval(unixtimes);
  }

  /**
   * 将draw_time字符串转换为Unix时间戳
   * @param {string} drawTime - "2025-12-24 11:15:00"
   * @returns {number} Unix时间戳（秒）
   */
  parseDrawTimeToUnix(drawTime) {
    try {
      // 假设drawTime是服务器本地时区（UTC+8）
      const date = new Date(drawTime);
      return Math.floor(date.getTime() / 1000);
    } catch (e) {
      return null;
    }
  }

  /**
   * 清除缓存
   * @param {string} lotCode - 彩种代码（可选，不提供则清除所有）
   */
  clearCache(lotCode = null) {
    if (lotCode) {
      this.intervalCache.delete(lotCode);
      logger.debug(`[CountdownCalculator] 已清除 ${lotCode} 的间隔缓存`);
    } else {
      this.intervalCache.clear();
      logger.debug('[CountdownCalculator] 已清除所有间隔缓存');
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    const stats = {};
    for (const [lotCode, data] of this.intervalCache.entries()) {
      const age = Date.now() - data.timestamp;
      stats[lotCode] = {
        interval: data.interval,
        ageMinutes: Math.floor(age / 60000),
        expiresIn: Math.max(0, this.cacheExpiry - age)
      };
    }
    return stats;
  }
}

// 导出单例
export default new CountdownCalculator();
