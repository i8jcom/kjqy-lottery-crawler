import logger from '../utils/Logger.js';

/**
 * 缓存服务 - 5秒短期缓存避免重复请求
 */
class CacheService {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };

    // 每分钟清理过期缓存
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * 获取缓存
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期（默认5秒）
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    logger.debug(`[Cache] 命中缓存: ${key}`);
    return item.data;
  }

  /**
   * 设置缓存
   */
  set(key, data, ttl = 5000) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    this.stats.sets++;
    logger.debug(`[Cache] 写入缓存: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * 删除缓存
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`[Cache] 删除缓存: ${key}`);
    }
    return deleted;
  }

  /**
   * 清空所有缓存
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`[Cache] 清空缓存: ${size}个条目`);
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`[Cache] 清理了 ${cleanedCount} 个过期缓存条目`);
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * 检查键是否存在且未过期
   */
  has(key) {
    return this.get(key) !== null;
  }
}

// 导出单例
export default new CacheService();
