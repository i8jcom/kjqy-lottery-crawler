import axios from 'axios';
import https from 'https';
import http from 'http';
import * as cheerio from 'cheerio';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';

/**
 * SpeedyLot88网站爬虫 - 企业级域名管理版本
 * 用于极速彩种（jspk10、jssc、jslhc等）的实时数据获取
 * 🛡️ 支持多域名自动切换，零停机保障
 */
class SpeedyLot88Scraper {
  constructor() {
    // ⚠️ 不再硬编码baseUrl，改为动态获取
    // this.baseUrl = 'https://speedylot88.com';
    this.domainManager = universalDomainManager;
    this.sourceType = 'speedylot88'; // 数据源类型

    // 🔧 强制使用HTTP/1.1：官网的HTTP/2协议极度不稳定（ERR_HTTP2_PROTOCOL_ERROR）
    //根据实际测试：需要点击70+次才能成功加载数据
    // 解决方案：禁用HTTP/2，强制使用HTTP/1.1
    this.httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 10
    });
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 10,
      // 🔑 关键配置：禁用ALPN协议协商，强制HTTP/1.1
      ALPNProtocols: ['http/1.1']
    });

    // 彩种URL映射 - 对接SpeedyLot88官网
    this.lotteryUrls = {
      // 极速赛车 (SPEED10) - 10个号码
      'jspk10': '/speedy10-result.php',

      // 极速飞艇 (SB SPEED10) - 10个号码
      'jsft': '/sbspeedy10-result.php',

      // 极速时时彩 (SPEED5) - 5个号码
      'jssc': '/speedy5-result.php',

      // 极速快3 (SPEED3) - 3个号码
      'jsk3': '/speedy3-result.php',

      // 极速快乐十分 (SPEED8) - 8个号码
      'jskl10': '/speedy8-result.php',

      // 极速快乐8 (SPEED20) - 20个号码
      'jskl8': '/speedy20-result.php',

      // 极速11选5 (SPEED11) - 5个号码
      'js11x5': '/speedy11-result.php',

      // 极速六合彩 (MARK6) - 7个号码 (6+1特码)
      'jslhc': '/mark6-result.php'
    };
  }

  /**
   * 获取彩票最新数据（企业级域名管理版本）
   */
  async fetchLatestData(lotCode, retryCount = 0, maxRetries = 2) {
    let currentDomain = null;
    const startTime = Date.now();

    try {
      const endpoint = this.lotteryUrls[lotCode];

      if (!endpoint) {
        throw new Error(`SpeedyLot88不支持彩种: ${lotCode}`);
      }

      // 🔥 从域名管理器获取当前最优域名
      currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      const targetUrl = `${baseUrl}${endpoint}`;

      logger.info(`[SpeedyLot88] 🚀 直接请求: ${targetUrl}${retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : ''} [域名: ${baseUrl}]`);

      const response = await axios.get(targetUrl, {
        timeout: 4000,  // 🚀 降低到4秒，加快响应速度
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',  // 🚀 禁用缓存，确保获取最新数据
          'Pragma': 'no-cache'
        }
      });

      const responseTime = Date.now() - startTime;

      // 解析HTML
      const result = this.parseHTML(response.data, lotCode);

      if (!result) {
        throw new Error('无法从HTML中解析出有效数据');
      }

      // ✅ 记录成功（域名管理器统计）
      await this.domainManager.recordSuccess(currentDomain.id, responseTime);

      logger.info(`[SpeedyLot88] ✅ 成功获取 ${lotCode} 第${result.period}期数据 (${responseTime}ms)`);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // ❌ 记录失败（域名管理器统计，可能触发自动切换）
      if (currentDomain) {
        await this.domainManager.recordFailure(currentDomain.id, error, true);
      }

      // 🔄 重试机制：网络波动或临时故障
      if (retryCount < maxRetries &&
          (error.message.includes('timeout') || error.message.includes('ECONNRESET'))) {
        logger.warn(`[SpeedyLot88] ⚠️ ${lotCode} 获取失败 (${error.message})，1秒后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      logger.error(`[SpeedyLot88] ❌ ${lotCode} 获取失败 (已重试${retryCount}次):`, error.message);
      throw error;
    }
  }

  /**
   * 解析HTML获取开奖数据
   */
  parseHTML(html, lotCode) {
    try {
      const $ = cheerio.load(html);

      let period = null;
      let numbers = [];
      let drawTime = null;

      // 🎯 SpeedyLot88特定结构解析

      // 1. 从header提取期号和时间
      // 格式: "WINNING NUMBERS, 33849013, Tuesday, Dec 23,2025 06:05:30 pm"
      const headerText = $('.resultheader .txtbold').first().text().trim();
      if (headerText) {
        const parts = headerText.split(',').map(s => s.trim());
        if (parts.length >= 2) {
          period = parts[0]; // 期号是第一个逗号前的数字

          // 尝试提取时间
          if (parts.length >= 3) {
            drawTime = parts.slice(1).join(',').trim();
          }
        }
      }

      // 如果上面没找到期号，尝试其他位置
      if (!period) {
        period = $('.txtbold').first().text().replace(/[^0-9]/g, '');
      }

      // 2. 提取官网实时倒计时并校正
      // 从 JavaScript 变量提取：var timeLeft = XX
      // ⚠️ SpeedyLot88官网倒计时提前13秒（最大约62秒，实际间隔75秒）
      let officialCountdown = null;
      const scriptMatch = html.match(/var\s+timeLeft\s*=\s*(\d+)/);
      const rawCountdown = scriptMatch ? parseInt(scriptMatch[1]) : null;

      if (rawCountdown !== null) {
        // 🔧 智能校正：官网倒计时不稳定（62-66秒波动），需智能处理
        // ⚠️ 极速六合彩特殊处理：开奖间隔300秒（5分钟），其他极速彩75秒

        if (lotCode === 'jslhc') {
          // 极速六合彩：间隔300秒（5分钟）
          // 🔧 修复：始终使用官网实时倒计时+13秒校正，避免跳变
          // 原因：官网倒计时提前约13秒，需要补偿
          // 确保结果在0-300秒范围内
          officialCountdown = Math.min(Math.max(rawCountdown + 13, 0), 300);
          logger.debug(
            `[SpeedyLot88] 🎯 倒计时: ${officialCountdown}秒 (极速六合彩实时同步，官网${rawCountdown}秒 + 13秒校正)`
          );
        } else {
          // 其他极速彩：间隔75秒
          // 🔧 修复：始终使用官网实时倒计时+13秒校正，避免跳变
          // 原因：官网倒计时提前约13秒，需要补偿
          // 确保结果在0-75秒范围内
          officialCountdown = Math.min(Math.max(rawCountdown + 13, 0), 75);
          logger.debug(
            `[SpeedyLot88] 🎯 倒计时: ${officialCountdown}秒 (实时同步，官网${rawCountdown}秒 + 13秒校正)`
          );
        }
      } else {
        logger.debug(`[SpeedyLot88] ⚠️ 未找到官网倒计时变量`);
      }

      // 3. 提取开奖号码
      // 方法1: 从 resultnum2 class (当前期)
      $('.resultnum2').each((i, el) => {
        const num = $(el).text().trim();
        // 极速快乐8有"+"符号，需要特殊处理
        if (num === '+') {
          // 跳过"+"符号，它不是号码
          return;
        }
        if (num && !isNaN(num)) {
          numbers.push(num.padStart(2, '0'));
        }
      });

      // 方法2: 如果没找到，尝试 resultnum3 (历史记录第一行)
      if (numbers.length === 0) {
        $('.resultnum3').slice(0, 10).each((i, el) => {
          const num = $(el).text().trim();
          if (num && !isNaN(num)) {
            numbers.push(num.padStart(2, '0'));
          }
        });
      }

      // 验证数据完整性
      const expectedNumberCount = this.getExpectedNumberCount(lotCode);

      if (!period) {
        throw new Error('无法解析期号');
      }

      if (numbers.length !== expectedNumberCount) {
        // 如果数量不对，尝试截取或填充
        if (numbers.length > expectedNumberCount) {
          numbers = numbers.slice(0, expectedNumberCount);
        } else {
          throw new Error(`号码数量不正确: 期望${expectedNumberCount}个，实际${numbers.length}个`);
        }
      }

      return {
        lotCode,
        period: period,
        numbers: numbers,
        opencode: numbers.join(','),
        drawTime: drawTime,
        officialCountdown: officialCountdown, // 🚀 官网实时倒计时（秒）
        timestamp: Date.now(),
        source: 'speedylot88_html'
      };

    } catch (error) {
      logger.error(`[SpeedyLot88] HTML解析失败:`, error.message);
      return null;
    }
  }

  /**
   * 获取彩种期望的号码数量
   */
  getExpectedNumberCount(lotCode) {
    const countMap = {
      'jspk10': 10,  // 极速赛车: 10个号码
      'jsft': 10,    // 极速飞艇: 10个号码
      'jssc': 5,     // 极速时时彩: 5个号码
      'jsk3': 3,     // 极速快3: 3个号码
      'jskl10': 8,   // 极速快乐十分: 8个号码
      'jskl8': 20,   // 极速快乐8: 20个号码（不包括"+"符号）
      'js11x5': 5,   // 极速11选5: 5个号码
      'jslhc': 7     // 极速六合彩: 7个号码 (6个正码 + 1个特码)
    };
    return countMap[lotCode] || 10;
  }

  /**
   * 获取历史数据（按日期）- 支持分页加载完整数据
   */
  async fetchHistoryData(lotCode, date) {
    let currentDomain = null;
    try {
      const endpoint = this.lotteryUrls[lotCode];

      if (!endpoint) {
        throw new Error(`SpeedyLot88不支持彩种: ${lotCode}`);
      }

      // 🔥 从域名管理器获取当前最优域名
      currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      // 构建历史查询URL，格式: /speedy10-result.php?date=2025-12-23
      const targetUrl = `${baseUrl}${endpoint}?date=${date}`;

      logger.info(`[SpeedyLot88] 🔍 获取历史数据（分页加载）: ${targetUrl} [域名: ${baseUrl}]`);

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };

      // 第一步：获取首页数据（最新20条）
      const firstResponse = await axios.get(targetUrl, {
        timeout: 8000,
        headers,
        httpAgent: this.httpAgent,
        httpsAgent: this.httpsAgent  // 🔑 强制使用HTTP/1.1
      });
      let allRecords = this.parseHistoryHTML(firstResponse.data, lotCode);

      if (!allRecords || allRecords.length === 0) {
        logger.warn(`[SpeedyLot88] ${date} 无历史数据`);
        return [];
      }

      logger.info(`[SpeedyLot88] 📄 首页获取 ${allRecords.length} 条`);

      // 第二步：加载更多数据（Load More Results - 只需点击一次）
      // 🔧 官网特性：Load More按钮一次点击就返回所有历史数据，不需要循环翻页
      // 🔧 但是这一次点击可能需要重试多次才能成功（官网不稳定）

      const lastRecord = allRecords[allRecords.length - 1];
      const lastTime = lastRecord.draw_time || lastRecord.drawTime;

      if (lastTime) {
        const timestamp = Math.floor(new Date(lastTime).getTime() / 1000);
        const moreResultUrl = `${baseUrl}${endpoint.replace('-result.php', '-moreresult.php')}?time=${timestamp}`;

        logger.info(`[SpeedyLot88] 🔄 点击Load More加载所有历史数据...`);

        // 🔥 疯狂重试策略：模拟用户点击70-80次Load More按钮
        // 根据实际测试：官网需要点击70+次才能成功（ERR_HTTP2_PROTOCOL_ERROR）
        let retryCount = 0;
        const maxRetries = 80; // 增加到80次
        let loadSuccess = false;

        while (retryCount <= maxRetries && !loadSuccess) {
          try {
            const moreResponse = await axios.get(moreResultUrl, {
              timeout: 8000,
              headers,
              httpAgent: this.httpAgent,
              httpsAgent: this.httpsAgent  // 🔑 强制使用HTTP/1.1
            });

            // 🔧 验证响应有效性：即使200 OK也可能是HTTP/2协议错误
            const moreRecords = this.parseHistoryHTML(moreResponse.data, lotCode);

            if (moreRecords && moreRecords.length > 0) {
              allRecords = allRecords.concat(moreRecords);
              logger.info(`[SpeedyLot88] ✅ Load More成功（第${retryCount + 1}次尝试）！获取${moreRecords.length}条，累计${allRecords.length}条`);
              loadSuccess = true;
            } else if (moreResponse.data && moreResponse.data.length < 100) {
              // 响应数据太短，可能是错误（HTTP/2协议错误返回的HTML很短）
              retryCount++;
              if (retryCount % 10 === 0) {
                logger.warn(`[SpeedyLot88] ⚠️ 响应无效（疑似HTTP/2错误），已重试${retryCount}/${maxRetries}次...`);
              }
              await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
            } else {
              logger.info(`[SpeedyLot88] 📄 Load More返回空数据`);
              loadSuccess = true;
            }
          } catch (error) {
            retryCount++;
            if (retryCount % 10 === 0) {
              logger.warn(`[SpeedyLot88] ⚠️ Load More失败(${error.message})，已重试${retryCount}/${maxRetries}次...`);
            }
            // 极短间隔：100-200ms（模拟疯狂点击）
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
          }
        }

        if (!loadSuccess) {
          logger.error(`[SpeedyLot88] ❌ Load More重试${maxRetries}次后仍失败，官网今天可能极度不稳定`);
        }
      }

      // 第三步：过滤掉非当天的数据（只保留指定日期的记录）
      logger.info(`[SpeedyLot88] 📊 过滤前共${allRecords.length}条记录，查询日期: ${date}`);
      const filteredRecords = allRecords.filter(record => {
        const recordTime = record.draw_time || record.drawTime;
        if (!recordTime) return false;
        // 提取日期部分（YYYY-MM-DD）
        const recordDate = recordTime.split(' ')[0]; // "2025-12-24 23:59:15" -> "2025-12-24"
        return recordDate === date;
      });

      logger.info(`[SpeedyLot88] ✅ 获取 ${lotCode} ${date} 历史数据 ${filteredRecords.length} 条（过滤前${allRecords.length}条）`);
      return filteredRecords;

    } catch (error) {
      // ❌ 记录失败（域名管理器统计）
      if (currentDomain) {
        await this.domainManager.recordFailure(currentDomain.id, error, true);
      }

      logger.error(`[SpeedyLot88] 获取历史数据失败: ${lotCode} ${date}`);
      logger.error(`[SpeedyLot88] 错误类型: ${error.constructor.name}`);
      logger.error(`[SpeedyLot88] 错误信息: ${error.message || String(error)}`);
      logger.error(`[SpeedyLot88] 错误堆栈:`, error.stack || 'No stack trace available');
      logger.error(`[SpeedyLot88] 完整错误对象:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      throw error;
    }
  }

  /**
   * 解析历史数据HTML
   */
  parseHistoryHTML(html, lotCode) {
    try {
      const $ = cheerio.load(html);
      const records = [];
      const expectedNumberCount = this.getExpectedNumberCount(lotCode);

      // 遍历所有历史记录行
      $('.row.bordergray2').each((index, row) => {
        try {
          const $row = $(row);

          // 提取期号（第1列）
          const issue = $row.find('.col-xs-5.col-md-3.mt5').first().text().trim();
          if (!issue || isNaN(issue)) return;

          // 提取时间（第2列，hidden-xs）
          const drawTime = $row.find('.hidden-xs.col-md-3.mt5.pr0').first().text().trim();

          // 提取号码（resultnum3）
          const numbers = [];
          $row.find('.resultnum3').each((i, el) => {
            const num = $(el).text().trim();
            // 跳过"+"符号（极速快乐8）
            if (num === '+') return;
            if (num && !isNaN(num)) {
              numbers.push(num.padStart(2, '0'));
            }
          });

          // 验证号码数量
          if (numbers.length !== expectedNumberCount) {
            if (numbers.length > expectedNumberCount) {
              numbers.length = expectedNumberCount; // 截取
            } else {
              logger.warn(`[SpeedyLot88] 期号${issue}号码数量不正确: ${numbers.length}/${expectedNumberCount}`);
              return;
            }
          }

          // 🕐 转换时间格式为MySQL DATETIME格式（使用本地时区）
          let mysqlTime = drawTime;
          try {
            // SpeedyLot88格式: "Mon, Dec 22, 2025 11:59:15 pm" 或 "Tuesday,Dec 24,2025 01:24:00 am"
            const parsedDate = new Date(drawTime);
            if (!isNaN(parsedDate.getTime())) {
              // ✅ 使用本地时区方法格式化为MySQL格式，不使用toISOString()
              const year = parsedDate.getFullYear();
              const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
              const day = String(parsedDate.getDate()).padStart(2, '0');
              const hours = String(parsedDate.getHours()).padStart(2, '0');
              const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
              const seconds = String(parsedDate.getSeconds()).padStart(2, '0');
              mysqlTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            }
          } catch (e) {
            // 如果解析失败，保持原格式
          }

          records.push({
            issue,
            draw_code: numbers.join(','),  // 使用下划线格式，与数据库字段一致
            drawCode: numbers.join(','),    // 保留驼峰格式用于兼容性
            draw_time: mysqlTime,           // 使用MySQL DATETIME格式
            drawTime: mysqlTime,            // 使用MySQL DATETIME格式
            source: 'speedylot88_history'
          });

        } catch (err) {
          logger.debug(`解析历史记录失败: ${err.message}`);
        }
      });

      return records;

    } catch (error) {
      logger.error('[SpeedyLot88] 解析历史HTML失败:', error.message);
      return [];
    }
  }

  /**
   * 检查服务是否可用
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/speedy10-result.php`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      return response.status === 200;
    } catch (error) {
      logger.error('[SpeedyLot88] 服务不可用:', error.message);
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
export default new SpeedyLot88Scraper();
