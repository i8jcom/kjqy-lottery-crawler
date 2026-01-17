import axios from 'axios';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';

/**
 * 台湾宾果彩票爬虫 - 使用官方API
 * 🇹🇼 数据来源: https://api.taiwanlottery.com/TLCAPIWeB/Lottery
 *
 * 支持彩种：
 * - bingo - 宾果宾果 (20个号码，每5分钟一期)
 *
 * ✅ 技术方案：直接调用官方JSON API
 * ⚡ 性能：极快（~200ms，无需HTML解析）
 * 🎯 准确性：100%（官方数据）
 * 📊 频率：每天约202期（07:05 - 23:55，每5分钟）
 */
class TaiwanBingoScraper {
  constructor() {
    this.domainManager = universalDomainManager;
    this.sourceType = 'taiwanlottery';

    // 台湾彩票官方API基础URL
    this.apiBaseUrl = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery';

    // Bingo彩种代码
    this.lotCode = '100007';  // 台湾宾果彩种代码
    this.lotteryName = '宾果宾果';
  }

  /**
   * 获取当前日期（格式：2026-01-04）
   */
  getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取宾果最新数据（使用官方API）
   */
  async fetchLatestData(lotCode, retryCount = 0, maxRetries = 2) {
    const startTime = Date.now();

    try {
      // 构建API URL（获取最新一期）
      const apiUrl = `${this.apiBaseUrl}/LatestBingoResult`;

      logger.info(`[TaiwanBingo] 🇹🇼 API请求: ${apiUrl}${retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : ''}`);

      const response = await axios.get(apiUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
          'Origin': 'https://www.taiwanlottery.com',
          'Referer': 'https://www.taiwanlottery.com/'
        }
      });

      const responseTime = Date.now() - startTime;

      // 解析API响应
      const result = this.parseAPIResponse(response.data);

      if (!result) {
        throw new Error('API返回数据为空或格式错误');
      }

      // 将lotCode添加到结果中
      result.lotCode = lotCode || this.lotCode;

      // 🎯 计算倒计时（宾果每5分钟一期）
      result.officialCountdown = this.calculateCountdown();

      // 记录成功（使用虚拟域名管理）
      try {
        const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
        await this.domainManager.recordSuccess(currentDomain.id, responseTime);
      } catch (err) {
        // 域名管理失败不影响数据获取
        logger.debug('[TaiwanBingo] 域名管理记录失败:', err.message);
      }

      logger.info(`[TaiwanBingo] ✅ 成功获取 ${this.lotteryName} 第${result.period}期数据 (${responseTime}ms)`);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // 记录失败
      try {
        const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
        await this.domainManager.recordFailure(currentDomain.id, error, true);
      } catch (err) {
        // 忽略
      }

      // 重试机制
      if (retryCount < maxRetries &&
          (error.code === 'ECONNABORTED' ||
           error.code === 'ETIMEDOUT' ||
           error.code === 'ECONNRESET' ||
           error.code === 'ECONNREFUSED')) {
        logger.warn(`[TaiwanBingo] ⚠️ API请求失败 (${error.message})，2秒后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      logger.error(`[TaiwanBingo] ❌ 获取失败 (已重试${retryCount}次):`, error.message);
      throw error;
    }
  }

  /**
   * 🎯 计算倒计时（宾果每5分钟一期）
   * @returns {number} 倒计时秒数
   */
  calculateCountdown() {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      // 宾果开奖时间：07:05 - 23:55，每5分钟一期
      // 开奖分钟：05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
      const validMinutes = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

      // 如果在开奖时间段外（00:00-07:05 或 23:55-24:00）
      if (currentHour < 7 || (currentHour === 7 && currentMinute < 5)) {
        // 下次开奖是今天07:05
        const nextDraw = new Date(now);
        nextDraw.setHours(7, 5, 0, 0);
        return Math.max(0, Math.floor((nextDraw.getTime() - now.getTime()) / 1000));
      }

      if (currentHour === 23 && currentMinute >= 55) {
        // 下次开奖是明天07:05
        const nextDraw = new Date(now);
        nextDraw.setDate(nextDraw.getDate() + 1);
        nextDraw.setHours(7, 5, 0, 0);
        return Math.max(0, Math.floor((nextDraw.getTime() - now.getTime()) / 1000));
      }

      // 在开奖时间段内，找到下一个开奖分钟
      let nextMinute = null;
      for (const minute of validMinutes) {
        if (currentMinute < minute) {
          nextMinute = minute;
          break;
        }
      }

      // 如果当前小时内找不到下一个开奖分钟
      if (nextMinute === null) {
        // 进入下一个小时的第一个开奖分钟
        const nextDraw = new Date(now);
        if (currentHour < 23) {
          nextDraw.setHours(currentHour + 1, 5, 0, 0);
        } else {
          // 已经是23点，下一期是明天07:05
          nextDraw.setDate(nextDraw.getDate() + 1);
          nextDraw.setHours(7, 5, 0, 0);
        }
        return Math.max(0, Math.floor((nextDraw.getTime() - now.getTime()) / 1000));
      }

      // 计算到下一个开奖分钟的倒计时
      const nextDraw = new Date(now);
      nextDraw.setMinutes(nextMinute, 0, 0);
      const countdown = Math.max(0, Math.floor((nextDraw.getTime() - now.getTime()) / 1000));

      logger.debug(`[TaiwanBingo] 倒计时: ${countdown}秒 (下次开奖: ${nextDraw.toLocaleTimeString('zh-CN')})`);
      return countdown;

    } catch (error) {
      logger.error('[TaiwanBingo] 计算倒计时失败:', error.message);
      return 0;
    }
  }

  /**
   * 解析API响应数据
   */
  parseAPIResponse(apiData) {
    try {
      // 检查响应状态
      if (apiData.rtCode !== 0) {
        throw new Error(`API返回错误: ${apiData.rtMsg || 'Unknown error'}`);
      }

      const content = apiData.content;
      if (!content) {
        throw new Error('API返回数据为空');
      }

      // 最新数据API使用 lotteryBingoLatestPost，历史数据API使用 bingoQueryResult
      const latestResult = content.lotteryBingoLatestPost || (content.bingoQueryResult && content.bingoQueryResult[0]);
      if (!latestResult) {
        throw new Error('未找到宾果数据');
      }

      // 提取开奖号码（使用bigShowOrder，官方展示顺序，按数字大小排序）
      const numbers = latestResult.bigShowOrder || [];

      // 提取超级奖号（正中靶心号 Bull's Eye）
      const bullEye = latestResult.prizeNum?.bullEye;
      if (bullEye) {
        logger.info(`[TaiwanBingo] 🎯 提取到超级奖号: ${bullEye}`);
      }

      // 格式化日期时间
      // 最新数据API使用 dDate，历史数据API使用 openDate
      const drawDate = latestResult.dDate || latestResult.openDate || this.getCurrentDate();
      const openDate = drawDate.split('T')[0];  // 2026-01-04
      const openTime = drawDate.split('T')[1]?.substring(0, 8) || '00:00:00';  // 21:00:00
      const drawTime = `${openDate} ${openTime}`;

      return {
        lotCode: this.lotCode,
        period: String(latestResult.drawTerm),
        numbers: numbers,
        mainNumbers: numbers,
        specialNumbers: bullEye ? [bullEye] : [],  // 超级奖号作为特码
        opencode: numbers.join(','),
        drawDate: openDate,
        drawTime: drawTime,
        timestamp: Date.now(),
        source: 'taiwanlottery_bingo_api',
        lotteryName: this.lotteryName,
        rawData: latestResult // 保留原始数据供调试
      };

    } catch (error) {
      logger.error(`[TaiwanBingo] API数据解析失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取历史数据（按日期）
   * @param {string} lotCode - 彩种代码
   * @param {string} date - 日期（格式：2026-01-04 或 2026-01）
   */
  async fetchHistoryData(lotCode, date = null) {
    const startTime = Date.now();

    try {
      // 如果date是年月格式（2026-01），转换为具体日期范围
      let targetDate = date;
      if (!targetDate) {
        targetDate = this.getCurrentDate();
      } else if (targetDate.length === 7) {
        // 年月格式，取该月第一天
        targetDate = `${targetDate}-01`;
      }

      // 宾果每天约202期，使用pageSize=250确保获取全天数据
      const pageSize = 250;
      const allRecords = [];

      // 获取该日期的所有数据（可能需要分页）
      let pageNum = 1;
      let hasMore = true;

      while (hasMore) {
        const apiUrl = `${this.apiBaseUrl}/BingoResult?openDate=${targetDate}&pageNum=${pageNum}&pageSize=${pageSize}`;

        logger.info(`[TaiwanBingo] 🔍 获取历史数据: ${apiUrl}`);

        const response = await axios.get(apiUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'zh-TW,zh;q=0.9',
            'Origin': 'https://www.taiwanlottery.com',
            'Referer': 'https://www.taiwanlottery.com/'
          }
        });

        const records = this.parseHistoryAPIResponse(response.data, targetDate);
        allRecords.push(...records);

        // 检查是否还有更多数据
        const totalSize = response.data?.content?.totalSize || 0;
        if (allRecords.length >= totalSize) {
          hasMore = false;
        } else {
          pageNum++;
          await new Promise(resolve => setTimeout(resolve, 200));  // 限流
        }
      }

      const responseTime = Date.now() - startTime;
      logger.info(`[TaiwanBingo] ✅ 获取 ${this.lotteryName} ${targetDate} 历史数据 ${allRecords.length} 条 (${responseTime}ms)`);
      return allRecords;

    } catch (error) {
      logger.error(`[TaiwanBingo] 获取历史数据失败: ${date}`, error.message);
      throw error;
    }
  }

  /**
   * 解析历史数据API响应
   * @param {Object} apiData - API响应数据
   * @param {string} queryDate - 查询的日期（格式：2026-01-04）
   */
  parseHistoryAPIResponse(apiData, queryDate = null) {
    try {
      if (apiData.rtCode !== 0) {
        return [];
      }

      const content = apiData.content;
      if (!content || content.totalSize === 0) {
        return [];
      }

      const results = content.bingoQueryResult || [];

      return results.map(item => {
        const numbers = item.bigShowOrder || [];

        // 历史API不返回具体时间，使用查询日期
        // 由于每天有~202期，无法精确推断每期的具体时间，所以使用日期即可
        const drawTime = queryDate || this.getCurrentDate();

        // 提取超级奖号（历史API使用 bullEyeTop 字段）
        const bullEye = item.bullEyeTop;
        if (bullEye) {
          logger.info(`[TaiwanBingo] 🎯 历史数据提取超级奖号: 第${item.drawTerm}期 = ${bullEye}`);
        }

        return {
          issue: String(item.drawTerm),
          draw_code: numbers.join(','),
          drawCode: numbers.join(','),
          draw_time: drawTime,
          drawTime: drawTime,
          specialNumbers: bullEye ? [bullEye] : [],  // 🎯 超级奖号（正中靶心号 Bull's Eye）
          source: 'taiwanlottery_bingo_api'
        };
      });

    } catch (error) {
      logger.error('[TaiwanBingo] 解析历史API数据失败:', error.message);
      return [];
    }
  }

  /**
   * 检查服务是否可用
   */
  async checkHealth() {
    try {
      const testUrl = `${this.apiBaseUrl}/LatestBingoResult`;

      const response = await axios.get(testUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      return response.data && response.data.rtCode === 0;
    } catch (error) {
      logger.error('[TaiwanBingo] API服务不可用:', error.message);
      return false;
    }
  }
}

// 导出单例
export default new TaiwanBingoScraper();
