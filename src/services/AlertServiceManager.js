/**
 * 告警服务管理器 - 全局单例
 *
 * 提供全局访问告警服务的统一入口
 * 由WebServer初始化后，可在任何模块中调用
 */
import logger from '../utils/Logger.js'

class AlertServiceManager {
  constructor() {
    this.alertService = null
    this.initialized = false
  }

  /**
   * 初始化告警服务
   * @param {AlertService} alertServiceInstance - AlertService实例
   */
  initialize(alertServiceInstance) {
    if (this.initialized) {
      logger.warn('[AlertServiceManager] 告警服务已经初始化，跳过重复初始化')
      return
    }

    this.alertService = alertServiceInstance
    this.initialized = true
    logger.success('[AlertServiceManager] 全局告警服务管理器已初始化')
  }

  /**
   * 获取告警服务实例
   */
  getService() {
    if (!this.initialized || !this.alertService) {
      logger.debug('[AlertServiceManager] 告警服务未初始化，跳过告警检查')
      return null
    }
    return this.alertService
  }

  /**
   * 检查爬取失败告警
   */
  async checkCrawlFailure(lotCode, lotName, failureCount, timeWindow) {
    const service = this.getService()
    if (!service) return

    try {
      await service.checkCrawlFailure(lotCode, lotName, failureCount, timeWindow)
    } catch (error) {
      logger.error(`[AlertServiceManager] 检查爬取失败告警异常:`, error.message)
    }
  }

  /**
   * 检查响应超时告警
   */
  async checkTimeout(lotCode, lotName, responseTime) {
    const service = this.getService()
    if (!service) return

    try {
      await service.checkTimeout(lotCode, lotName, responseTime)
    } catch (error) {
      logger.error(`[AlertServiceManager] 检查响应超时告警异常:`, error.message)
    }
  }

  /**
   * 检查HTTP错误告警
   */
  async checkHttpError(lotCode, lotName, statusCode, consecutiveErrors) {
    const service = this.getService()
    if (!service) return

    try {
      await service.checkHttpError(lotCode, lotName, statusCode, consecutiveErrors)
    } catch (error) {
      logger.error(`[AlertServiceManager] 检查HTTP错误告警异常:`, error.message)
    }
  }

  /**
   * 检查数据完整性告警
   */
  async checkDataCompleteness(lotCode, lotName, completeness) {
    const service = this.getService()
    if (!service) return

    try {
      await service.checkDataCompleteness(lotCode, lotName, completeness)
    } catch (error) {
      logger.error(`[AlertServiceManager] 检查数据完整性告警异常:`, error.message)
    }
  }

  /**
   * 检查彩种长时间无更新告警
   */
  async checkLotteryStale(lotCode, lotName, minutesSinceLastUpdate, isHighFreq) {
    const service = this.getService()
    if (!service) return

    try {
      await service.checkLotteryStale(lotCode, lotName, minutesSinceLastUpdate, isHighFreq)
    } catch (error) {
      logger.error(`[AlertServiceManager] 检查彩种无更新告警异常:`, error.message)
    }
  }
}

// 导出单例
export default new AlertServiceManager()
