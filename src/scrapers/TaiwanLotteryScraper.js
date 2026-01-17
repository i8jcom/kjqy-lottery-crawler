import axios from 'axios';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';
import lotteryConfigManager from '../managers/LotteryConfigManager.js';

/**
 * 台湾彩票官网爬虫 - 使用官方API (极速方案)
 * 🇹🇼 数据来源: https://api.taiwanlottery.com/TLCAPIWeB/Lottery
 *
 * 支持彩种：
 * - lotto649 - 威力彩 (6个号码 + 1个特别号)
 * - biglotto - 大乐透 (6个号码 + 1个特别号)
 * - daily539 - 今彩539 (5个号码)
 * - list38 - 38樂合彩 (6个号码)
 * - lotto3d - 3D (3个号码)
 * - lotto4d - 4D (4个号码)
 *
 * ✅ 技术方案：直接调用官方JSON API（参考GitHub成功案例）
 * ⚡ 性能：极快（~200ms，无需HTML解析）
 * 🎯 准确性：100%（官方数据）
 */
class TaiwanLotteryScraper {
  constructor() {
    this.domainManager = universalDomainManager;
    this.sourceType = 'taiwanlottery';

    // 台湾彩票官方API基础URL
    this.apiBaseUrl = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery';

    // 数字代码到API键的映射（调度器使用数字代码）
    this.lotCodeMapping = {
      '100001': 'lotto649',   // 威力彩（Super Lotto 6/38）
      '100002': 'biglotto',   // 大乐透（Lotto 6/49）
      '100003': 'daily539',   // 今彩539
      '100005': 'lotto3d',    // 3星彩
      '100006': 'lotto4d',    // 4星彩
      '100008': 'list39m5',   // 39樂合彩（M5/39）
      '100009': 'list49m6'    // 49樂合彩（M6/49）
    };

    // API端点映射（所有endpoint都支持范围查询：?period&month=开始月&endMonth=结束月）
    this.apiEndpoints = {
      // 威力彩 API
      'lotto649': '/SuperLotto638Result',

      // 大乐透 API
      'biglotto': '/Lotto649Result',

      // 今彩539 API
      'daily539': '/Daily539Result',

      // 3星彩 API
      'lotto3d': '/3DResult',

      // 4星彩 API
      'lotto4d': '/4DResult',

      // 39樂合彩 API
      'list39m5': '/39M5Result',

      // 49樂合彩 API
      'list49m6': '/49M6Result'
    };

    // 响应字段映射
    this.responseFields = {
      'lotto649': 'superLotto638Res',
      'biglotto': 'lotto649Res',
      'daily539': 'daily539Res',
      'lotto3d': 'lotto3DRes',
      'lotto4d': 'lotto4DRes',
      'list39m5': 'm539Res',
      'list49m6': 'm649Res'
    };

    // 彩种中文名称
    this.lotteryNames = {
      'lotto649': '威力彩',
      'biglotto': '大乐透',
      'daily539': '今彩539',
      'lotto3d': '3D',
      'lotto4d': '4D',
      'list39m5': '39樂合彩',
      'list49m6': '49樂合彩'
    };
  }

  /**
   * 获取当前年月（格式：2026-01）
   */
  getCurrentYearMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * 获取彩票最新数据（使用官方API）
   */
  async fetchLatestData(lotCode, retryCount = 0, maxRetries = 2) {
    const startTime = Date.now();

    try {
      // 转换数字代码到API键（如果需要）
      const apiKey = this.lotCodeMapping[lotCode] || lotCode;
      const endpoint = this.apiEndpoints[apiKey];

      if (!endpoint) {
        throw new Error(`台湾彩票不支持彩种: ${lotCode} (API key: ${apiKey})`);
      }

      // 构建API URL（获取最新数据）
      // 🎯 所有台湾彩票API都使用范围查询格式（获取最近2个月数据，确保跨月时也能获取）
      const yearMonth = this.getCurrentYearMonth();
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

      const apiUrl = `${this.apiBaseUrl}${endpoint}?period&month=${startMonth}&endMonth=${yearMonth}&pageNum=1&pageSize=5`;

      logger.info(`[TaiwanLottery] 🇹🇼 API请求: ${apiUrl}${retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : ''}`);

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

      // 解析API响应（使用apiKey进行解析）
      const result = this.parseAPIResponse(response.data, apiKey);

      if (!result) {
        throw new Error('API返回数据为空或格式错误');
      }

      // 将原始lotCode添加到结果中（用于数据库存储）
      result.lotCode = lotCode;
      result.apiKey = apiKey;

      // 🎯 计算倒计时（基于 drawSchedule 配置）
      // 必须在这里计算，因为 parseAPIResponse 不知道原始 lotCode
      result.officialCountdown = this.calculateCountdown(lotCode);

      // 记录成功（使用虚拟域名管理）
      try {
        const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
        await this.domainManager.recordSuccess(currentDomain.id, responseTime);
      } catch (err) {
        // 域名管理失败不影响数据获取
        logger.debug('[TaiwanLottery] 域名管理记录失败:', err.message);
      }

      logger.info(`[TaiwanLottery] ✅ 成功获取 ${this.lotteryNames[apiKey]} 第${result.period}期数据 (${responseTime}ms)`);
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
        logger.warn(`[TaiwanLottery] ⚠️ ${lotCode} API请求失败 (${error.message})，2秒后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      logger.error(`[TaiwanLottery] ❌ ${lotCode} 获取失败 (已重试${retryCount}次):`, error.message);
      throw error;
    }
  }

  /**
   * 🎯 计算倒计时（基于 drawSchedule 配置）
   * @param {string} lotCode - 原始彩种代码（如 "100001"）
   * @returns {number} 倒计时秒数，0表示无法计算
   */
  calculateCountdown(lotCode) {
    try {
      const lotteryConfig = lotteryConfigManager.getLottery(lotCode);

      if (!lotteryConfig || !lotteryConfig.drawSchedule || lotteryConfig.drawSchedule.mode !== 'scheduled') {
        logger.debug(`[TaiwanLottery] ${lotCode} 没有 drawSchedule 配置，无法计算倒计时`);
        return 0;
      }

      const { drawDays, drawTime } = lotteryConfig.drawSchedule;
      const now = new Date();
      const currentDayOfWeek = now.getDay();
      const [drawHour, drawMinute] = drawTime.split(':').map(Number);

      // 找到下一个开奖日
      let daysUntilNextDraw = null;
      for (let i = 0; i <= 7; i++) {
        const checkDay = (currentDayOfWeek + i) % 7;
        if (drawDays.includes(checkDay)) {
          if (i === 0) {
            // 今天是开奖日，检查时间是否已过
            const currentHours = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTotalMinutes = currentHours * 60 + currentMinutes;
            const drawTotalMinutes = drawHour * 60 + drawMinute;
            if (currentTotalMinutes >= drawTotalMinutes + 10) {
              continue; // 今天的开奖已过（给10分钟缓冲）
            }
          }
          daysUntilNextDraw = i;
          break;
        }
      }

      if (daysUntilNextDraw !== null) {
        const nextDrawTime = new Date(now);
        nextDrawTime.setDate(nextDrawTime.getDate() + daysUntilNextDraw);
        nextDrawTime.setHours(drawHour);
        nextDrawTime.setMinutes(drawMinute);
        nextDrawTime.setSeconds(0);
        nextDrawTime.setMilliseconds(0);

        const countdown = Math.max(0, Math.floor((nextDrawTime.getTime() - now.getTime()) / 1000));
        logger.debug(`[TaiwanLottery] ${lotCode} 倒计时: ${countdown}秒 (下次开奖: ${nextDrawTime.toLocaleString('zh-CN')})`);
        return countdown;
      }

      return 0;
    } catch (error) {
      logger.error(`[TaiwanLottery] ${lotCode} 计算倒计时失败:`, error.message);
      return 0;
    }
  }

  /**
   * 解析API响应数据
   */
  parseAPIResponse(apiData, lotCode) {
    try {
      // 检查响应状态
      if (apiData.rtCode !== 0) {
        throw new Error(`API返回错误: ${apiData.rtMsg || 'Unknown error'}`);
      }

      const content = apiData.content;
      if (!content || content.totalSize === 0) {
        throw new Error('API返回数据为空');
      }

      // 获取对应彩种的结果字段
      const resultField = this.responseFields[lotCode];
      const results = content[resultField];

      if (!results || results.length === 0) {
        throw new Error(`未找到${this.lotteryNames[lotCode]}数据`);
      }

      // 取最新一期
      const latestResult = results[0];

      // 提取开奖号码
      let numbers = [];
      let mainNumbers = [];
      let specialNumbers = [];

      // 根据不同彩种处理号码
      if (lotCode === 'lotto649') {
        // 威力彩: drawNumberSize = [7, 14, 22, 23, 31, 35, 1]
        // 前6个是主号，最后1个是特别号
        const allNumbers = latestResult.drawNumberSize || latestResult.drawNumberAppear || [];
        mainNumbers = allNumbers.slice(0, 6).map(n => String(n).padStart(2, '0'));
        specialNumbers = allNumbers.slice(6).map(n => String(n).padStart(2, '0'));
        numbers = [...mainNumbers, ...specialNumbers];
      } else if (lotCode === 'biglotto') {
        // 大乐透: 前6个是主号，最后1个是特别号
        const allNumbers = latestResult.drawNumberSize || latestResult.drawNumberAppear || [];
        mainNumbers = allNumbers.slice(0, 6).map(n => String(n).padStart(2, '0'));
        specialNumbers = allNumbers.slice(6).map(n => String(n).padStart(2, '0'));
        numbers = [...mainNumbers, ...specialNumbers];
      } else if (lotCode === 'daily539') {
        // 今彩539: 5个号码（1-39），需要补零
        const allNumbers = latestResult.drawNumberSize || latestResult.drawNumberAppear || [];
        numbers = allNumbers.map(n => String(n).padStart(2, '0'));
        mainNumbers = numbers;
      } else if (lotCode === 'list39m5') {
        // 39樂合彩: 5个号码（1-39），需要补零
        const allNumbers = latestResult.drawNumberSize || latestResult.drawNumberAppear || [];
        numbers = allNumbers.map(n => String(n).padStart(2, '0'));
        mainNumbers = numbers;
      } else if (lotCode === 'list49m6') {
        // 49樂合彩: 6个号码（1-49），需要补零
        const allNumbers = latestResult.drawNumberSize || latestResult.drawNumberAppear || [];
        numbers = allNumbers.map(n => String(n).padStart(2, '0'));
        mainNumbers = numbers;
      } else if (lotCode === 'lotto3d' || lotCode === 'lotto4d') {
        // 3D/4D: 使用drawNumberAppear字段（数组格式）
        // 3D/4D是0-9的独立数字，不补零（保持单个数字显示）
        const drawNumberArray = latestResult.drawNumberAppear || [];
        numbers = drawNumberArray.map(n => String(n));
        mainNumbers = numbers;
      } else {
        // 其他彩种：直接使用drawNumberSize，补零到两位
        const allNumbers = latestResult.drawNumberSize || latestResult.drawNumberAppear || [];
        numbers = allNumbers.map(n => String(n).padStart(2, '0'));
        mainNumbers = numbers;
      }

      // 格式化日期
      let drawDate = latestResult.lotteryDate || '';
      if (drawDate) {
        drawDate = drawDate.split('T')[0]; // 2026-01-01T00:00:00 -> 2026-01-01
      }

      return {
        lotCode,
        period: String(latestResult.period),
        numbers: numbers,
        mainNumbers: mainNumbers,
        specialNumbers: specialNumbers,
        opencode: numbers.join(','),
        drawDate: drawDate,
        drawTime: `${drawDate} 21:30:00`,
        timestamp: Date.now(),
        source: 'taiwanlottery_api',
        lotteryName: this.lotteryNames[lotCode],
        rawData: latestResult // 保留原始数据供调试
      };

    } catch (error) {
      logger.error(`[TaiwanLottery] API数据解析失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取历史数据（按年月）
   */
  async fetchHistoryData(lotCode, yearMonth = null) {
    const startTime = Date.now();

    try {
      // 转换数字代码到API键（如果需要）
      const apiKey = this.lotCodeMapping[lotCode] || lotCode;
      const endpoint = this.apiEndpoints[apiKey];

      if (!endpoint) {
        throw new Error(`台湾彩票不支持彩种: ${lotCode} (API key: ${apiKey})`);
      }

      // 如果没有指定年月，使用当前月份
      if (!yearMonth) {
        yearMonth = this.getCurrentYearMonth();
      }

      // 构建API URL（获取整月数据）
      const apiUrl = `${this.apiBaseUrl}${endpoint}?month=${yearMonth}&pageSize=31`;

      logger.info(`[TaiwanLottery] 🔍 获取历史数据: ${apiUrl}`);

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

      const responseTime = Date.now() - startTime;

      // 解析历史数据
      const records = this.parseHistoryAPIResponse(response.data, apiKey);

      logger.info(`[TaiwanLottery] ✅ 获取 ${this.lotteryNames[apiKey]} ${yearMonth} 历史数据 ${records.length} 条 (${responseTime}ms)`);
      return records;

    } catch (error) {
      logger.error(`[TaiwanLottery] 获取历史数据失败: ${lotCode} ${yearMonth}`, error.message);
      throw error;
    }
  }

  /**
   * 解析历史数据API响应
   */
  parseHistoryAPIResponse(apiData, lotCode) {
    try {
      if (apiData.rtCode !== 0) {
        return [];
      }

      const content = apiData.content;
      if (!content || content.totalSize === 0) {
        return [];
      }

      const resultField = this.responseFields[lotCode];
      const results = content[resultField] || [];

      return results.map(item => {
        const drawNumbers = item.drawNumberSize || item.drawNumberAppear || [];
        let numbers = [];

        if (lotCode === 'lotto3d' || lotCode === 'lotto4d') {
          // 3D/4D: 0-9的独立数字，不补零
          numbers = Array.isArray(drawNumbers) ? drawNumbers.map(n => String(n)) : [];
        } else {
          // 其他彩种（威力彩、大乐透、今彩539等）：补零到两位
          numbers = Array.isArray(drawNumbers) ? drawNumbers.map(n => String(n).padStart(2, '0')) : [];
        }

        const drawDate = item.lotteryDate ? item.lotteryDate.split('T')[0] : '';

        return {
          issue: String(item.period),
          draw_code: numbers.join(','),
          drawCode: numbers.join(','),
          draw_time: `${drawDate} 21:30:00`,
          drawTime: `${drawDate} 21:30:00`,
          source: 'taiwanlottery_api'
        };
      });

    } catch (error) {
      logger.error('[TaiwanLottery] 解析历史API数据失败:', error.message);
      return [];
    }
  }

  /**
   * 检查服务是否可用
   */
  async checkHealth() {
    try {
      const yearMonth = this.getCurrentYearMonth();
      const testUrl = `${this.apiBaseUrl}/SuperLotto638Result?month=${yearMonth}&pageSize=1`;

      const response = await axios.get(testUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      return response.data && response.data.rtCode === 0;
    } catch (error) {
      logger.error('[TaiwanLottery] API服务不可用:', error.message);
      return false;
    }
  }

  /**
   * 批量获取多个彩种数据
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
export default new TaiwanLotteryScraper();
