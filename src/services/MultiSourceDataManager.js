import logger from '../utils/Logger.js';
import cacheService from './CacheService.js';
import speedyLot88Scraper from '../scrapers/SpeedyLot88Scraper.js';
import sgLotteriesScraper from '../scrapers/SGLotteriesScraper.js';
import auLuckyLotteriesScraper from '../scrapers/AULuckyLotteriesScraper.js';
import luckySscaiScraper from '../scrapers/LuckySscaiScraper.js';
import luckyLottozScraper from '../scrapers/LuckyLottozScraper.js';
import HKJCScraper from '../scrapers/HKJCScraper.js';
import cwlScraper from '../scrapers/CWLFreeScraper.js';
import SportsLotteryScraper from '../scrapers/SportsLotteryScraper.js';
import UKLottosScraper from '../scrapers/UKLottosScraper.js';
import taiwanLotteryScraper from '../scrapers/TaiwanLotteryScraper.js';
import taiwanBingoScraper from '../scrapers/TaiwanBingoScraper.js';
import taiwan39M5Scraper from '../scrapers/Taiwan39M5Scraper.js';
import taiwan49M6Scraper from '../scrapers/Taiwan49M6Scraper.js';
import lotteryConfigManager from '../managers/LotteryConfigManager.js';
import CountdownManager from '../web/CountdownManager.js';  // 🕐 倒计时管理器

// 创建HKJC爬虫实例
const hkjcScraper = new HKJCScraper();

// 创建体彩爬虫实例
const sportsLotteryScraper = new SportsLotteryScraper();

// 创建UK Lottos爬虫实例
const ukLottosScraper = new UKLottosScraper();

/**
 * 多数据源管理器 - 支持动态路由到不同数据源
 *
 * 架构说明：
 * - 根据彩种配置中的 source 字段，动态路由到对应的 Scraper
 * - 支持的数据源类型：
 *   1. speedylot88 - SpeedyLot88官网 HTML爬取（极速彩种）
 *   2. custom_api - 自定义API数据源（待实现）
 *   3. official_site - 官方彩票网站（待实现）
 *
 * 扩展方式：
 * 1. 在 src/scrapers/ 创建新的 Scraper 类
 * 2. 在 LotteryConfigManager 中添加彩种配置，指定 source 字段
 * 3. 在 fetchLotteryData() 中添加对应的路由逻辑
 * 4. 系统会自动统计各数据源的性能指标
 *
 * 详见: docs/ADD_NEW_DATASOURCE.md
 */
class MultiSourceDataManager {
  constructor() {
    // lotCode到彩种简称的映射由LotteryConfigManager统一管理
    // 保留此映射作为备用，实际使用lotteryConfigManager.getScraperKey()
    this.lotCodeMapping = {
      '10037': 'jspk10',   // 极速赛车 (SPEED10)
      '10035': 'jsft',     // 极速飞艇 (SB SPEED10)
      '10036': 'jssc',     // 极速时时彩 (SPEED5)
      '10052': 'jsk3',     // 极速快3 (SPEED3)
      '10053': 'jskl10',   // 极速快乐十分 (SPEED8)
      '10054': 'jskl8',    // 极速快乐8 (SPEED20)
      '10055': 'js11x5'    // 极速11选5 (SPEED11)
    };

    // 彩种数据源配置 - 100%官方数据源
    this.lotterySourceConfig = {
      // 极速彩种 - SpeedyLot88官方源
      'jspk10': {
        sources: [
          { type: 'speedylot88', priority: 1, timeout: 3000 }
        ],
        interval: 75000, // 75秒开奖周期
        description: '极速赛车'
      },
      'jssc': {
        sources: [
          { type: 'speedylot88', priority: 1, timeout: 3000 }
        ],
        interval: 75000,
        description: '极速时时彩'
      },
      'jsft': {
        sources: [
          { type: 'speedylot88', priority: 1, timeout: 3000 }
        ],
        interval: 75000,
        description: '极速飞艇'
      },
      'jsk3': {
        sources: [
          { type: 'speedylot88', priority: 1, timeout: 3000 }
        ],
        interval: 75000,
        description: '极速快3'
      },

      // 极速快乐十分 (SPEED8)
      'jskl10': {
        sources: [
          { type: 'speedylot88', priority: 1, timeout: 3000 }
        ],
        interval: 75000,
        description: '极速快乐十分'
      },

      // 极速快乐8 (SPEED20)
      'jskl8': {
        sources: [
          { type: 'speedylot88', priority: 1, timeout: 3000 }
        ],
        interval: 75000,
        description: '极速快乐8'
      },

      // 极速11选5 (SPEED11)
      'js11x5': {
        sources: [
          { type: 'speedylot88', priority: 1, timeout: 3000 }
        ],
        interval: 75000,
        description: '极速11选5'
      }

      // 🔥 第三方API已完全移除，系统100%使用官方数据源
      // 待开发的官方源：中国福彩官网、中国体彩官网
    };

    // 数据源健康状态
    this.sourceHealth = new Map();

    // 统计信息（动态支持多数据源）
    this.stats = {
      sources: {},  // 动态存储各个数据源的统计信息
      cacheHits: 0,
      totalRequests: 0
    };
  }

  /**
   * 获取彩票数据 - 主入口（支持多数据源）
   */
  async fetchLotteryData(lotCode, crawler168) {
    this.stats.totalRequests++;

    // 0. 从LotteryConfigManager获取彩种配置
    const lotteryConfig = lotteryConfigManager.getLottery(lotCode);

    if (!lotteryConfig || !lotteryConfig.enabled) {
      return {
        success: false,
        error: `彩种${lotCode}未启用或不存在`
      };
    }

    const source = lotteryConfig.source || 'speedylot88';  // 默认使用speedylot88
    const scraperKey = lotteryConfigManager.getScraperKey(lotCode);

    // 1. 尝试从缓存获取（高频彩跳过缓存，确保实时性）
    const isSpeedyLottery = this.isSpeedyLottery(scraperKey || lotCode);
    const isSGLottery = source === 'sglotteries' || lotCode.startsWith('200'); // SG彩种代码20001-20006
    const isAULottery = source === 'auluckylotteries' || lotCode.startsWith('30'); // 🚀 AU彩种代码30001-30006
    const isLuckySscai = source === 'luckysscai' || lotCode.startsWith('400'); // 🎲 LuckySscai彩种代码40001+
    const isLuckyLottoz = source === 'luckylottoz' || lotCode.startsWith('500'); // 🎯 LuckyLottoz彩种代码50001+
    const isCWL = source === 'cwl' || lotCode.startsWith('700'); // 🎲 中国福彩彩种代码70001+
    const cacheKey = `lottery:${lotCode}:latest`;

    if (!isSpeedyLottery && !isSGLottery && !isAULottery && !isLuckySscai && !isLuckyLottoz && !isCWL) {
      // 只有非高频彩种才使用缓存
      const cached = cacheService.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        logger.debug(`[MultiSource] 📦 使用缓存数据: ${lotCode} 第${cached.period || cached.issue}期`);
        return {
          success: true,
          data: cached,
          source: 'cache',
          fromCache: true
        };
      }
    }

    // 2. 根据数据源类型调用不同的scraper
    try {
      const startTime = Date.now();
      let result = null;

      if (source === 'speedylot88') {
        // SpeedyLot88官网数据源
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        result = await this.fetchFromSpeedyLot88(scraperKey, 3000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'sglotteries') {
        // SG Lotteries官网数据源
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        result = await this.fetchFromSGLotteries(scraperKey, 5000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'auluckylotteries') {
        // AU Lucky Lotteries官网数据源
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        // 传入 apiEndpoint，支持动态添加新彩种
        const apiEndpoint = lotteryConfig.apiEndpoint || `/results/lucky-ball-5/`;
        result = await this.fetchFromAULuckyLotteries(scraperKey, apiEndpoint, 5000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'luckysscai') {
        // LuckySscai官网数据源
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        result = await this.fetchFromLuckySscai(scraperKey, 5000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'luckylottoz') {
        // LuckyLottoz官网数据源（幸运飞艇）
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        result = await this.fetchFromLuckyLottoz(scraperKey, 8000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'hkjc') {
        // HKJC官网数据源（香港六合彩）
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        result = await this.fetchFromHKJC(scraperKey, 10000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'cwl') {
        // CWL中国福彩官网数据源（双色球、福彩3D、七乐彩、快乐8）
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        result = await this.fetchFromCWL(scraperKey, 10000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'sportslottery') {
        // 中国体彩官网数据源（超级大乐透、排列3、排列5、七星彩）
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        result = await this.fetchFromSportsLottery(lotCode, 10000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'uklottos') {
        // UK Lottos官网数据源（UK Lotto 5/8/10/20）
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        result = await this.fetchFromUKLottos(lotCode, 10000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'taiwanlottery') {
        // 🇹🇼 台湾彩票官网数据源（威力彩、大乐透、今彩539、38樂合彩、3D、4D）
        if (!scraperKey) {
          throw new Error(`彩种${lotCode}缺少scraperKey映射`);
        }
        // 🔧 传入原始 lotCode，而不是 scraperKey，这样 calculateCountdown 才能找到配置
        result = await this.fetchFromTaiwanLottery(lotCode, 10000);
        if (result && result.data) {
          result.data.lotCode = lotCode;
        }

      } else if (source === 'custom_api') {
        // 自定义API数据源
        const customScraper = (await import('../scrapers/CustomScraper.js')).default;
        const data = await customScraper.fetchLatestData(lotCode);
        result = {
          success: true,
          data: {
            lotCode: data.lotCode,
            period: data.period,
            issue: data.period,
            numbers: data.numbers,
            opencode: data.opencode,
            drawCode: data.opencode,
            drawTime: data.drawTime,
            timestamp: data.timestamp,
            source: 'custom_api'
          }
        };

      } else if (source === 'official_site') {
        // 其他官方网站数据源（待实现）
        throw new Error('官方网站数据源暂未实现');

      } else {
        throw new Error(`不支持的数据源类型: ${source}`);
      }

      const responseTime = Date.now() - startTime;

      if (result && result.success) {
        // 更新统计
        this.updateStats(source, true, responseTime);

        // 写入缓存（极速彩种、SG彩种、AU彩种、LuckySscai、LuckyLottoz、CWL不缓存，普通彩种5秒）
        if (!isSpeedyLottery && !isSGLottery && !isAULottery && !isLuckySscai && !isLuckyLottoz && !isCWL) {
          const cacheTTL = 5000;
          cacheService.set(cacheKey, result.data, cacheTTL);
        }

        // 🕐 更新CountdownManager倒计时（5000+客户端优化的核心集成点）
        // ✅ 扩展到所有彩种（不仅限于SG彩种）
        try {
          const countdownManager = CountdownManager.getInstance();
          if (countdownManager && result.data) {
            let countdown = result.data.officialCountdown || result.data.countdown || 0;
            const period = result.data.period || result.data.issue;
            const drawTime = result.data.drawTime;

            // 🎯 统一倒计时处理逻辑（适用于所有彩种）
            // 原理：
            // 1. 新期号检测：检查期号是否改变
            // 2. 新期号时：使用爬虫返回的倒计时值更新CountdownManager
            // 3. 同期号时：使用CountdownManager的tick递减值，避免覆盖
            const currentState = countdownManager.getState(lotCode);
            const isNewPeriod = !currentState || currentState.period !== period;

            if (isNewPeriod && countdown >= 0 && period && drawTime) {
              // 🆕 新期号：更新CountdownManager
              countdownManager.updateCountdown(lotCode, {
                officialCountdown: countdown,
                period: period,
                drawTime: drawTime
              });

              logger.info(
                `[MultiSource] 🆕 新期号！${lotteryConfig.name}(${lotCode}) ` +
                `期号:${period}, 倒计时:${countdown}秒 → CountdownManager已更新`
              );
            } else if (currentState && currentState.period === period) {
              // ⏭️ 同期号：使用CountdownManager的递减值，避免跳变
              countdown = currentState.countdown;
              result.data.officialCountdown = currentState.countdown;
              if (result.data.countdown !== undefined) {
                result.data.countdown = currentState.countdown;
              }

              logger.debug(
                `[MultiSource] ⏭️ 同期号 ${lotteryConfig.name}(${lotCode}) ` +
                `期号:${period}未变，使用CountdownManager值 ${currentState.countdown}秒`
              );
            } else if (!currentState && countdown >= 0) {
              // 🔄 CountdownManager无数据（首次启动）：初始化
              if (period && drawTime) {
                countdownManager.updateCountdown(lotCode, {
                  officialCountdown: countdown,
                  period: period,
                  drawTime: drawTime
                });

                logger.info(
                  `[MultiSource] 🔄 首次初始化 ${lotteryConfig.name}(${lotCode}) ` +
                  `期号:${period}, 倒计时:${countdown}秒`
                );
              }
            }
          }
        } catch (countdownError) {
          // CountdownManager错误不影响主流程
          logger.warn(`[MultiSource] ⚠️ 更新倒计时失败 ${lotCode}:`, countdownError.message);
        }

        logger.info(
          `[MultiSource] ✅ ${lotteryConfig.name}(${lotCode}) ` +
          `从 ${source} 获取成功 (${responseTime}ms)`
        );

        return {
          ...result,
          source: source,
          responseTime,
          fromCache: false
        };
      }

    } catch (error) {
      this.updateStats(source, false, 0);
      logger.error(
        `[MultiSource] ❌ ${source} 获取失败: ${lotCode} - ${error.message}`
      );
      return {
        success: false,
        error: `数据源${source}不可用: ${error.message}`,
        lotCode
      };
    }

    // 未获取到数据
    return {
      success: false,
      error: '所有数据源都不可用',
      lotCode
    };
  }

  /**
   * 从SpeedyLot88获取数据
   */
  async fetchFromSpeedyLot88(lotCode, timeout = 3000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SpeedyLot88请求超时')), timeout);
      });

      const dataPromise = speedyLot88Scraper.fetchLatestData(lotCode);

      const data = await Promise.race([dataPromise, timeoutPromise]);

      // 🔧 极速彩集成CountdownManager：消除倒计时跳变
      // 策略：只在新期号时更新CountdownManager，同期号时保留tick()递减值
      logger.info(`[DEBUG] fetchFromSpeedyLot88 lotCode=${lotCode}, period=${data.period}, countdown=${data.officialCountdown}`);
      try {
        const countdownManager = CountdownManager.getInstance();
        logger.info(`[DEBUG] CountdownManager instance: ${!!countdownManager}`);
        if (countdownManager && data.officialCountdown !== null && data.period && data.drawTime) {
          const currentState = countdownManager.getState(lotCode);
          const isNewPeriod = !currentState || currentState.period !== data.period;
          logger.info(`[DEBUG] currentState=${JSON.stringify(currentState)}, isNewPeriod=${isNewPeriod}`);

          if (isNewPeriod) {
            // 新期号：更新CountdownManager
            countdownManager.updateCountdown(lotCode, {
              officialCountdown: data.officialCountdown,
              period: data.period,
              drawTime: data.drawTime
            });

            logger.info(
              `[SpeedyLot88] 🕐 新期号！更新倒计时 ${lotCode} ` +
              `期号:${data.period}, 倒计时:${data.officialCountdown}秒`
            );
          } else {
            // 同期号：跳过更新，避免覆盖CountdownManager的递减值
            logger.info(
              `[SpeedyLot88] ⏭️ 跳过更新 ${lotCode} ` +
              `期号:${data.period}未变化，保持CountdownManager递减值 ${currentState.countdown}秒`
            );
          }
        }
      } catch (countdownError) {
        // CountdownManager错误不影响主流程
        logger.warn(`[SpeedyLot88] ⚠️ 更新倒计时失败 ${lotCode}:`, countdownError.message);
      }

      return {
        success: true,
        data: {
          lotCode: data.lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.numbers,
          opencode: data.opencode,
          drawCode: data.opencode,  // 统一字段名
          drawTime: data.drawTime,
          officialCountdown: data.officialCountdown,  // 🚀 官网实时倒计时
          timestamp: data.timestamp,
          source: 'speedylot88_html'
        }
      };

    } catch (error) {
      throw new Error(`SpeedyLot88失败: ${error.message}`);
    }
  }

  /**
   * 从 SG Lotteries 获取数据
   */
  async fetchFromSGLotteries(lotCode, timeout = 5000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('SG Lotteries请求超时')), timeout);
      });

      const dataPromise = sgLotteriesScraper.fetchLatestData(lotCode);

      const data = await Promise.race([dataPromise, timeoutPromise]);

      return {
        success: true,
        data: {
          lotCode: data.lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.numbers,
          opencode: data.opencode,
          drawCode: data.opencode,  // 统一字段名
          drawTime: data.drawTime,
          unixtime: data.unixtime,  // SG特有的Unix时间戳
          officialCountdown: data.officialCountdown,  // 🚀 智能倒计时（由CountdownCalculator计算）
          timestamp: data.timestamp,
          source: 'sglotteries_api'
        }
      };

    } catch (error) {
      throw new Error(`SG Lotteries失败: ${error.message}`);
    }
  }

  /**
   * 从AU Lucky Lotteries官网获取数据
   */
  async fetchFromAULuckyLotteries(lotCode, apiEndpoint, timeout = 5000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AU Lucky Lotteries请求超时')), timeout);
      });

      const dataPromise = auLuckyLotteriesScraper.fetchLatestData(lotCode, apiEndpoint);

      const data = await Promise.race([dataPromise, timeoutPromise]);

      return {
        success: true,
        data: {
          lotCode: data.lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.numbers,
          opencode: data.opencode,
          drawCode: data.opencode,  // 统一字段名
          drawTime: data.drawTime,
          unixtime: data.unixtime,  // 🚀 AU特有的Unix时间戳（用于WebServer实时计算倒计时）
          officialCountdown: data.officialCountdown,  // 官网倒计时
          timestamp: data.timestamp,
          source: 'auluckylotteries_html'
        }
      };

    } catch (error) {
      throw new Error(`AU Lucky Lotteries失败: ${error.message}`);
    }
  }

  /**
   * 从 LuckySscai 获取数据
   */
  async fetchFromLuckySscai(lotCode, timeout = 5000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('LuckySscai请求超时')), timeout);
      });

      const dataPromise = luckySscaiScraper.fetchLatestData(lotCode);

      const data = await Promise.race([dataPromise, timeoutPromise]);

      // 🎲 获取官方倒计时
      let officialCountdown = 0;
      try {
        const countdownData = await luckySscaiScraper.fetchCountdown(lotCode);
        if (countdownData && typeof countdownData === 'string') {
          // 解析倒计时格式 "MM:SS" -> 秒数
          const parts = countdownData.trim().split(':');
          if (parts.length === 2) {
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;
            officialCountdown = minutes * 60 + seconds;
            logger.debug(`[LuckySscai] 🕐 倒计时解析: ${countdownData} -> ${officialCountdown}秒`);
          }
        } else {
          logger.warn(`[LuckySscai] 倒计时数据无效: ${countdownData}`);
        }
      } catch (err) {
        logger.warn(`[LuckySscai] 获取倒计时失败: ${err.message}`);
      }

      return {
        success: true,
        data: {
          lotCode: data.lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.numbers,
          opencode: data.numbers.join(','),
          drawCode: data.numbers.join(','),  // 统一字段名
          drawTime: data.drawTime,
          timestamp: new Date(data.drawTime).getTime(),
          officialCountdown: officialCountdown,  // 🎲 官方倒计时（秒）
          source: 'luckysscai_html'
        }
      };

    } catch (error) {
      throw new Error(`LuckySscai失败: ${error.message}`);
    }
  }

  /**
   * 从 LuckyLottoz 获取数据（幸运飞艇）
   */
  async fetchFromLuckyLottoz(lotCode, timeout = 8000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('LuckyLottoz请求超时')), timeout);
      });

      const dataPromise = luckyLottozScraper.fetchLatestData();

      const data = await Promise.race([dataPromise, timeoutPromise]);

      return {
        success: true,
        data: {
          lotCode: data.lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.numbers,
          opencode: data.opencode,
          drawCode: data.opencode,  // 统一字段名
          drawTime: data.drawTime,
          timestamp: data.timestamp,
          officialCountdown: data.officialCountdown,  // 🎯 官方倒计时（从API计算）
          source: 'luckylottoz_api'
        }
      };

    } catch (error) {
      throw new Error(`LuckyLottoz失败: ${error.message}`);
    }
  }

  /**
   * 从HKJC获取数据（香港六合彩）
   */
  async fetchFromHKJC(lotCode, timeout = 10000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('HKJC请求超时')), timeout);
      });

      const dataPromise = hkjcScraper.fetchLatestData(lotCode);

      const data = await Promise.race([dataPromise, timeoutPromise]);

      return {
        success: true,
        data: {
          lotCode: data.lotCode || lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.opencode ? data.opencode.split(',') : [],
          opencode: data.extra
            ? `${data.opencode},${data.extra}`  // 🎯 如果有特别号，添加到opencode末尾
            : data.opencode,
          drawCode: data.extra
            ? `${data.opencode},${data.extra}`  // 🎯 统一字段名，包含特别号
            : data.opencode,
          drawTime: data.opentime,
          timestamp: data.opentime ? new Date(data.opentime).getTime() : Date.now(),
          officialCountdown: data.countdown,  // 🎯 官方倒计时（计算得出）
          extra: data.extra,  // 特别号（保留原始字段）
          source: 'hkjc_official'
        }
      };

    } catch (error) {
      throw new Error(`HKJC失败: ${error.message}`);
    }
  }

  /**
   * 从CWL获取数据（中国福彩：双色球、福彩3D、七乐彩、快乐8）
   *
   * 数据源：第三方免费API (3650062.com/api)
   * - 完全免费，无限制调用
   * - 动态域名管理，自动故障转移
   * - 成功率 99.83%
   */
  async fetchFromCWL(lotCode, timeout = 10000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('CWL请求超时')), timeout);
      });

      const dataPromise = cwlScraper.fetchLatestData(lotCode);

      const data = await Promise.race([dataPromise, timeoutPromise]);

      return {
        success: true,
        data: {
          lotCode: data.lotCode || lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.numbers,
          opencode: data.opencode,
          drawCode: data.opencode,  // 统一字段名
          drawTime: data.opentime,
          timestamp: data.opentime ? new Date(data.opentime).getTime() : Date.now(),
          officialCountdown: data.countdown,  // 🎯 基于规则计算的倒计时
          source: 'cwl_free_api'
        }
      };

    } catch (error) {
      throw new Error(`CWL失败: ${error.message}`);
    }
  }

  /**
   * 从中国体彩官网获取数据
   * @param {string} lotCode - 彩种代码
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<Object>} 标准化的数据对象
   */
  async fetchFromSportsLottery(lotCode, timeout = 10000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('体彩官网请求超时')), timeout);
      });

      const dataPromise = sportsLotteryScraper.fetchLatestData(lotCode);

      const data = await Promise.race([dataPromise, timeoutPromise]);

      return {
        success: true,
        data: {
          lotCode: data.lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.numbers,
          opencode: data.opencode,
          drawCode: data.drawCode,  // 统一字段名
          drawTime: data.drawTime,
          timestamp: data.timestamp,
          officialCountdown: data.officialCountdown,  // 🎯 基于规则计算的倒计时
          source: 'sportslottery_official'
        }
      };

    } catch (error) {
      throw new Error(`体彩官网失败: ${error.message}`);
    }
  }

  /**
   * 从UK Lottos官网获取数据
   * @param {string} lotCode - 彩种代码 (90001-90004)
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<Object>} 开奖数据
   */
  async fetchFromUKLottos(lotCode, timeout = 10000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('UK Lottos官网请求超时')), timeout);
      });

      const dataPromise = ukLottosScraper.fetchLatestData(lotCode);

      const data = await Promise.race([dataPromise, timeoutPromise]);

      return {
        success: true,
        data: {
          lotCode: data.lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.numbers,
          opencode: data.opencode,
          drawCode: data.drawCode,  // 统一字段名
          drawTime: data.drawTime,
          timestamp: data.timestamp,
          unixtime: data.unixtime,  // ⭐ 用于自动校准
          officialCountdown: data.officialCountdown,  // 基于开奖时间计算的倒计时
          source: 'uklottos_official'
        }
      };

    } catch (error) {
      throw new Error(`UK Lottos官网失败: ${error.message}`);
    }
  }

  /**
   * 从台湾彩票官网获取数据
   * 🇹🇼 数据源: https://www.taiwanlottery.com
   * 支持：威力彩、大乐透、今彩539、3D、4D、宾果宾果
   */
  async fetchFromTaiwanLottery(lotCode, timeout = 10000) {
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('台湾彩票官网请求超时')), timeout);
      });

      // 🎯 根据彩种选择对应的爬虫
      // 宾果宾果(100007)使用专用爬虫，39选5(100008)使用专用爬虫，49选6(100009)使用专用爬虫，其他台湾彩使用通用爬虫
      let scraper;
      if (lotCode === '100007') {
        scraper = taiwanBingoScraper;
      } else if (lotCode === '100008') {
        scraper = taiwan39M5Scraper;
      } else if (lotCode === '100009') {
        scraper = taiwan49M6Scraper;
      } else {
        scraper = taiwanLotteryScraper;
      }
      const dataPromise = scraper.fetchLatestData(lotCode);

      const data = await Promise.race([dataPromise, timeoutPromise]);

      // 🎯 台湾彩票：使用 drawSchedule 配置实时计算倒计时
      let calculatedCountdown = data.officialCountdown || 0;
      const lotteryConfig = lotteryConfigManager.getLottery(lotCode);

      // 🎯 模式1: interval模式（如台湾宾果，基于官方drawTime计算）
      if (lotteryConfig?.drawSchedule?.mode === 'interval') {
        const intervalSeconds = lotteryConfig.drawSchedule.intervalSeconds || 300;

        // 如果有官方drawTime，基于它计算下一期开奖时间
        if (data.drawTime) {
          try {
            const lastDrawTime = new Date(data.drawTime);
            const now = new Date();
            // 🎯 台湾宾果特殊处理：实际开奖完成时间 = 预定时间 + 50秒
            // 官方dDate是预定开奖时间（如16:35:00），但号码实际在16:35:50才出现
            const drawDelaySeconds = (lotCode === '100007') ? 50 : 0;  // 台湾宾果加50秒延迟
            const nextDrawTime = new Date(lastDrawTime.getTime() + (intervalSeconds + drawDelaySeconds) * 1000);

            // 🎯 计算倒计时（如果下期开奖时间已过，返回0，前端显示"开奖中"）
            const rawCountdown = Math.max(0, Math.floor((nextDrawTime.getTime() - now.getTime()) / 1000));

            // 🎯 interval模式彩种倒计时保护
            // 特殊处理：幸运飞艇（50001）使用60秒阈值，其他使用10秒阈值
            const threshold = (lotCode === '50001') ? 60 : 10;
            if (rawCountdown <= threshold) {
              calculatedCountdown = 0;
              logger.debug(`[Interval] ${lotCode} 倒计时≤${threshold}秒(${rawCountdown}秒)，返回0等待新期号`);
            } else {
              calculatedCountdown = rawCountdown;
              logger.debug(`[Interval] ${lotCode} 倒计时: ${calculatedCountdown}秒 (上期: ${lastDrawTime.toLocaleTimeString('zh-CN')}, 下期: ${nextDrawTime.toLocaleTimeString('zh-CN')})`);
            }
          } catch (error) {
            logger.error(`[TaiwanLottery] ${lotCode} 解析drawTime失败:`, error.message);
            calculatedCountdown = data.officialCountdown || 0;
          }
        } else {
          // 如果没有drawTime，使用scraper返回的倒计时
          calculatedCountdown = data.officialCountdown || 0;
        }
      }
      // 🎯 模式2: scheduled模式（如台湾威力彩，每周固定时间）
      else if (lotteryConfig?.drawSchedule?.mode === 'scheduled') {
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

          const rawCountdown = Math.max(0, Math.floor((nextDrawTime.getTime() - now.getTime()) / 1000));

          // 🎯 官方彩种特殊处理：倒计时≤60秒时返回0，避免刷新时看到短暂倒计时
          // 适用于：台湾彩种（1000XX）、福彩（700XX）、体彩（800XX）、香港六合彩（60001）、幸运飞艇（50001）
          // scheduled模式的官方彩种开奖后号码也需要时间出现
          // 给60秒缓冲时间，确保用户体验统一（显示"开奖中"而不是短暂的倒计时）
          const isOfficialLottery = lotCode.startsWith('1000') ||
                                   lotCode.startsWith('700') ||
                                   lotCode.startsWith('800') ||
                                   lotCode === '60001' ||  // 香港六合彩
                                   lotCode === '50001';    // 幸运飞艇
          if (isOfficialLottery && rawCountdown <= 60) {
            calculatedCountdown = 0;
            logger.debug(`[Scheduled] ${lotCode} 倒计时≤60秒(${rawCountdown}秒)，返回0等待新期号`);
          } else {
            calculatedCountdown = rawCountdown;
            logger.debug(`[Scheduled] ${lotCode} 倒计时: ${calculatedCountdown}秒 (下次开奖: ${nextDrawTime.toLocaleString('zh-CN')})`);
          }
        }
      }

      return {
        success: true,
        data: {
          lotCode: data.lotCode,
          period: data.period,
          issue: data.period,  // 兼容性字段
          numbers: data.numbers,
          mainNumbers: data.mainNumbers,  // 主号码区
          specialNumbers: data.specialNumbers,  // 特别号区
          opencode: data.opencode,
          drawCode: data.opencode,  // 统一字段名
          drawTime: data.drawTime,
          drawDate: data.drawDate,
          timestamp: data.timestamp,
          officialCountdown: calculatedCountdown,  // 🎯 倒计时（基于 drawSchedule 实时计算）
          source: 'taiwanlottery_html',
          lotteryName: data.lotteryName
        }
      };

    } catch (error) {
      throw new Error(`台湾彩票官网失败: ${error.message}`);
    }
  }

  // ✅ fetchFrom168API方法已移除 - 系统100%使用官方数据源

  /**
   * 更新数据源统计（动态支持多数据源）
   */
  updateStats(sourceType, success, responseTime) {
    // 动态初始化数据源统计
    if (!this.stats.sources[sourceType]) {
      this.stats.sources[sourceType] = { success: 0, failure: 0, avgResponseTime: 0 };
    }

    const stats = this.stats.sources[sourceType];

    if (success) {
      stats.success++;
      // 计算平均响应时间
      const totalRequests = stats.success + stats.failure;
      stats.avgResponseTime =
        (stats.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    } else {
      stats.failure++;
    }

    // 更新健康状态
    const successRate = stats.success / (stats.success + stats.failure);
    this.sourceHealth.set(sourceType, {
      healthy: successRate > 0.5,
      successRate: (successRate * 100).toFixed(2) + '%',
      avgResponseTime: Math.round(stats.avgResponseTime) + 'ms',
      lastUpdate: new Date()
    });
  }

  /**
   * 获取统计信息（支持动态多数据源）
   */
  getStats() {
    const cacheStats = cacheService.getStats();

    // 动态构建所有数据源的统计信息
    const sourcesStats = {};
    for (const [sourceType, stats] of Object.entries(this.stats.sources)) {
      sourcesStats[sourceType] = {
        ...stats,
        successRate: (
          stats.success / (stats.success + stats.failure || 1) * 100
        ).toFixed(2) + '%',
        avgResponseTime: Math.round(stats.avgResponseTime) + 'ms'
      };
    }

    return {
      sources: sourcesStats,
      cache: cacheStats,
      totalRequests: this.stats.totalRequests,
      cacheHitRate: (
        this.stats.cacheHits / (this.stats.totalRequests || 1) * 100
      ).toFixed(2) + '%',
      sourceHealth: Object.fromEntries(this.sourceHealth)
    };
  }

  /**
   * 检查数据源健康状态
   */
  async checkSourcesHealth() {
    const results = {};

    // 检查SpeedyLot88
    try {
      const healthy = await speedyLot88Scraper.checkHealth();
      results.speedylot88 = {
        healthy,
        message: healthy ? '服务正常' : '服务不可用'
      };
    } catch (error) {
      results.speedylot88 = {
        healthy: false,
        message: error.message
      };
    }

    return results;
  }

  /**
   * 获取彩种配置
   */
  getLotteryConfig(lotCode) {
    return this.lotterySourceConfig[lotCode] || null;
  }

  /**
   * 是否为极速彩种
   */
  isSpeedyLottery(lotCode) {
    return lotCode.startsWith('js') && this.lotterySourceConfig[lotCode];
  }

  /**
   * 清除缓存
   */
  clearCache(lotCode = null) {
    if (lotCode) {
      cacheService.delete(`lottery:${lotCode}:latest`);
      logger.info(`[MultiSource] 清除 ${lotCode} 缓存`);
    } else {
      cacheService.clear();
      logger.info('[MultiSource] 清除所有缓存');
    }
  }
}

// 导出单例
export default new MultiSourceDataManager();
