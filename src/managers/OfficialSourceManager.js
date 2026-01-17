import logger from '../utils/Logger.js';
import fs from 'fs';
import path from 'path';
import speedyLot88Scraper from '../scrapers/SpeedyLot88Scraper.js';
import sgLotteriesScraper from '../scrapers/SGLotteriesScraper.js';
import auLuckyLotteriesScraper from '../scrapers/AULuckyLotteriesScraper.js';
import luckySscaiScraper from '../scrapers/LuckySscaiScraper.js';
import luckyLottozScraper from '../scrapers/LuckyLottozScraper.js';
import HKJCScraper from '../scrapers/HKJCScraper.js';
import SportsLotteryScraper from '../scrapers/SportsLotteryScraper.js';
import UKLottosScraper from '../scrapers/UKLottosScraper.js';
import taiwanLotteryScraper from '../scrapers/TaiwanLotteryScraper.js';
import cwlFreeScraper from '../scrapers/CWLFreeScraper.js'; // 导入单例实例
import lotteryConfigManager from './LotteryConfigManager.js';

// 创建爬虫实例
const hkjcScraper = new HKJCScraper();
const sportsLotteryScraper = new SportsLotteryScraper();
const ukLottosScraper = new UKLottosScraper();

/**
 * 官方数据源管理器
 *
 * 管理所有官方网站数据源（取代第三方API）
 * 核心理念：直接从官方开奖网站爬取数据，100%自主可控
 */
class OfficialSourceManager {
  constructor(lotteryConfigManager = null) {
    this.configFile = path.join(process.cwd(), 'data', 'official-sources.json');
    this.healthCheckInterval = 300000; // 5分钟检查一次
    this.healthCheckTimer = null;
    this.lotteryConfigManager = lotteryConfigManager; // 🎯 注入彩种配置管理器

    // 官方数据源配置
    this.sources = [
      {
        id: 'speedylot88',
        name: 'SpeedyLot88官网',
        url: 'https://speedylot88.com',
        scraper: 'SpeedyLot88Scraper',
        scraperInstance: speedyLot88Scraper,
        // 🎯 不再硬编码lotteries，改为从 LotteryConfigManager 动态读取
        // lotteries 会在运行时从 lottery-configs.json 中获取
        type: 'html_scraping',
        priority: 1, // 最高优先级
        status: 'healthy',
        updateInterval: 15, // 开奖前15秒
        enabled: true,
        description: '极速彩官方数据源，开奖前15秒即可获取数据',
        // 🎯 调度策略配置（默认值，彩种可以覆盖）
        schedulingStrategy: 'official_countdown', // 使用官网提供的倒计时
        drawInterval: 75, // 开奖间隔75秒（默认值，彩种可覆盖）
        countdownBehavior: 'wait_for_zero', // 倒计时为0时才开奖
        earlyFetch: 0, // 提前获取秒数（默认0，彩种可覆盖）
        // 统计信息
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      },
      {
        id: 'cwl',
        name: '中国福彩官网',
        url: 'https://api.apiose188.com',
        scraper: 'CWLFreeScraper',
        scraperInstance: cwlFreeScraper, // ✅ 使用 CWLFreeScraper 实例
        type: 'api_json',
        priority: 1, // 高优先级（免费稳定）
        status: 'healthy',
        updateInterval: 60, // 1分钟检查
        enabled: true, // ✅ 已启用
        description: '中国福彩免费API数据源（完全免费、无限制调用、支持智能自动补全）',
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      },
      {
        id: 'sportslottery',
        name: '中国体彩官网',
        url: 'https://webapi.sporttery.cn',
        scraper: 'SportsLotteryScraper',
        scraperInstance: sportsLotteryScraper,
        // 🎯 不再硬编码lotteries，改为从 LotteryConfigManager 动态读取
        type: 'api_json',
        priority: 1, // 高优先级
        status: 'healthy',
        updateInterval: 60, // 1分钟检查
        enabled: true, // ✅ 已启用
        description: '中国体育彩票官方API数据源（超级大乐透、排列3、排列5、七星彩）',
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      },
      {
        id: 'sglotteries',
        name: 'SG Lotteries官网',
        url: 'https://sglotteries.com',
        scraper: 'SGLotteriesScraper',
        scraperInstance: sgLotteriesScraper,
        // 🎯 不再硬编码lotteries，改为从 LotteryConfigManager 动态读取
        type: 'api_json',
        priority: 1, // 最高优先级
        status: 'healthy',
        updateInterval: 15, // 开奖前15秒
        enabled: true,
        description: 'SG彩官方数据源，支持6种SG彩种',
        // 🎯 调度策略配置（默认值，彩种可以覆盖）
        schedulingStrategy: 'calculated_countdown', // 根据开奖时间计算倒计时
        drawInterval: 300, // 开奖间隔300秒（5分钟，默认值）
        countdownBehavior: 'immediate_draw', // 倒计时结束立即显示号码
        earlyFetch: 22, // 🚀 SG彩种提前22秒获取数据（使我们的倒计时与官方一致）
        // 统计信息
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      },
      {
        id: 'auluckylotteries',
        name: 'AU Lucky Lotteries',
        url: 'http://auluckylotteries.com',
        scraper: 'AULuckyLotteriesScraper',
        scraperInstance: auLuckyLotteriesScraper,
        // 🎯 不再硬编码lotteries，改为从 LotteryConfigManager 动态读取
        type: 'html_scraping',
        priority: 1, // 最高优先级
        status: 'healthy',
        updateInterval: 15, // 开奖前15秒
        enabled: true,
        description: 'AU Lucky Lotteries官方数据源，支持4种Lucky Ball彩种',
        // 🎯 调度策略配置（默认值，彩种可以覆盖）
        schedulingStrategy: 'calculated_countdown', // 根据开奖时间计算倒计时（与SG Lotteries相同）
        drawInterval: 300, // 开奖间隔300秒（5分钟）
        countdownBehavior: 'immediate_draw', // 倒计时结束立即显示号码（基于unixtime实时计算）
        earlyFetch: 5, // 🚀 提前5秒获取数据（补偿爬取延迟，见AULuckyLotteriesScraper.js:282-284）
        // 统计信息
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      },
      {
        id: 'luckysscai',
        name: 'LuckySscai官网',
        url: 'https://luckysscai.com',
        scraper: 'LuckySscaiScraper',
        scraperInstance: luckySscaiScraper,
        // 🎯 不再硬编码lotteries，改为从 LotteryConfigManager 动态读取
        type: 'html_scraping',
        priority: 1, // 最高优先级
        status: 'healthy',
        updateInterval: 15, // 开奖前15秒
        enabled: true,
        description: 'LuckySscai官方数据源，幸运时时彩（早场10分钟/晚场5分钟）',
        // 🎯 调度策略配置（默认值，彩种可以覆盖）
        schedulingStrategy: 'official_countdown', // 使用官网提供的倒计时
        drawInterval: 300, // 开奖间隔300秒（仅供参考，实际使用官方API倒计时）
        // ⚠️ 幸运时时彩使用官方API实时倒计时，不使用wait_for_zero模式
        // countdownBehavior: 'use_official_api', // 直接使用官方API返回的倒计时
        earlyFetch: 0, // 无提前获取
        // 统计信息
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      },
      {
        id: 'luckylottoz',
        name: 'LuckyLottoz官网',
        url: 'https://luckylottoz.com',
        scraper: 'LuckyLottozScraper',
        scraperInstance: luckyLottozScraper,
        // 🎯 不再硬编码lotteries，改为从 LotteryConfigManager 动态读取
        type: 'api',
        priority: 1, // 最高优先级
        status: 'healthy',
        updateInterval: 15, // 开奖前15秒
        enabled: true,
        description: 'LuckyLottoz官方数据源，幸运飞艇（马耳他彩票，每5分钟一期）',
        // 🎯 调度策略配置
        schedulingStrategy: 'official_countdown', // 使用官网提供的倒计时
        drawInterval: 300, // 开奖间隔300秒（每5分钟）
        earlyFetch: 0, // 无提前获取
        // 统计信息
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      },
      {
        id: 'hkjc',
        name: 'On.cc 东网 (香港六合彩)',
        url: 'https://win.on.cc',
        scraper: 'HKJCScraper',
        scraperInstance: hkjcScraper,
        // 🎯 不再硬编码lotteries，改为从 LotteryConfigManager 动态读取
        type: 'api_json',
        priority: 1, // 最高优先级（官方源）
        status: 'healthy',
        updateInterval: 300, // 开奖前5分钟
        enabled: true,
        description: 'On.cc 东网提供香港六合彩官方数据（每周二、四、六晚9:30开奖）',
        // 🎯 调度策略配置
        schedulingStrategy: 'use_scraper_countdown', // ✅ 使用HKJCScraper计算的倒计时（基于实际开奖时间）
        drawInterval: 259200, // 开奖间隔约3天（仅供参考，实际使用scraper计算）
        // countdownBehavior: 已删除，使用scraper返回的countdown值
        earlyFetch: 0, // 无提前获取
        // 统计信息
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      },
      {
        id: 'uklottos',
        name: 'UK Lottos官网',
        url: 'https://www.uklottos.com',
        scraper: 'UKLottosScraper',
        scraperInstance: ukLottosScraper,
        // 🎯 不再硬编码lotteries，改为从 LotteryConfigManager 动态读取
        type: 'api_json',
        priority: 1, // 高优先级
        status: 'healthy',
        updateInterval: 15, // 15秒检查一次（高频彩）
        enabled: true,
        description: 'UK Lottos官方数据源（UK Lotto 5/8/10/20，每2.5分钟一期）',
        // 🎯 调度策略配置
        schedulingStrategy: 'calculated_countdown', // 根据开奖时间计算倒计时
        drawInterval: 150, // 开奖间隔150秒（2.5分钟）- 用户确认
        countdownBehavior: 'immediate_draw', // 倒计时结束立即显示号码
        earlyFetch: 23, // 🚀 提前23秒：调整后与第三方API保持同步（修复10秒差异）
        // 统计信息
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      },
      {
        id: 'taiwanlottery',
        name: '台湾彩票官网',
        url: 'https://www.taiwanlottery.com',
        scraper: 'TaiwanLotteryScraper',
        scraperInstance: taiwanLotteryScraper,
        // 🎯 不再硬编码lotteries，改为从 LotteryConfigManager 动态读取
        type: 'html_scraping',
        priority: 1, // 高优先级
        status: 'healthy',
        updateInterval: 3600, // 1小时检查一次（低频彩）
        enabled: true,
        description: '🇹🇼 台湾彩票官方数据源（威力彩、大乐透、今彩539、38樂合彩、3D、4D、宾果宾果）',
        // 🎯 调度策略配置
        schedulingStrategy: 'manual', // 手动触发或定时检查
        drawInterval: 86400, // 开奖间隔1天（部分彩种每周2次）
        countdownBehavior: 'manual', // 不使用倒计时
        earlyFetch: 0, // 无提前获取
        // 统计信息
        stats: {
          totalRequests: 0,
          successRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          lastCheck: null,
          lastSuccess: null,
          lastError: null
        }
      }
    ];

    this.loadConfig();
    logger.info('✅ 官方数据源管理器初始化完成');
  }

  /**
   * 加载配置（从文件读取统计信息、URL等可更新的配置）
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));

        // 合并统计信息和可配置项
        if (config.sources) {
          config.sources.forEach(savedSource => {
            const source = this.sources.find(s => s.id === savedSource.id);
            if (source) {
              // 统计信息
              source.stats = savedSource.stats || source.stats;
              source.enabled = savedSource.enabled !== undefined ? savedSource.enabled : source.enabled;
              source.status = savedSource.status || source.status;

              // 可配置的字段（域名变更时可修改）
              if (savedSource.url) source.url = savedSource.url;
              if (savedSource.name) source.name = savedSource.name;
              if (savedSource.description) source.description = savedSource.description;
              if (savedSource.priority !== undefined) source.priority = savedSource.priority;
              if (savedSource.updateInterval !== undefined) source.updateInterval = savedSource.updateInterval;
            }
          });
        }

        logger.info('✅ 官方数据源配置已加载（包括URL等可配置项）');
      }
    } catch (error) {
      logger.error('加载官方数据源配置失败:', error);
    }
  }

  /**
   * 保存配置（包括URL等可修改的字段）
   */
  saveConfig() {
    try {
      const dataDir = path.dirname(this.configFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const config = {
        version: '2.0', // 升级版本号，支持URL等配置
        lastUpdated: new Date().toISOString(),
        note: '域名变更时可修改url字段，修改后重启服务生效',
        sources: this.sources.map(s => ({
          id: s.id,
          name: s.name,
          url: s.url,
          description: s.description,
          priority: s.priority,
          updateInterval: s.updateInterval,
          enabled: s.enabled,
          status: s.status,
          stats: s.stats
        }))
      };

      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      logger.debug('✅ 官方数据源配置已保存（包括URL等可配置项）');
      return true;
    } catch (error) {
      logger.error('保存官方数据源配置失败:', error);
      return false;
    }
  }

  /**
   * 获取所有数据源
   */
  getSources() {
    return this.sources;
  }

  /**
   * 获取启用的数据源
   */
  getEnabledSources() {
    return this.sources.filter(s => s.enabled);
  }

  /**
   * 根据彩种代码获取数据源（包含彩种特定配置）
   * 🎯 动态从 LotteryConfigManager 获取彩种配置
   */
  getSourceForLottery(lotCode) {
    if (!this.lotteryConfigManager) {
      logger.warn('LotteryConfigManager未注入，无法获取彩种配置');
      return null;
    }

    // 🎯 从 LotteryConfigManager 获取彩种配置
    const lottery = this.lotteryConfigManager.getLottery(lotCode);
    if (!lottery) {
      logger.debug(`彩种 ${lotCode} 不存在于配置中`);
      return null;
    }

    // 根据彩种的 source 字段找到对应的数据源
    const source = this.sources.find(s => s.id === lottery.source && s.enabled);
    if (!source) {
      logger.warn(`彩种 ${lotCode} 的数据源 ${lottery.source} 未找到或未启用`);
      return null;
    }

    // 🚀 合并source配置和lottery特定配置（lottery优先）
    return {
      ...source,
      // 彩种特定配置优先，否则使用source默认值
      drawInterval: lottery.interval || source.drawInterval,
      earlyFetch: lottery.earlyFetch !== undefined ? lottery.earlyFetch : source.earlyFetch,
      countdownBehavior: lottery.countdownBehavior || source.countdownBehavior, // ✅ 支持彩种级别的倒计时策略
      schedulingStrategy: lottery.schedulingStrategy || source.schedulingStrategy, // ✅ 支持彩种级别的调度策略
      lotteryEndpoint: lottery.apiEndpoint || lottery.endpoint,
      lotteryName: lottery.name,
      scraperKey: lottery.scraperKey,
      historyEndpoint: lottery.historyEndpoint
    };
  }

  /**
   * 根据数据源ID获取数据源
   */
  getSourceById(sourceId) {
    return this.sources.find(s => s.id === sourceId);
  }

  /**
   * 启用/禁用数据源
   */
  toggleSource(sourceId, enabled) {
    const source = this.getSourceById(sourceId);
    if (source) {
      source.enabled = enabled;
      this.saveConfig();
      logger.info(`${enabled ? '✅ 启用' : '⏸️ 禁用'}官方数据源: ${source.name}`);
      return source;
    }
    return null;
  }

  /**
   * 更新数据源配置（用于域名变更等）
   * 允许更新的字段：url, name, description, priority, updateInterval
   */
  async updateSourceConfig(sourceId, updates) {
    const source = this.getSourceById(sourceId);
    if (!source) {
      return { success: false, error: '数据源不存在' };
    }

    // 只允许更新特定字段
    const allowedFields = ['url', 'name', 'description', 'priority', 'updateInterval'];
    const updatedFields = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        source[field] = updates[field];
        updatedFields.push(field);
      }
    }

    if (updatedFields.length === 0) {
      return { success: false, error: '没有可更新的字段' };
    }

    // 🔥 双向同步：数据源管理 → 域名管理（仅同步主域名）
    if (updates.url) {
      try {
        const cwlDomainManager = (await import('./CWLDomainManager.js')).default;
        const allDomains = await cwlDomainManager.getAllDomains();

        // 找到该数据源的主域名（source_type 匹配且 domain_type='primary'）
        const primaryDomain = allDomains.find(d =>
          d.source_type === sourceId && d.domain_type === 'primary'
        );

        if (primaryDomain) {
          // 只有URL真的不同时才更新
          if (primaryDomain.domain_url !== updates.url) {
            logger.info(`🔗 [同步] 数据源 ${sourceId} URL变更: ${primaryDomain.domain_url} → ${updates.url}`);

            await cwlDomainManager.updateDomain(primaryDomain.id, {
              domain_url: updates.url
            });

            logger.success(`✅ 已同步 ${sourceId} 主域名到域名管理 (ID=${primaryDomain.id})`);
          } else {
            logger.debug(`ℹ️ ${sourceId} 主域名URL未变化，跳过同步`);
          }
        } else {
          logger.debug(`ℹ️ 数据源 ${sourceId} 没有主域名记录，跳过同步`);
        }
      } catch (error) {
        logger.warn(`⚠️ 同步 ${sourceId} 域名到数据库失败，但数据源配置已更新`, error.message);
      }
    }

    this.saveConfig();
    logger.info(`✅ 更新官方数据源配置: ${source.name} (${updatedFields.join(', ')})`);

    return {
      success: true,
      message: `成功更新: ${updatedFields.join(', ')}`,
      updatedFields,
      source
    };
  }

  /**
   * 健康检查 - 单个数据源
   * 🎯 动态从 LotteryConfigManager 获取测试彩种
   */
  async checkSourceHealth(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) {
      return { success: false, error: '数据源不存在' };
    }

    if (!source.enabled) {
      return { success: false, error: '数据源未启用' };
    }

    if (!source.scraperInstance) {
      source.status = 'pending';
      return { success: false, error: '爬虫未实现' };
    }

    // 🎯 从 LotteryConfigManager 获取该数据源的彩种列表
    if (!this.lotteryConfigManager) {
      source.status = 'error';
      return { success: false, error: 'LotteryConfigManager未注入' };
    }

    const allLotteries = this.lotteryConfigManager.getAllLotteries();
    const sourceLotteries = allLotteries.filter(lot => lot.source === sourceId && lot.enabled);

    if (sourceLotteries.length === 0) {
      source.status = 'warning';
      logger.warn(`⚠️ [${source.name}] 没有启用的彩种`);
      return { success: false, error: '没有启用的彩种' };
    }

    const startTime = Date.now();
    source.stats.totalRequests++;
    source.stats.lastCheck = new Date().toISOString();

    try {
      // 测试第一个启用的彩种
      const testLottery = sourceLotteries[0];
      const testLotCode = this.getScraperLotCode(source.id, testLottery.lotCode);

      logger.info(`🏥 [${source.name}] 健康检查: ${testLottery.name}(${testLotCode})`);

      // 🚀 AU彩种需要传递apiEndpoint参数
      let data;
      if (sourceId === 'auluckylotteries') {
        const apiEndpoint = testLottery.apiEndpoint || testLottery.endpoint;
        data = await source.scraperInstance.fetchLatestData(testLotCode, apiEndpoint);
      } else {
        data = await source.scraperInstance.fetchLatestData(testLotCode);
      }

      const responseTime = Date.now() - startTime;

      if (data && data.period) {
        // 成功
        source.stats.successRequests++;
        source.stats.lastSuccess = new Date().toISOString();
        source.stats.lastError = null; // 🚀 清空历史错误

        // 更新平均响应时间
        const total = source.stats.successRequests;
        source.stats.avgResponseTime = Math.floor(
          (source.stats.avgResponseTime * (total - 1) + responseTime) / total
        );

        source.status = 'healthy';
        this.saveConfig();

        logger.success(`✅ [${source.name}] 健康检查通过 - ${responseTime}ms - 期号:${data.period}`);
        return {
          success: true,
          responseTime,
          data: {
            lottery: testLottery.name,
            period: data.period,
            numbers: data.opencode
          }
        };
      } else {
        // 数据无效
        source.stats.failedRequests++;
        source.stats.lastError = '数据格式错误';
        source.status = 'warning';
        this.saveConfig();

        logger.warn(`⚠️ [${source.name}] 数据格式错误`);
        return { success: false, error: '数据格式错误' };
      }
    } catch (error) {
      // 失败
      source.stats.failedRequests++;
      source.stats.lastError = error.message;
      source.status = 'error';
      this.saveConfig();

      logger.error(`❌ [${source.name}] 健康检查失败:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取爬虫使用的彩种代码
   * （某些爬虫使用简称，如 jspk10，需要转换）
   */
  getScraperLotCode(sourceId, lotCode) {
    if (sourceId === 'speedylot88') {
      // SpeedyLot88使用简称
      const mapping = {
        '10037': 'jspk10',   // 极速赛车
        '10035': 'jsft',     // 极速飞艇
        '10036': 'jssc',     // 极速时时彩
        '10052': 'jsk3',     // 极速快3
        '10053': 'jskl10',   // 极速快乐十分
        '10054': 'jskl8',    // 极速快乐8
        '10055': 'js11x5'    // 极速11选5
      };
      return mapping[lotCode] || lotCode;
    } else if (sourceId === 'sglotteries') {
      // SG Lotteries使用简称
      const mapping = {
        '20001': 'sgairship', // SG飞艇
        '20002': 'sg5d',      // SG 5D
        '20003': 'sgquick3',  // SG快3
        '20004': 'sghappy8',  // SG快乐8
        '20005': 'sghappy20', // SG快乐20
        '20006': 'sg11x5'     // SG 11选5
      };
      return mapping[lotCode] || lotCode;
    } else if (sourceId === 'luckysscai') {
      // LuckySscai使用简称
      const mapping = {
        '40001': 'xyssc'     // 幸运时时彩
      };
      return mapping[lotCode] || lotCode;
    } else if (sourceId === 'hkjc') {
      // HKJC使用简称
      const mapping = {
        '60001': 'hklhc'     // 香港六合彩
      };
      return mapping[lotCode] || lotCode;
    } else if (sourceId === 'cwl') {
      // CWL使用简称
      const mapping = {
        '70001': 'ssq',      // 福彩双色球
        '70002': 'fc3d',     // 福彩3D
        '70003': 'qlc',      // 福彩七乐彩
        '70004': 'kl8'       // 福彩快乐8
      };
      return mapping[lotCode] || lotCode;
    }
    return lotCode;
  }

  /**
   * 健康检查 - 所有数据源
   */
  async checkAllSourcesHealth() {
    logger.info('🏥 开始健康检查所有官方数据源...');

    const results = [];
    for (const source of this.sources) {
      if (source.enabled) {
        const result = await this.checkSourceHealth(source.id);
        results.push({
          sourceId: source.id,
          name: source.name,
          success: result.success,
          status: source.status,
          error: result.error
        });
      }
    }

    logger.info('✅ 官方数据源健康检查完成');
    return results;
  }

  /**
   * 启动自动健康检查
   */
  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // 立即执行一次
    setTimeout(() => this.checkAllSourcesHealth(), 5000);

    // 定期检查
    this.healthCheckTimer = setInterval(() => {
      this.checkAllSourcesHealth();
    }, this.healthCheckInterval);

    logger.info(`⏰ 官方数据源自动健康检查已启动（间隔: ${this.healthCheckInterval / 1000}秒）`);
  }

  /**
   * 停止自动健康检查
   */
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      logger.info('⏸️ 官方数据源自动健康检查已停止');
    }
  }

  /**
   * 获取统计信息
   * 🎯 动态从 LotteryConfigManager 计算彩种数量
   */
  getStats() {
    const total = this.sources.length;
    const enabled = this.sources.filter(s => s.enabled).length;
    const healthy = this.sources.filter(s => s.enabled && s.status === 'healthy').length;
    const pending = this.sources.filter(s => s.status === 'pending').length;

    // 🎯 从 LotteryConfigManager 获取所有彩种
    let allLotteries = [];
    if (this.lotteryConfigManager) {
      allLotteries = this.lotteryConfigManager.getAllLotteries();
    }

    // 计算每个数据源的彩种数量
    const getLotteriesCount = (sourceId, enabledOnly = false) => {
      return allLotteries.filter(lot => {
        const matchesSource = lot.source === sourceId;
        return enabledOnly ? matchesSource && lot.enabled : matchesSource;
      }).length;
    };

    // 计算覆盖的彩种数
    const totalLotteries = this.sources.reduce((sum, s) => sum + getLotteriesCount(s.id), 0);
    const enabledLotteries = this.sources
      .filter(s => s.enabled)
      .reduce((sum, s) => sum + getLotteriesCount(s.id, true), 0);

    return {
      sources: {
        total,
        enabled,
        healthy,
        pending,
        error: enabled - healthy - pending
      },
      lotteries: {
        total: totalLotteries,
        enabled: enabledLotteries,
        coverage: totalLotteries > 0
          ? ((enabledLotteries / totalLotteries) * 100).toFixed(2) + '%'
          : '0%'
      },
      details: this.sources.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        enabled: s.enabled,
        lotteriesCount: getLotteriesCount(s.id), // 🎯 动态计算
        successRate: s.stats.totalRequests > 0
          ? ((s.stats.successRequests / s.stats.totalRequests) * 100).toFixed(2) + '%'
          : '0%',
        avgResponseTime: s.stats.avgResponseTime + 'ms',
        lastCheck: s.stats.lastCheck,
        lastSuccess: s.stats.lastSuccess,
        lastError: s.stats.lastError
      }))
    };
  }

  /**
   * 获取彩种列表（按数据源分组）
   * 🎯 动态从 LotteryConfigManager 获取彩种
   */
  getLotteriesBySource() {
    if (!this.lotteryConfigManager) {
      logger.warn('LotteryConfigManager未注入，无法获取彩种列表');
      return [];
    }

    // 从 LotteryConfigManager 获取所有彩种
    const allLotteries = this.lotteryConfigManager.getAllLotteries();

    return this.sources.map(source => {
      // 筛选属于该数据源的彩种
      const sourceLotteries = allLotteries.filter(lot => lot.source === source.id);

      return {
        sourceId: source.id,
        sourceName: source.name,
        enabled: source.enabled,
        status: source.status,
        lotteries: sourceLotteries.map(lot => ({
          lotCode: lot.lotCode,
          name: lot.name,
          endpoint: lot.apiEndpoint || lot.endpoint,
          available: source.enabled && source.status === 'healthy'
        }))
      };
    });
  }
}

// 导出单例（注入 lotteryConfigManager 实现动态彩种配置）
export default new OfficialSourceManager(lotteryConfigManager);
