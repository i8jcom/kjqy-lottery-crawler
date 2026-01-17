/**
 * UK Lottos 官网爬虫
 * 数据源：www.uklottos.com (UK Lottos 官方API)
 *
 * 支持彩种：
 * - UK Lotto 5 (lotCode=90001) - 每2.5分钟一期
 * - UK Lotto 8 (lotCode=90002) - 每2.5分钟一期
 * - UK Lotto 10 (lotCode=90003) - 每2.5分钟一期
 * - UK Lotto 20 (lotCode=90004) - 每2.5分钟一期
 */

import https from 'https';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';

// 🎯 彩种映射配置
const LOTTERY_CONFIGS = {
  '90001': {
    name: 'UK Lotto 5',
    apiKey: 'lotto5',
    numberCount: 5,
    drawInterval: 150, // 2.5分钟 = 150秒
    numberRange: [0, 9] // 号码范围 0-9
  },
  '90002': {
    name: 'UK Lotto 8',
    apiKey: 'lotto8',
    numberCount: 8,
    drawInterval: 150,
    numberRange: [0, 9]
  },
  '90003': {
    name: 'UK Lotto 10',
    apiKey: 'lotto10',
    numberCount: 10,
    drawInterval: 150,
    numberRange: [0, 9]
  },
  '90004': {
    name: 'UK Lotto 20',
    apiKey: 'lotto20',
    numberCount: 20,
    drawInterval: 150,
    numberRange: [0, 9]
  }
};

class UKLottosScraper {
  constructor() {
    // ⚠️ 不再硬编码baseUrl，改为动态获取
    // this.baseUrl = 'www.uklottos.com';
    this.domainManager = universalDomainManager;
    this.sourceType = 'uklottos'; // 数据源类型
    this.basePath = '/api/result';
  }

  /**
   * 将UTC时间转换为中国时间（UTC+8）
   * @param {number} unixtime - Unix时间戳（秒）
   * @returns {string} 中国时间字符串 (YYYY-MM-DD HH:mm:ss)
   */
  convertToCST(unixtime) {
    const date = new Date(unixtime * 1000); // 转换为毫秒
    // 添加8小时（28800000毫秒）转换为中国时间
    const chinaDate = new Date(date.getTime() + (8 * 60 * 60 * 1000));

    const year = chinaDate.getUTCFullYear();
    const month = String(chinaDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaDate.getUTCDate()).padStart(2, '0');
    const hours = String(chinaDate.getUTCHours()).padStart(2, '0');
    const minutes = String(chinaDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(chinaDate.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 获取最新开奖数据
   * @param {string} lotCode - 彩种代码 (90001-90004)
   * @param {number} retryCount - 当前重试次数
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} 开奖数据
   */
  async fetchLatestData(lotCode, retryCount = 0, maxRetries = 2) {
    const config = LOTTERY_CONFIGS[lotCode];
    if (!config) {
      throw new Error(`不支持的彩种代码: ${lotCode}`);
    }

    try {
      logger.info(`[${config.name}] 开始获取开奖数据 (apiKey=${config.apiKey})`);

      // 调用API获取数据
      const apiData = await this.callAPI(config.apiKey);

      // 解析数据（返回最新一期）
      const latestData = this.parseLatestData(apiData, lotCode);

      logger.info(`[${config.name}] ✅ 获取成功 | 期号: ${latestData.period} | 号码: ${latestData.drawCode} | 倒计时: ${latestData.officialCountdown}秒`);

      return latestData;

    } catch (error) {
      logger.error(`[${config.name}] 获取失败 (尝试${retryCount + 1}/${maxRetries + 1}): ${error.message}`);

      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        logger.info(`[${config.name}] ${delay}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      throw error;
    }
  }

  /**
   * 调用 UK Lottos 官方API
   * @param {string} apiKey - API键 (lotto5/lotto8/lotto10/lotto20)
   * @returns {Promise<Object>} API返回的JSON数据
   */
  async callAPI(apiKey) {
    // 🔥 从域名管理器获取当前最优域名
    const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
    const baseUrl = currentDomain.domain_url.replace(/^https?:\/\//, ''); // 移除协议部分，因为https.get需要纯域名

    return new Promise((resolve, reject) => {
      const path = `${this.basePath}/load-${apiKey}.php`;

      const options = {
        hostname: baseUrl,
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': `https://${baseUrl}/`,
          'Connection': 'keep-alive'
        }
      };

      logger.debug(`[UKLottos] 🚀 请求: https://${baseUrl}${path} [域名: ${currentDomain.domain_url}]`);

      https.get(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            // API返回格式是多个JSON对象用逗号分隔，需要包装成数组
            const jsonArray = `[${data}]`;
            const parsed = JSON.parse(jsonArray);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`JSON解析失败: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`请求失败: ${error.message}`));
      });
    });
  }

  /**
   * 解析API返回的最新一期数据
   * @param {Array} apiData - API返回的数据数组
   * @param {string} lotCode - 彩种代码
   * @returns {Object} 标准化的开奖数据
   */
  parseLatestData(apiData, lotCode) {
    if (!apiData || apiData.length === 0) {
      throw new Error('API返回数据为空');
    }

    const config = LOTTERY_CONFIGS[lotCode];

    // 获取第一期（最新）数据
    const firstItem = apiData[0];
    const period = Object.keys(firstItem)[0];
    const data = firstItem[period];

    // 解析号码
    const numbers = data.number.split(',');

    // 验证号码数量
    if (numbers.length !== config.numberCount) {
      logger.warn(`[${config.name}] 期号${period}号码数量不匹配: 期望${config.numberCount}个，实际${numbers.length}个`);
    }

    // 计算倒计时（使用unixtime确保准确性）
    // ⚠️ 不修正unixtime，保持下期开奖时间准确（与第三方一致）
    const drawTime = data.unixtime * 1000; // 转换为毫秒
    const now = Date.now();
    const nextDrawTime = drawTime + (config.drawInterval * 1000);
    const countdown = Math.max(0, Math.floor((nextDrawTime - now) / 1000));

    // 🌏 将UTC时间转换为中国时间（UTC+8）
    const chinaTime = this.convertToCST(data.unixtime);

    return {
      lotCode: lotCode,
      period: period,
      issue: period,
      numbers: numbers,
      opencode: data.number,
      drawCode: data.number,
      drawTime: chinaTime, // 使用中国时间
      timestamp: data.unixtime * 1000,
      unixtime: data.unixtime, // 保留原始Unix时间戳用于校准
      officialCountdown: countdown,
      source: 'uklottos_official'
    };
  }

  /**
   * 获取历史数据
   * @param {string} lotCode - 彩种代码
   * @param {Object} options - 查询选项 { limit: 数量, date: 日期 }
   * @returns {Promise<Array>} 历史数据数组
   */
  async fetchHistoryData(lotCode, options = {}) {
    const config = LOTTERY_CONFIGS[lotCode];
    if (!config) {
      throw new Error(`不支持的彩种代码: ${lotCode}`);
    }

    const { limit = null, date = null } = options;

    try {
      logger.info(`[${config.name}] 获取历史数据 (limit=${limit || 'all'}, date=${date || 'none'})`);

      // 调用API（支持按日期查询）
      const apiData = date
        ? await this.callAPIWithDate(config.apiKey, date)
        : await this.callAPI(config.apiKey);

      // 转换为标准格式（如果指定了limit则截取，否则返回全部）
      const dataToProcess = limit ? apiData.slice(0, limit) : apiData;
      const historyData = dataToProcess.map(item => {
        const period = Object.keys(item)[0];
        const data = item[period];

        // 🌏 将UTC时间转换为中国时间（UTC+8）
        const chinaTime = this.convertToCST(data.unixtime);

        return {
          lotCode: lotCode,
          issue: period,        // ✅ 修复：添加issue字段（数据库需要）
          period: period,       // 保留period字段（兼容性）
          drawCode: data.number, // ✅ 修复：添加drawCode字段（数据库需要）
          numbers: data.number.split(','),
          opencode: data.number, // 保留opencode字段（兼容性）
          drawTime: chinaTime,   // 使用中国时间
          source: 'uklottos_official'
        };
      });

      logger.info(`[${config.name}] ✅ 获取历史数据成功: ${historyData.length}期`);

      return historyData;

    } catch (error) {
      logger.error(`[${config.name}] 获取历史数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 调用API获取指定日期的数据
   * @param {string} apiKey - API键
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @returns {Promise<Object>} API返回的JSON数据
   */
  async callAPIWithDate(apiKey, date) {
    // 🔥 从域名管理器获取当前最优域名
    const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
    const baseUrl = currentDomain.domain_url.replace(/^https?:\/\//, ''); // 移除协议部分

    return new Promise((resolve, reject) => {
      const path = `${this.basePath}/load-${apiKey}.php?date=${date}`;

      const options = {
        hostname: baseUrl,
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Referer': `https://${baseUrl}/`
        }
      };

      logger.debug(`[UKLottos] 🔍 获取历史数据: https://${baseUrl}${path} [域名: ${currentDomain.domain_url}]`);

      https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            // API返回格式: {"period1":{...}},{"period2":{...}},...
            // 包装成数组: [{"period1":{...}},{"period2":{...}}]
            const jsonArray = `[${data}]`;
            const parsed = JSON.parse(jsonArray);
            resolve(parsed);
          } catch (error) {
            reject(new Error(`JSON解析失败: ${error.message}`));
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck() {
    const results = {};

    for (const lotCode of Object.keys(LOTTERY_CONFIGS)) {
      try {
        await this.fetchLatestData(lotCode);
        results[lotCode] = { status: 'healthy', message: '正常' };
      } catch (error) {
        results[lotCode] = { status: 'unhealthy', message: error.message };
      }
    }

    const allHealthy = Object.values(results).every(r => r.status === 'healthy');

    return {
      healthy: allHealthy,
      source: 'uklottos',
      lotteries: results,
      timestamp: new Date().toISOString()
    };
  }
}

export default UKLottosScraper;
