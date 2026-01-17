import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/Logger.js';
import universalDomainManager from '../managers/UniversalDomainManager.js';

/**
 * LuckySscai网站爬虫 - 爬取幸运时时彩开奖数据
 * 数据源: https://luckysscai.com
 */
class LuckySscaiScraper {
  constructor() {
    // ⚠️ 不再硬编码baseUrl，改为动态获取
    // this.baseUrl = 'https://luckysscai.com';
    this.domainManager = universalDomainManager;
    this.sourceType = 'luckysscai';  // 数据源类型

    // 彩种URL映射
    this.lotteryUrls = {
      // 幸运时时彩 - 5个号码
      'xyssc': '/index.php'
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
        throw new Error(`LuckySscai不支持彩种: ${lotCode}`);
      }

      // 🔥 从域名管理器获取当前最优域名
      currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      const targetUrl = `${baseUrl}${endpoint}`;

      logger.info(`[LuckySscai] 🎲 请求: ${targetUrl}${retryCount > 0 ? ` (重试 ${retryCount}/${maxRetries})` : ''} [域名: ${baseUrl}]`);

      const response = await axios.get(targetUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
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

      logger.info(`[LuckySscai] ✅ 成功获取 ${lotCode} 第${result.period}期数据 (${responseTime}ms)`);
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
        logger.warn(`[LuckySscai] ⚠️ ${lotCode} 获取失败 (${error.message})，1秒后重试 (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      logger.error(`[LuckySscai] ❌ ${lotCode} 获取失败 (已重试${retryCount}次):`, error.message);
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

      // 🎯 优先从顶部"最新开奖"区域获取数据（更新最快）
      const latestResult = $('.latest-result .result-balls');

      if (latestResult.length > 0) {
        // 期号 (格式: "20251226 - 062期")
        const periodText = latestResult.find('span strong').text().trim();
        const periodMatch = periodText.match(/(\d+)/);
        if (periodMatch) {
          // 从日期span中提取日期
          const dateText = latestResult.find('span').first().text().trim();
          const dateMatch = dateText.match(/(\d{8})/);
          if (dateMatch) {
            period = `${dateMatch[1]}-${periodMatch[1].padStart(3, '0')}`;
          }
        }

        // 开奖时间 (格式: "12-26 09:20")
        drawTime = latestResult.find('span.time').text().trim();

        // 号码
        const balls = latestResult.find('.balls span');
        balls.each((i, ball) => {
          const num = $(ball).text().trim();
          if (num && /^\d+$/.test(num)) {
            numbers.push(num);
          }
        });
      }

      // 🔄 如果顶部区域解析失败，降级到表格数据
      if (!period || numbers.length === 0) {
        logger.warn('[LuckySscai] 顶部最新开奖区域解析失败，降级到表格数据');

        const dataRows = $('tbody tr');
        if (dataRows.length < 2) {
          throw new Error('未找到开奖数据行');
        }

        // 第二行是最新数据（第一行是表头）
        const firstDataRow = dataRows.eq(1);
        const cells = firstDataRow.find('td');

        if (cells.length < 3) {
          throw new Error('数据行格式不正确');
        }

        // 第一列: 期号 (格式: "20251225- 108期")
        const periodText = cells.eq(0).text().trim();
        const periodMatch = periodText.match(/(\d{8})-?\s*(\d+)/);
        if (periodMatch) {
          period = `${periodMatch[1]}-${periodMatch[2]}`;
        }

        // 第二列: 开奖时间 (格式: "12-25 16:00")
        drawTime = cells.eq(1).text().trim();

        // 第三列: 开出号码
        const numbersCell = cells.eq(2);
        const numberSpans = numbersCell.find('span');

        if (numberSpans.length > 0) {
          numberSpans.each((i, span) => {
            const num = $(span).text().trim();
            if (num && /^\d+$/.test(num)) {
              numbers.push(num);
            }
          });
        } else {
          const numbersText = numbersCell.text().trim();
          numbers = numbersText.split(/\s+/).filter(n => /^\d+$/.test(n));
        }
      }

      // 验证数据完整性
      if (!period) {
        throw new Error('未能解析期号');
      }

      if (numbers.length !== 5) {
        logger.warn(`[LuckySscai] 号码数量异常: ${numbers.length}个`);
        throw new Error(`号码数量错误: 期望5个，实际${numbers.length}个`);
      }

      // 🌍 时区转换：官网时间 -> 北京时间(+7小时)
      // 官方03:00 -> 北京10:00 | 官方18:55 -> 北京第二天01:55
      if (drawTime) {
        // 如果是 "12-25 16:00" 格式，转换为完整日期时间并+7小时
        // 🔧 从期号中提取年份（解决跨年时年份错误问题）
        const yearFromPeriod = period ? parseInt(period.substring(0, 4)) : new Date().getFullYear();
        if (drawTime.match(/^\d{2}-\d{2}\s+\d{2}:\d{2}$/)) {
          const [datePart, timePart] = drawTime.split(/\s+/);
          const [month, day] = datePart.split('-');
          const [hours, minutes] = timePart.split(':').map(n => parseInt(n));

          // 🔧 处理跨年情况：期号在1月，网站显示12月 -> 使用前一年
          // 例如：20260101-001期显示为"12-31 17:05"，应该是2025-12-31 17:05
          let yearForWebsite = yearFromPeriod;
          const periodMonth = parseInt(period.substring(4, 6));
          if (periodMonth === 1 && parseInt(month) === 12) {
            yearForWebsite = yearFromPeriod - 1;
            logger.debug(`[LuckySscai] 🔄 跨年检测: 期号=${period} (1月), 网站日期=${month}-${day} (12月) -> 使用年份=${yearForWebsite}`);
          }

          // 使用UTC时间构造，避免本地时区影响
          const websiteDate = new Date(Date.UTC(
            yearForWebsite,  // 使用调整后的年份
            parseInt(month) - 1,  // 月份从0开始
            parseInt(day),
            hours,
            minutes,
            0
          ));

          // +7小时转换为北京时间
          const beijingDate = new Date(websiteDate.getTime() + 7 * 60 * 60 * 1000);

          // 格式化为 MySQL 时间格式（使用UTC方法获取，因为已经转换好了）
          const year = beijingDate.getUTCFullYear();
          const mon = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
          const d = String(beijingDate.getUTCDate()).padStart(2, '0');
          const h = String(beijingDate.getUTCHours()).padStart(2, '0');
          const m = String(beijingDate.getUTCMinutes()).padStart(2, '0');
          const s = String(beijingDate.getUTCSeconds()).padStart(2, '0');

          drawTime = `${year}-${mon}-${d} ${h}:${m}:${s}`;

          logger.debug(`[LuckySscai] ⏰ 时区转换: 官网 ${datePart} ${timePart} -> 北京 ${drawTime}`);
        }
      } else {
        // 如果没有解析到时间，使用当前时间
        drawTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }

      logger.debug(`[LuckySscai] 解析结果: 期号=${period}, 号码=${numbers.join(',')}, 时间=${drawTime}`);

      return {
        period: period,
        numbers: numbers,
        drawTime: drawTime
      };

    } catch (error) {
      logger.error(`[LuckySscai] HTML解析失败:`, error.message);
      throw error;
    }
  }

  /**
   * 根据幸运时时彩的开奖时间表计算下一期开奖时间
   *
   * 🕐 开奖时间表（北京时间，120期/天）：
   * - 001-023期：00:05 ~ 01:55（凌晨段，23期，每5分钟）
   * - 024-096期：10:00 ~ 22:00（白天段，73期，每10分钟）
   * - 097-120期：22:05 ~ 00:00（晚上段，24期，每5分钟）
   *
   * @param {Date} currentTime - 当前时间（北京时间）
   * @returns {Date} 下一期开奖时间
   */
  getNextDrawTime(currentTime = new Date()) {
    const now = new Date(currentTime);
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // 定义三个时间段
    const morningStart = 0 * 60 + 5;      // 00:05
    const morningEnd = 1 * 60 + 55;       // 01:55
    const dayStart = 10 * 60 + 0;         // 10:00
    const dayEnd = 22 * 60 + 0;           // 22:00
    const nightStart = 22 * 60 + 5;       // 22:05
    const nightEnd = 24 * 60 + 0;         // 24:00 (次日00:00)

    let nextDrawTime = new Date(now);

    // 🌅 凌晨段（00:05-01:55，每5分钟）
    if (totalMinutes >= morningStart && totalMinutes < morningEnd) {
      const minutesIntoMorning = totalMinutes - morningStart;
      const minutesToNext = 5 - (minutesIntoMorning % 5);
      nextDrawTime.setMinutes(now.getMinutes() + minutesToNext);
      nextDrawTime.setSeconds(0);
      nextDrawTime.setMilliseconds(0);
    }
    // 🕐 间隔期（01:55-10:00）-> 下一期在10:00
    else if (totalMinutes >= morningEnd && totalMinutes < dayStart) {
      nextDrawTime.setHours(10, 0, 0, 0);
    }
    // ☀️ 白天段（10:00-22:00，每10分钟）
    else if (totalMinutes >= dayStart && totalMinutes < dayEnd) {
      const minutesIntoDay = totalMinutes - dayStart;
      const minutesToNext = 10 - (minutesIntoDay % 10);
      nextDrawTime.setMinutes(now.getMinutes() + minutesToNext);
      nextDrawTime.setSeconds(0);
      nextDrawTime.setMilliseconds(0);
    }
    // 🌙 晚上段（22:05-23:59，每5分钟）
    else if (totalMinutes >= nightStart && totalMinutes < nightEnd) {
      const minutesIntoNight = totalMinutes - nightStart;
      const minutesToNext = 5 - (minutesIntoNight % 5);
      nextDrawTime.setMinutes(now.getMinutes() + minutesToNext);
      nextDrawTime.setSeconds(0);
      nextDrawTime.setMilliseconds(0);
    }
    // 🌃 午夜后（00:00-00:05）-> 下一期在00:05
    else if (totalMinutes >= 0 && totalMinutes < morningStart) {
      nextDrawTime.setHours(0, 5, 0, 0);
    }
    // 🌙 晚上段结束后（22:00-22:05）-> 下一期在22:05
    else if (totalMinutes >= dayEnd && totalMinutes < nightStart) {
      nextDrawTime.setHours(22, 5, 0, 0);
    }

    return nextDrawTime;
  }

  /**
   * 获取倒计时信息（优先使用官方API，失败时使用时间表计算）
   */
  async fetchCountdown(lotCode) {
    try {
      // 🔥 动态获取域名
      const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;
      const timerUrl = `${baseUrl}/get_timer.php`;

      logger.info(`[LuckySscai] 🕐 请求倒计时: ${timerUrl}`);

      const response = await axios.get(timerUrl, {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      // 解析倒计时数据
      const countdown = response.data ? String(response.data).trim() : '';

      // 如果官方倒计时有效（不为空，不是00:00，不是"-"），使用官方倒计时
      if (countdown && countdown !== '00:00' && countdown !== '-' && countdown !== '') {
        logger.info(`[LuckySscai] ✅ 官方倒计时: ${countdown}`);
        return countdown;
      }

      // 如果官方API返回00:00、空值或无效数据，使用时间表计算（通常发生在间隔期01:55-10:00）
      logger.info(`[LuckySscai] ⚠️ 官方倒计时无效(${countdown || '空'})，使用时间表计算`);
      return this.calculateCountdownFromSchedule();

    } catch (error) {
      logger.warn(`[LuckySscai] 获取官方倒计时失败，使用时间表计算:`, error.message);
      return this.calculateCountdownFromSchedule();
    }
  }

  /**
   * 根据时间表计算倒计时（用于间隔期或官方API失败时）
   */
  calculateCountdownFromSchedule() {
    const now = new Date();
    const nextDrawTime = this.getNextDrawTime(now);
    const diffMs = nextDrawTime.getTime() - now.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;

    const countdownStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    logger.info(`[LuckySscai] 📅 计算倒计时: 当前=${now.toLocaleTimeString('zh-CN', {hour12: false})}, 下期=${nextDrawTime.toLocaleTimeString('zh-CN', {hour12: false})}, 倒计时=${countdownStr}`);

    return countdownStr;
  }

  /**
   * 获取历史数据
   */
  async fetchHistoryData(lotCode, params = {}) {
    try {
      const { date, timestamp } = params;

      // 🎯 如果提供了日期，使用分批加载获取完整的一天数据（120期）
      if (date) {
        return await this.fetchFullDayHistory(date);
      }

      // 🔥 动态获取域名
      const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      const baseUrl = currentDomain.domain_url;

      // 单次请求获取数据
      let url = `${baseUrl}/index.php`;

      if (timestamp) {
        url = `${baseUrl}/more_result.php?time=${timestamp}`;
        logger.info(`[LuckySscai] 📚 请求历史数据: ${url}`);
      } else {
        // 不带参数时，获取主页最新数据
        logger.info(`[LuckySscai] 📚 请求历史数据: ${url} (主页)`);
      }

      const response = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // 解析历史数据
      return this.parseHistoryHTML(response.data);

    } catch (error) {
      logger.error(`[LuckySscai] 获取历史数据失败:`, error.message);
      throw error;
    }
  }

  /**
   * 获取完整的一天历史数据（分批加载，最多120期）
   *
   * 🔑 核心逻辑：期号中的日期是日历日期，不是schedule日期
   * - 幸运时时彩每日120期编排规则：
   *   - 001-023期：当天00:05 ~ 01:55（凌晨段，23期，每5分钟）
   *   - 024-096期：当天10:00 ~ 22:00（早场，73期，每10分钟）
   *   - 097-120期：当天22:05 ~ 次日00:00（晚上段，24期，每5分钟）
   * - 所以查询"2025-12-25"需要获取draw_time在[2025-12-25 00:05, 2025-12-26 00:00]范围内的记录
   *
   * 🌟 数据分布策略：
   * - 官网数据按日期分档，完整的一天数据分布在两个日期页面中
   * - 查询2025-12-25的数据需要从两个页面获取：
   *   1. index.php?date=2025-12-24 -> 提取timestamp -> 获取001-023期（凌晨段）
   *   2. index.php?date=2025-12-25 -> 提取timestamp -> 获取024-120期（早场+晚场）
   */
  async fetchFullDayHistory(date) {
    let allRecords = [];

    // 🎯 计算目标时间范围（北京时间）
    const [year, month, day] = date.split('-').map(n => parseInt(n));
    const queryDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isToday = queryDate.getTime() === today.getTime();

    // 🎯 幸运时时彩期号编排规则（日历日期格式）：
    // - 001-023期：当天00:05-01:55（凌晨段，23期，每5分钟）
    // - 024-096期：当天10:00-22:00（早场，73期，每10分钟）
    // - 097-120期：当天22:05-次日00:00（晚上段，24期，每5分钟）
    // - 期号中的日期（如20251225）表示日历日期，第001期从当天00:05开始
    const startTime = new Date(year, month - 1, day, 0, 5, 0);  // 当天00:05（第001期）
    let endTime;

    if (isToday) {
      // 查询今天：结束时间为当前时间（只获取已开奖的期数）
      endTime = new Date();
    } else {
      // 查询历史：结束时间为第二天00:00（第120期）
      endTime = new Date(year, month - 1, day + 1, 0, 0, 0);
    }

    const startTimeStr = startTime.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});
    const endTimeStr = endTime.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});

    logger.info(`[LuckySscai] 📚 获取 ${date} 的历史数据（时间范围: ${startTimeStr} ~ ${endTimeStr}）`);

    // 🌟 策略：官网按开奖时间分页，需要从两个日期页面获取完整数据
    // - 查询2026-01-01的数据需要从两个页面获取：
    //   1. index.php?date=2025-12-31 -> 获取凌晨段001-023期（开奖时间01-01 00:05-01:55）
    //   2. index.php?date=2026-01-01 -> 获取早场+晚场024-120期（开奖时间01-01 10:00-次日00:00）

    // 1. 获取凌晨段数据（001-023期）：从前一天的页面
    // 🔧 使用Date对象正确处理跨月/跨年（如2026-01-01的前一天是2025-12-31）
    const prevDayDate = new Date(year, month - 1, day - 1);
    const prevDate = `${prevDayDate.getFullYear()}-${String(prevDayDate.getMonth() + 1).padStart(2, '0')}-${String(prevDayDate.getDate()).padStart(2, '0')}`;

    logger.info(`[LuckySscai] 🌅 获取凌晨段数据（001-023期）从 date=${prevDate}`);
    try {
      const morningRecords = await this.fetchRecordsFromDate(prevDate, startTime, new Date(year, month - 1, day, 1, 55, 0));
      logger.info(`[LuckySscai] ✅ 凌晨段获取到 ${morningRecords.length} 期`);
      allRecords.push(...morningRecords);
    } catch (err) {
      logger.warn(`[LuckySscai] ⚠️ 凌晨段数据获取失败: ${err.message}`);
    }

    // 2. 获取早场+晚场数据（024-120期）：从当天的页面
    logger.info(`[LuckySscai] ☀️ 获取早场+晚场数据（024-120期）从 date=${date}`);
    try {
      const dayRecords = await this.fetchRecordsFromDate(date, new Date(year, month - 1, day, 10, 0, 0), endTime);
      logger.info(`[LuckySscai] ✅ 早场+晚场获取到 ${dayRecords.length} 期`);
      allRecords.push(...dayRecords);
    } catch (err) {
      logger.warn(`[LuckySscai] ⚠️ 早场+晚场数据获取失败: ${err.message}`);
    }

    // 准备日期前缀用于期号编号
    const targetDatePrefix = date.replace(/-/g, '');

    // 🔄 去重：按开奖时间去重（可能从多个来源获取到重复数据）
    const uniqueRecordsMap = new Map();
    allRecords.forEach(record => {
      const drawTime = record.draw_time || record.drawTime;
      if (!uniqueRecordsMap.has(drawTime)) {
        uniqueRecordsMap.set(drawTime, record);
      }
    });
    allRecords = Array.from(uniqueRecordsMap.values());

    // 🔄 按时间排序（从早到晚）
    allRecords.sort((a, b) => {
      const timeA = new Date(a.draw_time || a.drawTime);
      const timeB = new Date(b.draw_time || b.drawTime);
      return timeA - timeB;
    });

    // 🎯 智能期号推算：根据开奖时间计算应该对应的期号
    // - 001-023期：00:05-01:55（凌晨段，每5分钟）
    // - 024-096期：10:00-22:00（早场，每10分钟）
    // - 097-120期：22:05-00:00（晚上段，每5分钟）
    allRecords.forEach((record) => {
      const drawTime = new Date(record.draw_time || record.drawTime);
      const hour = drawTime.getHours();
      const minute = drawTime.getMinutes();

      let periodNumber;

      // 🌟 特殊处理：次日00:00是第120期
      if (hour === 0 && minute === 0) {
        periodNumber = 120;
      } else if (hour >= 0 && hour < 2) {
        // 凌晨段（00:05-01:55）：001-023期
        const minutesSinceMidnight = hour * 60 + minute;
        const minutesSince0005 = minutesSinceMidnight - 5;  // 从00:05开始
        periodNumber = Math.floor(minutesSince0005 / 5) + 1;
      } else if (hour >= 10 && hour < 22) {
        // 早场（10:00-22:00）：024-096期
        const minutesSince1000 = (hour - 10) * 60 + minute;
        periodNumber = Math.floor(minutesSince1000 / 10) + 24;
      } else if (hour === 22 || hour === 23) {
        // 晚上段（22:05-23:55）：097-120期
        const minutesSince2205 = (hour - 22) * 60 + minute - 5;  // 从22:05开始
        periodNumber = Math.floor(minutesSince2205 / 5) + 97;
      } else {
        // 其他异常时间，记录警告
        logger.warn(`[LuckySscai] 异常开奖时间: ${drawTime.toISOString()}`);
        periodNumber = 0;
      }

      const newPeriodNumber = String(periodNumber).padStart(3, '0');
      const newIssue = `${targetDatePrefix}-${newPeriodNumber}`;
      record.issue = newIssue;
    });

    logger.info(`[LuckySscai] ✅ 获取历史数据 ${allRecords.length} 条 (${date}，已重新编号为日历格式)`);
    return allRecords;
  }

  /**
   * 从指定日期页面获取记录
   * @param {string} date - 日期（YYYY-MM-DD格式）
   * @param {Date} startTime - 开始时间
   * @param {Date} endTime - 结束时间
   * @returns {Promise<Array>} 记录数组
   */
  async fetchRecordsFromDate(date, startTime, endTime) {
    const records = [];

    // 🔥 动态获取域名（带fallback）
    let baseUrl;
    try {
      const currentDomain = await this.domainManager.getBestDomain(this.sourceType);
      baseUrl = currentDomain.domain_url;
    } catch (error) {
      // Fallback：域名管理器失败时使用默认URL
      baseUrl = 'https://luckysscai.com';
      logger.warn(`[LuckySscai] ⚠️ 域名管理器失败，使用fallback URL: ${baseUrl}`);
    }

    // 1. 先获取日期页面
    const dateUrl = `${baseUrl}/index.php?date=${date}`;
    logger.info(`[LuckySscai] 📄 请求日期页面: ${dateUrl}`);

    const datePageResponse = await axios.get(dateUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // 2. ⭐ 关键：先解析主页上直接显示的数据
    const mainPageRecords = this.parseHistoryHTML(datePageResponse.data);
    const mainPageTargetRecords = mainPageRecords.filter(r => {
      const drawTime = new Date(r.draw_time || r.drawTime);
      return drawTime >= startTime && drawTime <= endTime;
    });

    if (mainPageTargetRecords.length > 0) {
      records.push(...mainPageTargetRecords);
      logger.info(`[LuckySscai] 📋 主页显示 ${mainPageRecords.length} 期，其中目标时间范围内 ${mainPageTargetRecords.length} 期`);
    }

    // 3. 从HTML中提取"加载更多"的timestamp
    const $ = cheerio.load(datePageResponse.data);
    const scriptText = $('script').text();
    const timestampMatch = scriptText.match(/more_result\.php\?time=(\d+)/);

    if (!timestampMatch) {
      logger.warn(`[LuckySscai] 未找到timestamp，仅返回主页数据`);
      return records;
    }

    const baseTimestamp = parseInt(timestampMatch[1]);
    logger.info(`[LuckySscai] 📌 提取到timestamp: ${baseTimestamp}，继续加载更多数据`);

    // 3. 使用timestamp分批加载更多数据
    let currentTimestamp = baseTimestamp;
    const maxBatches = 15;  // 每个时间段最多加载15批（确保能获取完整数据）
    let batchCount = 0;
    let consecutiveEmptyBatches = 0;  // 连续空批次计数

    while (batchCount < maxBatches) {
      batchCount++;

      const moreUrl = `${baseUrl}/more_result.php?time=${currentTimestamp}`;
      logger.info(`[LuckySscai] 第${batchCount}批: time=${currentTimestamp}`);

      const moreResponse = await axios.get(moreUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const batchRecords = this.parseHistoryHTML(moreResponse.data);

      if (batchRecords.length === 0) {
        consecutiveEmptyBatches++;
        logger.info(`[LuckySscai] 第${batchCount}批无数据（连续${consecutiveEmptyBatches}批）`);
        if (consecutiveEmptyBatches >= 2) {
          logger.info(`[LuckySscai] 连续2批无数据，停止加载`);
          break;
        }
        // 即使无数据也继续往前查找
        currentTimestamp -= 3600;  // 往前推1小时
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      consecutiveEmptyBatches = 0;  // 重置连续空批次计数

      // 筛选出目标时间范围内的记录
      const targetRecords = batchRecords.filter(r => {
        const drawTime = new Date(r.draw_time || r.drawTime);
        return drawTime >= startTime && drawTime <= endTime;
      });

      const prevCount = records.length;
      records.push(...targetRecords);

      logger.info(`[LuckySscai] 第${batchCount}批: 获取${batchRecords.length}条，目标时间范围内${targetRecords.length}条，累计${records.length}条`);

      // 检查是否这批最早的记录远早于开始时间（超过1天）
      const earliestDrawTime = new Date(batchRecords[batchRecords.length - 1].draw_time);
      const oneDayBeforeStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);

      // 只有当以下条件都满足时才停止：
      // 1. 最早记录远早于开始时间（超过1天）
      // 2. 最近3批都没有获取到目标时间范围内的新数据
      if (earliestDrawTime < oneDayBeforeStart && targetRecords.length === 0) {
        logger.info(`[LuckySscai] 已加载到目标时间1天之前（${earliestDrawTime.toISOString()}），且本批无新数据，停止`);
        break;
      }

      // 使用这批最后一条记录的时间戳，继续加载更早的数据
      const lastRecord = batchRecords[batchRecords.length - 1];
      const lastDrawTime = lastRecord.draw_time || lastRecord.drawTime;
      const lastBeijingDate = new Date(lastDrawTime);
      const lastWebsiteDate = new Date(lastBeijingDate.getTime() - 7 * 60 * 60 * 1000);
      currentTimestamp = Math.floor(lastWebsiteDate.getTime() / 1000) - 60;

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return records;
  }

  /**
   * 解析历史数据HTML
   */
  parseHistoryHTML(html) {
    const $ = cheerio.load(html);
    const records = [];

    // 🎯 LuckySscai HTML结构: <thead>表头 <tbody>数据行
    const dataRows = $('tbody tr');

    if (dataRows.length === 0) {
      return records;  // 空数据，不需要警告
    }

    // 解析所有数据行（tbody中没有表头）
    dataRows.each((index, row) => {
        try {
          const $row = $(row);
          const cells = $row.find('td');

          if (cells.length < 3) {
            return; // 跳过格式不正确的行
          }

          // 第一列: 期号 (格式: "20251226- 008期")
          const periodText = cells.eq(0).text().trim();
          const periodMatch = periodText.match(/(\d{8})-?\s*(\d+)/);

          if (!periodMatch) {
            return; // 跳过无效期号
          }

          const period = `${periodMatch[1]}-${periodMatch[2]}`;

          // 第二列: 开奖时间 (格式: "12-25 17:40")
          let drawTime = cells.eq(1).text().trim();

          // 第三列: 开出号码 (在 .balls span 标签中)
          const numbersCell = cells.eq(2);
          const numberSpans = numbersCell.find('span');
          const numbers = [];

          if (numberSpans.length > 0) {
            numberSpans.each((i, span) => {
              const num = $(span).text().trim();
              if (num && /^\d+$/.test(num)) {
                numbers.push(num);
              }
            });
          }

          // 验证号码数量
          if (numbers.length !== 5) {
            logger.warn(`[LuckySscai] 期号${period}号码数量异常: ${numbers.length}个`);
            return;
          }

          // 🌍 时区转换：官网时间 -> 北京时间(+7小时)
          if (drawTime && drawTime.match(/^\d{2}-\d{2}\s+\d{2}:\d{2}$/)) {
            // 🔧 从期号中提取年份（解决跨年时年份错误问题）
            const yearFromPeriod = period ? parseInt(period.substring(0, 4)) : new Date().getFullYear();
            const [datePart, timePart] = drawTime.split(/\s+/);
            const [month, day] = datePart.split('-');
            const [hours, minutes] = timePart.split(':').map(n => parseInt(n));

            // 🔧 处理跨年情况：期号在1月，网站显示12月 -> 使用前一年
            // 例如：20260101-001期显示为"12-31 17:05"，应该是2025-12-31 17:05
            let yearForWebsite = yearFromPeriod;
            const periodMonth = parseInt(period.substring(4, 6));
            if (periodMonth === 1 && parseInt(month) === 12) {
              yearForWebsite = yearFromPeriod - 1;
              logger.debug(`[LuckySscai] 🔄 跨年检测: 期号=${period} (1月), 网站日期=${month}-${day} (12月) -> 使用年份=${yearForWebsite}`);
            }

            // 使用UTC时间构造，避免本地时区影响
            const websiteDate = new Date(Date.UTC(
              yearForWebsite,  // 使用调整后的年份
              parseInt(month) - 1,
              parseInt(day),
              hours,
              minutes,
              0
            ));

            // +7小时转换为北京时间
            const beijingDate = new Date(websiteDate.getTime() + 7 * 60 * 60 * 1000);

            // 格式化为 MySQL 时间格式
            const year = beijingDate.getUTCFullYear();
            const mon = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
            const d = String(beijingDate.getUTCDate()).padStart(2, '0');
            const h = String(beijingDate.getUTCHours()).padStart(2, '0');
            const m = String(beijingDate.getUTCMinutes()).padStart(2, '0');
            const s = String(beijingDate.getUTCSeconds()).padStart(2, '0');

            drawTime = `${year}-${mon}-${d} ${h}:${m}:${s}`;
          }

          records.push({
            issue: period,
            draw_code: numbers.join(','),
            drawCode: numbers.join(','),
            draw_time: drawTime,
            drawTime: drawTime,
            source: 'luckysscai_history'
          });

        } catch (err) {
          logger.warn(`[LuckySscai] 解析历史记录失败:`, err.message);
        }
      });

    return records;
  }
}

// 导出单例
export default new LuckySscaiScraper();
