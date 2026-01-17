/**
 * 爬虫配置 - 彩种列表和爬取策略
 *
 * 🎯 100%官方数据源系统
 * ✅ 只保留SpeedyLot88官方源支持的7个极速彩种
 */

// 彩种配置（与主系统的 lottery-configs.json 同步）
export const lotteryConfigs = [
  // 极速系列（75秒一期）- SpeedyLot88官方数据源
  { lotCode: '10037', name: '极速赛车', interval: 75, priority: 'high', source: 'speedylot88' },
  { lotCode: '10035', name: '极速飞艇', interval: 75, priority: 'high', source: 'speedylot88' },
  { lotCode: '10036', name: '极速时时彩', interval: 75, priority: 'high', source: 'speedylot88' },
  { lotCode: '10052', name: '极速快3', interval: 75, priority: 'high', source: 'speedylot88' },
  { lotCode: '10053', name: '极速快乐十分', interval: 75, priority: 'high', source: 'speedylot88' },
  { lotCode: '10054', name: '极速快乐8', interval: 75, priority: 'high', source: 'speedylot88' },
  { lotCode: '10055', name: '极速11选5', interval: 75, priority: 'high', source: 'speedylot88' }
];

// 爬取策略配置
export const crawlStrategies = {
  // 高频彩种：每个周期爬取1次
  high: {
    realtimeInterval: 75,  // 75秒爬取一次
    historyInterval: 3600, // 1小时爬取一次历史数据
    retryOnFailure: true
  },

  // 中频彩种：每个周期爬取1次
  medium: {
    realtimeInterval: 300, // 5分钟爬取一次
    historyInterval: 7200, // 2小时爬取一次历史数据
    retryOnFailure: true
  },

  // 低频彩种：每小时检查一次
  low: {
    realtimeInterval: 3600, // 1小时爬取一次
    historyInterval: 86400, // 1天爬取一次历史数据
    retryOnFailure: false
  }
};

// 监控配置
export const monitoringConfig = {
  // 健康检查间隔（5分钟）
  healthCheckInterval: 300000,

  // 统计报告间隔（30分钟）
  statsReportInterval: 1800000,

  // 数据新鲜度阈值（分钟）
  dataFreshnessThreshold: 10,

  // 告警阈值
  alertThresholds: {
    consecutiveFailures: 5,
    successRateBelow: 80
  }
};
