import axios from 'axios';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';

/**
 * Lucky Lottoz (幸运飞艇) 爬虫
 * 数据源：https://luckylottoz.com
 * 国家：马耳他 (Malta)
 * 时区：Europe/Malta (UTC+1/+2)
 *
 * 销售日模式：
 * - 当地时间：06:09:00 ~ 21:04:00
 * - 北京时间：13:09:00 ~ 次日 04:04:00
 * - 每5分钟一期，每天180期
 */
class LuckyLottozScraper {
  constructor() {
    // ⚠️ 不再硬编码baseUrl，改为动态获取
    // this.baseUrl = 'https://luckylottoz.com';
    this.domainManager = universalDomainManager;
    this.sourceType = 'luckylottoz';  // 数据源类型
    this.lotCode = '10057'; // 幸运飞艇
  }

  /**
   * 获取最新开奖数据（企业级域名管理版本）
   * @returns {Object} 最新一期开奖数据
   */
  async fetchLatestData(retryCount = 0, maxRetries = 3) {
    let currentDomain = null;
    const startTime = Date.now();

    try {
      // 🔥 从域名管理器获取当前最优域名
      currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      const targetUrl = `${baseUrl}/api/latest/getLotteryPksInfo.do?lotCode=${this.lotCode}`;

      logger.info(`[LuckyLottoz] 🚀 请求最新数据: ${targetUrl}${retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : ''} [域名: ${baseUrl}]`);

      const response = await axios.get(targetUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        }
      });

      const responseTime = Date.now() - startTime;

      // 解析数据
      const result = this.parseLatestData(response.data);

      if (!result) {
        throw new Error('无法解析出有效数据');
      }

      // ✅ 记录成功（域名管理器统计）
      await this.domainManager.recordSuccess(currentDomain.id, responseTime);

      logger.info(`[LuckyLottoz] ✅ 成功获取幸运飞艇第${result.period}期数据 (${responseTime}ms)`);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // ❌ 记录失败（域名管理器统计，可能触发自动切换）
      if (currentDomain) {
        await this.domainManager.recordFailure(currentDomain.id, error, true);
      }

      // 🔄 重试机制
      if (retryCount < maxRetries &&
          (error.message.includes('无法解析') || error.message.includes('timeout'))) {
        logger.warn(`[LuckyLottoz] ⚠️ 获取失败 (${error.message})，1秒后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchLatestData(retryCount + 1, maxRetries);
      }

      logger.error(`[LuckyLottoz] ❌ 获取失败 (已重试${retryCount}次):`, error.message);
      throw error;
    }
  }

  /**
   * 解析最新数据
   * @param {Object} response - API返回的数据
   * @returns {Object} 解析后的开奖数据
   */
  parseLatestData(response) {
    try {
      // API返回格式：
      // {
      //   "errorCode": 0,
      //   "message": "操作成功",
      //   "result": {
      //     "data": {
      //       "preDrawIssue": 20251226108,
      //       "preDrawTime": "2025-12-26 22:04:00",
      //       "preDrawCode": "04,06,03,01,08,10,05,07,09,02",
      //       "drawIssue": 20251226109,
      //       "drawTime": "2025-12-26 22:09:00",
      //       "serverTime": "2025-12-26 22:07:07"
      //     }
      //   }
      // }

      if (!response || response.errorCode !== 0) {
        throw new Error('API返回错误');
      }

      const data = response.result?.data;
      if (!data) {
        throw new Error('API返回数据为空');
      }

      // 期号
      const period = String(data.preDrawIssue);
      if (!period) {
        throw new Error('期号为空');
      }

      // 开奖号码
      const drawCode = data.preDrawCode;
      if (!drawCode) {
        throw new Error('开奖号码为空');
      }

      const numbers = drawCode.split(',').map(n => n.trim().padStart(2, '0'));
      if (numbers.length !== 10) {
        throw new Error(`号码数量不正确: 期望10个，实际${numbers.length}个`);
      }

      // 开奖时间 (API返回的是北京时间)
      const drawTime = data.preDrawTime;

      // 🎯 计算官方倒计时
      // drawTime: 下期开奖时间
      // serverTime: 服务器当前时间
      let officialCountdown = null;
      if (data.drawTime && data.serverTime) {
        try {
          const nextDrawTime = new Date(data.drawTime).getTime();
          const currentTime = new Date(data.serverTime).getTime();
          officialCountdown = Math.max(0, Math.floor((nextDrawTime - currentTime) / 1000));

          logger.debug(
            `[LuckyLottoz] 🎯 倒计时: ${officialCountdown}秒 ` +
            `(下期: ${data.drawTime}, 当前: ${data.serverTime})`
          );
        } catch (err) {
          logger.warn(`[LuckyLottoz] 倒计时计算失败: ${err.message}`);
        }
      }

      return {
        lotCode: 'luckyairship',
        period: period,
        numbers: numbers,
        opencode: numbers.join(','),
        drawTime: drawTime,
        officialCountdown: officialCountdown,
        timestamp: Date.now(),
        source: 'luckylottoz'
      };

    } catch (error) {
      logger.error(`[LuckyLottoz] 数据解析失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取历史数据（按日期）
   * @param {string} date - 日期（YYYY-MM-DD，北京时间）
   * @returns {Array} 历史记录数组
   */
  async fetchHistoryData(date) {
    try {
      // 🔥 动态获取域名
      const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      const targetUrl = `${baseUrl}/api/result/getPksHistoryList.do?lotCode=${this.lotCode}&date=${date}`;

      logger.info(`[LuckyLottoz] 🔍 获取历史数据: ${targetUrl}`);

      const response = await axios.get(targetUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        }
      });

      // 解析历史记录
      const records = this.parseHistoryData(response.data, date);

      if (!records || records.length === 0) {
        logger.warn(`[LuckyLottoz] ${date} 无历史数据`);
        return [];
      }

      logger.info(`[LuckyLottoz] ✅ 获取幸运飞艇 ${date} 历史数据 ${records.length} 条`);
      return records;

    } catch (error) {
      logger.error(`[LuckyLottoz] 获取历史数据失败: ${date}`, error.message);
      throw error;
    }
  }

  /**
   * 解析历史数据
   * @param {Object} response - API返回的数据
   * @param {string} date - 查询日期
   * @returns {Array} 历史记录数组
   */
  parseHistoryData(response, date) {
    try {
      // API返回格式：
      // {
      //   "errorCode": 0,
      //   "result": {
      //     "data": [
      //       {
      //         "preDrawIssue": 20251226108,
      //         "preDrawTime": "2025-12-26 22:04:00",
      //         "preDrawCode": "04,06,03,01,08,10,05,07,09,02"
      //       }
      //     ]
      //   }
      // }

      if (!response || response.errorCode !== 0) {
        throw new Error('API返回错误');
      }

      const dataList = response.result?.data;
      if (!dataList || !Array.isArray(dataList)) {
        return [];
      }

      const records = [];
      const datePrefix = date.replace(/-/g, ''); // 2025-12-26 -> 20251226

      for (const item of dataList) {
        const period = String(item.preDrawIssue);

        // 🎯 按期号前缀过滤（销售日模式）
        // 例如：2025-12-26的期号前缀是20251226
        if (!period || !period.startsWith(datePrefix)) {
          continue;
        }

        const drawCode = item.preDrawCode;
        if (!drawCode) {
          continue;
        }

        const numbers = drawCode.split(',').map(n => n.trim().padStart(2, '0'));
        if (numbers.length !== 10) {
          continue;
        }

        const drawTime = item.preDrawTime;

        records.push({
          issue: period,
          draw_code: numbers.join(','),
          drawCode: numbers.join(','),
          draw_time: drawTime,
          drawTime: drawTime,
          source: 'luckylottoz_history'
        });
      }

      // 按期号降序排序（最新的在前）
      records.sort((a, b) => {
        const periodA = parseInt(a.issue);
        const periodB = parseInt(b.issue);
        return periodB - periodA;
      });

      return records;

    } catch (error) {
      logger.error('[LuckyLottoz] 解析历史数据失败:', error.message);
      return [];
    }
  }

  /**
   * 检查服务是否可用
   * @returns {boolean} 服务状态
   */
  async checkHealth() {
    try {
      // 🔥 动态获取域名
      const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      const response = await axios.get(`${baseUrl}/api/latest/getLotteryPksInfo.do?lotCode=${this.lotCode}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return response.status === 200 && response.data?.errorCode === 0;
    } catch (error) {
      logger.error('[LuckyLottoz] 服务不可用:', error.message);
      return false;
    }
  }
}

// 导出单例
export default new LuckyLottozScraper();
