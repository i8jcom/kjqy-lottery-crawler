/**
 * API 请求模块
 * 提供统一的HTTP请求接口
 */

import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建axios实例
const service = axios.create({
  baseURL: '', // 使用相对路径，与应用部署在同一域名
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    // 可以在这里添加token等认证信息
    return config
  },
  error => {
    console.error('[API] 请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    const res = response.data

    // 如果返回的状态码不是200，认为是错误
    if (response.status !== 200) {
      ElMessage({
        message: res.message || '请求失败',
        type: 'error',
        duration: 3000
      })
      return Promise.reject(new Error(res.message || '请求失败'))
    }

    return res
  },
  error => {
    console.error('[API] 响应错误:', error)

    let message = '网络错误'
    if (error.response) {
      switch (error.response.status) {
        case 400:
          message = '请求参数错误'
          break
        case 401:
          message = '未授权，请重新登录'
          break
        case 403:
          message = '拒绝访问'
          break
        case 404:
          message = '请求的资源不存在'
          break
        case 500:
          message = '服务器错误'
          break
        case 502:
          message = '网关错误'
          break
        case 503:
          message = '服务不可用'
          break
        case 504:
          message = '网关超时'
          break
        default:
          message = error.response.data?.message || '请求失败'
      }
    } else if (error.request) {
      message = '网络连接失败'
    }

    ElMessage({
      message,
      type: 'error',
      duration: 3000
    })

    return Promise.reject(error)
  }
)

// 导出常用请求方法
export default {
  get(url, params, config = {}) {
    return service({
      url,
      method: 'get',
      params,
      ...config
    })
  },

  post(url, data) {
    return service({
      url,
      method: 'post',
      data
    })
  },

  put(url, data) {
    return service({
      url,
      method: 'put',
      data
    })
  },

  delete(url, params) {
    return service({
      url,
      method: 'delete',
      params
    })
  },

  // ==================== Dashboard API ====================
  // 获取系统状态
  getStatus() {
    return this.get('/api/status')
  },

  // 获取最新数据（用于仪表盘）
  getLatestData() {
    return this.get('/api/latest-data')
  },

  // ==================== 彩种配置 ====================
  // 获取彩种列表
  getLotteryConfigs() {
    return this.get('/api/lotteries/configs')
  },

  // ==================== 历史查询 ====================
  // 获取历史数据
  getHistoryData(params) {
    // 历史数据查询可能需要较长时间（官网分页加载）
    const timeout = (params.year || params.lottery === '100007') ? 60000 : 30000
    return this.get('/api/history-data', params, { timeout })
  },

  // 导出原始axios实例，以便需要更复杂配置时使用
  request: service
}
