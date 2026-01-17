import BaseCrawler from './BaseCrawler.js';
import logger from '../utils/Logger.js';
import lotteryConfigManager from '../managers/LotteryConfigManager.js';

/**
 * 168官方API数据源爬虫（支持可配置端点）- 与主系统同步
 * 使用 7p6a7sf3g.1682gaz3.com 官方API (主系统Priority 2)
 */
class Source3650062 extends BaseCrawler {
  constructor() {
    super('168official', 'https://7p6a7sf3g.1682gaz3.com');
  }

  /**
   * 获取实时数据
   */
  async fetchRealtimeData(lotCode) {
    try {
      // 从配置管理器获取彩种配置
      const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
      if (!lotteryConfig) {
        logger.warn(`⚠️ [${this.name}] 彩种配置不存在: ${lotCode}`);
        return null;
      }

      // 优先使用彩种配置中的apiEndpoint，否则回退到endpointMap
      let url;
      if (lotteryConfig.apiEndpoint) {
        url = `${this.baseUrl}/${lotteryConfig.apiEndpoint}?lotCode=${lotCode}`;
      } else {
        // 获取端点配置（回退方案）
        const endpointConfig = lotteryConfigManager.getEndpointConfig(lotteryConfig.endpoint);
        if (!endpointConfig) {
          logger.warn(`⚠️ [${this.name}] 端点配置不存在: ${lotteryConfig.endpoint}`);
          return null;
        }
        url = `${this.baseUrl}/${endpointConfig.path}/${endpointConfig.realtimeMethod}.do?lotCode=${lotCode}`;
      }

      logger.debug(`📡 [${this.name}] 请求实时数据: ${lotCode} -> ${url}`);

      const response = await this.requestWithRetry(url);

      // 解析响应数据
      if (response && response.result && response.result.data) {
        const data = response.result.data;

        const realtimeData = {
          issue: data.preDrawIssue,
          drawCode: data.preDrawCode,
          drawTime: data.preDrawTime,
          nextIssue: data.drawIssue,
          nextDrawTime: data.drawTime,
          serverTime: data.serverTime,
          countdown: this.calculateCountdown(data.drawTime, data.serverTime),
          source: this.name
        };

        logger.success(`✅ [${this.name}] 实时数据获取成功: ${lotCode} - 期号 ${realtimeData.issue}`);
        return realtimeData;
      } else {
        logger.warn(`⚠️ [${this.name}] 响应数据格式错误: ${lotCode}`);
        return null;
      }
    } catch (error) {
      logger.error(`❌ [${this.name}] 获取实时数据失败: ${lotCode}`, error);
      return null;
    }
  }

  /**
   * 获取历史数据
   */
  async fetchHistoryData(lotCode, options = {}) {
    try {
      const { pageNo = 1, pageSize = 50, date } = options;

      // 从配置管理器获取彩种配置
      const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
      if (!lotteryConfig) {
        logger.warn(`⚠️ [${this.name}] 彩种配置不存在: ${lotCode}`);
        return [];
      }

      // 优先使用彩种配置中的historyEndpoint，否则回退到endpointMap
      let url;
      if (lotteryConfig.historyEndpoint) {
        url = `${this.baseUrl}/${lotteryConfig.historyEndpoint}?lotCode=${lotCode}&pageNo=${pageNo}&pageSize=${pageSize}`;
      } else {
        // 获取端点配置（回退方案）
        const endpointConfig = lotteryConfigManager.getEndpointConfig(lotteryConfig.endpoint);
        if (!endpointConfig) {
          logger.warn(`⚠️ [${this.name}] 端点配置不存在: ${lotteryConfig.endpoint}`);
          return [];
        }
        url = `${this.baseUrl}/${endpointConfig.path}/${endpointConfig.historyMethod}.do?lotCode=${lotCode}&pageNo=${pageNo}&pageSize=${pageSize}`;
      }

      // 如果指定了日期，添加date参数
      if (date) {
        url += `&date=${date}`;
      }

      logger.info(`📡 [${this.name}] 请求历史数据: ${lotCode}${date ? ` (日期: ${date})` : ''} - URL: ${url}`);

      const response = await this.requestWithRetry(url);

      if (response && response.result && response.result.data) {
        const records = response.result.data.map(item => ({
          issue: item.preDrawIssue,
          drawCode: item.preDrawCode,
          drawTime: item.preDrawTime
        }));

        logger.success(`✅ [${this.name}] 历史数据获取成功: ${lotCode} - ${records.length}条记录`);
        return records;
      } else {
        logger.warn(`⚠️ [${this.name}] 历史响应数据格式错误: ${lotCode}`);
        return [];
      }
    } catch (error) {
      logger.error(`❌ [${this.name}] 获取历史数据失败: ${lotCode}`, error);
      return [];
    }
  }

  /**
   * 根据彩种代码获取API端点
   */
  getEndpoint(lotCode) {
    const code = parseInt(lotCode);

    if (code >= 10001 && code <= 10099) return 'pks';
    if (code >= 10101 && code <= 10199) return 'ssc';
    if (code >= 10201 && code <= 10299) return 'klsf';
    if (code >= 10301 && code <= 10399) return 'kl8';
    if (code >= 10401 && code <= 10499) return 'pcdd';
    if (code >= 10501 && code <= 10599) return 'syxw';
    if (code >= 10601 && code <= 10699) return 'k3';
    if (code >= 10901 && code <= 10999) return 'qgc';

    return 'lottery';
  }

  /**
   * 获取实时数据方法名
   */
  getMethodName(endpoint) {
    const methodMap = {
      'pks': 'getLotteryPksInfo',
      'ssc': 'getLotterySscInfo',
      'klsf': 'getLotteryKlsfInfo',
      'kl8': 'getLotteryKl8Info',
      'pcdd': 'getLotteryPcddInfo',
      'syxw': 'getLotterySyxwInfo',
      'k3': 'getLotteryK3Info',
      'qgc': 'getLotteryInfo'
    };
    return methodMap[endpoint] || 'getLotteryInfo';
  }

  /**
   * 获取历史数据方法名
   */
  getHistoryMethodName(endpoint) {
    const methodMap = {
      'pks': 'getPksHistoryList',
      'ssc': 'getSscHistoryList',
      'klsf': 'getKlsfHistoryList',
      'kl8': 'getKl8HistoryList',
      'pcdd': 'getPcddHistoryList',
      'syxw': 'getSyxwHistoryList',
      'k3': 'getK3HistoryList',
      'qgc': 'getLotteryHistoryList'
    };
    return methodMap[endpoint] || 'getLotteryHistoryList';
  }

  /**
   * 计算倒计时
   */
  calculateCountdown(nextDrawTime, serverTime) {
    if (!nextDrawTime || !serverTime) return 0;

    const next = new Date(nextDrawTime).getTime();
    const now = new Date(serverTime).getTime();
    const countdown = Math.floor((next - now) / 1000);

    return Math.max(countdown, 0);
  }
}

export default Source3650062;
