/**
 * 台湾49选6爬虫
 * 官网: https://www.taiwanlottery.com/lotto/result/49_m6
 * API: https://api.taiwanlottery.com/TLCAPIWeB/Lottery/49M6Result
 */
import axios from 'axios';
import logger from '../utils/Logger.js';

class Taiwan49M6Scraper {
  constructor() {
    this.apiBaseUrl = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery';
    this.lotCode = '100009';
    this.lotteryName = '49选6';
  }

  /**
   * 获取最新开奖数据
   */
  async fetchLatestData(lotCode, retryCount = 0, maxRetries = 2) {
    try {
      logger.info(`[Taiwan49M6] 开始获取最新数据 (lotCode=${lotCode})`);

      // 获取当前月份
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const apiUrl = `${this.apiBaseUrl}/49M6Result?period&month=${currentMonth}&endMonth=${currentMonth}&pageNum=1&pageSize=1`;

      logger.info(`[Taiwan49M6] API请求: ${apiUrl}`);

      const response = await axios.get(apiUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.data || !response.data.content || !response.data.content.m649Res) {
        throw new Error('API返回数据格式异常');
      }

      const latestResult = response.data.content.m649Res[0];
      if (!latestResult) {
        throw new Error('未获取到最新开奖数据');
      }

      const numbers = latestResult.drawNumberSize || [];

      // 格式化开奖时间
      const drawTime = latestResult.lotteryDate
        ? latestResult.lotteryDate.split('T')[0] + ' 00:00:00'
        : new Date().toISOString().split('T')[0] + ' 00:00:00';

      const result = {
        lotCode: this.lotCode,
        period: String(latestResult.period),
        numbers: numbers,
        mainNumbers: numbers,
        specialNumbers: [], // 49M6没有特别号
        opencode: numbers.join(','),
        drawTime: drawTime,
        source: 'taiwanlottery_49m6_api'
      };

      logger.info(`[Taiwan49M6] ✅ 获取成功: 期号=${result.period}, 号码=${result.opencode}`);
      return result;

    } catch (error) {
      logger.error(`[Taiwan49M6] ❌ 获取失败 (尝试${retryCount + 1}/${maxRetries + 1}): ${error.message}`);

      if (retryCount < maxRetries) {
        logger.info(`[Taiwan49M6] 🔄 ${2 ** retryCount}秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2 ** retryCount * 1000));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      throw error;
    }
  }

  /**
   * 获取历史数据（按月份）
   * @param {string} lotCode - 彩种代码
   * @param {string} date - 月份格式 YYYY-MM
   */
  async fetchHistoryData(lotCode, date = null) {
    try {
      // 获取月份参数
      let month = date;
      if (!month) {
        const now = new Date();
        month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }

      logger.info(`[Taiwan49M6] 获取历史数据: ${month}`);

      const apiUrl = `${this.apiBaseUrl}/49M6Result?period&month=${month}&endMonth=${month}&pageNum=1&pageSize=200`;

      const response = await axios.get(apiUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.data || !response.data.content || !response.data.content.m649Res) {
        logger.warn(`[Taiwan49M6] ${month} 数据格式异常`);
        return [];
      }

      const results = response.data.content.m649Res || [];
      logger.info(`[Taiwan49M6] ${month} 获取到 ${results.length} 条记录`);

      return results.map(item => {
        const numbers = item.drawNumberSize || [];
        const drawTime = item.lotteryDate
          ? item.lotteryDate.split('T')[0] + ' 00:00:00'
          : new Date().toISOString().split('T')[0] + ' 00:00:00';

        return {
          issue: String(item.period),
          drawCode: numbers.join(','),  // 使用驼峰命名
          drawTime: drawTime,            // 使用驼峰命名
          specialNumbers: [],
          source: 'taiwanlottery_49m6_api'
        };
      });

    } catch (error) {
      logger.error(`[Taiwan49M6] 获取历史数据失败 (${date}): ${error.message}`);
      return [];
    }
  }

  /**
   * 健康检查
   */
  async checkHealth() {
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const apiUrl = `${this.apiBaseUrl}/49M6Result?period&month=${currentMonth}&endMonth=${currentMonth}&pageNum=1&pageSize=1`;

      const response = await axios.get(apiUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const isHealthy = response.data && response.data.content && response.data.content.m649Res;

      return {
        healthy: isHealthy,
        message: isHealthy ? 'API正常' : 'API异常',
        statusCode: response.status
      };
    } catch (error) {
      return {
        healthy: false,
        message: `健康检查失败: ${error.message}`,
        statusCode: error.response?.status || 0
      };
    }
  }
}

export default new Taiwan49M6Scraper();
