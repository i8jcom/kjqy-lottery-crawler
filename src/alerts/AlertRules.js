/**
 * 告警规则定义
 */

/**
 * 爬取失败告警规则
 */
export const crawlFailureRule = {
  name: '爬取失败告警',
  level: 'error',
  enabled: true,
  notifiers: ['all'],
  // 条件：当调度器运行中且失败次数大于0时触发
  condition: (context) => {
    const { scheduler } = context;
    return scheduler.isRunning && scheduler.failedCrawls > 0;
  },
  message: (context) => {
    const { scheduler } = context;
    return `检测到爬取失败！失败次数: ${scheduler.failedCrawls}/${scheduler.totalCrawls}，成功率: ${scheduler.successRate}`;
  }
};

/**
 * 连续爬取失败告警规则
 */
export const continuousFailureRule = {
  name: '连续爬取失败告警',
  level: 'critical',
  enabled: true,
  notifiers: ['all'],
  // 条件：最近5次爬取都失败
  condition: (context) => {
    const { recentCrawls } = context;
    if (!recentCrawls || recentCrawls.length < 5) return false;
    const recent5 = recentCrawls.slice(0, 5);
    return recent5.every(c => !c.success);
  },
  message: (context) => {
    return `严重告警：连续5次爬取失败！请立即检查系统状态和数据源健康状况。`;
  }
};

/**
 * 数据源异常告警规则
 */
export const dataSourceErrorRule = {
  name: '数据源异常告警',
  level: 'warning',
  enabled: true,
  notifiers: ['all'],
  // 条件：数据源健康状况异常
  condition: (context) => {
    const { dataSources } = context;
    if (!dataSources || dataSources.length === 0) return false;
    // Check both healthy field and status field
    return dataSources.some(source => {
      return (source.healthy === false) ||
             (source.status === 'error') ||
             (source.status === 'warning') ||
             (source.status === 'unhealthy');
    });
  },
  message: (context) => {
    const { dataSources } = context;
    // Filter unhealthy sources using same logic as condition
    const unhealthy = dataSources.filter(s => {
      return (s.healthy === false) ||
             (s.status === 'error') ||
             (s.status === 'warning') ||
             (s.status === 'unhealthy');
    });

    const statusInfo = unhealthy.map(s => {
      const errCount = s.consecutiveFailures || s.errors || 0;
      const status = s.status || 'unknown';
      return `${s.name}(状态:${status}, 错误数:${errCount})`;
    }).join('; ');

    return `数据源异常：${statusInfo}`;
  }
};

/**
 * 数据库连接失败告警规则
 */
export const databaseErrorRule = {
  name: '数据库连接失败告警',
  level: 'critical',
  enabled: true,
  notifiers: ['all'],
  condition: (context) => {
    const { database } = context;
    return database && !database.connected;
  },
  message: (context) => {
    const { database } = context;
    return `数据库连接失败！错误信息: ${database.error || '未知错误'}`;
  }
};

/**
 * 缺失数据检测告警规则
 */
export const missingDataRule = {
  name: '缺失数据检测告警',
  level: 'warning',
  enabled: true,
  notifiers: ['all'],
  checkInterval: 3600000, // 每小时检查一次
  condition: (context) => {
    const { missingDates } = context;
    return missingDates && missingDates.length > 0;
  },
  message: (context) => {
    const { missingDates, lotCode, lotName } = context;
    return `${lotName} (${lotCode}) 检测到缺失数据！缺失日期: ${missingDates.join(', ')}。建议使用自动回填功能补全数据。`;
  }
};

/**
 * 系统性能告警规则
 */
export const performanceWarningRule = {
  name: '系统性能告警',
  level: 'warning',
  enabled: false, // 默认禁用，需要手动启用
  notifiers: ['all'],
  checkInterval: 300000, // 每5分钟检查一次
  condition: (context) => {
    const { cpu, memory } = context;
    return (cpu && cpu.usage > 80) || (memory && memory.usage > 90);
  },
  message: (context) => {
    const { cpu, memory } = context;
    return `系统性能告警！CPU使用率: ${cpu?.usage}%，内存使用率: ${memory?.usage}%`;
  }
};

/**
 * 调度器停止告警规则
 */
export const schedulerStoppedRule = {
  name: '调度器停止告警',
  level: 'error',
  enabled: true,
  notifiers: ['all'],
  condition: (context) => {
    const { scheduler, autoCrawlEnabled } = context;
    // 如果启用了自动爬取，但调度器未运行，则告警
    return autoCrawlEnabled && scheduler && !scheduler.isRunning;
  },
  message: (context) => {
    return `调度器已停止运行！自动爬取功能已启用但调度器未运行，请检查系统状态。`;
  }
};

/**
 * 爬取成功率低告警规则
 */
export const lowSuccessRateRule = {
  name: '爬取成功率低告警',
  level: 'warning',
  enabled: true,
  notifiers: ['all'],
  condition: (context) => {
    const { scheduler } = context;
    if (!scheduler || scheduler.totalCrawls < 10) return false;
    const successRate = (scheduler.successfulCrawls / scheduler.totalCrawls) * 100;
    return successRate < 80; // 成功率低于80%
  },
  message: (context) => {
    const { scheduler } = context;
    return `爬取成功率较低！当前成功率: ${scheduler.successRate}，成功次数: ${scheduler.successfulCrawls}/${scheduler.totalCrawls}`;
  }
};

/**
 * 彩种停更告警规则
 * 检测彩种超过10分钟没有新数据（考虑销售时间）
 */
export const lotteryStoppedUpdatingRule = {
  name: '彩种停更告警',
  level: 'error',
  enabled: true,
  notifiers: ['all'],
  checkInterval: 120000, // 每2分钟检查一次
  condition: (context) => {
    const { lotteryUpdateStatus } = context;
    if (!lotteryUpdateStatus || lotteryUpdateStatus.length === 0) return false;

    // 检查是否有彩种超过阈值时间没更新
    const now = Date.now();
    const stoppedLotteries = lotteryUpdateStatus.filter(lottery => {
      // 🕐 检查是否在销售时间内
      if (lottery.salesDayStart && lottery.salesDayEnd) {
        if (!isInSalesTime(lottery.salesDayStart, lottery.salesDayEnd)) {
          return false; // 不在销售时间内，不报警
        }
      }

      // 🎯 智能告警：根据彩种类型和倒计时判断告警阈值
      const isLowFrequencyLottery = lottery.tags && lottery.tags.includes('低频彩');
      const hasLongCountdown = lottery.countdown && lottery.countdown > 600; // 倒计时>10分钟
      const isNotDrawDay = lottery.countdown === -1; // 倒计时为-1表示非开奖日

      // 低频彩（如香港六合彩）：如果倒计时>10分钟 或 非开奖日，不报警
      // 只在倒计时<10分钟时才检测停更，避免误报
      if (isLowFrequencyLottery && (hasLongCountdown || isNotDrawDay)) {
        return false;
      }

      const timeSinceLastUpdate = now - (lottery.lastUpdateTime || 0);
      return timeSinceLastUpdate > 10 * 60 * 1000; // 10分钟
    });

    return stoppedLotteries.length > 0;
  },
  message: (context) => {
    const { lotteryUpdateStatus } = context;
    const now = Date.now();
    const stoppedLotteries = lotteryUpdateStatus.filter(lottery => {
      // 🕐 检查是否在销售时间内
      if (lottery.salesDayStart && lottery.salesDayEnd) {
        if (!isInSalesTime(lottery.salesDayStart, lottery.salesDayEnd)) {
          return false;
        }
      }

      // 🎯 智能告警：根据彩种类型和倒计时判断告警阈值
      const isLowFrequencyLottery = lottery.tags && lottery.tags.includes('低频彩');
      const hasLongCountdown = lottery.countdown && lottery.countdown > 600; // 倒计时>10分钟
      const isNotDrawDay = lottery.countdown === -1; // 倒计时为-1表示非开奖日

      // 低频彩（如香港六合彩）：如果倒计时>10分钟 或 非开奖日，不报警
      // 只在倒计时<10分钟时才检测停更，避免误报
      if (isLowFrequencyLottery && (hasLongCountdown || isNotDrawDay)) {
        return false;
      }

      const timeSinceLastUpdate = now - (lottery.lastUpdateTime || 0);
      return timeSinceLastUpdate > 10 * 60 * 1000;
    });

    const lotteryNames = stoppedLotteries.map(l => {
      const minutes = Math.floor((now - l.lastUpdateTime) / 60000);
      return `${l.name}(${minutes}分钟未更新)`;
    }).join(', ');

    return `检测到彩种停更！以下彩种超过10分钟没有新数据: ${lotteryNames}。请检查数据源是否正常。`;
  }
};

/**
 * 检查当前时间是否在销售时间内
 * @param {string} startTime - 格式 "HH:MM"
 * @param {string} endTime - 格式 "HH:MM"
 */
function isInSalesTime(startTime, endTime) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // 跨日情况（如13:09到次日04:04）
  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  // 同日情况
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * 期号连续性检测告警规则
 * 检测期号是否有跳跃（缺失数据）
 */
export const periodContinuityRule = {
  name: '期号不连续告警',
  level: 'warning',
  enabled: true,
  notifiers: ['all'],
  checkInterval: 300000, // 每5分钟检查一次
  condition: (context) => {
    const { periodGaps } = context;
    return periodGaps && periodGaps.length > 0;
  },
  message: (context) => {
    const { periodGaps } = context;
    const gapInfo = periodGaps.map(gap =>
      `${gap.name}(期号从${gap.lastPeriod}跳到${gap.currentPeriod}，缺失${gap.gapSize}期)`
    ).join('; ');

    return `检测到期号不连续！${gapInfo}。建议使用历史数据回填功能补全缺失数据。`;
  }
};

/**
 * 倒计时异常告警规则
 * 检测倒计时是否有异常跳跃
 */
export const countdownAnomalyRule = {
  name: '倒计时异常告警',
  level: 'warning',
  enabled: true,
  notifiers: ['all'],
  condition: (context) => {
    const { countdownAnomalies } = context;
    return countdownAnomalies && countdownAnomalies.length > 0;
  },
  message: (context) => {
    const { countdownAnomalies } = context;
    const anomalyInfo = countdownAnomalies.map(a =>
      `${a.name}(倒计时从${a.previousCountdown}秒跳到${a.currentCountdown}秒)`
    ).join('; ');

    return `检测到倒计时异常！${anomalyInfo}。这可能表明数据源时间不准确或网络延迟。`;
  }
};

/**
 * 数据源连续失败告警规则
 * 检测单个数据源是否连续失败多次
 */
export const dataSourceConsecutiveFailureRule = {
  name: '数据源连续失败告警',
  level: 'critical',
  enabled: true,
  notifiers: ['all'],
  checkInterval: 180000, // 每3分钟检查一次
  condition: (context) => {
    const { dataSources } = context;
    if (!dataSources || dataSources.length === 0) return false;

    // 检查是否有数据源连续失败超过5次
    return dataSources.some(source =>
      (source.consecutiveFailures || 0) >= 5
    );
  },
  message: (context) => {
    const { dataSources } = context;
    const failingSources = dataSources.filter(s =>
      (s.consecutiveFailures || 0) >= 5
    );

    const sourceInfo = failingSources.map(s =>
      `${s.name}(连续失败${s.consecutiveFailures}次)`
    ).join('; ');

    return `严重告警：数据源连续失败！${sourceInfo}。请立即检查数据源健康状况和网络连接。`;
  }
};

/**
 * 默认告警规则集
 */
export const defaultRules = {
  'crawl-failure': crawlFailureRule,
  'continuous-failure': continuousFailureRule,
  'datasource-error': dataSourceErrorRule,
  'database-error': databaseErrorRule,
  'missing-data': missingDataRule,
  'performance-warning': performanceWarningRule,
  'scheduler-stopped': schedulerStoppedRule,
  'low-success-rate': lowSuccessRateRule,
  'lottery-stopped-updating': lotteryStoppedUpdatingRule,
  'period-continuity': periodContinuityRule,
  'countdown-anomaly': countdownAnomalyRule,
  'datasource-consecutive-failure': dataSourceConsecutiveFailureRule
};
