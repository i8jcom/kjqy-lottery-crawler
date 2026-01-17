import axios from 'axios';
import logger from '../utils/Logger.js';

/**
 * On.cc 完整历史数据爬虫
 *
 * 🎯 用途：获取香港六合彩 1985-2025 年完整历史开奖数据
 * 📊 数据源：https://win.on.cc/api/marksix/v1/list/result
 * 🏢 提供商：On.cc 东网（香港东方日报集团）
 *
 * 📈 优势对比 cpzhan.com：
 * ✅ 官方数据源（On.cc 是香港东方日报集团）
 * ✅ REST API（JSON格式，无需HTML解析）
 * ✅ 响应速度快（~200-500ms vs cpzhan的~1秒）
 * ✅ 查询灵活（支持按年份、日期、星期、期号等多种方式）
 * ✅ 单一数据源（实时+历史都用 On.cc）
 *
 * 📅 数据覆盖：
 * - 起始年份：1985年
 * - 结束年份：2025年（当前）
 * - 覆盖范围：41年历史数据
 *
 * 🔍 支持的查询方式：
 * 1. 按年份查询：fetchYearData(2025)
 * 2. 按日期范围：fetchDateRange('20250101', '20251231')
 * 3. 按星期查询：fetchByWeekday(2, 50) // 周二，最近50期
 * 4. 指定日期：fetchByDate('20251225')
 * 5. 按期号范围：fetchByDrawIdRange('25001', '25133')
 *
 * 📝 API参数说明：
 * - minDrawId: 最小期号（如 2025000）
 * - maxDrawId: 最大期号（如 2025999）
 * - fromDate: 起始日期（YYYYMMDD格式，如 20250101）
 * - toDate: 结束日期（YYYYMMDD格式，如 20251231）
 * - drawDate: 指定日期（YYYYMMDD格式）
 * - weekDays: 星期几（0-6，0=周日）
 * - limit: 限制返回数量（如 10, 20, 30）
 * - fstPrize: 头奖金额筛选（元）
 * - snowballCode: 金多宝类型（CNY=新春，EAS=復活節等）
 */
class OnccHistoryScraper {
  constructor() {
    // On.cc 历史数据 API
    this.baseUrl = 'https://win.on.cc';
    this.apiUrl = `${this.baseUrl}/api/marksix/v1/list/result`;

    // 数据覆盖范围
    this.minYear = 1985; // 最早年份
    this.maxYear = new Date().getFullYear(); // 当前年份

    // 请求配置
    this.timeout = 15000; // 超时时间
    this.requestDelay = 500; // 请求间隔（毫秒）
  }

  /**
   * 按年份获取历史数据
   * @param {number} year - 年份（1985-2025）
   * @param {number} retryCount - 重试次数
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Array>} 该年份所有开奖记录
   *
   * @example
   * const records = await scraper.fetchYearData(2025);
   * // 返回 2025 年所有开奖记录
   */
  async fetchYearData(year, retryCount = 0, maxRetries = 3) {
    // 参数验证
    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      throw new Error(`无效的年份参数: ${year}`);
    }
    if (yearNum < this.minYear || yearNum > this.maxYear) {
      throw new Error(`年份超出范围: ${yearNum} (有效范围: ${this.minYear}-${this.maxYear})`);
    }

    try {
      logger.info(`[OnccHistory] 📜 获取 ${yearNum} 年历史数据...`);

      // 构建期号范围：完整年份 + 000/999
      // 注意：API要求7位数字格式 (2025000-2025999)，不是5位 (25000-25999)
      const minDrawId = `${yearNum}000`; // 2025000
      const maxDrawId = `${yearNum}999`; // 2025999

      const url = `${this.apiUrl}?minDrawId=${minDrawId}&maxDrawId=${maxDrawId}`;

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, */*',
          'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8',
          'Referer': 'https://win.on.cc/marksix/database.html'
        }
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.data || !response.data.result || !Array.isArray(response.data.result)) {
        throw new Error('API返回数据格式错误');
      }

      // 解析数据
      const records = this.parseApiResponse(response.data.result);

      logger.info(`[OnccHistory] ✅ ${year} 年数据获取成功，共 ${records.length} 期`);

      return records;

    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = 2000 * (retryCount + 1);
        logger.warn(`[OnccHistory] ⏳ ${year} 年数据获取失败，${delay}ms 后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchYearData(year, retryCount + 1, maxRetries);
      }

      logger.error(`[OnccHistory] ❌ ${year} 年数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 按日期范围获取历史数据
   * @param {string} fromDate - 起始日期（YYYYMMDD格式，如 '20250101'）
   * @param {string} toDate - 结束日期（YYYYMMDD格式，如 '20251231'）
   * @returns {Promise<Array>} 开奖记录数组
   *
   * @example
   * const records = await scraper.fetchDateRange('20250101', '20251231');
   * // 返回 2025年1月1日 - 2025年12月31日 的所有开奖记录
   */
  async fetchDateRange(fromDate, toDate, retryCount = 0, maxRetries = 3) {
    try {
      logger.info(`[OnccHistory] 📅 获取 ${fromDate} - ${toDate} 历史数据...`);

      const url = `${this.apiUrl}?fromDate=${fromDate}&toDate=${toDate}`;

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, */*',
          'Referer': 'https://win.on.cc/marksix/database.html'
        }
      });

      if (!response.data || !response.data.result) {
        throw new Error('API返回数据格式错误');
      }

      const records = this.parseApiResponse(response.data.result);
      logger.info(`[OnccHistory] ✅ 日期范围数据获取成功，共 ${records.length} 期`);

      return records;

    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = 2000 * (retryCount + 1);
        logger.warn(`[OnccHistory] ⏳ 日期范围数据获取失败，${delay}ms 后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchDateRange(fromDate, toDate, retryCount + 1, maxRetries);
      }

      logger.error(`[OnccHistory] ❌ 日期范围数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 按指定日期获取开奖数据
   * @param {string} drawDate - 开奖日期（YYYYMMDD格式，如 '20251225'）
   * @returns {Promise<Object|null>} 开奖记录对象，如果当天无开奖则返回 null
   *
   * @example
   * const record = await scraper.fetchByDate('20251225');
   * // 返回 2025年12月25日 的开奖记录
   */
  async fetchByDate(drawDate, retryCount = 0, maxRetries = 3) {
    try {
      logger.info(`[OnccHistory] 📆 获取 ${drawDate} 开奖数据...`);

      const url = `${this.apiUrl}?drawDate=${drawDate}`;

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, */*',
          'Referer': 'https://win.on.cc/marksix/database.html'
        }
      });

      if (!response.data || !response.data.result) {
        throw new Error('API返回数据格式错误');
      }

      const records = this.parseApiResponse(response.data.result);

      if (records.length === 0) {
        logger.info(`[OnccHistory] ℹ️  ${drawDate} 无开奖数据`);
        return null;
      }

      logger.info(`[OnccHistory] ✅ ${drawDate} 数据获取成功`);
      return records[0]; // 返回第一条（通常只有一条）

    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = 2000 * (retryCount + 1);
        logger.warn(`[OnccHistory] ⏳ ${drawDate} 数据获取失败，${delay}ms 后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchByDate(drawDate, retryCount + 1, maxRetries);
      }

      logger.error(`[OnccHistory] ❌ ${drawDate} 数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 按星期查询开奖数据
   * @param {number} weekday - 星期几（0=周日, 1=周一, ..., 6=周六）
   * @param {number} limit - 限制返回数量（默认50）
   * @returns {Promise<Array>} 开奖记录数组
   *
   * @example
   * // 查询最近50期周二开奖的数据
   * const records = await scraper.fetchByWeekday(2, 50);
   */
  async fetchByWeekday(weekday, limit = 50, retryCount = 0, maxRetries = 3) {
    // 参数验证
    if (weekday < 0 || weekday > 6) {
      throw new Error(`无效的星期参数: ${weekday} (有效范围: 0-6)`);
    }

    try {
      logger.info(`[OnccHistory] 📊 获取星期${weekday} 数据（最近${limit}期）...`);

      const url = `${this.apiUrl}?weekDays=${weekday}&limit=${limit}`;

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, */*',
          'Referer': 'https://win.on.cc/marksix/database.html'
        }
      });

      if (!response.data || !response.data.result) {
        throw new Error('API返回数据格式错误');
      }

      const records = this.parseApiResponse(response.data.result);
      logger.info(`[OnccHistory] ✅ 星期${weekday} 数据获取成功，共 ${records.length} 期`);

      return records;

    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = 2000 * (retryCount + 1);
        logger.warn(`[OnccHistory] ⏳ 星期${weekday} 数据获取失败，${delay}ms 后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchByWeekday(weekday, limit, retryCount + 1, maxRetries);
      }

      logger.error(`[OnccHistory] ❌ 星期${weekday} 数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 按期号范围获取历史数据
   * @param {string} minDrawId - 最小期号（如 '25001' 或 '2025001'）
   * @param {string} maxDrawId - 最大期号（如 '25133' 或 '2025133'）
   * @returns {Promise<Array>} 开奖记录数组
   *
   * @example
   * const records = await scraper.fetchByDrawIdRange('25001', '25133');
   * // 返回期号 25001 - 25133 的所有开奖记录
   */
  async fetchByDrawIdRange(minDrawId, maxDrawId, retryCount = 0, maxRetries = 3) {
    try {
      logger.info(`[OnccHistory] 🔢 获取期号 ${minDrawId} - ${maxDrawId} 数据...`);

      // 转换期号格式：如果是5位（25133），转为7位（2025133）
      const convertToFullId = (id) => {
        const idStr = id.toString();
        if (idStr.length === 5) {
          // 5位格式：25133 -> 2025133
          return `20${idStr}`;
        }
        // 已经是7位，直接返回
        return idStr;
      };

      const fullMinId = convertToFullId(minDrawId);
      const fullMaxId = convertToFullId(maxDrawId);

      const url = `${this.apiUrl}?minDrawId=${fullMinId}&maxDrawId=${fullMaxId}`;

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, */*',
          'Referer': 'https://win.on.cc/marksix/database.html'
        }
      });

      if (!response.data || !response.data.result) {
        throw new Error('API返回数据格式错误');
      }

      const records = this.parseApiResponse(response.data.result);
      logger.info(`[OnccHistory] ✅ 期号范围数据获取成功，共 ${records.length} 期`);

      return records;

    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = 2000 * (retryCount + 1);
        logger.warn(`[OnccHistory] ⏳ 期号范围数据获取失败，${delay}ms 后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchByDrawIdRange(minDrawId, maxDrawId, retryCount + 1, maxRetries);
      }

      logger.error(`[OnccHistory] ❌ 期号范围数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量获取多个年份的历史数据
   * @param {number} startYear - 起始年份
   * @param {number} endYear - 结束年份
   * @param {Function} progressCallback - 进度回调函数 (year, total, current, count)
   * @returns {Promise<Object>} { totalRecords, yearlyData, startYear, endYear }
   *
   * @example
   * const result = await scraper.fetchMultipleYears(2020, 2025, (year, total, current, count) => {
   *   console.log(`正在获取 ${year} 年数据 (${current}/${total})，已获取 ${count} 期`);
   * });
   * console.log(`共获取 ${result.totalRecords} 期数据`);
   */
  async fetchMultipleYears(startYear, endYear, progressCallback = null) {
    logger.info(`[OnccHistory] 🚀 开始批量获取 ${startYear}-${endYear} 年历史数据...`);

    const yearlyData = {};
    let totalRecords = 0;
    const totalYears = endYear - startYear + 1;
    let currentYear = 0;

    for (let year = startYear; year <= endYear; year++) {
      currentYear++;

      try {
        // 获取该年数据
        const records = await this.fetchYearData(year);

        yearlyData[year] = records;
        totalRecords += records.length;

        // 调用进度回调
        if (progressCallback) {
          progressCallback(year, totalYears, currentYear, records.length);
        }

        // 请求间隔（避免过快）
        if (year < endYear) {
          await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }

      } catch (error) {
        logger.error(`[OnccHistory] ❌ ${year} 年数据获取失败，跳过`);
        yearlyData[year] = [];
      }
    }

    logger.info(`[OnccHistory] 🎉 批量获取完成！共 ${totalRecords} 期数据`);

    return {
      totalRecords,
      yearlyData,
      startYear,
      endYear
    };
  }

  /**
   * 解析 On.cc API 响应数据
   * @param {Array} resultArray - API 返回的 result 数组
   * @returns {Array} 解析后的开奖记录数组
   *
   * API 数据格式示例（实际格式）：
   * {
   *   "drawId": 2025133,                          // 期号（整数）
   *   "drawDate": 20251225,                       // 日期（整数 YYYYMMDD）
   *   "weekDay": 4,                               // 星期几（0=周日）
   *   "snowballName": "",                         // 金多宝名称
   *   "firstPrize": 0,                            // 头奖金额
   *   "numbers": "1,2,4,30,41,43,13",            // 全部号码（字符串）
   *   "winUnit": "0"                              // 中奖注数
   * }
   */
  parseApiResponse(resultArray) {
    if (!Array.isArray(resultArray)) {
      return [];
    }

    return resultArray
      .map(item => {
        try {
          if (!item || !item.drawId || !item.numbers) {
            return null;
          }

          // 解析号码字符串：'1,2,4,30,41,43,13' -> ['1', '2', '4', '30', '41', '43', '13']
          const numbersArray = item.numbers.split(',');
          if (numbersArray.length < 7) {
            logger.debug(`[OnccHistory] ⚠️ 期号 ${item.drawId} 号码数据不完整`);
            return null;
          }

          // 前6个是正码，第7个是特别号
          const regularNumbers = numbersArray.slice(0, 6);
          const specialNumber = numbersArray[6];

          // 转换日期格式：20251225 -> '2025-12-25'
          const dateStr = item.drawDate.toString();
          const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;

          // 构建开奖时间
          const opentime = `${formattedDate} 21:30:00`;

          // 星期几映射
          const weekDayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
          const weekDayName = weekDayNames[item.weekDay] || `星期${item.weekDay}`;

          // 转换期号格式：2025133 -> 25133（保持与现有数据格式一致）
          const drawIdStr = item.drawId.toString();
          const period = drawIdStr.substring(2); // 去掉前2位年份：2025133 -> 25133

          return {
            period: period,                         // 期号：'25133'
            opencode: regularNumbers.join(','),     // 正码：'1,2,4,30,41,43'
            extra: specialNumber,                   // 特别号：'13'
            opentime: opentime,                     // 开奖时间：'2025-12-25 21:30:00'

            // 额外信息
            _metadata: {
              drawDate: formattedDate,              // 格式化日期：'2025-12-25'
              drawDay: weekDayName,                 // 星期几：'星期四'
              weekDay: item.weekDay,                // 星期几数字：4
              snowballName: item.snowballName,      // 金多宝名称
              firstPrize: item.firstPrize,          // 头奖金额
              winUnit: item.winUnit,                // 中奖注数
              source: 'oncc-history'
            }
          };

        } catch (error) {
          logger.debug(`[OnccHistory] ⚠️ 解析数据失败: ${error.message}`);
          return null;
        }
      })
      .filter(item => item !== null); // 过滤掉解析失败的数据
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      // 测试 API：获取最近10期数据
      const response = await axios.get(`${this.apiUrl}?limit=10`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });

      const isHealthy = response.status === 200 &&
                       response.data &&
                       response.data.result &&
                       Array.isArray(response.data.result) &&
                       response.data.result.length > 0;

      return {
        healthy: isHealthy,
        statusCode: response.status,
        dataSource: 'On.cc 东网历史API',
        apiUrl: this.apiUrl,
        dataCount: response.data.result ? response.data.result.length : 0,
        latestPeriod: response.data.result[0]?.drawId || 'N/A',
        availableYears: `${this.minYear}-${this.maxYear}`
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        dataSource: 'On.cc 东网历史API',
        apiUrl: this.apiUrl
      };
    }
  }

  /**
   * 验证数据准确性（与其他数据源对比）
   * @param {Object} sourceData - 源数据（如 cpzhan 或 On.cc实时）
   * @param {Object} onccHistoryData - On.cc历史API数据
   * @returns {Object} 验证结果
   */
  validateData(sourceData, onccHistoryData) {
    // 对比期号
    const sourceIssue = sourceData.period;
    const onccIssue = onccHistoryData.period;
    const issueMatch = sourceIssue === onccIssue;

    // 对比号码（排序后）
    const sourceNumbers = `${sourceData.opencode},${sourceData.extra}`;
    const onccNumbers = `${onccHistoryData.opencode},${onccHistoryData.extra}`;

    const sourceSorted = sourceNumbers.split(',').sort((a, b) => a - b).join(',');
    const onccSorted = onccNumbers.split(',').sort((a, b) => a - b).join(',');
    const numbersMatch = sourceSorted === onccSorted;

    return {
      valid: issueMatch && numbersMatch,
      issueMatch,
      numbersMatch,
      sourceData: {
        period: sourceIssue,
        numbers: sourceNumbers
      },
      onccHistoryData: {
        period: onccIssue,
        numbers: onccNumbers
      }
    };
  }
}

export default OnccHistoryScraper;
