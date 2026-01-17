import fs from 'fs';
import path from 'path';
import logger from '../utils/Logger.js';

/**
 * 彩种配置管理器 - 管理彩种及其端点配置
 */
class LotteryConfigManager {
  constructor() {
    this.configFile = path.join(process.cwd(), 'data', 'lottery-configs.json');
    this.lotteries = [];
    this.endpointMap = new Map();
    this.loadConfigs();
  }

  /**
   * 加载彩种配置
   */
  loadConfigs() {
    try {
      // 确保 data 目录存在
      const dataDir = path.dirname(this.configFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // 读取配置文件
      if (fs.existsSync(this.configFile)) {
        const content = fs.readFileSync(this.configFile, 'utf-8');
        const config = JSON.parse(content);
        this.lotteries = config.lotteries || [];
        this.endpointMap = new Map(Object.entries(config.endpointMap || {}));
        this.lotCodeToScraperKey = config.lotCodeToScraperKey
          ? new Map(Object.entries(config.lotCodeToScraperKey))
          : new Map();
        logger.debug(`加载了 ${this.lotteries.length} 个彩种配置`);
      } else {
        // 创建默认配置
        this.initDefaultConfigs();
        this.saveConfigs();
      }
    } catch (error) {
      logger.error('加载彩种配置失败', error);
      this.initDefaultConfigs();
    }
  }

  /**
   * 初始化默认配置
   */
  initDefaultConfigs() {
    // SpeedyLot88官方数据源彩种（7个极速彩种）
    this.lotteries = [
      {
        lotCode: '10037',
        name: '极速赛车',
        interval: 75,
        priority: 'high',
        endpoint: 'speedylot88',
        apiEndpoint: 'speedy10-result.php',
        historyEndpoint: 'speedy10-result.php',
        enabled: true,
        source: 'speedylot88',
        description: 'SpeedyLot88官方数据源'
      },
      {
        lotCode: '10035',
        name: '极速飞艇',
        interval: 75,
        priority: 'high',
        endpoint: 'speedylot88',
        apiEndpoint: 'sbspeedy10-result.php',
        historyEndpoint: 'sbspeedy10-result.php',
        enabled: true,
        source: 'speedylot88',
        description: 'SpeedyLot88官方数据源'
      },
      {
        lotCode: '10036',
        name: '极速时时彩',
        interval: 75,
        priority: 'high',
        endpoint: 'speedylot88',
        apiEndpoint: 'speedy5-result.php',
        historyEndpoint: 'speedy5-result.php',
        enabled: true,
        source: 'speedylot88',
        description: 'SpeedyLot88官方数据源'
      },
      {
        lotCode: '10052',
        name: '极速快3',
        interval: 75,
        priority: 'high',
        endpoint: 'speedylot88',
        apiEndpoint: 'speedy3-result.php',
        historyEndpoint: 'speedy3-result.php',
        enabled: true,
        source: 'speedylot88',
        description: 'SpeedyLot88官方数据源'
      },
      {
        lotCode: '10053',
        name: '极速快乐十分',
        interval: 75,
        priority: 'high',
        endpoint: 'speedylot88',
        apiEndpoint: 'speedy8-result.php',
        historyEndpoint: 'speedy8-result.php',
        enabled: true,
        source: 'speedylot88',
        description: 'SpeedyLot88官方数据源'
      },
      {
        lotCode: '10054',
        name: '极速快乐8',
        interval: 75,
        priority: 'high',
        endpoint: 'speedylot88',
        apiEndpoint: 'speedy20-result.php',
        historyEndpoint: 'speedy20-result.php',
        enabled: true,
        source: 'speedylot88',
        description: 'SpeedyLot88官方数据源'
      },
      {
        lotCode: '10055',
        name: '极速11选5',
        interval: 75,
        priority: 'high',
        endpoint: 'speedylot88',
        apiEndpoint: 'speedy11-result.php',
        historyEndpoint: 'speedy11-result.php',
        enabled: true,
        source: 'speedylot88',
        description: 'SpeedyLot88官方数据源'
      },

      // SG Lotteries官方数据源彩种（6个SG彩种）
      {
        lotCode: '20001',
        name: 'SG飞艇',
        interval: 75,
        priority: 'high',
        endpoint: 'sglotteries',
        apiEndpoint: '/api/result/load-ft.php',
        historyEndpoint: '/api/result/load-ft.php',
        enabled: true,
        source: 'sglotteries',
        description: 'SG Lotteries官方数据源 - 10个号码'
      },
      {
        lotCode: '20002',
        name: 'SG 5D',
        interval: 75,
        priority: 'high',
        endpoint: 'sglotteries',
        apiEndpoint: '/api/result/load-5d.php',
        historyEndpoint: '/api/result/load-5d.php',
        enabled: true,
        source: 'sglotteries',
        description: 'SG Lotteries官方数据源 - 5个号码'
      },
      {
        lotCode: '20003',
        name: 'SG快3',
        interval: 75,
        priority: 'high',
        endpoint: 'sglotteries',
        apiEndpoint: '/api/result/load-quick3.php',
        historyEndpoint: '/api/result/load-quick3.php',
        enabled: true,
        source: 'sglotteries',
        description: 'SG Lotteries官方数据源 - 3个号码'
      },
      {
        lotCode: '20004',
        name: 'SG快乐8',
        interval: 75,
        priority: 'high',
        endpoint: 'sglotteries',
        apiEndpoint: '/api/result/load-happy8.php',
        historyEndpoint: '/api/result/load-happy8.php',
        enabled: true,
        source: 'sglotteries',
        description: 'SG Lotteries官方数据源 - 8个号码'
      },
      {
        lotCode: '20005',
        name: 'SG快乐20',
        interval: 75,
        priority: 'high',
        endpoint: 'sglotteries',
        apiEndpoint: '/api/result/load-happy20.php',
        historyEndpoint: '/api/result/load-happy20.php',
        enabled: true,
        source: 'sglotteries',
        description: 'SG Lotteries官方数据源 - 20个号码'
      },
      {
        lotCode: '20006',
        name: 'SG 11选5',
        interval: 75,
        priority: 'high',
        endpoint: 'sglotteries',
        apiEndpoint: '/api/result/load-11x5.php',
        historyEndpoint: '/api/result/load-11x5.php',
        enabled: true,
        source: 'sglotteries',
        description: 'SG Lotteries官方数据源 - 5个号码'
      }
    ];

    // 端点配置映射
    this.endpointMap = new Map([
      ['speedylot88', {
        baseUrl: 'https://speedylot88.com',
        method: 'html_scraping',
        description: 'SpeedyLot88官方HTML爬取'
      }],
      ['sglotteries', {
        baseUrl: 'https://sglotteries.com',
        method: 'api_json',
        description: 'SG Lotteries官方API'
      }]
    ]);

    // lotCode到scraper key的映射
    this.lotCodeToScraperKey = new Map([
      // SpeedyLot88极速彩种
      ['10037', 'jspk10'],    // 极速赛车
      ['10035', 'jsft'],      // 极速飞艇
      ['10036', 'jssc'],      // 极速时时彩
      ['10052', 'jsk3'],      // 极速快3
      ['10053', 'jskl10'],    // 极速快乐十分
      ['10054', 'jskl8'],     // 极速快乐8
      ['10055', 'js11x5'],    // 极速11选5

      // SG Lotteries彩种
      ['20001', 'sgairship'], // SG飞艇
      ['20002', 'sg5d'],      // SG 5D
      ['20003', 'sgquick3'],  // SG快3
      ['20004', 'sghappy8'],  // SG快乐8
      ['20005', 'sghappy20'], // SG快乐20
      ['20006', 'sg11x5']     // SG 11选5
    ]);
  }

  /**
   * 保存配置
   */
  saveConfigs() {
    try {
      const config = {
        lotteries: this.lotteries,
        endpointMap: Object.fromEntries(this.endpointMap),
        lotCodeToScraperKey: Object.fromEntries(this.lotCodeToScraperKey || new Map()),
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf-8');
      logger.debug('彩种配置已保存');
      return true;
    } catch (error) {
      logger.error('保存彩种配置失败', error);
      return false;
    }
  }

  /**
   * 获取所有彩种配置
   */
  getAllLotteries() {
    // 返回彩种配置时，自动附加scraperKey（如果存在）
    return this.lotteries.map(lottery => {
      const scraperKey = this.lotCodeToScraperKey?.get(lottery.lotCode);
      return scraperKey ? { ...lottery, scraperKey } : lottery;
    });
  }

  /**
   * 获取已启用的彩种
   */
  getEnabledLotteries() {
    return this.lotteries.filter(lot => lot.enabled);
  }

  /**
   * 获取单个彩种配置
   */
  getLottery(lotCode) {
    const lottery = this.lotteries.find(lot => lot.lotCode === lotCode);
    if (!lottery) return null;

    // 自动附加scraperKey（如果存在）
    const scraperKey = this.lotCodeToScraperKey?.get(lotCode);
    return scraperKey ? { ...lottery, scraperKey } : lottery;
  }

  /**
   * 添加彩种
   */
  addLottery(lottery) {
    // 检查是否已存在
    const exists = this.lotteries.find(lot => lot.lotCode === lottery.lotCode);
    if (exists) {
      logger.warn(`彩种已存在: ${lottery.lotCode}`);
      return false;
    }

    // 添加默认字段（支持多数据源架构）
    const newLottery = {
      lotCode: lottery.lotCode,
      name: lottery.name,
      interval: lottery.interval || 300,
      priority: lottery.priority || 'medium',
      endpoint: lottery.endpoint || 'speedylot88',
      source: lottery.source || 'speedylot88',
      enabled: lottery.enabled !== false,
      description: lottery.description || ''
    };

    // 需要scraperKey的数据源（SpeedyLot88, SG Lotteries, AU Lucky Lotteries）
    const needsScraperKey = ['speedylot88', 'sglotteries', 'auluckylotteries'];
    if (needsScraperKey.includes(lottery.source) && lottery.scraperKey) {
      newLottery.scraperKey = lottery.scraperKey;
      newLottery.apiEndpoint = lottery.apiEndpoint || '';
      newLottery.historyEndpoint = lottery.historyEndpoint || lottery.apiEndpoint || '';

      // 更新lotCodeToScraperKey映射
      if (!this.lotCodeToScraperKey) {
        this.lotCodeToScraperKey = new Map();
      }
      this.lotCodeToScraperKey.set(lottery.lotCode, lottery.scraperKey);
      logger.info(`映射scraperKey: ${lottery.lotCode} -> ${lottery.scraperKey}`);
    }

    // 自定义API特定字段
    if (lottery.source === 'custom_api') {
      newLottery.customApiUrl = lottery.customApiUrl || '';
      newLottery.customApiKey = lottery.customApiKey || '';
    }

    this.lotteries.push(newLottery);
    this.saveConfigs();
    logger.info(`彩种已添加: ${newLottery.name} (${newLottery.lotCode}) [数据源: ${newLottery.source}]`);
    return newLottery;
  }

  /**
   * 更新彩种
   */
  updateLottery(lotCode, updates) {
    const lottery = this.lotteries.find(lot => lot.lotCode === lotCode);
    if (!lottery) {
      logger.warn(`彩种不存在: ${lotCode}`);
      return false;
    }

    // 更新字段
    Object.assign(lottery, updates);

    // 如果更新了需要scraperKey的数据源，同步更新映射
    const needsScraperKey = ['speedylot88', 'sglotteries', 'auluckylotteries'];
    if (needsScraperKey.includes(lottery.source) && updates.scraperKey) {
      if (!this.lotCodeToScraperKey) {
        this.lotCodeToScraperKey = new Map();
      }
      this.lotCodeToScraperKey.set(lotCode, updates.scraperKey);
      logger.info(`更新scraperKey映射: ${lotCode} -> ${updates.scraperKey}`);
    }

    // 如果数据源改为不需要scraperKey的类型，移除映射
    if (updates.source && !needsScraperKey.includes(updates.source) && this.lotCodeToScraperKey?.has(lotCode)) {
      this.lotCodeToScraperKey.delete(lotCode);
      logger.info(`移除scraperKey映射: ${lotCode}`);
    }

    this.saveConfigs();
    logger.info(`彩种已更新: ${lottery.name} (${lotCode}) [数据源: ${lottery.source}]`);
    return lottery;
  }

  /**
   * 删除彩种
   */
  deleteLottery(lotCode) {
    const index = this.lotteries.findIndex(lot => lot.lotCode === lotCode);
    if (index === -1) {
      logger.warn(`彩种不存在: ${lotCode}`);
      return false;
    }

    const lottery = this.lotteries[index];
    this.lotteries.splice(index, 1);

    // 如果彩种有scraperKey映射，同时移除
    if (this.lotCodeToScraperKey?.has(lotCode)) {
      this.lotCodeToScraperKey.delete(lotCode);
      logger.info(`移除scraperKey映射: ${lotCode}`);
    }

    this.saveConfigs();
    logger.info(`彩种已删除: ${lottery.name} (${lotCode})`);
    return true;
  }

  /**
   * 切换彩种启用状态
   */
  toggleLottery(lotCode, enabled) {
    return this.updateLottery(lotCode, { enabled });
  }

  /**
   * 获取端点配置
   */
  getEndpointConfig(endpointType) {
    return this.endpointMap.get(endpointType);
  }

  /**
   * 更新端点配置
   */
  updateEndpointConfig(endpointType, config) {
    this.endpointMap.set(endpointType, config);
    this.saveConfigs();
    logger.info(`端点配置已更新: ${endpointType}`);
    return true;
  }

  /**
   * 获取所有端点配置
   */
  getAllEndpointConfigs() {
    return Object.fromEntries(this.endpointMap);
  }

  /**
   * 获取scraper key（用于SpeedyLot88）
   */
  getScraperKey(lotCode) {
    return this.lotCodeToScraperKey?.get(lotCode) || null;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const total = this.lotteries.length;
    const enabled = this.lotteries.filter(lot => lot.enabled).length;
    const byPriority = {
      high: this.lotteries.filter(lot => lot.priority === 'high').length,
      medium: this.lotteries.filter(lot => lot.priority === 'medium').length,
      low: this.lotteries.filter(lot => lot.priority === 'low').length
    };
    const byEndpoint = {};
    this.lotteries.forEach(lot => {
      byEndpoint[lot.endpoint] = (byEndpoint[lot.endpoint] || 0) + 1;
    });

    return {
      total,
      enabled,
      disabled: total - enabled,
      byPriority,
      byEndpoint
    };
  }
}

export default new LotteryConfigManager();
