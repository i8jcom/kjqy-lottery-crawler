import BaseCrawler from './BaseCrawler.js';
import logger from '../utils/Logger.js';

/**
 * 官方API数据源（使用主系统的API）
 * API Base: https://api.apiose122.com
 */
class SourceOfficialAPI extends BaseCrawler {
  constructor() {
    super('OfficialAPI', 'https://api.apiose122.com');
  }

  /**
   * 获取实时数据
   */
  async fetchRealtimeData(lotCode) {
    try {
      const endpoint = this.getEndpointForLotCode(lotCode);
      const params = this.getParamsForLotCode(lotCode);
      const url = `${this.baseUrl}${endpoint}?lotCode=${lotCode}${params}`;

      logger.debug(`📡 [${this.name}] 请求实时数据: ${lotCode} -> ${url}`);

      const response = await this.requestWithRetry(url);

      // 解析响应数据
      if (response && response.errorCode === 0 && response.result && response.result.data) {
        const data = response.result.data;

        // 检查数据是否有效
        if (!data.serverTime || !data.drawTime) {
          logger.warn(`⚠️ [${this.name}] 数据无效: ${lotCode}`);
          return null;
        }

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
      let url = `${this.baseUrl}/pks/getPksHistoryList.do?lotCode=${lotCode}&pageNo=${pageNo}&pageSize=${pageSize}`;

      // 如果指定了日期，添加date参数
      if (date) {
        url += `&date=${date}`;
      }

      logger.info(`📡 [${this.name}] 请求历史数据: ${lotCode}${date ? ` (日期: ${date})` : ''} - URL: ${url}`);

      const response = await this.requestWithRetry(url);

      if (response && response.errorCode === 0 && response.result && response.result.data) {
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
   * 根据彩种代码获取对应的API端点
   */
  getEndpointForLotCode(lotCode) {
    const code = parseInt(lotCode);

    const endpointMap = {
      // 线路9 - 特殊彩种
      9: '/pks/getLotteryPksInfo.do',

      // 快乐十分类型
      10005: '/klsf/getLotteryInfo.do',
      10034: '/klsf/getLotteryInfo.do',
      10053: '/klsf/getLotteryInfo.do',
      10083: '/klsf/getLotteryInfo.do',  // SG快乐十分
      10011: '/klsf/getLotteryInfo.do',
      10078: '/klsf/getLotteryInfo.do',
      10201: '/klsf/getLotteryInfo.do',
      10215: '/klsf/getLotteryInfo.do',
      10217: '/klsf/getLotteryInfo.do',
      10236: '/klsf/getLotteryInfo.do',

      // PK10/赛车类型
      10001: '/pks/getLotteryPksInfo.do',
      10002: '/pks/getLotteryPksInfo.do',
      10012: '/pks/getLotteryPksInfo.do',
      10017: '/pks/getLotteryPksInfo.do',
      10037: '/pks/getLotteryPksInfo.do',
      10038: '/pks/getLotteryPksInfo.do',
      10057: '/pks/getLotteryPksInfo.do',
      10058: '/pks/getLotteryPksInfo.do',
      10035: '/pks/getLotteryPksInfo.do',
      10079: '/pks/getLotteryPksInfo.do',
      10084: '/pks/getLotteryPksInfo.do',

      // 时时彩类型
      10101: '/CQShiCai/getBaseCQShiCai.do',
      10103: '/CQShiCai/getBaseCQShiCai.do',
      10104: '/CQShiCai/getBaseCQShiCai.do',
      10109: '/CQShiCai/getBaseCQShiCai.do',
      10111: '/CQShiCai/getBaseCQShiCai.do',
      10148: '/CQShiCai/getBaseCQShiCai.do',
      10036: '/CQShiCai/getBaseCQShiCai.do',
      10059: '/CQShiCai/getBaseCQShiCai.do',
      10075: '/CQShiCai/getBaseCQShiCai.do',
      10064: '/CQShiCai/getBaseCQShiCai.do',
      10010: '/CQShiCai/getBaseCQShiCai.do',
      10077: '/CQShiCai/getBaseCQShiCai.do',

      // 快乐8/快乐20类型
      10013: '/LuckTwenty/getBaseLuckTewnty.do',
      10054: '/LuckTwenty/getBaseLuckTewnty.do',
      10082: '/LuckTwenty/getBaseLuckTewnty.do',
      10047: '/LuckTwenty/getBaseLuckTewnty.do',
      10080: '/LuckTwenty/getBaseLuckTewnty.do',
      10301: '/LuckTwenty/getBaseLuckTewnty.do',
      10313: '/LuckTwenty/getBaseLuckTewnty.do',
      10316: '/LuckTwenty/getBaseLuckTewnty.do',
      10321: '/LuckTwenty/getBaseLuckTewnty.do',
      10338: '/LuckTwenty/getBaseLuckTewnty.do',

      // PC蛋蛋类型
      10401: '/LuckTwenty/getPcLucky28.do',
      10427: '/LuckTwenty/getPcLucky28.do',

      // 11选5类型
      10501: '/ElevenFive/getElevenFiveInfo.do',
      10528: '/ElevenFive/getElevenFiveInfo.do',

      // 快3类型
      10617: '/lotteryJSFastThree/getBaseJSFastThree.do',
      10628: '/lotteryJSFastThree/getBaseJSFastThree.do',

      // 官方彩类型
      10901: '/QuanGuoCai/getLotteryInfo.do',
      10902: '/QuanGuoCai/getLotteryInfo.do',
      10903: '/QuanGuoCai/getLotteryInfo.do',
      10904: '/QuanGuoCai/getLotteryInfo.do',
      10905: '/QuanGuoCai/getLotteryInfo.do',
      10906: '/QuanGuoCai/getLotteryInfo.do',
      10907: '/QuanGuoCai/getLotteryInfo.do',
      10995: '/taiWanCai/getLotteryInfo.do',
      10996: '/taiWanCai/getLotteryInfo.do',
      10997: '/taiWanCai/getLotteryInfo.do'
    };

    return endpointMap[code] || '/pks/getLotteryPksInfo.do'; // 默认使用PK10接口
  }

  /**
   * 根据彩种代码获取对应的API参数
   */
  getParamsForLotCode(lotCode) {
    const code = parseInt(lotCode);

    const paramsMap = {
      // 快乐十分类型需要pageType参数
      10005: '&pageType=3',
      10034: '&pageType=3',
      10053: '&pageType=53',
      10083: '&pageType=83',  // SG快乐十分
      10011: '&pageType=3',
      10078: '&pageType=3'
    };

    return paramsMap[code] || ''; // 默认无额外参数
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

export default SourceOfficialAPI;
