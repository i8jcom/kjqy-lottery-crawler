/**
 * 中国体彩官网爬虫
 * 数据源：webapi.sporttery.cn (中国体育彩票官方API)
 *
 * 支持彩种：
 * - 超级大乐透 (gameNo=85, lotCode=80001)
 * - 排列3 (gameNo=35, lotCode=80002)
 * - 排列5 (gameNo=35, lotCode=80003)
 * - 七星彩 (gameNo=04, lotCode=80004)
 */

import https from 'https';
import logger from '../utils/Logger.js';

// 🎯 彩种映射配置
const LOTTERY_CONFIGS = {
  '80001': {
    name: '超级大乐透',
    gameNo: '85',
    apiKey: 'dlt',
    drawDays: [1, 3, 6], // 周一、三、六
    drawTime: '21:25',
    drawInterval: 259200, // 3天（实际按周期算）
    numberFormat: 'split' // 前5+后2
  },
  '80002': {
    name: '排列3',
    gameNo: '35',
    apiKey: 'pls',
    drawDays: [0, 1, 2, 3, 4, 5, 6], // 每天
    drawTime: '21:25',
    drawInterval: 86400, // 1天
    numberFormat: 'simple' // 3个数字
  },
  '80003': {
    name: '排列5',
    gameNo: '35',
    apiKey: 'plw',
    apiParam: '35,0;350133,0', // 特殊参数格式：同时请求排列3和排列5
    historyGameNo: '350133', // 历史数据API专用gameNo（排列5独立编号）
    drawDays: [0, 1, 2, 3, 4, 5, 6], // 每天
    drawTime: '21:25',
    drawInterval: 86400, // 1天
    numberFormat: 'simple' // 5个数字
  },
  '80004': {
    name: '七星彩',
    gameNo: '04',
    apiKey: 'qxc',
    drawDays: [2, 5, 0], // 周二、五、日
    drawTime: '21:25',
    drawInterval: 259200, // 约3天（实际按周期算）
    numberFormat: 'simple' // 7个数字
  }
};

class SportsLotteryScraper {
  constructor() {
    this.baseUrl = 'https://webapi.sporttery.cn/gateway/lottery/getDigitalDrawInfoV1.qry';
    this.lastFetchTime = {};
    this.cache = {};
    this.CACHE_TTL = 30000; // 缓存30秒
  }

  /**
   * 获取最新开奖数据
   * @param {string} lotCode - 彩种代码 (80001-80004)
   * @param {number} retryCount - 当前重试次数
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} 标准化的开奖数据
   */
  async fetchLatestData(lotCode, retryCount = 0, maxRetries = 3) {
    const config = LOTTERY_CONFIGS[lotCode];
    if (!config) {
      throw new Error(`不支持的彩种代码: ${lotCode}`);
    }

    // 检查缓存
    const cacheKey = lotCode;
    const now = Date.now();
    if (this.cache[cacheKey] && (now - this.lastFetchTime[cacheKey]) < this.CACHE_TTL) {
      logger.debug(`[${config.name}] 使用缓存数据 (${Math.floor((now - this.lastFetchTime[cacheKey]) / 1000)}秒前)`);
      return this.cache[cacheKey];
    }

    try {
      logger.info(`[${config.name}] 开始获取开奖数据 (gameNo=${config.gameNo})`);

      // 调用官方API（支持自定义参数格式）
      const apiData = await this.callAPI(config.gameNo, config.apiParam);

      // 解析数据
      const parsedData = this.parseApiData(apiData, lotCode, config);

      // 缓存结果
      this.cache[cacheKey] = parsedData;
      this.lastFetchTime[cacheKey] = now;

      logger.info(
        `[${config.name}] ✅ 获取成功 | 期号: ${parsedData.period} | ` +
        `号码: ${parsedData.drawCode} | 倒计时: ${parsedData.officialCountdown}秒`
      );

      return parsedData;

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
   * 调用中国体彩官方API
   * @param {string} gameNo - 游戏编号
   * @param {string} apiParam - 可选的自定义参数格式（如 "35,0;350133,0"）
   * @returns {Promise<Object>} API返回的JSON数据
   */
  callAPI(gameNo, apiParam) {
    return new Promise((resolve, reject) => {
      // 如果提供了自定义参数，使用它；否则使用默认格式
      const param = apiParam || `${gameNo},0`;
      const url = `${this.baseUrl}?param=${param}&isVerify=1`;

      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.lottery.gov.cn/',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Connection': 'keep-alive'
        }
      };

      https.get(url, options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);

            if (json.errorCode === '0' && json.value) {
              resolve(json.value);
            } else {
              reject(new Error(`API错误: ${json.errorCode} - ${json.errorMessage || '未知错误'}`));
            }
          } catch (error) {
            reject(new Error(`JSON解析失败: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`网络请求失败: ${error.message}`));
      });
    });
  }

  /**
   * 解析API返回的数据
   * @param {Object} apiValue - API返回的value对象
   * @param {string} lotCode - 彩种代码
   * @param {Object} config - 彩种配置
   * @returns {Object} 标准化的开奖数据
   */
  parseApiData(apiValue, lotCode, config) {
    // 根据apiKey获取对应彩种的数据
    const lotteryData = apiValue[config.apiKey];

    if (!lotteryData || !lotteryData.lotteryDrawNum) {
      throw new Error(`API返回数据中没有${config.name}数据`);
    }

    // 提取基础字段
    const period = lotteryData.lotteryDrawNum; // 期号
    const drawResult = lotteryData.lotteryDrawResult; // 开奖号码（如 "24 26 30 31 32 05 12"）
    const drawTime = lotteryData.lotteryDrawTime; // 开奖时间（如 "2025-12-29 21:19:54"）

    // 格式化号码
    const formattedNumbers = this.formatNumbers(drawResult, config.numberFormat);

    // 计算倒计时
    const officialCountdown = this.calculateCountdown(lotCode, config, drawTime);

    // 返回标准化数据
    return {
      lotCode: lotCode,
      period: period,
      numbers: formattedNumbers.array,
      opencode: formattedNumbers.string,
      drawCode: formattedNumbers.string,
      drawTime: this.formatDrawTime(drawTime, config),
      officialCountdown: officialCountdown,
      timestamp: Date.now(),
      source: 'sportslottery_official'
    };
  }

  /**
   * 格式化开奖号码
   * @param {string} drawResult - API返回的号码字符串
   * @param {string} format - 格式类型 (simple/split)
   * @returns {Object} {array: [], string: ''}
   */
  formatNumbers(drawResult, format) {
    // 去除多余空格，分割成数组
    const numbers = drawResult.trim().split(/\s+/);

    if (format === 'split') {
      // 超级大乐透：前5个是前区，后2个是后区
      const front = numbers.slice(0, 5).map(n => n.padStart(2, '0'));
      const back = numbers.slice(5, 7).map(n => n.padStart(2, '0'));
      return {
        array: [...front, ...back],
        string: [...front, ...back].join(',')
      };
    } else {
      // 排列3/5/七星彩：保持原样
      return {
        array: numbers,
        string: numbers.join(',')
      };
    }
  }

  /**
   * 格式化开奖时间
   * @param {string} drawTime - API返回的时间字符串
   * @param {Object} config - 彩种配置对象
   * @returns {string} 格式化后的时间
   */
  formatDrawTime(drawTime, config) {
    // API返回格式："2025-12-29 21:19:54" 或 "2025-12-30"
    if (drawTime.length === 10) {
      // 只有日期，补充时间（使用配置的开奖时间）
      const defaultTime = config?.drawTime || '21:10';
      return `${drawTime} ${defaultTime}:00`;
    }
    return drawTime;
  }

  /**
   * 计算倒计时
   * @param {string} lotCode - 彩种代码
   * @param {Object} config - 彩种配置
   * @param {string} lastDrawTime - 最近一期开奖时间
   * @returns {number} 倒计时秒数
   */
  calculateCountdown(lotCode, config, lastDrawTime) {
    const now = new Date();
    const currentDay = now.getDay(); // 0-6 (周日-周六)
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // 解析开奖时间
    const [drawHour, drawMinute] = config.drawTime.split(':').map(Number);
    const drawTimeMinutes = drawHour * 60 + drawMinute;

    // 🎯 找到下次开奖日
    let nextDrawDay = null;
    let daysToAdd = 0;

    // 如果今天是开奖日且未到开奖时间
    if (config.drawDays.includes(currentDay) && currentTime < drawTimeMinutes) {
      nextDrawDay = currentDay;
      daysToAdd = 0;
    } else {
      // 找下一个开奖日
      for (let i = 1; i <= 7; i++) {
        const testDay = (currentDay + i) % 7;
        if (config.drawDays.includes(testDay)) {
          nextDrawDay = testDay;
          daysToAdd = i;
          break;
        }
      }
    }

    if (nextDrawDay === null) {
      logger.warn(`[${config.name}] 无法计算下次开奖日，使用默认间隔`);
      return config.drawInterval;
    }

    // 计算时间差
    const nextDrawDate = new Date(now);
    nextDrawDate.setDate(nextDrawDate.getDate() + daysToAdd);
    nextDrawDate.setHours(drawHour, drawMinute, 0, 0);

    const countdown = Math.floor((nextDrawDate - now) / 1000);

    logger.debug(
      `[${config.name}] 倒计时计算: 当前${['日', '一', '二', '三', '四', '五', '六'][currentDay]} ${now.getHours()}:${now.getMinutes()} → ` +
      `下次开奖${['日', '一', '二', '三', '四', '五', '六'][nextDrawDay]} ${config.drawTime} (${daysToAdd}天后) = ${countdown}秒`
    );

    return Math.max(0, countdown);
  }

  /**
   * 获取历史数据（支持按年查询）
   * @param {string} lotCode - 彩种代码
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 获取数量（默认30）
   * @param {string} options.year - 年份（格式：'2024'）
   * @returns {Promise<Array>} 历史数据数组
   */
  async fetchHistoryData(lotCode, options = {}) {
    const config = LOTTERY_CONFIGS[lotCode];
    if (!config) {
      throw new Error(`不支持的彩种代码: ${lotCode}`);
    }

    const { limit = 30, year = null } = options;

    try {
      let allData = [];

      if (year) {
        // 🎯 按年查询：需要分页获取该年份的所有数据
        logger.info(`[${config.name}] 📅 获取${year}年历史数据...`);

        const yearPrefix = year.substring(2); // '2024' -> '24'
        let pageNo = 1;
        let totalFetched = 0;
        let foundTargetYear = false; // 是否找到目标年份
        let leftTargetYear = false;  // 是否已离开目标年份

        while (totalFetched < 1000) { // 最多1000期
          const pageData = await this.fetchHistoryPage(config, pageNo, 100);

          if (!pageData || pageData.length === 0) {
            break;
          }

          // 筛选该年份的数据
          const yearData = pageData.filter(item => {
            const periodStr = String(item.lotteryDrawNum);
            return periodStr.startsWith(yearPrefix);
          });

          if (yearData.length > 0) {
            foundTargetYear = true;
            allData = allData.concat(yearData);
          }

          // 如果已经找到过目标年份，但这一页没有任何目标年份数据，说明已经离开了
          if (foundTargetYear && yearData.length === 0) {
            leftTargetYear = true;
          }

          // 如果已经离开目标年份，停止查询
          if (leftTargetYear) {
            break;
          }

          totalFetched += pageData.length;
          pageNo++;

          // 避免请求过快
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        logger.info(`[${config.name}] ✅ 获取到${year}年数据: ${allData.length}期`);

      } else {
        // 📜 普通查询：获取最近N期
        allData = await this.fetchHistoryPage(config, 1, limit);
      }

      // 转换为标准格式
      return allData.map(item => ({
        lotCode: lotCode,
        period: item.lotteryDrawNum,
        numbers: this.formatNumbers(item.lotteryDrawResult, config.numberFormat).array,
        opencode: this.formatNumbers(item.lotteryDrawResult, config.numberFormat).string,
        drawTime: this.formatDrawTime(item.lotteryDrawTime, config),
        source: 'sportslottery_official'
      }));

    } catch (error) {
      logger.error(`[${config.name}] 获取历史数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取历史数据的单页
   * @param {Object} config - 彩种配置
   * @param {number} pageNo - 页码
   * @param {number} pageSize - 每页数量
   * @returns {Promise<Array>} 历史数据数组
   */
  async fetchHistoryPage(config, pageNo, pageSize) {
    // 优先使用 historyGameNo（排列5需要），否则使用 gameNo
    const gameNo = config.historyGameNo || config.gameNo;
    const historyUrl = `https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=${gameNo}&provinceId=0&pageSize=${pageSize}&isVerify=1&pageNo=${pageNo}`;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.lottery.gov.cn/'
      }
    };

    return new Promise((resolve, reject) => {
      https.get(historyUrl, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.errorCode === '0' && json.value && json.value.list) {
              resolve(json.value.list);
            } else {
              reject(new Error('历史数据API返回错误'));
            }
          } catch (error) {
            reject(error);
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
      source: 'sportslottery',
      lotteries: results,
      timestamp: new Date().toISOString()
    };
  }
}

export default SportsLotteryScraper;
