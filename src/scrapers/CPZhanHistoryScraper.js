import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/Logger.js';

/**
 * cpzhan.com 历史数据爬虫
 *
 * 用途：获取香港六合彩 1976-2025 年完整历史开奖数据
 * 数据源：https://www.cpzhan.com/liu-he-cai/all-results
 *
 * 特点：
 * - 数据准确：与 On.cc 官方数据验证一致
 * - 范围完整：1976年至今近50年数据
 * - 稳定可靠：16年运营历史
 *
 * 限制：
 * - 响应较慢：~1秒/请求
 * - 仅用于历史数据补充，不用于实时数据
 */
class CPZhanHistoryScraper {
  constructor() {
    this.baseUrl = 'https://www.cpzhan.com';
    this.historyUrl = `${this.baseUrl}/liu-he-cai/all-results`;

    // 请求配置
    this.requestDelay = 1500; // 请求间隔（毫秒）
    this.timeout = 15000; // 超时时间
  }

  /**
   * 获取指定年份的历史数据
   * @param {number} year - 年份（1976-2025）
   * @returns {Promise<Array>} 该年份所有开奖记录
   */
  async fetchYearData(year, retryCount = 0, maxRetries = 3) {
    // 参数验证
    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      throw new Error(`无效的年份参数: ${year}`);
    }
    if (yearNum < 1976 || yearNum > new Date().getFullYear()) {
      throw new Error(`年份超出范围: ${yearNum} (有效范围: 1976-${new Date().getFullYear()})`);
    }

    try {
      logger.info(`[CPZhan] 📜 获取 ${yearNum} 年历史数据...`);

      const url = `${this.historyUrl}?year=${year}`;

      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }

      // 解析 HTML
      const records = this.parseHTML(response.data, year);

      logger.info(`[CPZhan] ✅ ${year} 年数据获取成功，共 ${records.length} 期`);

      return records;

    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = 2000 * (retryCount + 1);
        logger.warn(`[CPZhan] ⏳ ${year} 年数据获取失败，${delay}ms 后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchYearData(year, retryCount + 1, maxRetries);
      }

      logger.error(`[CPZhan] ❌ ${year} 年数据获取失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 解析 HTML 获取开奖数据
   */
  parseHTML(html, year) {
    const $ = cheerio.load(html);
    const records = [];

    // 查找表格
    const table = $('table').first();
    if (!table.length) {
      throw new Error('未找到数据表格');
    }

    // 遍历数据行
    const rows = table.find('tbody tr, tr').filter((i, row) => {
      return $(row).find('td').length > 0;
    });

    rows.each((index, row) => {
      try {
        const cells = $(row).find('td');

        if (cells.length < 10) {
          return; // 跳过不完整的行
        }

        const yearCell = $(cells[0]).text().trim();
        const issueCell = $(cells[1]).text().trim();
        const dateCell = $(cells[2]).text().trim();

        // 提取6个正码
        const numbers = [];
        for (let i = 3; i <= 8; i++) {
          const num = $(cells[i]).text().trim();
          if (/^\d+$/.test(num)) {
            numbers.push(num);
          }
        }

        // 提取特别号
        const special = $(cells[9]).text().trim();

        // 验证数据完整性
        if (numbers.length !== 6 || !special) {
          logger.debug(`[CPZhan] ⚠️ ${year}/${issueCell} 数据不完整，跳过`);
          return;
        }

        // 构建期号（统一格式：年份后2位 + 期数补零3位，如 25001, 25133）
        const shortYear = yearCell.substring(2); // "2025" -> "25"
        const period = `${shortYear}${issueCell.padStart(3, '0')}`; // "1" -> "001" -> "25001"

        // 构建开奖时间
        const opentime = dateCell ? `${dateCell} 21:30:00` : null;

        records.push({
          period,              // 25133
          opencode: numbers.join(','),  // 1,2,4,30,41,43
          extra: special,      // 13
          opentime,            // 2025-12-25 21:30:00

          // 原始数据（用于验证）
          _source: {
            year: yearCell,
            issue: issueCell,
            date: dateCell,
            numbers,
            special
          }
        });

      } catch (error) {
        logger.debug(`[CPZhan] ⚠️ 解析第 ${index + 1} 行数据失败: ${error.message}`);
      }
    });

    return records;
  }

  /**
   * 批量获取多个年份的历史数据
   * @param {number} startYear - 起始年份
   * @param {number} endYear - 结束年份
   * @param {Function} progressCallback - 进度回调函数 (year, total, current)
   * @returns {Promise<Object>} { totalRecords, yearlyData }
   */
  async fetchMultipleYears(startYear, endYear, progressCallback = null) {
    logger.info(`[CPZhan] 🚀 开始批量获取 ${startYear}-${endYear} 年历史数据...`);

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
        logger.error(`[CPZhan] ❌ ${year} 年数据获取失败，跳过`);
        yearlyData[year] = [];
      }
    }

    logger.info(`[CPZhan] 🎉 批量获取完成！共 ${totalRecords} 期数据`);

    return {
      totalRecords,
      yearlyData,
      startYear,
      endYear
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const response = await axios.get(this.historyUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const isHealthy = response.status === 200;

      return {
        healthy: isHealthy,
        statusCode: response.status,
        dataSource: 'cpzhan.com',
        purpose: '历史数据补充',
        availableYears: '1976-2025'
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        dataSource: 'cpzhan.com'
      };
    }
  }

  /**
   * 验证数据准确性（与 On.cc 对比）
   * @param {Object} onccData - On.cc 数据
   * @param {Object} cpzhanData - cpzhan 数据
   * @returns {Object} 验证结果
   */
  validateData(onccData, cpzhanData) {
    // 对比期号
    const onccIssue = onccData.period;
    const cpzhanIssue = cpzhanData.period;
    const issueMatch = onccIssue === cpzhanIssue;

    // 对比号码（排序后）
    const onccNumbers = `${onccData.opencode},${onccData.extra}`;
    const cpzhanNumbers = `${cpzhanData.opencode},${cpzhanData.extra}`;

    const onccSorted = onccNumbers.split(',').sort((a, b) => a - b).join(',');
    const cpzhanSorted = cpzhanNumbers.split(',').sort((a, b) => a - b).join(',');
    const numbersMatch = onccSorted === cpzhanSorted;

    return {
      valid: issueMatch && numbersMatch,
      issueMatch,
      numbersMatch,
      onccData: {
        period: onccIssue,
        numbers: onccNumbers
      },
      cpzhanData: {
        period: cpzhanIssue,
        numbers: cpzhanNumbers
      }
    };
  }
}

export default CPZhanHistoryScraper;
