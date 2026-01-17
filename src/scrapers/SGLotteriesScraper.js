import axios from 'axios';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';

/**
 * SG Lotteries 网站爬虫 - 企业级域名管理版本
 * 数据源：动态域名（多域名自动切换）
 * 支持6种SG彩种的实时数据和历史数据获取
 * 🛡️ 支持多域名自动切换，零停机保障
 *
 * 倒计时算法：使用固定间隔300秒（与官网main.js一致）
 * 官网算法：secondCountdown = 300 - (currentTime - latestResultTime) / 1000
 */
class SGLotteriesScraper {
  constructor() {
    // ⚠️ 不再硬编码baseUrl，改为动态获取
    // this.baseUrl = 'https://sglotteries.com';
    this.domainManager = universalDomainManager;
    this.sourceType = 'sglotteries'; // 数据源类型

    // 彩种API映射
    this.lotteryApis = {
      // SG Airship - 10个号码
      'sgairship': '/api/result/load-ft.php',

      // SG 5D - 5个号码
      'sg5d': '/api/result/load-5d.php',

      // SG Quick 3 - 3个号码
      'sgquick3': '/api/result/load-quick3.php',

      // SG Happy 8 - 8个号码
      'sghappy8': '/api/result/load-happy8.php',

      // SG Happy 20 - 20个号码
      'sghappy20': '/api/result/load-happy20.php',

      // SG 11X5 - 5个号码
      'sg11x5': '/api/result/load-11x5.php'
    };
  }

  /**
   * 获取彩票最新数据（企业级域名管理版本）
   * @param {string} lotCode - 彩种代码（如 sgairship）
   * @returns {Object} 最新一期开奖数据
   */
  async fetchLatestData(lotCode, retryCount = 0, maxRetries = 3) {
    let currentDomain = null;
    const startTime = Date.now();

    try {
      const endpoint = this.lotteryApis[lotCode];

      if (!endpoint) {
        throw new Error(`SG Lotteries不支持彩种: ${lotCode}`);
      }

      // 🔥 从域名管理器获取当前最优域名
      currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      const targetUrl = `${baseUrl}${endpoint}`;

      logger.info(`[SGLotteries] 🚀 请求最新数据: ${targetUrl}${retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : ''} [域名: ${baseUrl}]`);

      const response = await axios.get(targetUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      const responseTime = Date.now() - startTime;

      // 解析数据
      const result = this.parseLatestData(response.data, lotCode);

      if (!result) {
        // 记录原始响应数据以便调试
        const dataPreview = typeof response.data === 'string'
          ? response.data.substring(0, 200)
          : JSON.stringify(response.data).substring(0, 200);
        logger.error(`[SGLotteries] 解析失败的原始数据 (${lotCode}): ${dataPreview}...`);
        throw new Error('无法解析出有效数据');
      }

      // ✅ 记录成功（域名管理器统计）
      await this.domainManager.recordSuccess(currentDomain.id, responseTime);

      logger.info(`[SGLotteries] ✅ 成功获取 ${lotCode} 第${result.period}期数据 (${responseTime}ms)`);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // ❌ 记录失败（域名管理器统计，可能触发自动切换）
      if (currentDomain) {
        await this.domainManager.recordFailure(currentDomain.id, error, true);
      }

      // 🔄 重试机制：开奖前后API可能不稳定
      if (retryCount < maxRetries &&
          (error.message.includes('无法解析') || error.message.includes('timeout'))) {
        logger.warn(`[SGLotteries] ⚠️ ${lotCode} 获取失败 (${error.message})，1秒后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      logger.error(`[SGLotteries] ❌ ${lotCode} 获取失败 (已重试${retryCount}次):`, error.message);
      throw error;
    }
  }

  /**
   * 解析最新数据（返回第一条记录）
   * @param {string} data - API返回的原始数据
   * @param {string} lotCode - 彩种代码
   * @returns {Object} 解析后的开奖数据
   */
  parseLatestData(data, lotCode) {
    try {
      // SG API返回格式：{"期号1":{...}},{"期号2":{...}},{"期号3":{...}}
      // 需要包装成数组：[{"期号1":{...}},{"期号2":{...}}]
      const jsonArray = JSON.parse(`[${data}]`);

      if (!jsonArray || jsonArray.length === 0) {
        throw new Error('API返回空数据');
      }

      // 获取第一条（最新）记录
      const latestRecord = jsonArray[0];
      if (!latestRecord || typeof latestRecord !== 'object') {
        throw new Error('最新记录格式错误');
      }

      const period = Object.keys(latestRecord)[0];
      if (!period) {
        throw new Error('未找到期号');
      }

      const recordData = latestRecord[period];
      if (!recordData || !recordData.number || !recordData.datetime) {
        throw new Error(`期号${period}的数据不完整`);
      }

      // 提取开奖号码
      const numbers = recordData.number.split(',').map(n => n.trim().padStart(2, '0'));
      if (numbers.length === 0) {
        throw new Error('开奖号码为空');
      }

      // 🕐 直接使用官方返回的开奖时间，不做任何转换
      // SG API返回格式：datetime="2025-12-24 10:15:00" (新加坡官方时间)
      const drawTime = recordData.datetime;

      // 🎯 使用与官网完全相同的倒计时算法（固定间隔300秒）
      // 参考官网main.js: secondCountdown = timeOffsetConstant - (currentTime - latestResultTime) / 1000
      // ⚠️ 注意：这里返回RAW倒计时，earlyFetch由ContinuousPollingScheduler处理（与UK Lottos一致）
      let officialCountdown = null;
      if (recordData.unixtime) {
        const currentTime = Math.floor(Date.now() / 1000);  // 当前Unix时间戳（秒）
        const lastDrawTime = recordData.unixtime;           // 最新一期开奖时间（秒）
        const timeOffsetConstant = 300;                     // 固定间隔5分钟（与官网一致）

        // 计算倒计时：固定间隔 - 已过时间（不减earlyFetch，由scheduler处理）
        const timeElapsed = currentTime - lastDrawTime;
        const rawCountdown = timeOffsetConstant - timeElapsed;

        // 🛡️ 保护：如果unixtime是未来时间（官网在新期号开奖前~16-30秒会返回新期数据），
        // 会导致timeElapsed为负数，rawCountdown超过300秒
        // 🎯 关键修复：限制倒计时最大值为300秒（符合用户期望"最慢300秒"）
        if (rawCountdown > timeOffsetConstant) {
          // lastDrawTime是新期号的起始时间（未来时间）
          // 下一期开奖时间 = lastDrawTime + 300秒
          const nextDrawTime = lastDrawTime + timeOffsetConstant;
          let actualCountdown = nextDrawTime - currentTime;

          // 🎯 限制最大倒计时为300秒（用户需求："需要最慢300秒"）
          if (actualCountdown > timeOffsetConstant) {
            logger.info(
              `[SGLotteries] 🆕 ${lotCode} 检测到新期号（未来时间）: 期号=${period}, ` +
              `原始倒计时=${actualCountdown}秒 > 300秒，限制为300秒`
            );
            actualCountdown = timeOffsetConstant;
          } else {
            logger.info(
              `[SGLotteries] 🆕 ${lotCode} 检测到新期号（未来时间）: 期号=${period}, ` +
              `实际倒计时=${actualCountdown}秒`
            );
          }
          // ✅ 返回倒计时（最大300秒）
          officialCountdown = Math.max(0, actualCountdown);
        } else {
          officialCountdown = Math.max(0, rawCountdown);
        }

        logger.debug(
          `[SGLotteries] 🎯 ${lotCode} 原始倒计时: ${officialCountdown}秒 ` +
          `(固定间隔${timeOffsetConstant}秒 - 已过${timeElapsed}秒) ` +
          `[最新期: ${lastDrawTime}, 当前: ${currentTime}]`
        );
      }

      return {
        lotCode,
        period: period,
        numbers: numbers,
        opencode: numbers.join(','),
        drawTime: drawTime,
        unixtime: recordData.unixtime,
        officialCountdown: officialCountdown, // 🚀 计算出的倒计时（秒）
        timestamp: Date.now(),
        source: 'sglotteries'
      };

    } catch (error) {
      logger.error(`[SGLotteries] 数据解析失败 (${lotCode}):`, error.message);
      logger.debug(`[SGLotteries] 原始数据类型: ${typeof data}, 长度: ${data ? data.length : 'N/A'}`);
      return null;
    }
  }

  /**
   * 获取历史数据（按日期）
   * @param {string} lotCode - 彩种代码
   * @param {string} date - 日期（YYYY-MM-DD）
   * @returns {Array} 历史记录数组
   */
  async fetchHistoryData(lotCode, date) {
    let currentDomain = null;
    try {
      const endpoint = this.lotteryApis[lotCode];

      if (!endpoint) {
        throw new Error(`SG Lotteries不支持彩种: ${lotCode}`);
      }

      // 🔥 从域名管理器获取当前最优域名
      currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      // 构建历史查询URL
      const targetUrl = `${baseUrl}${endpoint}?date=${date}`;

      logger.info(`[SGLotteries] 🔍 获取历史数据: ${targetUrl} [域名: ${baseUrl}]`);

      const response = await axios.get(targetUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      // 解析历史记录列表
      const records = this.parseHistoryData(response.data, lotCode);

      if (!records || records.length === 0) {
        logger.warn(`[SGLotteries] ${date} 无历史数据`);
        return [];
      }

      // 🎯 按期号前缀过滤（而不是按开奖时间）
      // 原因：SG彩种的最后一期（第288期）开奖时间是次日00:00:00
      // 例如：20251225288期的开奖时间是2025-12-26 00:00:00
      const datePrefix = date.replace(/-/g, '');  // 2025-12-25 -> 20251225
      const filteredRecords = records.filter(r => r.issue && r.issue.startsWith(datePrefix));

      logger.info(`[SGLotteries] ✅ 获取 ${lotCode} ${date} 历史数据 ${filteredRecords.length} 条（按期号过滤，原始${records.length}条）`);
      return filteredRecords;

    } catch (error) {
      // ❌ 记录失败（域名管理器统计）
      if (currentDomain) {
        await this.domainManager.recordFailure(currentDomain.id, error, true);
      }

      logger.error(`[SGLotteries] 获取历史数据失败: ${lotCode} ${date}`, error.message);
      throw error;
    }
  }

  /**
   * 解析历史数据（返回所有记录）
   * @param {string} data - API返回的原始数据
   * @param {string} lotCode - 彩种代码
   * @returns {Array} 历史记录数组
   */
  parseHistoryData(data, lotCode) {
    try {
      // 包装成JSON数组
      const jsonArray = JSON.parse(`[${data}]`);

      if (!jsonArray || jsonArray.length === 0) {
        return [];
      }

      const records = [];

      for (const item of jsonArray) {
        const period = Object.keys(item)[0];
        const recordData = item[period];

        // 提取开奖号码
        const numbers = recordData.number.split(',').map(n => n.trim().padStart(2, '0'));

        // 🕐 直接使用官方返回的开奖时间，不做任何转换
        // SG API返回格式：datetime="2025-12-24 10:15:00" (新加坡官方时间)
        const mysqlTime = recordData.datetime;

        records.push({
          issue: period,
          draw_code: numbers.join(','),  // 使用下划线格式，与数据库字段一致
          drawCode: numbers.join(','),    // 保留驼峰格式用于兼容性
          draw_time: mysqlTime,
          drawTime: mysqlTime,
          unixtime: recordData.unixtime,
          source: 'sglotteries_history'
        });
      }

      return records;

    } catch (error) {
      logger.error('[SGLotteries] 解析历史数据失败:', error.message);
      return [];
    }
  }

  /**
   * 获取彩种期望的号码数量
   * @param {string} lotCode - 彩种代码
   * @returns {number} 号码数量
   */
  getExpectedNumberCount(lotCode) {
    const countMap = {
      'sgairship': 10,   // SG Airship: 10个号码
      'sg5d': 5,         // SG 5D: 5个号码
      'sgquick3': 3,     // SG Quick 3: 3个号码
      'sghappy8': 8,     // SG Happy 8: 8个号码
      'sghappy20': 20,   // SG Happy 20: 20个号码
      'sg11x5': 5        // SG 11X5: 5个号码
    };
    return countMap[lotCode] || 10;
  }

  /**
   * 检查服务是否可用
   * @returns {boolean} 服务状态
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/result/load-ft.php`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return response.status === 200;
    } catch (error) {
      logger.error('[SGLotteries] 服务不可用:', error.message);
      return false;
    }
  }

  /**
   * 批量获取多个彩种数据
   * @param {Array} lotCodes - 彩种代码数组
   * @returns {Array} 批量结果
   */
  async batchFetch(lotCodes) {
    const results = await Promise.allSettled(
      lotCodes.map(lotCode => this.fetchLatestData(lotCode))
    );

    return results.map((result, index) => ({
      lotCode: lotCodes[index],
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  }
}

// 导出单例
export default new SGLotteriesScraper();
