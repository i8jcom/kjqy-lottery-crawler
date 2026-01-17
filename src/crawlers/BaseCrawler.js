import axios from 'axios';
import https from 'https';
import http from 'http';
import logger from '../utils/Logger.js';

// 🚀 性能优化：创建全局HTTP连接池，启用Keep-Alive
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,  // 保持连接30秒
  maxSockets: 50,          // 每个主机最多50个并发socket
  maxFreeSockets: 10,      // 保留10个空闲socket以便复用
  timeout: 60000,          // socket超时60秒
  scheduling: 'fifo'       // 先进先出调度
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  scheduling: 'fifo'
});

// 创建复用的axios实例
const axiosInstance = axios.create({
  httpAgent: httpAgent,
  httpsAgent: httpsAgent,
  headers: {
    'Connection': 'keep-alive'
  }
});

/**
 * 基础爬虫类
 */
class BaseCrawler {
  constructor(name, baseUrl) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.maxRetry = parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3;
    this.timeout = parseInt(process.env.REQUEST_TIMEOUT) || 10000;
    this.stats = {
      successCount: 0,
      failureCount: 0,
      totalRequests: 0
    };
  }

  /**
   * HTTP 请求封装
   */
  async request(url, options = {}) {
    const config = {
      method: options.method || 'GET',
      url: url,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        ...options.headers
      },
      ...options
    };

    try {
      // 🚀 性能优化：使用带连接池的axios实例，复用TCP连接
      const response = await axiosInstance(config);
      return response.data;
    } catch (error) {
      logger.error(`HTTP请求失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 带重试的请求
   */
  async requestWithRetry(url, options = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetry; attempt++) {
      try {
        this.stats.totalRequests++;
        const data = await this.request(url, options);
        this.stats.successCount++;
        return data;
      } catch (error) {
        lastError = error;
        this.stats.failureCount++;

        if (attempt < this.maxRetry) {
          const delay = attempt * 1000; // 递增延迟
          logger.warn(`请求失败，${delay}ms后重试 (${attempt}/${this.maxRetry})`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0
        ? ((this.stats.successCount / this.stats.totalRequests) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      successCount: 0,
      failureCount: 0,
      totalRequests: 0
    };
  }

  /**
   * 子类必须实现的方法
   */
  async fetchRealtimeData(lotCode) {
    throw new Error('子类必须实现 fetchRealtimeData 方法');
  }

  async fetchHistoryData(lotCode, options = {}) {
    throw new Error('子类必须实现 fetchHistoryData 方法');
  }
}

export default BaseCrawler;
