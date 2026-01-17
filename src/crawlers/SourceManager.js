import Source3650062 from './Source3650062.js';
import SourceOfficialAPI from './SourceOfficialAPI.js';
import logger from '../utils/Logger.js';
import validator from '../validators/DataValidator.js';

/**
 * 数据源管理器 - 管理多个数据源并实现自动切换
 */
class SourceManager {
  constructor() {
    this.sources = [];
    this.currentSource = null;
    this.sourceHealth = new Map();
    this.initSources();
  }

  /**
   * 初始化数据源
   */
  initSources() {
    // 主数据源：3650062.com（可用）
    this.sources.push(new Source3650062());

    // 备用数据源：官方API（需要代理）
    // this.sources.push(new SourceOfficialAPI());

    // TODO: 添加更多备用数据源
    // this.sources.push(new SourceBackup());

    // 初始化健康状态
    this.sources.forEach(source => {
      this.sourceHealth.set(source.name, {
        healthy: true,
        lastCheckTime: null,
        consecutiveFailures: 0,
        totalRequests: 0,
        successRequests: 0
      });
    });

    // 默认使用第一个数据源
    this.currentSource = this.sources[0];
    logger.info(`🎯 初始化 ${this.sources.length} 个数据源，当前使用: ${this.currentSource.name}`);
  }

  /**
   * 获取实时数据（多源尝试）
   */
  async fetchRealtimeData(lotCode) {
    const results = [];

    // 尝试所有健康的数据源
    for (const source of this.sources) {
      const health = this.sourceHealth.get(source.name);

      // 跳过不健康的数据源
      if (!health.healthy) {
        logger.debug(`⏭️ 跳过不健康的数据源: ${source.name}`);
        continue;
      }

      try {
        const data = await source.fetchRealtimeData(lotCode);

        if (data && validator.validateRealtimeData(data)) {
          results.push(data);
          this.updateSourceHealth(source.name, true);

          // 如果第一个数据源成功，直接返回（快速响应）
          if (source === this.currentSource) {
            logger.success(`✅ 当前数据源可用: ${source.name}`);
            return data;
          }
        } else {
          this.updateSourceHealth(source.name, false);
        }
      } catch (error) {
        this.updateSourceHealth(source.name, false);
        logger.warn(`数据源失败: ${source.name}`, error);
      }
    }

    // 多源验证
    if (results.length > 0) {
      const bestData = validator.compareMultiSourceData(results);

      if (bestData) {
        logger.success(`✅ 多源验证成功: ${lotCode}`);
        return bestData;
      }
    }

    logger.error(`❌ 所有数据源都失败了: ${lotCode}`);
    return null;
  }

  /**
   * 获取历史数据
   */
  async fetchHistoryData(lotCode, options = {}) {
    // 只从主数据源获取历史数据
    const source = this.currentSource;

    try {
      const data = await source.fetchHistoryData(lotCode, options);

      if (data && validator.validateHistoryData(data)) {
        this.updateSourceHealth(source.name, true);
        return data;
      } else {
        this.updateSourceHealth(source.name, false);
        return [];
      }
    } catch (error) {
      this.updateSourceHealth(source.name, false);
      logger.error(`❌ 获取历史数据失败: ${lotCode}`, error);
      return [];
    }
  }

  /**
   * 更新数据源健康状态
   */
  updateSourceHealth(sourceName, success) {
    const health = this.sourceHealth.get(sourceName);
    if (!health) return;

    health.totalRequests++;
    health.lastCheckTime = new Date();

    if (success) {
      health.successRequests++;
      health.consecutiveFailures = 0;
      health.healthy = true;
    } else {
      health.consecutiveFailures++;

      // 连续失败3次，标记为不健康
      if (health.consecutiveFailures >= 3) {
        health.healthy = false;
        logger.warn(`⚠️ 数据源标记为不健康: ${sourceName} (连续失败 ${health.consecutiveFailures} 次)`);

        // 自动切换到其他健康的数据源
        this.switchToHealthySource();
      }
    }
  }

  /**
   * 切换到健康的数据源
   */
  switchToHealthySource() {
    for (const source of this.sources) {
      const health = this.sourceHealth.get(source.name);

      if (health.healthy && source !== this.currentSource) {
        this.currentSource = source;
        logger.info(`🔄 自动切换数据源: ${source.name}`);
        return;
      }
    }

    logger.error('❌ 没有可用的健康数据源');
  }

  /**
   * 获取所有数据源状态
   */
  getSourcesStatus() {
    const status = [];

    this.sources.forEach(source => {
      const health = this.sourceHealth.get(source.name);
      const stats = source.getStats();

      status.push({
        name: source.name,
        isCurrent: source === this.currentSource,
        healthy: health.healthy,
        consecutiveFailures: health.consecutiveFailures,
        successRate: health.totalRequests > 0
          ? ((health.successRequests / health.totalRequests) * 100).toFixed(2) + '%'
          : '0%',
        totalRequests: health.totalRequests,
        lastCheckTime: health.lastCheckTime,
        stats: stats
      });
    });

    return status;
  }

  /**
   * 健康检查（定期执行）
   */
  async healthCheck() {
    logger.info('🏥 开始健康检查...');

    for (const source of this.sources) {
      const health = this.sourceHealth.get(source.name);

      // 如果数据源已经不健康超过5分钟，尝试恢复
      if (!health.healthy && health.lastCheckTime) {
        const minutesSinceLastCheck = (new Date() - health.lastCheckTime) / 1000 / 60;

        if (minutesSinceLastCheck > 5) {
          logger.info(`🔄 尝试恢复数据源: ${source.name}`);
          health.consecutiveFailures = 0;
          health.healthy = true;
        }
      }
    }

    const status = this.getSourcesStatus();
    logger.info(`健康检查完成: ${JSON.stringify(status, null, 2)}`);
  }
}

export default new SourceManager();
