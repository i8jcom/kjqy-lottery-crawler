import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';

/**
 * AU Lucky Lotteries网站爬虫 - 企业级域名管理版本
 * 数据源：动态域名（多域名自动切换）
 * 用于Lucky Ball彩种（5, 8, 10, 20）的实时数据获取
 * 🛡️ 支持多域名自动切换，零停机保障
 *
 * 倒计时算法：使用固定间隔300秒，基于drawTime实时计算
 * 算法：倒计时 = 300秒 - (当前时间 - 开奖时间)
 */
class AULuckyLotteriesScraper {
  constructor() {
    // ⚠️ 不再硬编码baseUrl，改为动态获取
    // this.baseUrl = 'http://auluckylotteries.com';
    this.domainManager = universalDomainManager;
    this.sourceType = 'auluckylotteries'; // 数据源类型
  }

  /**
   * 获取彩票最新数据（企业级域名管理版本）
   * @param {string} lotCode - Scraper Key (如 lucky5, lucky8)
   * @param {string} apiEndpoint - API端点路径 (如 /results/lucky-ball-5/)
   */
  async fetchLatestData(lotCode, apiEndpoint, retryCount = 0, maxRetries = 2) {
    let currentDomain = null;
    const startTime = Date.now();

    try {
      if (!apiEndpoint) {
        throw new Error(`AU Lucky Lotteries彩种 ${lotCode} 缺少 apiEndpoint 配置`);
      }

      // 🔥 从域名管理器获取当前最优域名
      currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      const targetUrl = `${baseUrl}${apiEndpoint}`;

      logger.info(`[AULuckyLotteries] 🚀 请求: ${targetUrl}${retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : ''} [域名: ${baseUrl}]`);

      const response = await axios.get(targetUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Cache-Control': 'no-cache',
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

      logger.info(`[AULuckyLotteries] ✅ 成功获取 ${lotCode} 第${result.period}期数据 (${responseTime}ms)`);
      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // ❌ 记录失败（域名管理器统计，可能触发自动切换）
      if (currentDomain) {
        await this.domainManager.recordFailure(currentDomain.id, error, true);
      }

      // 🔄 重试机制：网络波动或临时故障
      if (retryCount < maxRetries &&
          (error.message.includes('timeout') || error.message.includes('ECONNRESET') || error.message.includes('无法解析'))) {
        logger.warn(`[AULuckyLotteries] ⚠️ ${lotCode} 获取失败 (${error.message})，1秒后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchLatestData(lotCode, apiEndpoint, retryCount + 1, maxRetries);
      }

      logger.error(`[AULuckyLotteries] ❌ ${lotCode} 获取失败 (已重试${retryCount}次):`, error.message);
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
      let officialCountdown = null;

      // 1. 提取期号
      // 在页面中查找 "Draw: XXXXXXXX" 格式的期号
      const drawText = $('body').text();
      const drawMatch = drawText.match(/Draw:\s*(\d{8})/);
      if (drawMatch) {
        period = drawMatch[1];
      }

      // 如果上面没找到，尝试从脚本变量中提取
      if (!period) {
        const scriptMatch = html.match(/drawNumber\s*=\s*['"](\d{8})['"]/);
        if (scriptMatch) {
          period = scriptMatch[1];
        }
      }

      // 2. 提取倒计时（优先使用HTML的timeLeft，因为它是官网的准确倒计时）
      // 官网的timeLeft是基于实际开奖时刻，比显示的drawTime更准确（drawTime可能四舍五入）
      let htmlCountdown = null;
      const countdownMatch = html.match(/var\s+timeLeft\s*=\s*(\d+);?/);
      if (countdownMatch) {
        htmlCountdown = parseInt(countdownMatch[1]);
        logger.debug(`[AULuckyLotteries] ${lotCode} 提取到HTML倒计时: ${htmlCountdown}秒`);
      } else {
        logger.warn(`[AULuckyLotteries] ${lotCode} 未能提取到HTML倒计时！`);
      }

      // 3. 提取开奖时间
      // 格式: "Wednesday, Dec 24,2025 10:49 pm (ACDT)"
      const timeMatch = html.match(/([A-Za-z]+,\s*[A-Za-z]+\s+\d{1,2},\s*\d{4}\s+\d{1,2}:\d{2}\s*[ap]m\s*\([A-Z]+\))/);
      if (timeMatch) {
        // 将英文时间格式转换为标准格式 YYYY-MM-DD HH:MM:SS
        drawTime = this.formatDrawTime(timeMatch[1]);
      }

      // 4. 提取开奖号码
      // 方法1: 从页面中查找号码容器
      // Lucky Ball的号码通常在特定的div或span中
      $('span[class*="ball"], div[class*="ball"], span[class*="number"], div[class*="number"]').each((i, el) => {
        const num = $(el).text().trim();
        if (num && /^\d+$/.test(num)) {
          numbers.push(num);
        }
      });

      // 方法2: 如果上面没找到，从文本中提取最新一期的号码
      // 在 HTML 中查找号码序列
      if (numbers.length === 0) {
        // 尝试从页面顶部提取号码
        const topResultDiv = $('.result-top, .latest-result, .current-draw').first();
        if (topResultDiv.length > 0) {
          const numberElements = topResultDiv.find('span, div').filter((i, el) => {
            const text = $(el).text().trim();
            return /^\d+$/.test(text) && text.length <= 2;
          });
          numberElements.each((i, el) => {
            numbers.push($(el).text().trim());
          });
        }
      }

      // 方法3: 如果还是没找到，使用正则表达式从HTML中提取
      if (numbers.length === 0) {
        // 根据不同彩种使用不同的策略
        const expectedCount = this.getExpectedNumberCount(lotCode);

        // 查找连续的数字序列
        const allNumbers = [];
        const textContent = $.text();
        const numberPattern = /\b\d{1,2}\b/g;
        let match;
        while ((match = numberPattern.exec(textContent)) !== null) {
          allNumbers.push(match[0]);
        }

        // 尝试找到期号后面的号码序列
        if (period && allNumbers.length > 0) {
          const periodIndex = textContent.indexOf(period);
          if (periodIndex >= 0) {
            // 从期号位置开始查找号码
            const afterPeriod = textContent.substring(periodIndex + period.length);
            const afterNumbers = [];
            const afterPattern = /\b(\d{1,2})\b/g;
            while ((match = afterPattern.exec(afterPeriod)) !== null && afterNumbers.length < expectedCount) {
              const num = match[1];
              // 根据彩种验证号码范围
              if (this.isValidNumber(lotCode, num)) {
                afterNumbers.push(num);
              }
            }
            if (afterNumbers.length === expectedCount) {
              numbers = afterNumbers;
            }
          }
        }
      }

      // 验证数据完整性
      const expectedNumberCount = this.getExpectedNumberCount(lotCode);

      if (!period) {
        throw new Error('无法解析期号');
      }

      if (numbers.length !== expectedNumberCount) {
        if (numbers.length > expectedNumberCount) {
          numbers = numbers.slice(0, expectedNumberCount);
        } else {
          throw new Error(
            `号码数量不正确: 期望${expectedNumberCount}个，实际${numbers.length}个`
          );
        }
      }

      // 格式化号码（补零）
      const formattedNumbers = numbers.map(num => num.padStart(2, '0'));

      // 🎯 第一步：总是计算drawTimestamp（WebServer需要它来实时重新计算倒计时）
      let drawTimestamp = null; // Unix时间戳（秒）

      if (drawTime) {
        try {
          // 将北京时间转换为UTC时间戳
          // drawTime格式："2025-12-25 15:29:00"（北京时间 UTC+8）
          const parts = drawTime.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
          if (parts) {
            const year = parseInt(parts[1]);
            const month = parseInt(parts[2]) - 1; // 月份从0开始
            const day = parseInt(parts[3]);
            const hour = parseInt(parts[4]);
            const minute = parseInt(parts[5]);
            const second = parseInt(parts[6]);

            // 🎯 正确的时区转换：北京时间 → UTC时间戳
            // 北京时间 = UTC + 8小时
            // 所以 UTC时间 = 北京时间 - 8小时
            // 例如：北京时间 15:29 → UTC 07:29
            let utcHour = hour - 8;
            let utcDay = day;
            let utcMonth = month;
            let utcYear = year;

            // 处理小时借位（跨日期）
            if (utcHour < 0) {
              utcHour += 24;
              utcDay -= 1;

              // 处理跨月
              if (utcDay < 1) {
                utcMonth -= 1;
                if (utcMonth < 0) {
                  utcMonth = 11;
                  utcYear -= 1;
                }
                const daysInPrevMonth = new Date(utcYear, utcMonth + 1, 0).getDate();
                utcDay = daysInPrevMonth;
              }
            }

            // 创建UTC时间戳
            drawTimestamp = Math.floor(Date.UTC(utcYear, utcMonth, utcDay, utcHour, minute, second) / 1000);

            logger.debug(
              `[AULuckyLotteries] ${lotCode} ✅ 计算drawTimestamp: ${drawTimestamp} ` +
              `[开奖时间: ${drawTime}(BJ)]`
            );
          } else {
            logger.warn(`[AULuckyLotteries] 无法解析drawTime格式: ${drawTime}`);
          }
        } catch (error) {
          logger.warn(`[AULuckyLotteries] drawTimestamp计算失败: ${error.message}`);
        }
      }

      // 🎯 第二步：决定倒计时值（优先HTML，fallback到计算）
      if (htmlCountdown !== null) {
        // 🚀 返回原始HTML倒计时（不减延迟，由WebServer统一处理）
        // earlyFetch在OfficialSourceManager中设置为5秒，WebServer会减去
        officialCountdown = htmlCountdown;
        logger.debug(
          `[AULuckyLotteries] ${lotCode} ✅ 使用HTML倒计时: ${htmlCountdown}秒 (原始值，由WebServer减去earlyFetch)`
        );

        // 🚀 重要：使用HTML倒计时反向计算准确的unixtime
        // 因为drawTime是四舍五入的（如19:34:00），但实际开奖时间可能是19:33:33
        // 官网的timeLeft是基于实际开奖时间计算的，所以我们可以反推：
        // 准确的开奖时间 = 当前时间 - (300秒 - HTML倒计时)
        const currentTime = Math.floor(Date.now() / 1000);
        const timeElapsedSinceLastDraw = 300 - htmlCountdown; // 距离上次开奖过了多少秒
        drawTimestamp = currentTime - timeElapsedSinceLastDraw; // 反推准确的开奖时间戳

        logger.debug(
          `[AULuckyLotteries] ${lotCode} 🎯 反向计算准确unixtime: ${drawTimestamp} ` +
          `(基于HTML倒计时${htmlCountdown}秒反推)`
        );
      } else if (drawTimestamp !== null) {
        // ⚠️ Fallback: 基于drawTimestamp计算倒计时
        const currentTime = Math.floor(Date.now() / 1000);
        const timeOffsetConstant = 300; // 固定间隔5分钟
        const timeElapsed = currentTime - drawTimestamp;
        const rawCountdown = timeOffsetConstant - timeElapsed;
        officialCountdown = Math.max(0, rawCountdown);

        logger.debug(
          `[AULuckyLotteries] ⚠️ Fallback倒计时: ${officialCountdown}秒 ` +
          `(基于drawTimestamp计算，可能有±25秒误差)`
        );
      } else {
        officialCountdown = null;
        logger.warn(`[AULuckyLotteries] 无法获取倒计时（HTML和drawTime都失败）`);
      }

      return {
        lotCode,
        period: period,
        numbers: formattedNumbers,
        opencode: formattedNumbers.join(','),
        drawTime: drawTime,
        unixtime: drawTimestamp, // 🚀 开奖时间的Unix时间戳（秒），用于WebServer实时计算倒计时
        officialCountdown: officialCountdown, // 🚀 基于drawTime实时计算的倒计时
        timestamp: Date.now(),
        source: 'auluckylotteries_html'
      };

    } catch (error) {
      logger.error(`[AULuckyLotteries] HTML解析失败:`, error.message);
      return null;
    }
  }

  /**
   * 验证号码是否在有效范围内
   */
  isValidNumber(lotCode, num) {
    const n = parseInt(num);
    switch (lotCode) {
      case 'lucky5':
        return n >= 0 && n <= 9;
      case 'lucky8':
        return n >= 1 && n <= 20;
      case 'lucky10':
        return n >= 1 && n <= 10;
      case 'lucky20':
        return n >= 1 && n <= 80;
      default:
        return true;
    }
  }

  /**
   * 获取彩种期望的号码数量
   */
  getExpectedNumberCount(lotCode) {
    const countMap = {
      'lucky5': 5,   // Lucky 5 Ball: 5个号码
      'lucky8': 8,   // Lucky 8 Ball: 8个号码
      'lucky10': 10, // Lucky 10 Ball: 10个号码
      'lucky20': 20  // Lucky 20 Ball: 20个号码
    };

    return countMap[lotCode] || 5;
  }

  /**
   * 获取历史数据（可选功能）
   */
  /**
   * 获取历史数据（按日期查询）
   * @param {string} lotCode - Scraper Key (如 lucky5, lucky8)
   * @param {string} apiEndpoint - API端点路径 (如 /results/lucky-ball-5/)
   * @param {string} bjDate - 北京时间日期 (YYYY-MM-DD格式)
   * @returns {Array} 历史开奖记录
   *
   * 说明：由于北京时间与澳大利亚时间有2.5小时时差，北京时间的一天跨越澳大利亚时间的两天
   * 例如：北京时间 2025-12-23 对应澳大利亚时间 2025-12-23 02:30 到 2025-12-24 02:29
   * 因此需要从两天的数据中筛选
   */
  async fetchHistoryData(lotCode, apiEndpoint, bjDate) {
    let currentDomain = null;
    try {
      if (!apiEndpoint) {
        throw new Error(`AU Lucky Lotteries彩种 ${lotCode} 缺少 apiEndpoint 配置`);
      }

      // 🔥 从域名管理器获取当前最优域名
      currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      // 计算澳大利亚时间的日期范围
      // 北京时间 = UTC+8, ACDT = UTC+10:30, 时差 = 2.5小时
      // 北京时间的一天对应澳大利亚时间的两天

      // 解析日期（YYYY-MM-DD）
      const [year, month, day] = bjDate.split('-').map(Number);

      // 创建北京时间的起始和结束时刻（UTC表示）
      // 北京时间 00:00:00 = UTC 前一天 16:00:00
      const bjStartUTC = Date.UTC(year, month - 1, day, 0, 0, 0) - 8 * 60 * 60 * 1000;
      // 北京时间 23:59:59 = UTC 同一天 15:59:59
      const bjEndUTC = Date.UTC(year, month - 1, day, 23, 59, 59) - 8 * 60 * 60 * 1000;

      // 转换为澳大利亚时间（UTC + 10.5小时）
      const auStartDate = new Date(bjStartUTC + 10.5 * 60 * 60 * 1000);
      const auEndDate = new Date(bjEndUTC + 10.5 * 60 * 60 * 1000);

      // 格式化为 YYYY-MM-DD
      const auStartDateStr = auStartDate.toISOString().split('T')[0];
      const auEndDateStr = auEndDate.toISOString().split('T')[0];

      logger.info(`[AULuckyLotteries] 📊 查询历史数据: 北京时间 ${bjDate} → 澳大利亚时间 ${auStartDateStr} 到 ${auEndDateStr} [域名: ${baseUrl}]`);

      // 获取澳大利亚时间两天的数据
      const dates = [auStartDateStr];
      if (auStartDateStr !== auEndDateStr) {
        dates.push(auEndDateStr);
      }

      let allRecords = [];

      for (const auDate of dates) {
        const targetUrl = `${baseUrl}${apiEndpoint}?date=${auDate}`;
        logger.debug(`[AULuckyLotteries] 🚀 请求: ${targetUrl}`);

        const response = await axios.get(targetUrl, {
          timeout: 8000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          }
        });

        // 解析 HTML 提取历史记录
        const records = this.parseHistoryHTML(response.data, lotCode);
        allRecords = allRecords.concat(records);
      }

      // 过滤出北京时间在查询日期范围内的记录
      const bjStartTime = bjDate + ' 00:00:00';
      const bjEndTime = bjDate + ' 23:59:59';

      const filteredRecords = allRecords.filter(record => {
        if (!record.draw_time || record.draw_time === '-') {
          return false;
        }
        return record.draw_time >= bjStartTime && record.draw_time <= bjEndTime;
      });

      // 去重（按期号）
      const uniqueRecords = [];
      const seenPeriods = new Set();
      for (const record of filteredRecords) {
        if (!seenPeriods.has(record.period)) {
          seenPeriods.add(record.period);
          uniqueRecords.push(record);
        }
      }

      // 按期号降序排序
      uniqueRecords.sort((a, b) => parseInt(b.period) - parseInt(a.period));

      logger.info(`[AULuckyLotteries] ✅ 成功获取历史数据: ${lotCode}, 北京时间: ${bjDate}, 记录数: ${uniqueRecords.length}`);
      return uniqueRecords;

    } catch (error) {
      // ❌ 记录失败（域名管理器统计）
      if (currentDomain) {
        await this.domainManager.recordFailure(currentDomain.id, error, true);
      }

      logger.error(`[AULuckyLotteries] 获取历史数据失败: ${lotCode}, ${error.message}`);
      throw error;
    }
  }

  /**
   * 解析历史数据 HTML
   *
   * 修复说明：
   * - 问题：之前使用 parent.find('*') 会匹配到所有子元素，导致期号和号码错配
   * - 方案：限制搜索范围，只在当前元素及其紧邻的下一个兄弟元素中查找号码
   * - 参考：SpeedyLot88Scraper 的行级隔离策略
   */
  parseHistoryHTML(html, lotCode) {
    try {
      const $ = cheerio.load(html);
      const records = [];
      const seenPeriods = new Set(); // 用于去重

      // 查找所有历史记录行
      // 根据 WebFetch 分析，历史数据在 "Past Results" 区域
      // 排除顶部的实时数据区域（class="brt2f_2", "brt3t_number"）
      // 只匹配包含完整时间格式的历史记录
      const drawElements = $('body').find('*:contains("Draw:")').filter(function() {
        const text = $(this).text();
        const $this = $(this);

        // 排除顶部实时数据区域
        if ($this.hasClass('brt2f_2') || $this.hasClass('brt3t_number') ||
            $this.parents('.brt2f_2').length > 0 || $this.parents('.brt3t_number').length > 0) {
          return false;
        }

        // 只匹配包含完整时间格式的历史记录
        // 格式: "Mon, Dec 24, 2025 11:59 pm (ACDT)  &nbsp;&nbsp;Draw:  51274603"
        return /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+[ap]m\s+\([A-Z]+\)/.test(text) &&
               /Draw:\s*\d{8}/.test(text);
      });

      drawElements.each((index, element) => {
        try {
          const drawText = $(element).text();
          const drawMatch = drawText.match(/Draw:\s*(\d{8})/);

          if (drawMatch) {
            const period = drawMatch[1];

            // 去重：如果已经处理过这个期号，跳过
            if (seenPeriods.has(period)) {
              return; // 跳过这条记录
            }
            seenPeriods.add(period);

            // 查找该期号对应的号码
            let numbers = [];
            let drawTime = null;

            // 尝试解析开奖时间
            // 时间和期号通常在同一行，格式: "Wed, Dec 24, 2025 11:59 pm (ACDT)   Draw: 51274603"

            // 方法1: 从当前元素的文本中查找（时间和期号在同一行）
            let timeMatch = drawText.match(/([A-Za-z]{3,9},\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+[ap]m\s+\([A-Z]+\))/);

            // 方法2: 如果当前元素没找到，从父元素查找
            if (!timeMatch) {
              const parent = $(element).parent();
              const parentText = parent.text();
              timeMatch = parentText.match(/([A-Za-z]{3,9},\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+[ap]m\s+\([A-Z]+\))/);
            }

            // 方法3: 从前一个兄弟元素查找（时间可能在上一行）
            if (!timeMatch) {
              let prev = $(element).prev();
              for (let i = 0; i < 3 && prev.length > 0; i++) {
                const prevText = prev.text();
                timeMatch = prevText.match(/([A-Za-z]{3,9},\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+[ap]m\s+\([A-Z]+\))/);
                if (timeMatch) break;
                prev = prev.prev();
              }
            }

            if (timeMatch) {
              // 格式化时间（转换为北京时间）
              drawTime = this.formatDrawTime(timeMatch[1]);
            }

            // 🔧 关键修复：限制号码搜索范围，避免跨期号匹配
            // 策略1: 首先在当前元素的直接子元素中查找
            $(element).find('*').each((i, el) => {
              const text = $(el).text().trim();
              if (/^\d+$/.test(text) && text.length <= 2) {
                const num = parseInt(text);
                if (!isNaN(num) && this.isValidNumber(lotCode, num)) {
                  numbers.push(text.padStart(2, '0'));
                }
              }
            });

            // 策略2: 如果当前元素没找到号码，查找下一个兄弟元素（号码通常在期号的下一行）
            const expectedCount = this.getExpectedNumberCount(lotCode);
            if (numbers.length < expectedCount) {
              let nextSibling = $(element).next();
              let attempts = 0;

              // 最多检查接下来的3个兄弟元素
              while (numbers.length < expectedCount && nextSibling.length > 0 && attempts < 3) {
                const siblingText = nextSibling.text();

                // 如果遇到下一个期号，停止搜索
                if (/Draw:\s*\d{8}/.test(siblingText)) {
                  break;
                }

                // 在兄弟元素及其子元素中查找号码
                const searchInElement = (el) => {
                  const text = $(el).text().trim();
                  if (/^\d+$/.test(text) && text.length <= 2) {
                    const num = parseInt(text);
                    if (!isNaN(num) && this.isValidNumber(lotCode, num) && numbers.length < expectedCount) {
                      numbers.push(text.padStart(2, '0'));
                    }
                  }
                };

                // 搜索兄弟元素本身
                searchInElement(nextSibling[0]);

                // 搜索兄弟元素的子元素
                nextSibling.find('*').each((i, el) => {
                  if (numbers.length < expectedCount) {
                    searchInElement(el);
                  }
                });

                nextSibling = nextSibling.next();
                attempts++;
              }
            }

            // 根据彩种类型验证号码数量
            if (numbers.length >= expectedCount) {
              // 截取前N个号码（不去重，因为开奖号码本身可能有重复）
              numbers = numbers.slice(0, expectedCount);

              const now = new Date();
              const createdAt = now.toISOString().replace('T', ' ').substring(0, 19);

              // 计算unixtime（开奖时间的Unix时间戳）
              let unixtime = null;
              if (drawTime && drawTime !== '-') {
                try {
                  const parts = drawTime.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
                  if (parts) {
                    const year = parseInt(parts[1]);
                    const month = parseInt(parts[2]) - 1;
                    const day = parseInt(parts[3]);
                    const hour = parseInt(parts[4]);
                    const minute = parseInt(parts[5]);
                    const second = parseInt(parts[6]);

                    // 🎯 正确的时区转换：北京时间 → UTC时间戳
                    let utcHour = hour - 8;
                    let utcDay = day;
                    let utcMonth = month;
                    let utcYear = year;

                    if (utcHour < 0) {
                      utcHour += 24;
                      utcDay -= 1;
                      if (utcDay < 1) {
                        utcMonth -= 1;
                        if (utcMonth < 0) {
                          utcMonth = 11;
                          utcYear -= 1;
                        }
                        const daysInPrevMonth = new Date(utcYear, utcMonth + 1, 0).getDate();
                        utcDay = daysInPrevMonth;
                      }
                    }

                    unixtime = Math.floor(Date.UTC(utcYear, utcMonth, utcDay, utcHour, minute, second) / 1000);
                  }
                } catch (error) {
                  logger.debug(`[AULuckyLotteries] 历史数据unixtime计算失败: ${error.message}`);
                }
              }

              records.push({
                period: period,
                issue: period,
                numbers: numbers,
                opencode: numbers.join(','),
                drawCode: numbers.join(','),
                draw_code: numbers.join(','),  // 前端使用的字段名
                draw_time: drawTime || '-',     // 开奖时间
                unixtime: unixtime,             // Unix时间戳（秒）
                created_at: createdAt,          // 记录创建时间
                timestamp: Date.now(),
                source: 'auluckylotteries_history'
              });
            } else {
              logger.debug(`[AULuckyLotteries] 期号${period}号码数量不足: ${numbers.length}/${expectedCount}`);
            }
          }
        } catch (err) {
          logger.debug(`[AULuckyLotteries] 解析单条记录失败: ${err.message}`);
        }
      });

      // 按期号从大到小排序（最新的在前）
      records.sort((a, b) => {
        const periodA = parseInt(a.period);
        const periodB = parseInt(b.period);
        return periodB - periodA; // 降序排序
      });

      logger.debug(`[AULuckyLotteries] 解析到 ${records.length} 条历史记录`);
      return records;

    } catch (error) {
      logger.error(`[AULuckyLotteries] 解析历史HTML失败:`, error.message);
      return [];
    }
  }

  /**
   * 获取彩种的预期号码数量
   */
  getExpectedNumberCount(lotCode) {
    const counts = {
      'lucky5': 5,
      'lucky8': 8,
      'lucky10': 10,
      'lucky20': 20
    };
    return counts[lotCode] || 5;
  }

  /**
   * 格式化开奖时间
   * 将 "Wed, Dec 24, 2025 11:59 pm (ACDT)" 转换为北京时间 "2025-12-24 21:29:00"
   *
   * 时区转换：
   * - ACDT (Australian Central Daylight Time) = UTC+10:30
   * - ACST (Australian Central Standard Time) = UTC+9:30
   * - 北京时间 = UTC+8
   * - 转换公式: 北京时间 = ACDT - 2.5小时 或 ACST - 1.5小时
   */
  formatDrawTime(timeStr) {
    try {
      // 提取时区标识
      const timezoneMatch = timeStr.match(/\(([A-Z]+)\)/);
      const timezone = timezoneMatch ? timezoneMatch[1] : 'ACDT';

      // 移除时区信息，只保留日期和时间部分
      // 示例: "Wed, Dec 24, 2025 11:59 pm (ACDT)" -> "Wed, Dec 24, 2025 11:59 pm"
      const cleanTime = timeStr.replace(/\s*\([A-Z]+\)\s*$/, '');

      // 🔧 关键修复：手动解析时间字符串，避免Date对象的时区问题
      // 格式: "Wed, Dec 25, 2025 6:09 pm" 或 "Wednesday, Dec 25, 2025 11:59 pm"
      const match = cleanTime.match(/([A-Za-z]+),\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*([ap]m)/i);

      if (!match) {
        logger.warn(`[AULuckyLotteries] 无法解析时间格式: ${timeStr}`);
        return timeStr;
      }

      const monthStr = match[2];
      const day = parseInt(match[3]);
      const year = parseInt(match[4]);
      let hour = parseInt(match[5]);
      const minute = parseInt(match[6]);
      const ampm = match[7].toLowerCase();

      // 转换12小时制为24小时制
      if (ampm === 'pm' && hour !== 12) {
        hour += 12;
      } else if (ampm === 'am' && hour === 12) {
        hour = 0;
      }

      // 月份映射
      const months = {'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                      'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11};
      const month = months[monthStr.toLowerCase().substring(0, 3)];

      if (month === undefined) {
        logger.warn(`[AULuckyLotteries] 无法识别月份: ${monthStr}`);
        return timeStr;
      }

      const second = 0;  // 官网时间没有秒，默认为0

      // 确定时区偏移（小时）
      let acdtOffsetHours, acdtOffsetMinutes;
      if (timezone === 'ACDT') {
        acdtOffsetHours = 10;
        acdtOffsetMinutes = 30;  // ACDT = UTC+10:30
      } else if (timezone === 'ACST') {
        acdtOffsetHours = 9;
        acdtOffsetMinutes = 30;  // ACST = UTC+9:30
      } else {
        acdtOffsetHours = 10;
        acdtOffsetMinutes = 30;  // 默认ACDT
        logger.warn(`[AULuckyLotteries] 未知时区: ${timezone}, 默认使用ACDT`);
      }

      // 🎯 正确的时区转换流程：
      // 1. ACDT时间 → UTC时间（减去ACDT偏移）
      // 2. 创建UTC时间戳
      // 3. UTC时间 → 北京时间（加8小时）
      //
      // 例如：ACDT 18:29:00 (2025-12-25)
      //   步骤1: UTC = 18:29 - 10:30 = 07:59
      //   步骤2: timestamp = Date.UTC(2025, 11, 25, 7, 59, 0)
      //   步骤3: 北京 = UTC 07:59 + 8小时 = 15:59

      // 步骤1: ACDT转UTC（减去ACDT偏移）
      let utcHour = hour;
      let utcMinute = minute;
      let utcDay = day;
      let utcMonth = month;
      let utcYear = year;

      utcHour -= acdtOffsetHours;
      utcMinute -= acdtOffsetMinutes;

      // 处理分钟借位
      if (utcMinute < 0) {
        utcMinute += 60;
        utcHour -= 1;
      }

      // 处理小时借位（跨日期）
      if (utcHour < 0) {
        utcHour += 24;
        utcDay -= 1;

        // 处理跨月
        if (utcDay < 1) {
          utcMonth -= 1;
          if (utcMonth < 0) {
            utcMonth = 11;
            utcYear -= 1;
          }
          // 获取上个月的天数
          const daysInPrevMonth = new Date(utcYear, utcMonth + 1, 0).getDate();
          utcDay = daysInPrevMonth;
        }
      }

      // 步骤2: 创建UTC时间戳
      const utcTimestamp = Date.UTC(utcYear, utcMonth, utcDay, utcHour, utcMinute, second);

      // 步骤3: UTC转北京时间（加8小时）
      const bjDate = new Date(utcTimestamp);
      let bjHour = bjDate.getUTCHours() + 8;
      let bjDay = bjDate.getUTCDate();
      let bjMonth = bjDate.getUTCMonth();
      let bjYear = bjDate.getUTCFullYear();

      // 处理小时进位（跨日期）
      if (bjHour >= 24) {
        bjHour -= 24;
        bjDay += 1;

        // 处理跨月
        const daysInMonth = new Date(bjYear, bjMonth + 1, 0).getDate();
        if (bjDay > daysInMonth) {
          bjDay = 1;
          bjMonth += 1;
          if (bjMonth > 11) {
            bjMonth = 0;
            bjYear += 1;
          }
        }
      }

      const bjHours = String(bjHour).padStart(2, '0');
      const bjMinutes = String(bjDate.getUTCMinutes()).padStart(2, '0');
      const bjSeconds = String(bjDate.getUTCSeconds()).padStart(2, '0');
      const bjMonthStr = String(bjMonth + 1).padStart(2, '0');
      const bjDayStr = String(bjDay).padStart(2, '0');

      return `${bjYear}-${bjMonthStr}-${bjDayStr} ${bjHours}:${bjMinutes}:${bjSeconds}`;
    } catch (error) {
      logger.error(`[AULuckyLotteries] 时间格式转换失败: ${timeStr}`, error.message);
      return timeStr; // 返回原始字符串
    }
  }
}

export default new AULuckyLotteriesScraper();
