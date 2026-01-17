import axios from 'axios';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';

/**
 * 香港六合彩 Mark Six 爬虫 - 实时数据源
 *
 * 🎯 双数据源架构：
 * - 实时数据：On.cc API（本爬虫）- 快速、稳定、最新数据
 * - 历史数据：cpzhan.com (CPZhanHistoryScraper) - 完整历史数据（1976-2025）
 *
 * 📊 On.cc API 说明：
 * - 数据源：https://win.on.cc/marksix/markSixRealTime.js
 * - 提供商：On.cc 东网（香港东方日报集团）
 * - 数据格式：JSON 数组，包含最近 154 期开奖结果
 * - 更新频率：每期开奖后实时更新
 * - 响应速度：~420ms
 * - 数据准确性：已验证与官方数据一致 ✅
 *
 * ⏰ 开奖时间：每周二、四、六晚上 21:30 (HKT)
 * 🚫 停售时间：开奖当天 21:15 (HKT)
 *
 * 💡 使用建议：
 * - 实时轮询：使用本爬虫（On.cc API）
 * - 历史补充：使用 CPZhanHistoryScraper + importHKJCHistory.js 脚本
 * - 数据验证：两个数据源互为验证
 */
class HKJCScraper {
  constructor() {
    // On.cc 数据源
    this.baseUrl = 'https://win.on.cc';
    this.apiUrl = `${this.baseUrl}/marksix/markSixRealTime.js`;

    // 开奖时间配置（香港时间，UTC+8）
    this.drawDays = [2, 4, 6]; // 周二、周四、周六
    this.drawTime = { hour: 21, minute: 30 }; // 晚上9:30
    this.stopSellTime = { hour: 21, minute: 15 }; // 停售时间
  }

  /**
   * 获取最新开奖数据
   */
  async fetchLatestData(lotCode = 'hklhc', retryCount = 0, maxRetries = 3) {
    try {
      logger.info(`[HKJC] 🚀 请求 On.cc API${retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : ''}`);

      const response = await axios.get(this.apiUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, */*',
          'Referer': 'https://win.on.cc/marksix/index.html'
        }
      });

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('API返回数据格式错误或为空');
      }

      // 解析最新一期数据（数组第一个元素）
      const latestData = this.parseOnccData(response.data[0]);

      if (!latestData || !latestData.period) {
        throw new Error('数据解析失败');
      }

      logger.info(`[HKJC] ✅ 成功获取数据 - 期号: ${latestData.period}`);
      return latestData;

    } catch (error) {
      if (retryCount < maxRetries) {
        logger.warn(`[HKJC] ⏳ 请求失败，准备重试 (${retryCount + 1}/${maxRetries}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      logger.error(`[HKJC] ❌ 获取数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 解析 On.cc API 数据
   *
   * 数据格式示例：
   * {
   *   "drawNumber": "25/133",              // 期号
   *   "drawDate": "2025-12-25",            // 开奖日期
   *   "drawResult": "1,2,4,30,41,43,13",   // 开奖号码（前6个正码，最后1个特别号）
   *   "nextDrawNumber": "25/134",          // 下期期号
   *   "nextDrawDate": "2025-12-28",        // 下期日期
   *   "stopSellingTime": "21:15",          // 停售时间
   *   "jackpot": "24216278",               // 多宝金额
   *   ...
   * }
   */
  parseOnccData(data) {
    if (!data || !data.drawNumber || !data.drawResult) {
      return null;
    }

    // 分离正码和特别号
    const numbers = data.drawResult.split(',');
    const regularNumbers = numbers.slice(0, 6); // 前6个正码
    const specialNumber = numbers[6]; // 第7个是特别号

    // 构建开奖时间（开奖日期 + 开奖时间）
    const opentime = data.drawDate
      ? `${data.drawDate} 21:30:00`
      : null;

    return {
      period: data.drawNumber.replace('/', ''), // 移除斜杠：25/133 → 25133
      opencode: regularNumbers.join(','),       // 只包含正码：1,2,4,30,41,43
      specialNumbers: specialNumber ? [specialNumber] : [],  // ✅ 改为数组格式，与数据库字段匹配
      extra: specialNumber,                     // 保留extra字段供其他代码使用
      opentime: opentime,                       // 开奖时间
      countdown: this.calculateNextDrawCountdown(data.nextDrawDate), // ✅ 传入API返回的下期日期

      // 额外信息
      _metadata: {
        drawDate: data.drawDate,
        nextDrawNumber: data.nextDrawNumber,
        nextDrawDate: data.nextDrawDate,
        jackpot: data.jackpot,
        totalTurnover: data.totalTurnover,
        source: 'oncc'
      }
    };
  }

  /**
   * 计算距离下次开奖的倒计时（秒）
   *
   * ✅ 优先使用On.cc API返回的nextDrawDate（因为有假期调整等特殊情况）
   *
   * @param {string} nextDrawDate - On.cc API返回的下期开奖日期（格式：YYYY-MM-DD）
   * @returns {number} 倒计时秒数
   */
  calculateNextDrawCountdown(nextDrawDate = null) {
    const now = new Date();

    // 🎯 优先使用API返回的下期日期（处理假期、跨年等特殊情况）
    if (nextDrawDate) {
      try {
        // nextDrawDate格式：2026-01-03
        const nextDraw = new Date(`${nextDrawDate} 21:30:00`);
        const countdown = Math.floor((nextDraw - now) / 1000);
        return Math.max(0, countdown);
      } catch (error) {
        logger.warn(`[HKJC] 解析下期日期失败: ${nextDrawDate}，使用规则计算`);
      }
    }

    // 🔄 Fallback：按周二、四、六规则计算（仅在API未提供nextDrawDate时使用）
    let nextDraw = new Date(now);
    nextDraw.setHours(this.drawTime.hour, this.drawTime.minute, 0, 0);

    const currentDay = now.getDay();
    if (this.drawDays.includes(currentDay) && now < nextDraw) {
      // 使用今天的开奖时间
    } else {
      // 找下一个开奖日
      let daysToAdd = 1;
      while (daysToAdd < 7) {
        const testDay = (currentDay + daysToAdd) % 7;
        if (this.drawDays.includes(testDay)) {
          nextDraw.setDate(nextDraw.getDate() + daysToAdd);
          break;
        }
        daysToAdd++;
      }
    }

    const countdown = Math.floor((nextDraw - now) / 1000);
    return Math.max(0, countdown);
  }

  /**
   * 获取历史数据
   * On.cc API 返回最近10期数据
   */
  async fetchHistoryData(lotCode = 'hklhc', limit = 10) {
    try {
      logger.info(`[HKJC] 📜 请求历史数据，数量: ${limit}`);

      const response = await axios.get(this.apiUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, */*',
          'Referer': 'https://win.on.cc/marksix/index.html'
        }
      });

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('API返回数据格式错误');
      }

      // 解析所有历史数据
      const historyData = response.data
        .slice(0, limit) // 限制返回数量
        .map(item => this.parseOnccData(item))
        .filter(item => item !== null); // 过滤掉解析失败的数据

      logger.info(`[HKJC] ✅ 成功获取 ${historyData.length} 期历史数据`);
      return historyData;

    } catch (error) {
      logger.error(`[HKJC] 历史数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      // 测试 API 连接
      const response = await axios.get(this.apiUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });

      const isHealthy = response.status === 200 &&
                       Array.isArray(response.data) &&
                       response.data.length > 0;

      return {
        healthy: isHealthy,
        statusCode: response.status,
        dataSource: 'On.cc 东网',
        apiUrl: this.apiUrl,
        dataCount: response.data ? response.data.length : 0,
        latestPeriod: response.data[0]?.drawNumber || 'N/A'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        dataSource: 'On.cc 东网',
        apiUrl: this.apiUrl
      };
    }
  }
}

export default HKJCScraper;
