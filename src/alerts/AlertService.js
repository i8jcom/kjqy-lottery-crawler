import alertManager from './AlertManager.js';
import EmailNotifier from './notifiers/EmailNotifier.js';
import DingTalkNotifier from './notifiers/DingTalkNotifier.js';
import WeChatNotifier from './notifiers/WeChatNotifier.js';
import { defaultRules } from './AlertRules.js';
import logger from '../utils/Logger.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * 告警服务
 * 负责初始化和运行告警系统
 */
class AlertService {
  constructor() {
    this.initialized = false;
    this.checkInterval = null;
    this.contextProviders = new Map(); // 上下文提供者
    this.currentConfig = null; // 当前配置
    this.configFilePath = path.join(process.cwd(), 'alert-config.json'); // 配置文件路径
    this.ruleStates = new Map(); // 跟踪每个规则的触发状态（用于恢复通知）
  }

  /**
   * 初始化告警系统
   */
  async initialize(config = {}) {
    if (this.initialized) {
      logger.warn('告警系统已初始化');
      return;
    }

    logger.info('🚀 初始化告警系统...');

    // 尝试从文件加载配置
    const savedConfig = await this.loadConfig();

    // 合并配置（优先使用保存的配置）
    const finalConfig = savedConfig || config;
    this.currentConfig = finalConfig;

    // 初始化通知渠道
    this.initializeNotifiers(finalConfig);

    // 加载告警规则
    this.loadDefaultRules();

    // 标记为已初始化
    this.initialized = true;

    logger.success('✅ 告警系统初始化完成');
  }

  /**
   * 初始化通知渠道
   */
  initializeNotifiers(config) {
    const { email, dingtalk, wechat } = config;

    // 注册邮件通知器
    const emailNotifier = new EmailNotifier(email || {});
    alertManager.registerNotifier('email', emailNotifier);

    // 注册钉钉通知器
    const dingtalkNotifier = new DingTalkNotifier(dingtalk || {});
    alertManager.registerNotifier('dingtalk', dingtalkNotifier);

    // 注册企业微信通知器
    const wechatNotifier = new WeChatNotifier(wechat || {});
    alertManager.registerNotifier('wechat', wechatNotifier);
  }

  /**
   * 加载默认告警规则
   */
  loadDefaultRules() {
    for (const [ruleId, rule] of Object.entries(defaultRules)) {
      alertManager.addRule(ruleId, rule);
    }
  }

  /**
   * 注册上下文提供者
   */
  registerContextProvider(name, provider) {
    this.contextProviders.set(name, provider);
    logger.debug(`注册上下文提供者: ${name}`);
  }

  /**
   * 获取告警检查上下文
   */
  async getContext() {
    const context = {};

    // 从所有提供者收集上下文
    for (const [name, provider] of this.contextProviders) {
      try {
        const data = await provider();
        Object.assign(context, data);
      } catch (error) {
        logger.error(`获取上下文失败: ${name}`, error.message || error);
        logger.debug(`错误堆栈:`, error.stack);
      }
    }

    return context;
  }

  /**
   * 启动告警检查
   */
  async start(intervalMs = 60000) {
    if (!this.initialized) {
      throw new Error('告警系统未初始化');
    }

    if (this.checkInterval) {
      logger.warn('告警检查已在运行中');
      return;
    }

    logger.info(`⏰ 启动告警检查，间隔: ${intervalMs}ms`);

    // 立即执行一次检查
    await this.checkRules();

    // 定时检查
    this.checkInterval = setInterval(async () => {
      await this.checkRules();
    }, intervalMs);
  }

  /**
   * 停止告警检查
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('⏹️ 停止告警检查');
    }

    // 停止告警聚合定时器
    alertManager.stopAggregation();
  }

  /**
   * 检查所有告警规则
   */
  async checkRules() {
    try {
      // 获取上下文
      const context = await this.getContext();

      // 获取所有规则
      const rules = alertManager.getRules();

      // 检查每个规则
      for (const rule of rules) {
        if (!rule.enabled) continue;

        try {
          // 检查是否需要执行（根据checkInterval）
          if (rule.checkInterval) {
            const now = Date.now();
            if (rule.lastCheck && (now - rule.lastCheck) < rule.checkInterval) {
              continue;
            }
            rule.lastCheck = now;
          }

          // 执行条件检查
          const shouldAlert = await rule.condition(context);

          // 获取之前的状态
          const previousState = this.ruleStates.get(rule.id);

          if (shouldAlert) {
            // 构建告警消息
            const message = typeof rule.message === 'function'
              ? rule.message(context)
              : rule.message;

            // 发送告警
            await alertManager.sendAlert({
              level: rule.level,
              title: rule.name,
              message,
              data: this.extractRelevantData(context, rule),
              notifiers: rule.notifiers
            });

            rule.lastAlert = Date.now();

            // 更新状态为已触发
            this.ruleStates.set(rule.id, {
              triggered: true,
              lastTriggered: Date.now()
            });
          } else if (previousState && previousState.triggered) {
            // 🎉 告警恢复：之前触发了，现在恢复正常
            const recoveryMessage = `问题已解决！${rule.name}的异常情况已恢复正常。`;

            await alertManager.sendAlert({
              level: 'info',
              title: `✅ [恢复] ${rule.name}`,
              message: recoveryMessage,
              data: this.extractRelevantData(context, rule),
              notifiers: rule.notifiers
            });

            logger.success(`✅ 告警已恢复: ${rule.name}`);

            // 更新状态为已恢复
            this.ruleStates.set(rule.id, {
              triggered: false,
              lastRecovered: Date.now()
            });
          }
        } catch (error) {
          logger.error(`检查告警规则失败: ${rule.id}`, error);
        }
      }
    } catch (error) {
      logger.error('告警规则检查失败', error);
    }
  }

  /**
   * 提取相关数据（避免发送过多无关数据）
   */
  extractRelevantData(context, rule) {
    // 根据规则类型提取相关数据
    const relevantKeys = [
      'scheduler', 'dataSources', 'database',
      'missingDates', 'lotCode', 'lotName',
      'cpu', 'memory', 'recentCrawls'
    ];

    const data = {};
    for (const key of relevantKeys) {
      if (context[key] !== undefined) {
        data[key] = context[key];
      }
    }

    return data;
  }

  /**
   * 手动触发告警
   */
  async triggerAlert(alert) {
    return alertManager.sendAlert(alert);
  }

  /**
   * 获取告警历史
   */
  getHistory(options) {
    return alertManager.getHistory(options);
  }

  /**
   * 获取告警统计
   */
  getStats(hours) {
    return alertManager.getStats(hours);
  }

  /**
   * 测试通知渠道
   */
  async testNotifier(name) {
    return alertManager.testNotifier(name);
  }

  /**
   * 从文件加载配置
   */
  async loadConfig() {
    try {
      const data = await fs.readFile(this.configFilePath, 'utf8');
      const config = JSON.parse(data);
      logger.info('📄 从文件加载告警配置成功');
      return config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.debug('告警配置文件不存在，使用默认配置');
      } else {
        logger.error('加载告警配置文件失败', error);
      }
      return null;
    }
  }

  /**
   * 保存配置到文件
   */
  async saveConfig(config) {
    try {
      await fs.writeFile(
        this.configFilePath,
        JSON.stringify(config, null, 2),
        'utf8'
      );
      logger.info('💾 告警配置保存成功');
    } catch (error) {
      logger.error('保存告警配置失败', error);
      throw error;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return this.currentConfig || {
      email: { enabled: false },
      dingtalk: { enabled: false },
      wechat: { enabled: false }
    };
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig) {
    // 保存配置到文件
    await this.saveConfig(newConfig);

    // 更新内存中的配置
    this.currentConfig = newConfig;

    // 重新初始化通知器
    this.initializeNotifiers(newConfig);

    logger.success('✅ 告警配置已更新');
  }
}

export default new AlertService();
