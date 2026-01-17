import axios from 'axios'

// ========== API响应缓存系统 ==========
class APICache {
  constructor() {
    this.cache = new Map()
    this.defaultTTL = 30000 // 默认缓存30秒
  }

  // 生成缓存键
  generateKey(config) {
    const { method, url, params } = config
    return `${method}:${url}:${JSON.stringify(params || {})}`
  }

  // 获取缓存
  get(key) {
    const cached = this.cache.get(key)
    if (!cached) return null

    const { data, expireAt } = cached
    if (Date.now() > expireAt) {
      this.cache.delete(key)
      return null
    }

    return data
  }

  // 设置缓存
  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      expireAt: Date.now() + ttl
    })
  }

  // 清除特定缓存
  delete(key) {
    this.cache.delete(key)
  }

  // 清除所有缓存
  clear() {
    this.cache.clear()
  }

  // 清除过期缓存
  clearExpired() {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expireAt) {
        this.cache.delete(key)
      }
    }
  }
}

const apiCache = new APICache()

// 定期清理过期缓存（每分钟）
setInterval(() => apiCache.clearExpired(), 60000)

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 创建主系统API实例（用于实时数据）
const mainSystemApi = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    // 对于GET请求，检查缓存
    if (config.method === 'get' && !config.skipCache) {
      const cacheKey = apiCache.generateKey(config)
      const cached = apiCache.get(cacheKey)

      if (cached) {
        console.log(`✨ [API Cache] Hit: ${config.url}`)
        // 返回缓存的数据（包装成类似axios响应的格式）
        config.adapter = () => Promise.resolve({
          data: cached,
          status: 200,
          statusText: 'OK (from cache)',
          headers: {},
          config,
          request: {}
        })
      }
    }

    return config
  },
  error => {
    console.error('Request Error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    // 对于GET请求，缓存响应数据
    if (response.config.method === 'get' && !response.config.skipCache) {
      const cacheKey = apiCache.generateKey(response.config)
      const cacheTTL = response.config.cacheTTL || apiCache.defaultTTL
      apiCache.set(cacheKey, response.data, cacheTTL)
    }

    // 返回data部分
    return response.data
  },
  error => {
    // 统一错误处理
    console.error('API Error:', error)

    if (error.response) {
      switch (error.response.status) {
        case 401:
          console.error('未授权，请登录')
          break
        case 403:
          console.error('拒绝访问')
          break
        case 404:
          console.error('请求错误，未找到该资源')
          break
        case 500:
          console.error('服务器错误')
          break
        default:
          console.error('请求失败')
      }
    }

    return Promise.reject(error)
  }
)

// 暴露API实例到window供调试
if (typeof window !== 'undefined') {
  window.__apiCache__ = apiCache
}

// API方法
export default {
  // ========== 缓存管理 ==========

  // 清除所有API缓存
  clearCache() {
    apiCache.clear()
    console.log('🗑️ [API Cache] All cache cleared')
  },

  // 清除特定URL的缓存
  clearCacheByUrl(url) {
    for (const key of apiCache.cache.keys()) {
      if (key.includes(url)) {
        apiCache.delete(key)
      }
    }
    console.log(`🗑️ [API Cache] Cleared cache for: ${url}`)
  },

  // ========== 仪表盘相关 ==========

  // 获取最新数据（不缓存，实时数据）
  getLatestData() {
    return api.get('/latest-data', { skipCache: true })
  },

  // 获取状态信息（缓存60秒）
  getStatus() {
    return api.get('/status', { cacheTTL: 60000 })
  },

  // ========== 历史查询 ==========

  // 获取历史数据
  getHistoryData(params) {
    // 对于年份查询（特别是台湾彩票自动补填）或台湾宾果按天查询，需要更长的超时时间
    // 台湾宾果每5分钟一期，一天202期数据，查询量大
    // 🚀 SpeedyLot88/SG/AU/UK彩种首次查询需要分页爬取+重试502错误（60-120秒），后续查询<1秒
    const timeout = (params.year || params.lottery === '100007') ? 180000 : 180000  // 增加到3分钟超时

    // 🔧 历史数据查询跳过缓存，确保每次都获取最新数据（可能触发自动补全）
    return api.get('/history-data', { params, timeout, skipCache: true })
  },

  // ========== 数据源管理 ==========

  // 获取数据源列表（缓存60秒）
  getSources() {
    return api.get('/sources', { cacheTTL: 60000 })
  },

  // 检查数据源
  checkSource(id) {
    return api.post(`/sources/${id}/check`)
  },

  // 检查所有数据源
  checkAllSources() {
    return api.post('/sources/check-all')
  },

  // 获取数据源详情
  getSourceDetail(id) {
    return api.get(`/sources/${id}`)
  },

  // 添加数据源
  addSource(data) {
    return api.post('/sources', data)
  },

  // 更新数据源
  updateSource(id, data) {
    return api.put(`/sources/${id}`, data)
  },

  // 删除数据源
  deleteSource(id) {
    return api.delete(`/sources/${id}`)
  },

  // ========== 彩种配置 ==========

  // 获取彩种列表（跳过缓存，配置数据很重要）
  getLotteryConfigs() {
    return api.get('/lotteries/configs', { skipCache: true })
  },

  // 添加彩种
  addLotteryConfig(data) {
    return api.post('/lotteries/configs', data)
  },

  // 更新彩种
  updateLotteryConfig(lotCode, data) {
    return api.put(`/lotteries/configs/${lotCode}`, data)
  },

  // 删除彩种
  deleteLotteryConfig(lotCode) {
    return api.delete(`/lotteries/configs/${lotCode}`)
  },

  // ========== 调度器 ==========

  // 获取调度器状态（不缓存，实时数据）
  getSchedulerStatus() {
    return api.get('/scheduler/status', { skipCache: true })
  },

  // 获取任务列表（不缓存，实时数据）
  getTasks() {
    return api.get('/scheduler/details', { skipCache: true })
  },

  // 触发手动爬取
  triggerCrawl(lotCode) {
    return api.post('/crawl', { lotCode })
  },

  // ========== 告警管理 ==========

  // 获取告警统计
  getAlertStats(hours = 24) {
    return api.get('/alerts/stats', { params: { hours } })
  },

  // 获取告警历史
  getAlertHistory(params = {}) {
    return api.get('/alerts/history', { params })
  },

  // 获取告警列表（兼容旧代码）
  getAlerts(params) {
    const { type, ...rest } = params || {}
    if (type === 'stats') {
      return this.getAlertStats(rest.hours)
    } else if (type === 'history') {
      return this.getAlertHistory(rest)
    }
    return api.get('/alerts/history', { params })
  },

  // 获取告警规则
  getAlertRules() {
    return api.get('/alerts/rules')
  },

  // 更新告警规则
  updateAlertRule(id, data) {
    return api.put(`/alerts/rules/${id}`, data)
  },

  // 删除告警规则
  deleteAlertRule(id) {
    return api.delete(`/alerts/rules/${id}`)
  },

  // 清空告警历史
  clearAlertHistory() {
    return api.delete('/alerts/history')
  },

  // 测试通知渠道
  testNotifier(notifier) {
    return api.post(`/alerts/test/${notifier}`)
  },

  // ========== 日志 ==========

  // 获取日志
  getLogs(params) {
    return api.get('/logs', { params })
  },

  // ========== 域名管理 ==========

  // 获取域名列表
  getDomains() {
    return api.get('/cwl/domains')
  },

  // 获取域名历史
  getDomainHistory() {
    return api.get('/cwl/domains/history')
  },

  // 检查域名健康
  checkDomain(id) {
    return api.get(`/cwl/domains/${id}/health`)
  },

  // 添加域名
  addDomain(data) {
    return api.post('/cwl/domains', data)
  },

  // 更新域名
  updateDomain(id, data) {
    return api.put(`/cwl/domains/${id}`, data)
  },

  // 删除域名
  deleteDomain(id) {
    return api.delete(`/cwl/domains/${id}`)
  },

  // ========== 数据管理 ==========

  // 检测缺失数据
  checkMissingData(params) {
    return api.get('/data/check-missing', { params })
  },

  // 补填数据
  fillMissingData(data) {
    return api.post('/data/fill-missing', data)
  },

  // 导出数据
  exportData(params) {
    return api.get('/data/export', {
      params,
      responseType: 'blob'
    })
  },

  // ========== 实时数据（调用主系统API） ==========

  // 获取实时最新数据
  getRealtimeLatest(lotteryCode) {
    return mainSystemApi.get(`/realtime/${lotteryCode}/latest`).then(res => res.data)
  },

  // 获取实时历史数据
  getRealtimeHistory(lotteryCode, limit = 20) {
    return mainSystemApi.get(`/realtime/${lotteryCode}/history`, {
      params: { limit }
    }).then(res => res.data)
  },

  // 批量获取实时数据
  getRealtimeBatch(requests) {
    return mainSystemApi.post('/realtime/batch', { requests }).then(res => res.data)
  },

  // ========== WebSocket 监控 ==========

  // 获取WebSocket统计信息
  getWebSocketStats() {
    return api.get('/websocket/stats', { skipCache: true })
  },

  // 获取WebSocket详细监控报告
  getWebSocketMonitor() {
    return api.get('/websocket/monitor', { skipCache: true })
  }
}
