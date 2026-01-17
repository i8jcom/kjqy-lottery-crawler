import BaseCrawler from './BaseCrawler.js';
import logger from '../utils/Logger.js';

/**
 * 3650098.com 数据源爬虫
 */
class Source3650098 extends BaseCrawler {
  constructor() {
    super('3650098', 'https://3650098.com/api');
  }

  /**
   * 获取实时数据
   */
  async fetchRealtimeData(lotCode) {
    try {
      // 根据彩种类型选择不同的API端点
      const endpoint = this.getEndpoint(lotCode);
      const url = `${this.baseUrl}/${endpoint}/getLotteryInfo.do?lotCode=${lotCode}`;

      logger.debug(`📡 [${this.name}] 请求实时数据: ${lotCode}`);

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
      const { pageNo = 1, pageSize = 50 } = options;
      const endpoint = this.getEndpoint(lotCode);
      const url = `${this.baseUrl}/${endpoint}/get${this.getHistoryEndpointName(lotCode)}HistoryList.do?lotCode=${lotCode}&pageNo=${pageNo}&pageSize=${pageSize}`;

      logger.debug(`📡 [${this.name}] 请求历史数据: ${lotCode}`);

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

    // 赛车类 (10001-10099)
    if (code >= 10001 && code <= 10099) return 'pks';

    // 时时彩类 (10101-10199)
    if (code >= 10101 && code <= 10199) return 'ssc';

    // 快乐十分类 (10201-10299)
    if (code >= 10201 && code <= 10299) return 'klsf';

    // 快乐8类 (10301-10399)
    if (code >= 10301 && code <= 10399) return 'kl8';

    // PC蛋蛋类 (10401-10499)
    if (code >= 10401 && code <= 10499) return 'pcdd';

    // 11选5类 (10501-10599)
    if (code >= 10501 && code <= 10599) return 'syxw';

    // K3类 (10601-10699)
    if (code >= 10601 && code <= 10699) return 'k3';

    // 官方彩类 (10901-10999)
    if (code >= 10901 && code <= 10999) return 'qgc';

    // 默认
    return 'lottery';
  }

  /**
   * 获取历史数据端点名称
   */
  getHistoryEndpointName(lotCode) {
    const endpoint = this.getEndpoint(lotCode);
    const nameMap = {
      'pks': 'Pks',
      'ssc': 'Ssc',
      'klsf': 'Klsf',
      'kl8': 'Kl8',
      'pcdd': 'Pcdd',
      'syxw': 'Syxw',
      'k3': 'K3',
      'qgc': 'Lottery'
    };
    return nameMap[endpoint] || 'Lottery';
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

export default Source3650098;
