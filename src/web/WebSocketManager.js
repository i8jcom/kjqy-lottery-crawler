import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';  // 🎯 消息压缩
import logger from '../utils/Logger.js';
import multiSourceDataManager from '../services/MultiSourceDataManager.js';
import continuousScheduler from '../schedulers/ContinuousPollingScheduler.js';
import officialSourceManager from '../managers/OfficialSourceManager.js';
import WebSocketMonitor from './WebSocketMonitor.js';
import RedisAdapter from './RedisAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * WebSocket 管理器 - 实时推送彩票数据
 *
 * 功能:
 * 1. 订阅/取消订阅彩种
 * 2. 实时推送新期号数据
 * 3. 心跳检测
 * 4. 连接管理
 */
class WebSocketManager {
  static instance = null; // 🎯 单例实例

  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map(); // clientId -> { ws, subscriptions, logSubscribed, lastActivity }
    this.subscriptions = new Map(); // lotCode -> Set of client ids
    this.lastPeriods = new Map(); // lotCode -> last pushed period

    // 🆕 日志推送相关
    this.logSubscribers = new Set(); // 订阅日志的客户端IDs
    this.logWatcher = null;
    this.lastLogPosition = 0;

    // 📊 性能监控器
    this.monitor = new WebSocketMonitor();

    // 📡 Redis Pub/Sub适配器（可选）
    this.redis = new RedisAdapter();

    // 🛡️ 连接限流与防护配置（5000+客户端优化）
    this.MAX_CONNECTIONS = 10000;              // 最大连接数
    this.MAX_SUBSCRIPTIONS_PER_CLIENT = 50;    // 每客户端最大订阅数
    this.CONNECTION_RATE_LIMIT = 100;          // 每秒最多接受100个新连接
    this.MAX_MESSAGE_SIZE = 100 * 1024;        // 100KB消息大小限制
    this.recentConnections = [];               // 记录最近的连接时间戳（用于速率限制）

    // 🎯 保存单例实例
    WebSocketManager.instance = this;

    this.init();
  }

  /**
   * 获取WebSocketManager单例实例
   */
  static getInstance() {
    return WebSocketManager.instance;
  }

  init() {
    this.wss.on('connection', (ws, req) => {
      // 🛡️ 连接速率限制检查
      const now = Date.now();
      this.recentConnections = this.recentConnections.filter(t => now - t < 1000);

      if (this.recentConnections.length >= this.CONNECTION_RATE_LIMIT) {
        logger.warn(`⚠️ 连接速率超限（${this.recentConnections.length}/秒），拒绝新连接 (IP: ${req.socket.remoteAddress})`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      this.recentConnections.push(now);

      // 🛡️ 检查总连接数
      if (this.clients.size >= this.MAX_CONNECTIONS) {
        logger.warn(`⚠️ 达到最大连接数${this.MAX_CONNECTIONS}，拒绝新连接 (IP: ${req.socket.remoteAddress})`);
        ws.close(1008, 'Server capacity reached');
        return;
      }

      // 📊 检查连接限流（WebSocketMonitor的额外限制）
      if (!this.monitor.canAcceptConnection()) {
        logger.warn(`⚠️ 拒绝新连接（达到监控器限流阈值${this.monitor.limits.maxConnections}）`);
        this.monitor.recordRejectedConnection();
        ws.close(1008, 'Server capacity reached');
        return;
      }

      const clientId = this.generateClientId();

      // 保存客户端
      this.clients.set(clientId, {
        ws,
        subscriptions: new Set(),
        logSubscribed: false, // 🆕 是否订阅日志
        lastActivity: Date.now()
      });

      // 📊 记录新连接
      this.monitor.recordConnection();

      logger.info(`✅ WebSocket客户端连接: ${clientId} (IP: ${req.socket.remoteAddress})`);

      // 发送连接成功消息
      this.sendToClient(clientId, {
        type: 'connection',
        data: {
          status: 'connected',
          clientId,
          timestamp: Date.now()
        }
      });

      // 处理消息
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          // 📊 记录接收消息
          this.monitor.recordMessageReceived(message);

          this.handleMessage(clientId, message);
        } catch (error) {
          logger.error(`WebSocket消息解析错误 [${clientId}]:`, error.message);

          // 📊 记录消息错误
          this.monitor.recordMessageError();

          this.sendToClient(clientId, {
            type: 'error',
            data: { message: '消息格式错误' }
          });
        }
      });

      // 处理pong（心跳响应）
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastActivity = Date.now();
        }
      });

      // 处理断开连接
      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      // 处理错误
      ws.on('error', (error) => {
        logger.error(`WebSocket客户端错误 [${clientId}]:`, error.message);
      });
    });

    // 启动心跳检测
    this.startHeartbeat();

    // 启动数据推送
    this.startDataPush();

    // 📡 启动Redis订阅（如果启用）
    this.startRedisSubscription();

    logger.info('📡 WebSocket服务器已启动');
  }

  /**
   * 生成客户端ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 处理客户端消息
   */
  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { type, data } = message;

    switch (type) {
      case 'subscribe':
        this.handleSubscribe(clientId, data);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, data);
        break;

      case 'subscribe_logs': // 🆕 订阅日志
        this.handleSubscribeLogs(clientId, data);
        break;

      case 'unsubscribe_logs': // 🆕 取消订阅日志
        this.handleUnsubscribeLogs(clientId);
        break;

      case 'ping':
        // 响应ping
        this.sendToClient(clientId, {
          type: 'pong',
          data: { timestamp: Date.now() }
        });
        break;

      default:
        logger.warn(`未知消息类型 [${clientId}]: ${type}`);
        this.sendToClient(clientId, {
          type: 'error',
          data: { message: `未知消息类型: ${type}` }
        });
    }
  }

  /**
   * 处理订阅
   */
  handleSubscribe(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // 🔧 兼容多种字段名: lotCodes, lotteries, lotCode, lottery
    const lotCodes = Array.isArray(data.lotCodes)
      ? data.lotCodes
      : Array.isArray(data.lotteries)
        ? data.lotteries
        : [data.lotCode || data.lottery];

    // 📊 检查订阅数量限制（使用增强的限制配置）
    const currentSubscriptionCount = client.subscriptions.size;
    const newSubscriptionCount = currentSubscriptionCount + lotCodes.length;

    if (newSubscriptionCount > this.MAX_SUBSCRIPTIONS_PER_CLIENT) {
      logger.warn(`⚠️ 客户端 ${clientId} 订阅数超限（当前${currentSubscriptionCount}+${lotCodes.length}=${newSubscriptionCount}，最大${this.MAX_SUBSCRIPTIONS_PER_CLIENT}）`);
      this.sendToClient(clientId, {
        type: 'error',
        data: {
          message: `订阅数超限，最多允许${this.MAX_SUBSCRIPTIONS_PER_CLIENT}个订阅`,
          code: 'SUBSCRIPTION_LIMIT_EXCEEDED'
        }
      });
      return;
    }

    // 额外检查：WebSocketMonitor的订阅限制
    if (!this.monitor.canSubscribe(newSubscriptionCount)) {
      logger.warn(`⚠️ 客户端 ${clientId} 超过监控器订阅限制（最大${this.monitor.limits.maxSubscriptionsPerClient}）`);
      this.sendToClient(clientId, {
        type: 'error',
        data: {
          message: `订阅数超限，最多允许${this.monitor.limits.maxSubscriptionsPerClient}个订阅`,
          code: 'SUBSCRIPTION_LIMIT_EXCEEDED'
        }
      });
      return;
    }

    lotCodes.forEach(lotCode => {
      if (!lotCode) return;

      // 添加到客户端订阅列表
      client.subscriptions.add(lotCode);

      // 添加到全局订阅Map
      if (!this.subscriptions.has(lotCode)) {
        this.subscriptions.set(lotCode, new Set());
      }
      this.subscriptions.get(lotCode).add(clientId);

      logger.info(`📢 客户端 ${clientId} 订阅彩种: ${lotCode}`);
    });

    // 📊 更新订阅统计
    this.monitor.updateSubscriptionStats(this.subscriptions);

    // 响应订阅成功
    this.sendToClient(clientId, {
      type: 'subscribed',
      data: {
        lotCodes,
        timestamp: Date.now()
      }
    });

    // 立即推送当前数据
    lotCodes.forEach(lotCode => {
      this.pushLotteryData(clientId, lotCode);
    });
  }

  /**
   * 处理取消订阅
   */
  handleUnsubscribe(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // 🔧 兼容多种字段名: lotCodes, lotteries, lotCode, lottery
    const lotCodes = Array.isArray(data.lotCodes)
      ? data.lotCodes
      : Array.isArray(data.lotteries)
        ? data.lotteries
        : [data.lotCode || data.lottery];

    lotCodes.forEach(lotCode => {
      if (!lotCode) return;

      // 从客户端订阅列表移除
      client.subscriptions.delete(lotCode);

      // 从全局订阅Map移除
      const subscribers = this.subscriptions.get(lotCode);
      if (subscribers) {
        subscribers.delete(clientId);

        // 如果没有订阅者了，删除彩种记录
        if (subscribers.size === 0) {
          this.subscriptions.delete(lotCode);
        }
      }

      logger.info(`📢 客户端 ${clientId} 取消订阅彩种: ${lotCode}`);
    });

    // 响应取消订阅成功
    this.sendToClient(clientId, {
      type: 'unsubscribed',
      data: {
        lotCodes,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 处理客户端断开连接
   */
  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // 清理彩票订阅关系
    client.subscriptions.forEach(lotCode => {
      const subscribers = this.subscriptions.get(lotCode);
      if (subscribers) {
        subscribers.delete(clientId);

        if (subscribers.size === 0) {
          this.subscriptions.delete(lotCode);
        }
      }
    });

    // 🆕 清理日志订阅
    if (client.logSubscribed) {
      this.logSubscribers.delete(clientId);

      // 如果没有订阅者了，停止监听
      if (this.logSubscribers.size === 0 && this.logWatcher) {
        clearInterval(this.logWatcher);
        this.logWatcher = null;
        logger.info('📜 日志监听已停止（无订阅者）');
      }
    }

    // 删除客户端
    this.clients.delete(clientId);

    // 📊 记录断开连接
    this.monitor.recordDisconnection();

    // 📊 更新订阅统计
    this.monitor.updateSubscriptionStats(this.subscriptions);

    logger.info(`❌ WebSocket客户端断开连接: ${clientId}`);
  }

  /**
   * 发送消息给指定客户端
   *
   * 🎯 5000+客户端优化：智能压缩
   * - 消息 > 1KB：自动GZIP压缩（节省70%带宽）
   * - 消息 <= 1KB：直接发送（避免压缩开销）
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return false;

    if (client.ws.readyState === client.ws.OPEN) {
      try {
        const startTime = Date.now();
        const jsonString = JSON.stringify(message);
        const messageSize = Buffer.byteLength(jsonString, 'utf8');

        // 🛡️ 消息大小限制检查
        if (messageSize > this.MAX_MESSAGE_SIZE) {
          logger.warn(`⚠️ 消息过大 [${clientId}]: ${messageSize}字节 > ${this.MAX_MESSAGE_SIZE}字节，拒绝发送`);
          return false;
        }

        // 🎯 智能压缩：消息 > 1KB 时启用GZIP压缩
        if (messageSize > 1024) {
          const compressed = zlib.gzipSync(jsonString);
          const compressionRatio = Math.round((1 - compressed.length / messageSize) * 100);

          client.ws.send(compressed, { binary: true });

          // 📊 压缩统计日志（仅大消息）
          if (messageSize > 10240) { // > 10KB才记录
            logger.debug(
              `📦 压缩消息 [${clientId}]: ${messageSize}字节 → ${compressed.length}字节 (节省${compressionRatio}%)`
            );
          }
        } else {
          // 小消息直接发送（避免压缩开销）
          client.ws.send(jsonString);
        }

        // 📊 记录消息发送
        this.monitor.recordMessageSent(message);

        // 📊 记录消息延迟（如果消息带有timestamp）
        if (message.data && message.data.timestamp) {
          const delay = startTime - message.data.timestamp;
          this.monitor.recordMessageDelay(delay);
        }

        return true;
      } catch (error) {
        logger.error(`发送消息失败 [${clientId}]:`, error.message);

        // 📊 记录消息错误
        this.monitor.recordMessageError();

        return false;
      }
    }

    return false;
  }

  /**
   * 广播彩种数据更新
   */
  async broadcastLotteryUpdate(lotCode, data) {
    const subscribers = this.subscriptions.get(lotCode);
    if (!subscribers || subscribers.size === 0) return;

    // 📊 记录广播开始时间
    const broadcastStartTime = Date.now();

    // 🔍 DEBUG: ���于SG彩种，打印接收到的data
    if (lotCode && lotCode.startsWith('200')) {
      logger.info(
        `[WebSocket-Broadcast-DEBUG] ${lotCode} 接收data.officialCountdown=${data.officialCountdown}, ` +
        `data.countdown=${data.countdown}`
      );
    }

    // 🎯 直接使用scraper返回的倒计时（scraper已经处理了所有逻辑）
    // ✅ SG Lotteries: scraper检测到未来时间时计算了真实倒计时
    // ✅ 极速彩种: scraper返回的就是准确倒计时
    // ❌ 不要在这里再调整earlyFetch，会导致不准确
    let finalCountdown = data.officialCountdown || data.countdown || 0;

    // 🎯 统一字段名：将倒计时赋值给countdown和officialCountdown（保持兼容性）
    const messageData = {
      lotCode,
      ...data,
      countdown: finalCountdown,
      officialCountdown: finalCountdown,  // 🔧 添加此字段以兼容前端
      timestamp: Date.now()
    };

    // 📡 优先使用Redis发布（集群模式）
    if (this.redis.enabled && this.redis.connected) {
      await this.redis.publishLotteryUpdate(lotCode, messageData);

      // 📊 记录广播耗时（Redis模式）
      const broadcastTime = Date.now() - broadcastStartTime;
      this.monitor.recordBroadcastTime(broadcastTime, subscribers.size);

      logger.debug(`📤 [Redis] 发布彩种更新 [${lotCode}] (耗时${broadcastTime}ms)`);

    } else {
      // 💡 降级到直连模式
      const message = {
        type: 'lottery_update',
        data: messageData
      };

      let successCount = 0;
      subscribers.forEach(clientId => {
        if (this.sendToClient(clientId, message)) {
          successCount++;
        }
      });

      // 📊 记录广播耗时
      const broadcastTime = Date.now() - broadcastStartTime;
      this.monitor.recordBroadcastTime(broadcastTime, subscribers.size);

      logger.debug(`📤 推送彩种更新 [${lotCode}] 给 ${successCount}/${subscribers.size} 个客户端 (耗时${broadcastTime}ms)`);
    }
  }

  /**
   * 🕐 广播倒计时更新（仅倒计时，由CountdownManager调用）
   *
   * 与broadcastLotteryUpdate的区别：
   * - 只推送倒计时变化（每秒触发）
   * - 消息类型为lottery_update（复用现有消息类型）
   * - 数据源标记为countdown_manager
   * - 不触发期号检测和数据库查询
   */
  async broadcastCountdownOnly(lotCode, data) {
    const subscribers = this.subscriptions.get(lotCode);
    if (!subscribers || subscribers.size === 0) return;

    // 📊 记录广播开始时间
    const broadcastStartTime = Date.now();

    // 🎯 构造倒计时消息（与broadcastLotteryUpdate格式一致）
    const messageData = {
      lotCode,
      period: data.period,
      drawTime: data.drawTime,
      countdown: data.countdown,
      officialCountdown: data.officialCountdown,
      timestamp: data.timestamp,
      source: data.source  // countdown_manager
    };

    // 📡 优先使用Redis发布（集群模式）
    if (this.redis.enabled && this.redis.connected) {
      await this.redis.publishLotteryUpdate(lotCode, messageData);

      // 📊 记录广播耗时（Redis模式）
      const broadcastTime = Date.now() - broadcastStartTime;
      this.monitor.recordBroadcastTime(broadcastTime, subscribers.size);

      logger.debug(`📤 [Redis] 发布倒计时更新 [${lotCode}] (${data.countdown}秒) (耗时${broadcastTime}ms)`);

    } else {
      // 💡 降级到直连模式
      const message = {
        type: 'lottery_update',
        data: messageData
      };

      let successCount = 0;
      subscribers.forEach(clientId => {
        if (this.sendToClient(clientId, message)) {
          successCount++;
        }
      });

      // 📊 记录广播耗时
      const broadcastTime = Date.now() - broadcastStartTime;
      this.monitor.recordBroadcastTime(broadcastTime, subscribers.size);

      logger.debug(`📤 推送倒计时更新 [${lotCode}] (${data.countdown}秒) 给 ${successCount}/${subscribers.size} 个客户端 (耗时${broadcastTime}ms)`);
    }
  }

  /**
   * 🚀 批量广播倒计时更新（优化版，按订阅推送）
   *
   * 🎯 5000+客户端优化策略：
   * 1. 只推送客户端订阅的彩种（而非所有彩种）
   * 2. 减少无效数据传输，节省带宽
   * 3. 提升推送效率 6-10倍
   *
   * @param {Object} batchData - 批量数据 { type, timestamp, countdowns: [{lotCode, countdown, period, drawTime}] }
   */
  async broadcastCountdownBatch(batchData) {
    // 📊 记录广播开始时间
    const broadcastStartTime = Date.now();

    // 🎯 核心优化：按订阅关系分组消息
    // clientId -> 该客户端订阅的彩种倒计时数据
    const clientMessages = new Map();

    // 遍历所有倒计时更新
    batchData.countdowns.forEach(countdownData => {
      const { lotCode } = countdownData;
      const subscribers = this.subscriptions.get(lotCode);

      if (!subscribers || subscribers.size === 0) return;

      // 为每个订阅者收集他关心的彩种数据
      subscribers.forEach(clientId => {
        if (!clientMessages.has(clientId)) {
          clientMessages.set(clientId, []);
        }
        clientMessages.get(clientId).push(countdownData);
      });
    });

    // 📡 只推送每个客户端订阅的数据
    let successCount = 0;
    let totalMessages = 0;

    clientMessages.forEach((countdowns, clientId) => {
      const message = {
        type: 'countdown_batch_update',
        data: {
          type: 'countdown_batch',
          timestamp: Date.now(),
          countdowns: countdowns
        }
      };

      if (this.sendToClient(clientId, message)) {
        successCount++;
      }
      totalMessages += countdowns.length;
    });

    // 📊 记录广播耗时和性能统计
    const broadcastTime = Date.now() - broadcastStartTime;
    this.monitor.recordBroadcastTime(broadcastTime, clientMessages.size);

    // 🎯 性能对比日志（原来会推送给所有客户端）
    const potentialClients = this.clients.size;
    const actualClients = clientMessages.size;
    const efficiency = potentialClients > 0 ? Math.round((1 - actualClients / potentialClients) * 100) : 0;

    logger.debug(
      `📤 推送${batchData.countdowns.length}个彩种更新给${successCount}/${actualClients}个订阅客户端 ` +
      `(全部客户端:${potentialClients}, 节省${efficiency}%, 耗时${broadcastTime}ms)`
    );
  }

  /**
   * 推送单个彩种数据给指定客户端
   */
  async pushLotteryData(clientId, lotCode) {
    try {
      const result = await multiSourceDataManager.fetchLotteryData(lotCode);

      if (result.success && result.data) {
        // 🎯 统一策略：所有彩种优先使用CountdownManager（扩展到41个彩种）
        let finalCountdown = result.data.officialCountdown || result.data.countdown || 0;

        if (this.countdownManager) {
          // ✅ 优先级1：使用CountdownManager的实时倒计时（内存值，零延迟）
          const countdownState = this.countdownManager.getState(lotCode);
          if (countdownState && countdownState.countdown !== undefined) {
            finalCountdown = countdownState.countdown;
            logger.debug(
              `[WebSocket-Subscribe] ${lotCode} 使用CountdownManager: ${finalCountdown}秒`
            );
          } else {
            // ✅ 优先级2：CountdownManager无数据（首次启动或新彩种），使用scraper值
            logger.debug(
              `[WebSocket-Subscribe] ${lotCode} CountdownManager无数据，使用scraper值: ${finalCountdown}秒`
            );
          }
        } else {
          // ⚠️ Fallback：CountdownManager未初始化（不应该发生）
          logger.warn(
            `[WebSocket-Subscribe] ${lotCode} CountdownManager未初始化，使用scraper值: ${finalCountdown}秒`
          );
        }

        // 🎯 统一字段名
        const messageData = {
          lotCode,
          ...result.data,
          countdown: finalCountdown,
          officialCountdown: finalCountdown,
          timestamp: Date.now()
        };

        this.sendToClient(clientId, {
          type: 'lottery_data',
          data: messageData
        });
      }
    } catch (error) {
      logger.error(`推送彩种数据失败 [${lotCode}]:`, error.message);
    }
  }

  /**
   * 心跳检测
   */
  startHeartbeat() {
    const HEARTBEAT_INTERVAL = 30000; // 30秒
    const CONNECTION_TIMEOUT = 60000; // 60秒超时

    setInterval(() => {
      const now = Date.now();

      this.clients.forEach((client, clientId) => {
        // 检查超时
        if (now - client.lastActivity > CONNECTION_TIMEOUT) {
          logger.warn(`客户端 ${clientId} 超时，断开连接`);
          client.ws.terminate();
          this.handleDisconnect(clientId);
          return;
        }

        // 发送ping
        if (client.ws.readyState === client.ws.OPEN) {
          client.ws.ping();
        }
      });
    }, HEARTBEAT_INTERVAL);

    logger.info('💓 WebSocket心跳检测已启动 (30秒/次)');
  }

  /**
   * 定时推送数据
   * 🔧 优化：已禁用定时轮询推送，完全依赖调度器事件驱动推送
   * 理由：ContinuousPollingScheduler检测到新期号时已立即调用notifyNewPeriod()推送，
   *       无需额外的定时轮询，减少服务器负载，提升实时性
   */
  startDataPush() {
    // 🚀 优化后方案：完全依赖调度器事件驱动推送（实时性更好）
    // 调度器检测到新期号 → 立即调用 notifyNewPeriod() → 实时推送（<100ms延迟）

    /* 🔧 已禁用：10秒定时轮询推送（冗余机制）
    setInterval(async () => {
      const subscribedLotteries = Array.from(this.subscriptions.keys());

      for (const lotCode of subscribedLotteries) {
        try {
          const result = await multiSourceDataManager.fetchLotteryData(lotCode);

          if (result.success && result.data) {
            const currentPeriod = result.data.period || result.data.issue;
            const lastPeriod = this.lastPeriods.get(lotCode);

            // 只在期号变化时推送（避免重复推送相同数据）
            if (!lastPeriod || currentPeriod !== lastPeriod) {
              this.broadcastLotteryUpdate(lotCode, result.data);
              this.lastPeriods.set(lotCode, currentPeriod);

              if (lastPeriod && currentPeriod !== lastPeriod) {
                logger.info(`🎉 检测到新期号 [${lotCode}]: ${currentPeriod} (WebSocket已推送)`);
              }
            }
          }
        } catch (error) {
          logger.error(`推送彩种数据失败 [${lotCode}]:`, error.message);
        }
      }
    }, 10000); // 10秒
    */

    logger.info('📤 WebSocket推送模式: 事件驱动（调度器检测到新期号立即推送）');
  }

  /**
   * 获取连接统计
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      subscribedLotteries: this.subscriptions.size,
      subscriptions: Array.from(this.subscriptions.entries()).map(([lottery, clients]) => ({
        lotCode: lottery,
        subscribers: clients.size
      })),
      // 📊 添加性能监控数据
      monitor: this.monitor.getStats()
    };
  }

  /**
   * 获取详细监控报告
   */
  getMonitorReport() {
    return this.monitor.getDetailedReport();
  }

  /**
   * 立即推送新期号数据（由调度器触发）
   */
  notifyNewPeriod(lotCode, data) {
    const subscribers = this.subscriptions.get(lotCode);
    if (!subscribers || subscribers.size === 0) return;

    // 更新最后推送的期号
    const period = data.period || data.issue;
    this.lastPeriods.set(lotCode, period);

    // 🎯 SG彩种：确保新期号推送使用完整倒计时(300秒)
    // 原因：scheduler检测到新期号后，在保存数据库和调用notifyNewPeriod()之间，
    //      CountdownManager已经开始tick递减，导致推送的倒计时偏小（例如192秒）
    // 解决：如果是新期号推送（data.officialCountdown接近300秒），强制使用300秒
    if (lotCode && lotCode.startsWith('200')) {
      const originalCountdown = data.officialCountdown;

      // 如果原始倒计时在280-350秒范围内，说明是新期号推送，强制使用300秒
      if (originalCountdown >= 280 && originalCountdown <= 350) {
        data = {
          ...data,
          officialCountdown: 300
        };
        logger.info(
          `[WebSocket-NewPeriod-SG] ${lotCode} 新期号强制使用300秒 ` +
          `(原始值=${originalCountdown}秒)`
        );
      } else {
        // 不是新期号推送（倒计时<280秒），使用CountdownManager值
        const countdownState = this.countdownManager?.getState(lotCode);
        if (countdownState && countdownState.countdown !== undefined) {
          data = {
            ...data,
            officialCountdown: countdownState.countdown
          };
          logger.info(
            `[WebSocket-NewPeriod-SG] ${lotCode} 使用CountdownManager倒计时: ${countdownState.countdown}秒 ` +
            `(原始值=${originalCountdown}秒)`
          );
        }
      }
    }

    // 广播新期号
    this.broadcastLotteryUpdate(lotCode, data);

    logger.info(`🚀 立即推送新期号 [${lotCode}]: ${period} 给 ${subscribers.size} 个订阅者`);
  }

  // ========== 🆕 日志推送功能 ==========

  /**
   * 处理订阅日志
   */
  handleSubscribeLogs(clientId, data = {}) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.logSubscribed = true;
    this.logSubscribers.add(clientId);

    logger.info(`📜 客户端 ${clientId} 订阅日志推送`);

    // 启动日志监听（如果还未启动）
    if (!this.logWatcher) {
      this.startLogWatcher();
    }

    // 响应订阅成功
    this.sendToClient(clientId, {
      type: 'log_subscribed',
      data: {
        status: 'subscribed',
        timestamp: Date.now()
      }
    });
  }

  /**
   * 处理取消订阅日志
   */
  handleUnsubscribeLogs(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.logSubscribed = false;
    this.logSubscribers.delete(clientId);

    logger.info(`📜 客户端 ${clientId} 取消订阅日志推送`);

    // 如果没有订阅者了，停止监听
    if (this.logSubscribers.size === 0 && this.logWatcher) {
      clearInterval(this.logWatcher);
      this.logWatcher = null;
      logger.info('📜 日志监听已停止（无订阅者）');
    }

    // 响应取消订阅成功
    this.sendToClient(clientId, {
      type: 'log_unsubscribed',
      data: {
        status: 'unsubscribed',
        timestamp: Date.now()
      }
    });
  }

  /**
   * 启动日志文件监听（tail -f 效果）
   */
  startLogWatcher() {
    const logsDir = path.join(__dirname, '../../logs');
    const logPattern = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+): (.+)$/;

    // 查找最新日志文件
    const getLatestLogFile = () => {
      try {
        const allLogFiles = fs.readdirSync(logsDir)
          .filter(f => f.startsWith('crawler') && f.endsWith('.log'))
          .map(f => {
            const filepath = path.join(logsDir, f);
            const stats = fs.statSync(filepath);
            return { filepath, mtime: stats.mtimeMs, filename: f };
          })
          .sort((a, b) => b.mtime - a.mtime);

        return allLogFiles.length > 0 ? allLogFiles[0].filepath : null;
      } catch (error) {
        logger.error('查找日志文件失败:', error);
        return null;
      }
    };

    // 解析日志行
    const parseLogLine = (line) => {
      const match = line.match(logPattern);

      if (match) {
        const [, timestamp, logLevel, message] = match;
        const sourceMatch = message.match(/^\[([^\]]+)\]/);
        const logSource = sourceMatch ? sourceMatch[1] : 'system';

        return {
          timestamp: new Date(timestamp).toISOString(),
          level: logLevel.toLowerCase(),
          source: logSource,
          message: message,
          raw: line
        };
      } else {
        return {
          timestamp: new Date().toISOString(),
          level: 'info',
          source: 'system',
          message: line,
          raw: line
        };
      }
    };

    // 🔧 性能优化：每10秒检查新日志，每次最多推送50条
    this.logWatcher = setInterval(() => {
      const logFile = getLatestLogFile();
      if (!logFile) return;

      try {
        const stats = fs.statSync(logFile);
        const fileSize = stats.size;

        // 如果文件大小没变化，跳过
        if (fileSize === this.lastLogPosition) return;

        // 如果文件变小了（可能是日志轮转），重置位置
        if (fileSize < this.lastLogPosition) {
          this.lastLogPosition = 0;
        }

        // 读取新增内容
        const stream = fs.createReadStream(logFile, {
          start: this.lastLogPosition,
          encoding: 'utf-8'
        });

        let buffer = '';
        const newLogs = []; // 🆕 收集新日志

        stream.on('data', (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');

          // 保留最后一行（可能不完整）
          buffer = lines.pop() || '';

          // 处理完整的行
          lines.forEach(line => {
            if (line.trim()) {
              const logEntry = parseLogLine(line);
              newLogs.push(logEntry); // 🆕 先收集，不立即推送
            }
          });
        });

        stream.on('end', () => {
          this.lastLogPosition = fileSize;

          // 🔥 智能过滤：只推送重要日志（ERROR/WARN）
          const importantLogs = newLogs.filter(log =>
            log.level === 'error' || log.level === 'warn'
          );

          // 🔧 限制推送数量：最多推送最后50条重要日志
          const logsToSend = importantLogs.length > 50 ? importantLogs.slice(-50) : importantLogs;

          if (logsToSend.length > 0) {
            // 批量推送重要日志
            logsToSend.forEach(logEntry => {
              this.broadcastLog(logEntry);
            });

            // 记录推送统计
            logger.info(`📡 推送重要日志: ${logsToSend.length}条 (总日志${newLogs.length}条, 过滤${newLogs.length - importantLogs.length}条INFO/DEBUG)`);

            if (importantLogs.length > 50) {
              logger.warn(`⚠️ 重要日志过多，已限制：${importantLogs.length}条 → 推送最后${logsToSend.length}条`);
            }
          }
        });

        stream.on('error', (error) => {
          logger.error('读取日志流失败:', error);
        });
      } catch (error) {
        logger.error('日志监听错误:', error);
      }
    }, 10000); // 🔧 10秒检查一次（原2秒）

    logger.info('📜 日志监听已启动 (10秒/次，仅推送ERROR/WARN，最多50条)');
  }

  /**
   * 广播日志消息给所有订阅者
   */
  broadcastLog(logEntry) {
    if (this.logSubscribers.size === 0) return;

    const message = {
      type: 'log_message',
      data: logEntry
    };

    let successCount = 0;
    this.logSubscribers.forEach(clientId => {
      if (this.sendToClient(clientId, message)) {
        successCount++;
      }
    });

    if (successCount > 0) {
      logger.debug(`📤 推送日志给 ${successCount}/${this.logSubscribers.size} 个客户端`);
    }
  }

  // ========== 📡 Redis Pub/Sub集成 ==========

  /**
   * 启动Redis订阅（集群模式）
   */
  async startRedisSubscription() {
    if (!this.redis.enabled || !this.redis.connected) {
      logger.info('💡 使用直连模式（Redis未启用）');
      return;
    }

    logger.info('📡 启动Redis订阅模式（集群架构）');

    // 订阅系统广播
    await this.redis.subscribeBroadcast((data) => {
      logger.debug(`📥 [Redis] 收到系统广播: ${data.type}`);
      this.handleRedisBroadcast(data);
    });

    // 动态订阅彩种频道
    // 当有新彩种被订阅时，自动订阅Redis频道
    this.subscriptions.forEach(async (subscribers, lotCode) => {
      await this.redis.subscribeLottery(lotCode, (data) => {
        logger.debug(`📥 [Redis] 收到彩种更新: ${lotCode}`);
        this.handleRedisLotteryUpdate(data);
      });
    });

    logger.success('✅ Redis订阅已启动');
  }

  /**
   * 处理Redis发布的彩种更新
   */
  handleRedisLotteryUpdate(data) {
    const { lotCode, data: messageData } = data;
    const subscribers = this.subscriptions.get(lotCode);

    if (!subscribers || subscribers.size === 0) return;

    const message = {
      type: 'lottery_update',
      data: messageData
    };

    // 转发给本服务器的WebSocket客户端
    let successCount = 0;
    subscribers.forEach(clientId => {
      if (this.sendToClient(clientId, message)) {
        successCount++;
      }
    });

    logger.debug(`📤 [Redis] 转发彩种更新 [${lotCode}] 给 ${successCount}/${subscribers.size} 个客户端`);
  }

  /**
   * 处理Redis系统广播
   */
  handleRedisBroadcast(data) {
    // 可以用于集群间同步、管理命令等
    logger.debug('[Redis] 处理系统广播:', data.type);

    // 示例：可以添加集群管理命令
    // if (data.type === 'reload_config') {
    //   this.reloadConfiguration();
    // }
  }

  /**
   * 广播数据补全进度
   */
  broadcastCompletionProgress(progressData) {
    const message = {
      type: 'completion_progress',
      data: progressData
    };

    let successCount = 0;
    this.clients.forEach((client) => {
      if (this.sendToClient(Array.from(this.clients.entries()).find(([id, c]) => c === client)?.[0], message)) {
        successCount++;
      }
    });

    logger.debug(`📤 推送补全进度 [${progressData.type}] 给 ${successCount}/${this.clients.size} 个客户端`);
  }
}

export default WebSocketManager;
