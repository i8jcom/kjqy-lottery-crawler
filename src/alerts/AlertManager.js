import logger from '../utils/Logger.js';

/**
 * 告警管理器
 * 负责统一管理各类告警和通知
 */
class AlertManager {
  constructor() {
    this.notifiers = new Map(); // 通知渠道
    this.alertHistory = []; // 告警历史
    this.alertRules = new Map(); // 告警规则
    this.suppressionMap = new Map(); // 告警抑制（防止刷屏）
    this.aggregationMap = new Map(); // 告警聚合统计
    this.config = {
      enabled: true,
      suppressionTime: 300000, // 5分钟内相同告警只发一次
      maxHistorySize: 1000, // 最多保存1000条历史
      enableAggregation: true, // 启用告警聚合
      aggregationSummaryInterval: 600000, // 每10分钟发送一次聚合汇总
      // 分级通知机制配置
      tieredNotifications: {
        critical: ['email', 'dingtalk', 'wechat'], // 严重告警：所有渠道
        error: ['email', 'dingtalk'], // 错误告警：邮件+钉钉
        warning: ['dingtalk'], // 警告告警：仅钉钉
        info: [] // 信息告警：仅记录，不发送
      }
    };

    // 定期发送聚合汇总
    this.aggregationTimer = setInterval(() => {
      this.sendAggregationSummary();
    }, this.config.aggregationSummaryInterval);
  }

  /**
   * 注册通知渠道
   */
  registerNotifier(name, notifier) {
    this.notifiers.set(name, notifier);
    logger.info(`📢 注册告警通知渠道: ${name}`);
  }

  /**
   * 添加告警规则
   */
  addRule(ruleId, rule) {
    this.alertRules.set(ruleId, {
      id: ruleId,
      name: rule.name,
      level: rule.level || 'warning', // info, warning, error, critical
      enabled: rule.enabled !== false,
      notifiers: rule.notifiers || ['all'], // 使用哪些通知渠道
      checkInterval: rule.checkInterval || 60000, // 检查间隔
      condition: rule.condition, // 触发条件函数
      message: rule.message, // 告警消息模板
      lastCheck: null,
      lastAlert: null
    });
    logger.info(`📋 添加告警规则: ${ruleId} - ${rule.name}`);
  }

  /**
   * 发送告警
   */
  async sendAlert(alert) {
    if (!this.config.enabled) {
      logger.debug('告警系统已禁用，跳过发送');
      return;
    }

    const {
      level = 'warning',
      title,
      message,
      data = {},
      notifiers = ['all']
    } = alert;

    // 检查是否在抑制期内
    const suppressionKey = `${level}:${title}`;
    if (this.isInSuppression(suppressionKey)) {
      // 📊 告警聚合：记录被抑制的告警次数
      if (this.config.enableAggregation) {
        this.recordSuppressedAlert(suppressionKey, {
          level,
          title,
          message,
          timestamp: new Date()
        });
      }
      logger.debug(`告警在抑制期内，已聚合: ${title}`);
      return;
    }

    // 记录到历史
    const alertRecord = {
      id: Date.now(),
      timestamp: new Date(),
      level,
      title,
      message,
      data,
      notifiers
    };
    this.addToHistory(alertRecord);

    // 添加到抑制列表
    this.suppressionMap.set(suppressionKey, Date.now());

    // 🎯 分级通知机制：根据告警级别选择合适的通知渠道
    let targetNotifiers;
    if (notifiers.includes('all')) {
      // 如果指定了'all'，则使用分级配置
      targetNotifiers = this.config.tieredNotifications[level] || [];
      if (targetNotifiers.length === 0) {
        // 如果级别对应的通知渠道为空（如info级别），仅记录不发送
        logger.info(`📝 ${level}级别告警仅记录: ${title}`);
        return;
      }
    } else {
      // 如果明确指定了通知渠道，则使用指定的
      targetNotifiers = notifiers;
    }

    const promises = targetNotifiers.map(async (notifierName) => {
      const notifier = this.notifiers.get(notifierName);
      if (!notifier || !notifier.enabled) {
        return;
      }

      try {
        await notifier.send({
          level,
          title,
          message,
          data,
          timestamp: alertRecord.timestamp
        });
        logger.info(`✅ 告警已发送 [${notifierName}]: ${title}`);
      } catch (error) {
        logger.error(`❌ 发送告警失败 [${notifierName}]: ${title}`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * 检查是否在抑制期内
   */
  isInSuppression(key) {
    const lastAlertTime = this.suppressionMap.get(key);
    if (!lastAlertTime) return false;

    const elapsed = Date.now() - lastAlertTime;
    if (elapsed >= this.config.suppressionTime) {
      this.suppressionMap.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 添加到历史记录
   */
  addToHistory(alert) {
    this.alertHistory.unshift(alert);

    // 限制历史记录大小
    if (this.alertHistory.length > this.config.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.config.maxHistorySize);
    }
  }

  /**
   * 获取告警历史
   */
  getHistory(options = {}) {
    const { level, limit = 50, offset = 0 } = options;

    let history = this.alertHistory;

    // 按级别过滤
    if (level) {
      history = history.filter(a => a.level === level);
    }

    // 分页
    return {
      total: history.length,
      records: history.slice(offset, offset + limit)
    };
  }

  /**
   * 获取告警统计
   */
  getStats(hours = 24) {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const recentAlerts = this.alertHistory.filter(a => a.timestamp >= since);

    const stats = {
      total: recentAlerts.length,
      byLevel: {
        critical: 0,
        error: 0,
        warning: 0,
        info: 0
      },
      byHour: {}
    };

    recentAlerts.forEach(alert => {
      // 按级别统计
      stats.byLevel[alert.level] = (stats.byLevel[alert.level] || 0) + 1;

      // 按小时统计
      const hour = new Date(alert.timestamp).getHours();
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    });

    return stats;
  }

  /**
   * 获取所有规则
   */
  getRules() {
    return Array.from(this.alertRules.values());
  }

  /**
   * 更新规则
   */
  updateRule(ruleId, updates) {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`规则不存在: ${ruleId}`);
    }

    Object.assign(rule, updates);
    logger.info(`📝 更新告警规则: ${ruleId}`);
  }

  /**
   * 删除规则
   */
  deleteRule(ruleId) {
    const deleted = this.alertRules.delete(ruleId);
    if (deleted) {
      logger.info(`🗑️ 删除告警规则: ${ruleId}`);
    }
    return deleted;
  }

  /**
   * 启用/禁用告警系统
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    logger.info(`告警系统已${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 测试通知渠道
   */
  async testNotifier(notifierName) {
    const notifier = this.notifiers.get(notifierName);
    if (!notifier) {
      throw new Error(`通知渠道不存在: ${notifierName}`);
    }

    await this.sendAlert({
      level: 'info',
      title: '测试告警',
      message: `这是来自 ${notifierName} 的测试消息`,
      notifiers: [notifierName]
    });
  }

  /**
   * 清空历史记录
   */
  clearHistory() {
    const count = this.alertHistory.length;
    this.alertHistory = [];
    logger.info(`🗑️ 清空告警历史: ${count}条`);
    return count;
  }

  /**
   * 更新分级通知配置
   */
  updateTieredNotifications(config) {
    Object.assign(this.config.tieredNotifications, config);
    logger.info('🎯 分级通知配置已更新');
    logger.debug('新配置:', this.config.tieredNotifications);
  }

  /**
   * 获取分级通知配置
   */
  getTieredNotifications() {
    return this.config.tieredNotifications;
  }

  /**
   * 记录被抑制的告警（用于聚合）
   */
  recordSuppressedAlert(key, alertInfo) {
    if (!this.aggregationMap.has(key)) {
      this.aggregationMap.set(key, {
        count: 0,
        firstSeen: alertInfo.timestamp,
        lastSeen: alertInfo.timestamp,
        level: alertInfo.level,
        title: alertInfo.title,
        messages: []
      });
    }

    const aggregation = this.aggregationMap.get(key);
    aggregation.count++;
    aggregation.lastSeen = alertInfo.timestamp;
    aggregation.messages.push({
      timestamp: alertInfo.timestamp,
      message: alertInfo.message
    });

    // 限制消息数量，只保留最近10条
    if (aggregation.messages.length > 10) {
      aggregation.messages = aggregation.messages.slice(-10);
    }
  }

  /**
   * 发送聚合汇总
   */
  async sendAggregationSummary() {
    if (!this.config.enableAggregation || this.aggregationMap.size === 0) {
      return;
    }

    logger.info(`📊 发送告警聚合汇总，共${this.aggregationMap.size}类告警`);

    for (const [key, aggregation] of this.aggregationMap.entries()) {
      if (aggregation.count === 0) continue;

      const duration = Math.floor((aggregation.lastSeen - aggregation.firstSeen) / 60000);
      const summary = `
📊 告警聚合汇总：${aggregation.title}
⏰ 时间段：${aggregation.firstSeen.toLocaleString()} - ${aggregation.lastSeen.toLocaleString()} (${duration}分钟)
🔢 触发次数：${aggregation.count}次
📝 最近消息：
${aggregation.messages.slice(-3).map((m, i) =>
  `  ${i + 1}. [${m.timestamp.toLocaleTimeString()}] ${m.message}`
).join('\n')}
      `.trim();

      // 使用原始告警级别和通知渠道
      const targetNotifiers = this.config.tieredNotifications[aggregation.level] || [];

      await this.sendAlertDirect({
        level: 'info',
        title: `【聚合汇总】${aggregation.title}`,
        message: summary,
        notifiers: targetNotifiers
      });

      // 清除已发送的聚合数据
      this.aggregationMap.delete(key);
    }
  }

  /**
   * 直接发送告警（不经过抑制检查）
   */
  async sendAlertDirect(alert) {
    const {
      level = 'info',
      title,
      message,
      data = {},
      notifiers = []
    } = alert;

    // 记录到历史
    this.addToHistory({
      id: Date.now(),
      timestamp: new Date(),
      level,
      title,
      message,
      data,
      notifiers
    });

    // 发送通知
    const promises = notifiers.map(async (notifierName) => {
      const notifier = this.notifiers.get(notifierName);
      if (!notifier || !notifier.enabled) {
        return;
      }

      try {
        await notifier.send({
          level,
          title,
          message,
          data,
          timestamp: new Date()
        });
        logger.info(`✅ 聚合汇总已发送 [${notifierName}]: ${title}`);
      } catch (error) {
        logger.error(`❌ 发送聚合汇总失败 [${notifierName}]: ${title}`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * 停止聚合定时器
   */
  stopAggregation() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
      logger.info('⏹️ 告警聚合定时器已停止');
    }
  }
}

export default new AlertManager();
