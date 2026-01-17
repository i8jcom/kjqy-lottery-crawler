import logger from '../utils/Logger.js';

/**
 * WebSocket性能监控器
 *
 * 功能：
 * 1. 连接数统计（当前、峰值、历史）
 * 2. 消息吞吐量（发送、接收）
 * 3. 订阅统计（热门彩种、订阅分布）
 * 4. 性能指标（延迟、错误率）
 * 5. 内存使用监控
 * 6. 限流和告警
 */
class WebSocketMonitor {
  constructor() {
    // 连接统计
    this.stats = {
      connections: {
        current: 0,           // 当前连接数
        peak: 0,              // 峰值连接数
        total: 0,             // 累计连接数
        disconnects: 0,       // 累计断开数
        rejected: 0           // 拒绝连接数（限流）
      },

      // 消息统计
      messages: {
        sent: 0,              // 发送消息数
        received: 0,          // 接收消息数
        errors: 0,            // 消息错误数
        byteSent: 0,          // 发送字节数
        byteReceived: 0       // 接收字节数
      },

      // 订阅统计
      subscriptions: {
        total: 0,             // 总订阅数
        unique: 0,            // 唯一彩种数
        hottest: [],          // 热门彩种
        distribution: {}      // 订阅分布
      },

      // 性能指标
      performance: {
        avgMessageDelay: 0,   // 平均消息延迟(ms)
        avgBroadcastTime: 0,  // 平均广播耗时(ms)
        errorRate: 0,         // 错误率
        uptime: 0             // 运行时长
      },

      // 内存使用
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        external: 0
      }
    };

    // 时间序列数据（最近1小时，每分钟一个点）
    this.timeSeries = {
      connections: new Array(60).fill(0),
      messagesPerMin: new Array(60).fill(0),
      errorsPerMin: new Array(60).fill(0),
      avgDelayPerMin: new Array(60).fill(0)
    };

    // 性能样本（用于计算平均值）
    this.performanceSamples = {
      messageDelays: [],      // 消息延迟样本（最多保留1000个）
      broadcastTimes: [],     // 广播耗时样本
      maxSamples: 1000
    };

    // 告警配置
    this.alerts = {
      maxConnections: 5000,        // 最大连接数告警阈值
      highErrorRate: 0.05,         // 高错误率告警（5%）
      highLatency: 1000,           // 高延迟告警（1秒）
      memoryThreshold: 0.9         // 内存使用告警（90%）
    };

    // 限流配置
    this.limits = {
      maxConnections: 10000,       // 硬限制：最大连接数
      maxSubscriptionsPerClient: 100,  // 单客户端最大订阅数
      maxMessagesPerMinute: 6000   // 每分钟最大消息数
    };

    // 开始时间
    this.startTime = Date.now();

    // 启动定时任务
    this.startPeriodicTasks();

    logger.info('📊 WebSocket性能监控器已启动');
  }

  /**
   * 记录新连接
   */
  recordConnection() {
    this.stats.connections.current++;
    this.stats.connections.total++;

    // 更新峰值
    if (this.stats.connections.current > this.stats.connections.peak) {
      this.stats.connections.peak = this.stats.connections.current;
      logger.info(`🔝 新的连接峰值: ${this.stats.connections.peak}`);
    }
  }

  /**
   * 记录断开连接
   */
  recordDisconnection() {
    this.stats.connections.current = Math.max(0, this.stats.connections.current - 1);
    this.stats.connections.disconnects++;
  }

  /**
   * 记录被拒绝的连接（限流）
   */
  recordRejectedConnection() {
    this.stats.connections.rejected++;
    logger.warn(`⚠️ 连接被拒绝（达到限流阈值）`);
  }

  /**
   * 记录发送消息
   */
  recordMessageSent(message) {
    this.stats.messages.sent++;

    const size = JSON.stringify(message).length;
    this.stats.messages.byteSent += size;
  }

  /**
   * 记录接收消息
   */
  recordMessageReceived(message) {
    this.stats.messages.received++;

    const size = JSON.stringify(message).length;
    this.stats.messages.byteReceived += size;
  }

  /**
   * 记录消息错误
   */
  recordMessageError() {
    this.stats.messages.errors++;
  }

  /**
   * 记录消息延迟
   */
  recordMessageDelay(delayMs) {
    this.performanceSamples.messageDelays.push(delayMs);

    // 限制样本数量
    if (this.performanceSamples.messageDelays.length > this.performanceSamples.maxSamples) {
      this.performanceSamples.messageDelays.shift();
    }

    // 更新平均延迟
    this.stats.performance.avgMessageDelay = this.calculateAverage(
      this.performanceSamples.messageDelays
    );

    // 高延迟告警
    if (delayMs > this.alerts.highLatency) {
      logger.warn(`⚠️ 检测到高延迟消息: ${delayMs}ms`);
    }
  }

  /**
   * 记录广播耗时
   */
  recordBroadcastTime(timeMs, subscriberCount) {
    this.performanceSamples.broadcastTimes.push(timeMs);

    // 限制样本数量
    if (this.performanceSamples.broadcastTimes.length > this.performanceSamples.maxSamples) {
      this.performanceSamples.broadcastTimes.shift();
    }

    // 更新平均广播时间
    this.stats.performance.avgBroadcastTime = this.calculateAverage(
      this.performanceSamples.broadcastTimes
    );

    // 性能告警（广播到100个客户端应该在100ms内完成）
    const expectedTime = subscriberCount * 1; // 每个客户端1ms
    if (timeMs > expectedTime * 2) {
      logger.warn(`⚠️ 广播性能下降: ${timeMs}ms for ${subscriberCount} clients`);
    }
  }

  /**
   * 更新订阅统计
   */
  updateSubscriptionStats(subscriptions) {
    this.stats.subscriptions.total = 0;
    this.stats.subscriptions.distribution = {};

    const lotteryCounts = {};

    // 统计每个彩种的订阅数
    subscriptions.forEach((subscribers, lotCode) => {
      const count = subscribers.size;
      this.stats.subscriptions.total += count;
      lotteryCounts[lotCode] = count;
      this.stats.subscriptions.distribution[lotCode] = count;
    });

    this.stats.subscriptions.unique = subscriptions.size;

    // 找出热门彩种（订阅数最多的前10个）
    this.stats.subscriptions.hottest = Object.entries(lotteryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([lotCode, count]) => ({ lotCode, subscribers: count }));
  }

  /**
   * 更新内存使用统计
   */
  updateMemoryStats() {
    const mem = process.memoryUsage();
    this.stats.memory = {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external
    };

    // 内存告警
    const usagePercent = mem.heapUsed / mem.heapTotal;
    if (usagePercent > this.alerts.memoryThreshold) {
      logger.warn(`⚠️ 内存使用率过高: ${(usagePercent * 100).toFixed(1)}%`);
    }
  }

  /**
   * 更新性能指标
   */
  updatePerformanceStats() {
    const totalMessages = this.stats.messages.sent + this.stats.messages.received;
    const totalErrors = this.stats.messages.errors;

    // 错误率
    this.stats.performance.errorRate = totalMessages > 0
      ? totalErrors / totalMessages
      : 0;

    // 运行时长
    this.stats.performance.uptime = Date.now() - this.startTime;

    // 高错误率告警
    if (this.stats.performance.errorRate > this.alerts.highErrorRate) {
      logger.warn(`⚠️ 错误率过高: ${(this.stats.performance.errorRate * 100).toFixed(2)}%`);
    }
  }

  /**
   * 检查是否可以接受新连接（限流）
   */
  canAcceptConnection() {
    return this.stats.connections.current < this.limits.maxConnections;
  }

  /**
   * 检查客户端订阅数是否超限
   */
  canSubscribe(currentSubscriptionCount) {
    return currentSubscriptionCount < this.limits.maxSubscriptionsPerClient;
  }

  /**
   * 获取实时统计数据
   */
  getStats() {
    return {
      ...this.stats,
      timeSeries: this.timeSeries,
      limits: this.limits,
      alerts: this.alerts
    };
  }

  /**
   * 获取详细监控报告
   */
  getDetailedReport() {
    const uptime = Date.now() - this.startTime;
    const uptimeHours = (uptime / 3600000).toFixed(2);

    return {
      summary: {
        uptime: uptime,
        uptimeHours: uptimeHours,
        currentConnections: this.stats.connections.current,
        peakConnections: this.stats.connections.peak,
        totalMessages: this.stats.messages.sent + this.stats.messages.received,
        errorRate: (this.stats.performance.errorRate * 100).toFixed(2) + '%',
        avgDelay: this.stats.performance.avgMessageDelay.toFixed(2) + 'ms',
        memoryUsage: (this.stats.memory.heapUsed / 1024 / 1024).toFixed(2) + 'MB'
      },
      connections: this.stats.connections,
      messages: {
        ...this.stats.messages,
        byteSentMB: (this.stats.messages.byteSent / 1024 / 1024).toFixed(2),
        byteReceivedMB: (this.stats.messages.byteReceived / 1024 / 1024).toFixed(2)
      },
      subscriptions: this.stats.subscriptions,
      performance: {
        ...this.stats.performance,
        uptimeHours: uptimeHours
      },
      memory: {
        heapUsedMB: (this.stats.memory.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMB: (this.stats.memory.heapTotal / 1024 / 1024).toFixed(2),
        rssMB: (this.stats.memory.rss / 1024 / 1024).toFixed(2),
        usagePercent: ((this.stats.memory.heapUsed / this.stats.memory.heapTotal) * 100).toFixed(1) + '%'
      },
      timeSeries: this.timeSeries
    };
  }

  /**
   * 计算平均值
   */
  calculateAverage(samples) {
    if (samples.length === 0) return 0;
    const sum = samples.reduce((acc, val) => acc + val, 0);
    return sum / samples.length;
  }

  /**
   * 启动定时任务
   */
  startPeriodicTasks() {
    // 每分钟更新时间序列数据
    setInterval(() => {
      // 记录当前分钟的数据
      this.timeSeries.connections.push(this.stats.connections.current);
      this.timeSeries.connections.shift();

      // 消息数（每分钟发送+接收）
      const totalMessages = this.stats.messages.sent + this.stats.messages.received;
      this.timeSeries.messagesPerMin.push(totalMessages);
      this.timeSeries.messagesPerMin.shift();

      // 错误数
      this.timeSeries.errorsPerMin.push(this.stats.messages.errors);
      this.timeSeries.errorsPerMin.shift();

      // 平均延迟
      this.timeSeries.avgDelayPerMin.push(this.stats.performance.avgMessageDelay);
      this.timeSeries.avgDelayPerMin.shift();

    }, 60000); // 每分钟

    // 每10秒更新性能统计
    setInterval(() => {
      this.updatePerformanceStats();
      this.updateMemoryStats();
    }, 10000);

    // 每5分钟输出监控报告
    setInterval(() => {
      const report = this.getDetailedReport();
      logger.info('📊 WebSocket监控报告:', {
        连接数: `${report.summary.currentConnections} / ${report.connections.peak}(峰值)`,
        总消息数: report.summary.totalMessages,
        错误率: report.summary.errorRate,
        平均延迟: report.summary.avgDelay,
        内存使用: report.summary.memoryUsage,
        运行时长: report.summary.uptimeHours + '小时'
      });
    }, 300000); // 5分钟
  }

  /**
   * 重置统计（用于测试）
   */
  reset() {
    this.stats.connections.total = 0;
    this.stats.connections.disconnects = 0;
    this.stats.connections.rejected = 0;
    this.stats.messages = {
      sent: 0,
      received: 0,
      errors: 0,
      byteSent: 0,
      byteReceived: 0
    };
    this.performanceSamples.messageDelays = [];
    this.performanceSamples.broadcastTimes = [];
    this.startTime = Date.now();

    logger.info('📊 监控统计已重置');
  }
}

export default WebSocketMonitor;
