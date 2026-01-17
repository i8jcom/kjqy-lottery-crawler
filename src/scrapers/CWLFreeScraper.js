import axios from 'axios';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';

/**
 * 中国福彩爬虫 - 免费API版本（企业级域名管理）
 *
 * 📊 数据源：多域名智能切换（完全免费）
 * 🔗 无需注册，无需API密钥
 * 💰 无限制调用
 * 🛡️ 自动故障转移，零停机保障
 *
 * 支持彩种：
 * - 双色球 (ssq) - lotCode: 10039
 * - 福彩3D (fc3d) - lotCode: 10041
 * - 七乐彩 (qlc) - lotCode: 10042
 * - 快乐8 (kl8) - lotCode: 10073
 *
 * 优势：
 * ✅ 零成本（完全免费）
 * ✅ 零配置（无需API密钥）
 * ✅ 零资源消耗（普通HTTP请求）
 * ✅ 企业级可靠性（多域名自动切换）
 * ✅ 无限制调用
 */
class CWLFreeScraper {
  constructor() {
    // ⚠️ 不再硬编码baseUrl，改为动态获取
    // this.baseUrl = 'https://api.apiose188.com';
    this.domainManager = universalDomainManager;
    this.sourceType = 'cwl'; // 数据源类型

    // 彩种API配置
    this.lotteryApis = {
      'ssq': {
        name: '双色球',
        endpoint: '/QuanGuoCai/getHistoryLotteryInfo.do',
        apiLotCode: '10039',
        numberCount: 7,
        drawDays: [2, 4, 0],  // 周二、四、日
        drawTime: { hour: 21, minute: 15 }
      },
      'fc3d': {
        name: '福彩3D',
        endpoint: '/QuanGuoCai/getLotteryInfoList.do',
        apiLotCode: '10041',
        numberCount: 3,
        drawDays: [0,1,2,3,4,5,6],  // 每天
        drawTime: { hour: 21, minute: 15 }
      },
      'qlc': {
        name: '七乐彩',
        endpoint: '/QuanGuoCai/getHistoryLotteryInfo.do',
        apiLotCode: '10042',
        numberCount: 8,  // 7个基本号码 + 1个特别号码
        drawDays: [1, 3, 5],  // 周一、三、五
        drawTime: { hour: 21, minute: 30 }
      },
      'kl8': {
        name: '快乐8',
        endpoint: '/LuckTwenty/getBaseLuckTwentyList.do',
        apiLotCode: '10073',
        numberCount: 20,
        drawDays: [0,1,2,3,4,5,6],  // 每天
        drawTime: { hour: 21, minute: 15 }  // 高频彩，具体按API返回
      }
    };
  }

  /**
   * 获取最新开奖数据
   *
   * @param {string} lotCode - 彩种代码（ssq, fc3d, qlc, kl8）
   * @param {number} retryCount - 当前重试次数
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} 标准化的开奖数据
   */
  async fetchLatestData(lotCode = 'ssq', retryCount = 0, maxRetries = 3) {
    let currentDomain = null;
    const startTime = Date.now();

    try {
      const config = this.lotteryApis[lotCode];

      if (!config) {
        throw new Error(`CWL不支持彩种: ${lotCode}`);
      }

      // 🔥 从域名管理器获取当前最优域名
      currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      logger.info(`[CWL-Free] 🚀 请求 ${config.name}${retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : ''} [域名: ${baseUrl}]`);

      const requestUrl = `${baseUrl}${config.endpoint}`;
      logger.debug(`[CWL-Free] 📡 请求URL: ${requestUrl}?lotCode=${config.apiLotCode}`);

      const response = await axios.get(requestUrl, {
        params: {
          lotCode: config.apiLotCode,
          ...(lotCode === 'kl8' && { date: '' })  // 快乐8需要date参数
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const responseTime = Date.now() - startTime;

      logger.debug(`[CWL-Free] 📥 响应状态: ${response.status}`);
      logger.debug(`[CWL-Free] 📥 响应数据: ${JSON.stringify(response.data).substring(0, 200)}...`);

      // 检查API响应状态
      if (response.data.errorCode !== 0) {
        const errorMsg = response.data.message || '未知错误';
        throw new Error(`API错误: ${errorMsg} (errorCode=${response.data.errorCode})`);
      }

      if (!response.data.result || !response.data.result.data || response.data.result.data.length === 0) {
        throw new Error('API返回数据为空');
      }

      // 获取最新一期数据
      const latestData = response.data.result.data[0];

      if (!latestData || !latestData.preDrawIssue) {
        throw new Error('数据格式错误：缺少期号');
      }

      // 解析并标准化数据
      const parsedData = this.parseApiData(latestData, lotCode, currentDomain.domain_url);

      // ✅ 记录成功（域名管理器统计）
      await this.domainManager.recordSuccess(currentDomain.id, responseTime);

      logger.info(`[CWL-Free] ✅ 成功获取 ${config.name} - 期号: ${parsedData.period} (${responseTime}ms)`);
      return parsedData;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // 详细记录错误信息
      if (error.response) {
        logger.error(`[CWL-Free] ❌ HTTP错误 ${error.response.status}: ${error.response.statusText}`);
        logger.debug(`[CWL-Free] 响应数据: ${JSON.stringify(error.response.data).substring(0, 200)}`);
      } else if (error.request) {
        logger.error(`[CWL-Free] ❌ 请求发送失败，无响应: ${error.message}`);
      } else {
        logger.error(`[CWL-Free] ❌ 请求配置错误: ${error.message}`);
      }

      // ❌ 记录失败（域名管理器统计，可能触发自动切换）
      if (currentDomain) {
        await this.domainManager.recordFailure(currentDomain.id, error, true);
      }

      if (retryCount < maxRetries) {
        logger.warn(`[CWL-Free] ⏳ 准备重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      logger.error(`[CWL-Free] ❌ 最终失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 解析免费API返回的数据
   *
   * API返回格式示例：
   * {
   *   "preDrawIssue": 2025150,
   *   "preDrawCode": "06,13,17,19,24,31,08",
   *   "preDrawTime": "2025-12-28 21:30:00"
   * }
   *
   * @param {Object} data - API返回的单条数据
   * @param {string} lotCode - 彩种代码
   * @returns {Object} 标准化的数据对象
   */
  parseApiData(data, lotCode, domainUrl = null) {
    if (!data || !data.preDrawIssue) {
      return null;
    }

    const config = this.lotteryApis[lotCode];

    // 解析开奖号码
    const numbers = data.preDrawCode ? data.preDrawCode.split(',').map(n => n.trim()) : [];

    // 验证号码数量
    if (numbers.length !== config.numberCount) {
      logger.warn(`[CWL-Free] ${config.name} 号码数量: ${numbers.length}/${config.numberCount} (可能正常)`);
    }

    // 计算倒计时
    const countdown = this.calculateNextDrawCountdown(lotCode);

    return {
      period: String(data.preDrawIssue),
      opencode: numbers.join(','),
      numbers: numbers,
      opentime: data.preDrawTime || null,
      countdown: countdown,

      // 元数据
      _metadata: {
        lotteryType: config.name,
        drawDate: data.preDrawTime,
        source: 'free_api',
        apiProvider: domainUrl || '动态域名', // 🔥 记录实际使用的域名
        domainUrl: domainUrl, // 🔥 完整域名URL
        sumNum: data.sumNum  // 和值（某些分析可能需要）
      }
    };
  }

  /**
   * 计算距离下次开奖的倒计时（秒）
   */
  calculateNextDrawCountdown(lotCode) {
    const now = new Date();
    const config = this.lotteryApis[lotCode];

    if (!config) {
      return 0;
    }

    let nextDraw = new Date(now);
    nextDraw.setHours(config.drawTime.hour, config.drawTime.minute, 0, 0);

    const currentDay = now.getDay();

    // 如果今天是开奖日且未过开奖时间
    if (config.drawDays.includes(currentDay) && now < nextDraw) {
      // 使用今天的开奖时间
    } else {
      // 找下一个开奖日
      let daysToAdd = 1;
      while (daysToAdd <= 7) {
        const testDay = (currentDay + daysToAdd) % 7;
        if (config.drawDays.includes(testDay)) {
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
   * 获取历史数据（利用API返回的多期数据）
   *
   * @param {string} lotCode - 彩种代码
   * @param {number} limit - 获取期数（默认30期）
   * @returns {Promise<Array>} 历史数据数组
   */
  async fetchHistoryData(lotCode = 'ssq', limit = 30) {
    try {
      const config = this.lotteryApis[lotCode];

      if (!config) {
        throw new Error(`CWL不支持彩种: ${lotCode}`);
      }

      // 🔥 从域名管理器获取当前最优域名
      const currentDomain = await this.domainManager.getBestDomain();
      const baseUrl = currentDomain.domain_url;

      logger.info(`[CWL-Free] 📜 请求历史数据，彩种: ${config.name}, 数量: ${limit} [域名: ${baseUrl}]`);

      const response = await axios.get(`${baseUrl}${config.endpoint}`, {
        params: {
          lotCode: config.apiLotCode,
          ...(lotCode === 'kl8' && { date: '' })
        },
        timeout: 10000
      });

      if (response.data.errorCode !== 0) {
        throw new Error(`API错误: ${response.data.message}`);
      }

      if (!response.data.result || !response.data.result.data) {
        throw new Error('历史数据返回格式错误');
      }

      // 解析历史数据（取前limit期）
      const historyData = response.data.result.data
        .slice(0, limit)
        .map(item => this.parseApiData(item, lotCode, currentDomain.domain_url))
        .filter(item => item !== null);

      logger.info(`[CWL-Free] ✅ 成功获取 ${config.name} ${historyData.length} 期历史数据`);
      return historyData;

    } catch (error) {
      logger.error(`[CWL-Free] 历史数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 按年份获取历史数据
   *
   * @param {string} lotCode - 彩种代码
   * @param {number} year - 年份（如2024）
   * @param {string} customDate - 自定义查询日期（可选，如"2024-06-30"）
   * @returns {Promise<Object>} 该年份的历史数据对象 {allData, yearData}
   */
  async fetchYearData(lotCode = 'ssq', year = 2025, customDate = null) {
    try {
      const config = this.lotteryApis[lotCode];

      if (!config) {
        throw new Error(`CWL不支持彩种: ${lotCode}`);
      }

      // 🔥 从域名管理器获取当前最优域名
      const currentDomain = await this.domainManager.getBestDomain();
      const baseUrl = currentDomain.domain_url;

      // 使用自定义日期或年份的最后一天
      const dateParam = customDate || `${year}-12-31`;

      logger.info(`[CWL-Free] 📅 请求年度数据，彩种: ${config.name}, 年份: ${year}, 查询日期: ${dateParam} [域名: ${baseUrl}]`);

      const response = await axios.get(`${baseUrl}${config.endpoint}`, {
        params: {
          lotCode: config.apiLotCode,
          date: dateParam
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.data.errorCode !== 0) {
        throw new Error(`API错误: ${response.data.message}`);
      }

      if (!response.data.result || !response.data.result.data) {
        throw new Error('年度数据返回格式错误');
      }

      // 解析所有数据
      const allData = response.data.result.data
        .map(item => this.parseApiData(item, lotCode, currentDomain.domain_url))
        .filter(item => item !== null);

      // 筛选出该年份的数据
      const yearData = allData.filter(item => {
        if (!item.opentime) return false;
        const itemYear = new Date(item.opentime).getFullYear();
        return itemYear === year;
      });

      logger.info(`[CWL-Free] ✅ 成功获取 ${config.name} ${year}年数据: ${yearData.length} 期 (API返回${allData.length}期)`);

      // 返回所有数据和指定年份数据
      return {
        allData: allData,        // API返回的所有100期数据
        yearData: yearData       // 筛选后的指定年份数据
      };

    } catch (error) {
      logger.error(`[CWL-Free] ${year}年数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取完整年度数据（多次查询自动合并）
   *
   * 策略：
   * - 低频彩（双色球、七乐彩）：2次查询（12-31, 06-30）
   * - 高频彩（福彩3D、快乐8）：4次查询（12-31, 09-30, 06-30, 03-31）
   *
   * @param {string} lotCode - 彩种代码 (ssq, fc3d, qlc, kl8)
   * @param {number} year - 年份
   * @returns {Promise<Object>} { allData, yearData }
   */
  async fetchFullYearData(lotCode = 'ssq', year = 2025) {
    try {
      const config = this.lotteryApis[lotCode];

      if (!config) {
        throw new Error(`CWL不支持彩种: ${lotCode}`);
      }

      // 🎯 根据彩种确定查询策略
      const queryDates = {
        'ssq': ['12-31', '06-30'],           // 双色球：2次查询
        'fc3d': ['12-31', '09-30', '06-30', '03-31'],  // 福彩3D：4次查询
        'qlc': ['12-31', '06-30'],           // 七乐彩：2次查询
        'kl8': ['12-31', '09-30', '06-30', '03-31']    // 快乐8：4次查询
      };

      const dates = queryDates[lotCode] || ['12-31'];

      logger.info(`[CWL-Free] 🎯 开始获取 ${config.name} ${year}年完整数据，需要查询${dates.length}次`);

      const allRecords = new Map(); // 使用Map去重（key=期号）

      // 多次查询，每次不同的日期点
      for (let i = 0; i < dates.length; i++) {
        const datePoint = `${year}-${dates[i]}`;

        try {
          const result = await this.fetchYearData(lotCode, year, datePoint);

          if (result && result.allData) {
            // 合并数据（自动去重）
            let newCount = 0;
            for (const record of result.allData) {
              const issueKey = record.period;
              if (!allRecords.has(issueKey)) {
                allRecords.set(issueKey, record);
                newCount++;
              }
            }

            logger.info(`[CWL-Free] 📡 查询 ${i + 1}/${dates.length}: date=${datePoint}, 返回${result.allData.length}期，新增${newCount}期，累计${allRecords.size}期`);
          }

          // 短暂延迟，避免频繁请求
          if (i < dates.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }

        } catch (error) {
          logger.warn(`[CWL-Free] 查询失败 (${datePoint}): ${error.message}`);
        }
      }

      // 转换为数组
      const allData = Array.from(allRecords.values());

      // 筛选出指定年份的数据
      const yearData = allData.filter(item => {
        if (!item.opentime) return false;
        const itemYear = new Date(item.opentime).getFullYear();
        return itemYear === year;
      });

      // 按期号排序（降序）
      yearData.sort((a, b) => parseInt(b.period) - parseInt(a.period));

      logger.info(`[CWL-Free] ✅ ${config.name} ${year}年完整数据获取成功: ${yearData.length}期 (总获取${allData.length}期)`);

      return {
        allData: allData,
        yearData: yearData
      };

    } catch (error) {
      logger.error(`[CWL-Free] ${year}年完整数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      // 🔥 从域名管理器获取当前最优域名
      const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      // 测试双色球API连接
      const response = await axios.get(`${baseUrl}/QuanGuoCai/getHistoryLotteryInfo.do`, {
        params: {
          lotCode: '10039'
        },
        timeout: 5000
      });

      const isHealthy = response.data.errorCode === 0 &&
                       response.data.result &&
                       response.data.result.data &&
                       response.data.result.data.length > 0;

      return {
        healthy: isHealthy,
        statusCode: response.status,
        apiStatus: response.data.errorCode,
        dataSource: '免费API (api.apiose188.com)',
        apiUrl: baseUrl,
        latestPeriod: response.data.result?.data?.[0]?.preDrawIssue || 'N/A',
        note: '完全免费，无需注册，无限制调用',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // 获取域名用于错误信息
      let baseUrl = 'unknown';
      try {
        const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
        baseUrl = currentDomain.domain_url;
      } catch {}

      return {
        healthy: false,
        error: error.message,
        dataSource: '免费API',
        apiUrl: baseUrl,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 导出单例
export default new CWLFreeScraper();
