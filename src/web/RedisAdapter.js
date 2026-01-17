import logger from '../utils/Logger.js';

/**
 * Redis Pub/Sub 适配器
 *
 * 功能：
 * 1. 当用户量增长到1000+时启用
 * 2. 使用Redis Pub/Sub分发WebSocket消息
 * 3. 支持多服务器集群部署
 * 4. 降低单服务器负载
 *
 * 配置环境变量:
 * REDIS_ENABLED=true
 * REDIS_HOST=localhost
 * REDIS_PORT=6379
 * REDIS_PASSWORD=your_password (可选)
 */
class RedisAdapter {
  constructor() {
    this.enabled = process.env.REDIS_ENABLED === 'true';
    this.redis = null;
    this.subscriber = null;
    this.publisher = null;
    this.connected = false;

    if (this.enabled) {
      this.init();
    } else {
      logger.info('📡 Redis Pub/Sub未启用（当前用户量<1000，使用直连模式）');
    }
  }

  /**
   * 初始化Redis连接
   */
  async init() {
    try {
      // 动态导入redis模块（避免未安装时报错）
      const redis = await import('redis');

      const config = {
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          connectTimeout: 10000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis重连失败次数过多，停止重连');
              return new Error('重连失败');
            }
            // 指数退避：1s, 2s, 4s, 8s...
            const delay = Math.min(retries * 1000, 30000);
            logger.info(`Redis断线，${delay}ms后重连 (第${retries}次)`);
            return delay;
          }
        },
        password: process.env.REDIS_PASSWORD || undefined
      };

      // 创建发布者和订阅者（需要两个独立连接）
      this.publisher = redis.createClient(config);
      this.subscriber = redis.createClient(config);

      // 错误处理
      this.publisher.on('error', (err) => logger.error('Redis Publisher错误:', err));
      this.subscriber.on('error', (err) => logger.error('Redis Subscriber错误:', err));

      // 连接
      await this.publisher.connect();
      await this.subscriber.connect();

      this.connected = true;
      logger.success('✅ Redis Pub/Sub已连接');
      logger.info(`📡 Redis服务器: ${config.socket.host}:${config.socket.port}`);

    } catch (error) {
      logger.error('Redis初始化失败:', error.message);
      logger.warn('⚠️ 降级到直连模式（不使用Redis）');
      this.enabled = false;
      this.connected = false;
    }
  }

  /**
   * 发布彩种更新消息
   */
  async publishLotteryUpdate(lotCode, data) {
    if (!this.enabled || !this.connected) return false;

    try {
      const channel = `lottery:${lotCode}`;
      const message = JSON.stringify({
        type: 'lottery_update',
        lotCode,
        data,
        timestamp: Date.now(),
        serverId: process.pid // 标识来自哪个服务器进程
      });

      await this.publisher.publish(channel, message);
      logger.debug(`📤 [Redis] 发布彩种更新: ${lotCode}`);
      return true;

    } catch (error) {
      logger.error(`Redis发布失败 [${lotCode}]:`, error.message);
      return false;
    }
  }

  /**
   * 订阅彩种更新
   */
  async subscribeLottery(lotCode, callback) {
    if (!this.enabled || !this.connected) return false;

    try {
      const channel = `lottery:${lotCode}`;

      await this.subscriber.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);

          // 过滤来自本服务器的消息（避免重复处理）
          if (data.serverId !== process.pid) {
            callback(data);
          }
        } catch (error) {
          logger.error('Redis消息解析失败:', error.message);
        }
      });

      logger.debug(`📥 [Redis] 订阅彩种: ${lotCode}`);
      return true;

    } catch (error) {
      logger.error(`Redis订阅失败 [${lotCode}]:`, error.message);
      return false;
    }
  }

  /**
   * 取消订阅彩种
   */
  async unsubscribeLottery(lotCode) {
    if (!this.enabled || !this.connected) return false;

    try {
      const channel = `lottery:${lotCode}`;
      await this.subscriber.unsubscribe(channel);
      logger.debug(`📥 [Redis] 取消订阅彩种: ${lotCode}`);
      return true;

    } catch (error) {
      logger.error(`Redis取消订阅失败 [${lotCode}]:`, error.message);
      return false;
    }
  }

  /**
   * 发布系统广播消息
   */
  async publishBroadcast(type, data) {
    if (!this.enabled || !this.connected) return false;

    try {
      const channel = 'lottery:broadcast';
      const message = JSON.stringify({
        type,
        data,
        timestamp: Date.now(),
        serverId: process.pid
      });

      await this.publisher.publish(channel, message);
      logger.debug(`📤 [Redis] 发布广播消息: ${type}`);
      return true;

    } catch (error) {
      logger.error('Redis广播失败:', error.message);
      return false;
    }
  }

  /**
   * 订阅系统广播
   */
  async subscribeBroadcast(callback) {
    if (!this.enabled || !this.connected) return false;

    try {
      await this.subscriber.subscribe('lottery:broadcast', (message) => {
        try {
          const data = JSON.parse(message);

          // 过滤来自本服务器的消息
          if (data.serverId !== process.pid) {
            callback(data);
          }
        } catch (error) {
          logger.error('Redis广播消息解析失败:', error.message);
        }
      });

      logger.debug('📥 [Redis] 订阅系统广播');
      return true;

    } catch (error) {
      logger.error('Redis订阅广播失败:', error.message);
      return false;
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    if (!this.enabled || !this.connected) {
      return {
        enabled: false,
        connected: false,
        mode: 'direct'
      };
    }

    try {
      const info = await this.publisher.info('clients');
      const lines = info.split('\r\n');
      const clientsCount = lines.find(line => line.startsWith('connected_clients:'));

      return {
        enabled: true,
        connected: true,
        mode: 'redis',
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        clients: clientsCount ? parseInt(clientsCount.split(':')[1]) : 0,
        serverId: process.pid
      };

    } catch (error) {
      logger.error('获取Redis统计失败:', error.message);
      return {
        enabled: true,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.enabled) return { healthy: true, mode: 'direct' };

    try {
      await this.publisher.ping();
      return {
        healthy: true,
        mode: 'redis',
        latency: 0
      };

    } catch (error) {
      return {
        healthy: false,
        mode: 'redis',
        error: error.message
      };
    }
  }

  /**
   * 关闭连接
   */
  async close() {
    if (!this.enabled || !this.connected) return;

    try {
      await this.publisher.quit();
      await this.subscriber.quit();
      this.connected = false;
      logger.info('Redis连接已关闭');

    } catch (error) {
      logger.error('关闭Redis连接失败:', error.message);
    }
  }
}

export default RedisAdapter;
