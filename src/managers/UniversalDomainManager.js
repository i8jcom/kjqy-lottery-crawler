import mysql from 'mysql2/promise';
import logger from '../utils/Logger.js';
import axios from 'axios';

/**
 * 通用域名管理器（企业版） - 支持所有免费API数据源
 *
 * 核心功能：
 * ✅ 多数据源域名池管理
 * ✅ 智能故障转移（自动切换）
 * ✅ 健康检查和性能监控
 * ✅ 历史记录追踪
 * ✅ 告警触发集成
 *
 * 支持的数据源：
 * - cwl: 中国福彩免费API（4个彩种）
 * - speedylot88: SpeedyLot88（7个彩种）
 * - sglotteries: SG Lotteries（6个彩种）
 * - auluckylotteries: AU Lucky Lotteries（4个彩种）
 * - luckysscai: Lucky Sscai（1个彩种）
 * - luckylottoz: Lucky Lottoz（1个彩种）
 *
 * 使用示例：
 * ```javascript
 * const domain = await universalDomainManager.getBestDomain('speedylot88');
 * await universalDomainManager.recordSuccess(domain.id, 150);
 * ```
 */
class UniversalDomainManager {
  constructor() {
    this.pool = null;
    this.currentDomains = new Map(); // 缓存各数据源的当前域名
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 5 * 60 * 1000; // 5分钟健康检查
    this.failureThreshold = 3; // 连续失败阈值
    this.performanceDegradedThresholdMs = 5000; // 性能降级阈值（5秒）
    this.alertService = null; // 告警服务（延迟注入）

    // 数据源配置
    this.sourceTypes = {
      cwl: { name: '中国福彩免费API', testEndpoint: '/QuanGuoCai/getLotteryInfoList.do?lotCode=10041' },
      speedylot88: { name: 'SpeedyLot88', testEndpoint: '/speedy10-result.php' },
      sglotteries: { name: 'SG Lotteries', testEndpoint: '/api/result/load-ft.php' },
      auluckylotteries: { name: 'AU Lucky Lotteries', testEndpoint: '/results/lucky-ball-5/' },
      luckysscai: { name: 'Lucky Sscai', testEndpoint: '/index.php' },
      luckylottoz: { name: 'Lucky Lottoz', testEndpoint: '/api/latest/getLotteryPksInfo.do?lotCode=10057' },
      taiwanlottery: { name: '台湾彩票官网', testEndpoint: '/lotto/result/lotto649' }
    };
  }

  /**
   * 初始化数据库连接池
   */
  _initPool() {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || 'lottery-mysql-compose',
        port: parseInt(process.env.DB_PORT) || 3306,
        database: process.env.DB_NAME || 'lottery_crawler',
        user: process.env.DB_USER || 'lottery',
        password: process.env.DB_PASSWORD || 'lottery123',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        dateStrings: true
      });
      logger.debug(`[UniversalDomainManager] 数据库连接池已初始化`);
    }
    return this.pool;
  }

  /**
   * 注入告警服务（避免循环依赖）
   */
  setAlertService(alertService) {
    this.alertService = alertService;
    logger.debug('[UniversalDomainManager] 告警服务已注入');
  }

  /**
   * 启动健康检查
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      logger.warn('[UniversalDomainManager] 健康检查已在运行');
      return;
    }

    logger.info(`[UniversalDomainManager] 🏥 启动全局健康检查（间隔：${this.healthCheckIntervalMs / 1000}秒）`);

    // 立即执行一次
    this.performHealthCheck();

    // 定期执行
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('[UniversalDomainManager] 健康检查已停止');
    }
  }

  /**
   * 执行健康检查（所有数据源）
   */
  async performHealthCheck() {
    try {
      const domains = await this.getAllDomains();
      const enabledDomains = domains.filter(d => d.enabled);

      logger.debug(`[UniversalDomainManager] 🏥 开始全局健康检查（${enabledDomains.length}个域名）`);

      // 按数据源分组
      const domainsBySource = {};
      for (const domain of enabledDomains) {
        if (!domainsBySource[domain.source_type]) {
          domainsBySource[domain.source_type] = [];
        }
        domainsBySource[domain.source_type].push(domain);
      }

      // 检查每个数据源的域名
      for (const [sourceType, sourceDomains] of Object.entries(domainsBySource)) {
        for (const domain of sourceDomains) {
          await this.testDomainHealth(domain);
        }
      }

      logger.debug('[UniversalDomainManager] ✅ 全局健康检查完成');
    } catch (error) {
      logger.error('[UniversalDomainManager] ❌ 全局健康检查失败', error);
    }
  }

  /**
   * 测试单个域名健康状态
   */
  async testDomainHealth(domain) {
    const startTime = Date.now();
    let checkResult = 'success';
    let errorMessage = null;
    let httpStatus = null;

    try {
      const sourceConfig = this.sourceTypes[domain.source_type];
      if (!sourceConfig) {
        logger.warn(`[UniversalDomainManager] 未知数据源类型: ${domain.source_type}`);
        return;
      }

      const testUrl = `${domain.domain_url}${sourceConfig.testEndpoint}`;
      const response = await axios.get(testUrl, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      httpStatus = response.status;
      const responseTime = Date.now() - startTime;

      // 记录成功
      await this.recordSuccess(domain.id, responseTime);

      logger.debug(`[UniversalDomainManager] ✅ [${domain.source_type}] ${domain.domain_url} 健康检查通过 (${responseTime}ms)`);
    } catch (error) {
      checkResult = error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' ? 'timeout' : 'error';
      errorMessage = error.message;
      const responseTime = Date.now() - startTime;

      // 记录失败（健康检查失败不触发自动切换）
      await this.recordFailure(domain.id, error, false);

      logger.warn(`[UniversalDomainManager] ⚠️ [${domain.source_type}] ${domain.domain_url} 健康检查失败: ${errorMessage}`);
    }

    // 记录健康检查日志
    await this.logHealthCheck(domain.source_type, domain.id, domain.domain_url, checkResult, Date.now() - startTime, httpStatus, errorMessage);
  }

  /**
   * 记录健康检查日志
   */
  async logHealthCheck(sourceType, domainId, domainUrl, checkResult, responseTimeMs, httpStatus, errorMessage) {
    const pool = this._initPool();
    const query = `
      INSERT INTO cwl_domain_health_logs
      (source_type, domain_id, domain_url, check_result, response_time_ms, http_status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await pool.query(query, [sourceType, domainId, domainUrl, checkResult, responseTimeMs, httpStatus, errorMessage]);
    } catch (error) {
      logger.error('[UniversalDomainManager] ❌ 记录健康检查日志失败', error);
    }
  }

  /**
   * 获取当前最优域名（指定数据源）
   * @param {string} sourceType - 数据源类型（cwl, speedylot88等）
   */
  async getBestDomain(sourceType = 'cwl') {
    const pool = this._initPool();
    const query = `
      SELECT * FROM cwl_api_domains
      WHERE source_type = ? AND enabled = TRUE AND status IN ('active', 'degraded')
      ORDER BY
        CASE status
          WHEN 'active' THEN 1
          WHEN 'degraded' THEN 2
          ELSE 3
        END,
        priority ASC
      LIMIT 1
    `;

    try {
      const [rows] = await pool.query(query, [sourceType]);

      if (rows.length === 0) {
        // 没有可用域名，尝试获取任何已启用的域名
        const [fallbackRows] = await pool.query(
          'SELECT * FROM cwl_api_domains WHERE source_type = ? AND enabled = TRUE ORDER BY priority ASC LIMIT 1',
          [sourceType]
        );

        if (fallbackRows.length === 0) {
          throw new Error(`[${sourceType}] 没有可用的域名配置`);
        }

        logger.warn(`[UniversalDomainManager] ⚠️ [${sourceType}] 所有域名状态异常，使用备用域名`);
        this.currentDomains.set(sourceType, fallbackRows[0]);
        return fallbackRows[0];
      }

      this.currentDomains.set(sourceType, rows[0]);
      logger.debug(`[UniversalDomainManager] 🎯 [${sourceType}] 当前最优域名: ${rows[0].domain_url} (优先级: ${rows[0].priority})`);
      return rows[0];
    } catch (error) {
      logger.error(`[UniversalDomainManager] ❌ [${sourceType}] 获取最优域名失败`, error);
      throw error;
    }
  }

  /**
   * 记录成功请求
   */
  async recordSuccess(domainId, responseTimeMs = 0) {
    const pool = this._initPool();
    const query = `
      UPDATE cwl_api_domains
      SET
        total_requests = total_requests + 1,
        success_requests = success_requests + 1,
        success_rate = ROUND((success_requests + 1) * 100.0 / (total_requests + 1), 2),
        response_time_ms = ROUND((response_time_ms * total_requests + ?) / (total_requests + 1)),
        consecutive_failures = 0,
        last_check_at = NOW(),
        last_success_at = NOW(),
        status = CASE
          WHEN ? > ? THEN 'degraded'
          ELSE 'active'
        END
      WHERE id = ?
    `;

    try {
      await pool.query(query, [
        responseTimeMs,
        responseTimeMs,
        this.performanceDegradedThresholdMs,
        domainId
      ]);

      logger.debug(`[UniversalDomainManager] ✅ 记录成功: 域名ID=${domainId}, 响应时间=${responseTimeMs}ms`);
    } catch (error) {
      logger.error('[UniversalDomainManager] ❌ 记录成功失败', error);
    }
  }

  /**
   * 记录失败请求
   * @param {number} domainId - 域名ID
   * @param {Error} error - 错误对象
   * @param {boolean} autoSwitch - 是否自动切换域名（默认true）
   */
  async recordFailure(domainId, error, autoSwitch = true) {
    const pool = this._initPool();
    const errorMessage = error?.message || String(error);

    const query = `
      UPDATE cwl_api_domains
      SET
        total_requests = total_requests + 1,
        failed_requests = failed_requests + 1,
        success_rate = ROUND(success_requests * 100.0 / (total_requests + 1), 2),
        consecutive_failures = consecutive_failures + 1,
        last_check_at = NOW(),
        last_failure_at = NOW(),
        failure_reason = ?,
        status = CASE
          WHEN consecutive_failures + 1 >= ? THEN 'failed'
          ELSE status
        END
      WHERE id = ?
    `;

    try {
      await pool.query(query, [errorMessage, this.failureThreshold, domainId]);

      // 获取更新后的域名信息
      const [rows] = await pool.query('SELECT * FROM cwl_api_domains WHERE id = ?', [domainId]);
      const domain = rows[0];

      logger.warn(`[UniversalDomainManager] ⚠️ [${domain.source_type}] 记录失败: ${domain.domain_url}, 连续失败=${domain.consecutive_failures}次`);

      // 检查是否达到故障转移阈值
      if (autoSwitch && domain.consecutive_failures >= this.failureThreshold) {
        logger.error(`[UniversalDomainManager] 🔥 [${domain.source_type}] 域名故障: ${domain.domain_url} (连续${domain.consecutive_failures}次失败)`);

        // 触发自动故障转移
        await this.performAutoFailover(domain, errorMessage);
      }
    } catch (error) {
      logger.error('[UniversalDomainManager] ❌ 记录失败失败', error);
    }
  }

  /**
   * 执行自动故障转移
   */
  async performAutoFailover(failedDomain, errorMessage) {
    try {
      logger.warn(`[UniversalDomainManager] 🔄 [${failedDomain.source_type}] 开始自动故障转移: ${failedDomain.domain_url}`);

      // 获取下一个可用域名
      const newDomain = await this.getNextAvailableDomain(failedDomain.source_type, failedDomain.id);

      if (!newDomain) {
        logger.error(`[UniversalDomainManager] ❌ [${failedDomain.source_type}] 没有可用的备用域名！`);

        // 触发告警：所有域名均不可用
        await this.triggerAlert('all_domains_failed', {
          sourceType: failedDomain.source_type,
          failedDomain: failedDomain.domain_url,
          error: errorMessage
        });

        return false;
      }

      // 记录切换历史
      await this.recordDomainSwitch(
        failedDomain.source_type,
        failedDomain.id,
        newDomain.id,
        'auto_failover',
        'system',
        null,
        `域名故障（连续${failedDomain.consecutive_failures}次失败）: ${errorMessage}`
      );

      // 清空缓存，下次getBestDomain会自动获取新域名
      this.currentDomains.delete(failedDomain.source_type);

      logger.success(`[UniversalDomainManager] ✅ [${failedDomain.source_type}] 自动切换成功: ${failedDomain.domain_url} → ${newDomain.domain_url}`);

      // 触发告警：域名自动切换
      await this.triggerAlert('domain_auto_switched', {
        sourceType: failedDomain.source_type,
        oldDomain: failedDomain.domain_url,
        newDomain: newDomain.domain_url,
        reason: errorMessage
      });

      return true;
    } catch (error) {
      logger.error(`[UniversalDomainManager] ❌ [${failedDomain.source_type}] 自动故障转移失败`, error);
      return false;
    }
  }

  /**
   * 获取下一个可用域名（排除当前失败的域名）
   */
  async getNextAvailableDomain(sourceType, excludeDomainId) {
    const pool = this._initPool();
    const query = `
      SELECT * FROM cwl_api_domains
      WHERE source_type = ?
        AND enabled = TRUE
        AND id != ?
        AND status IN ('active', 'degraded')
      ORDER BY
        CASE status
          WHEN 'active' THEN 1
          WHEN 'degraded' THEN 2
        END,
        priority ASC
      LIMIT 1
    `;

    try {
      const [rows] = await pool.query(query, [sourceType, excludeDomainId]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error(`[UniversalDomainManager] ❌ [${sourceType}] 获取备用域名失败`, error);
      return null;
    }
  }

  /**
   * 记录域名切换历史
   */
  async recordDomainSwitch(sourceType, oldDomainId, newDomainId, switchReason, triggerType, operator, failureInfo) {
    const pool = this._initPool();

    // 获取域名URL
    const [oldDomain] = await pool.query('SELECT domain_url FROM cwl_api_domains WHERE id = ?', [oldDomainId]);
    const [newDomain] = await pool.query('SELECT domain_url FROM cwl_api_domains WHERE id = ?', [newDomainId]);

    const query = `
      INSERT INTO cwl_domain_switch_history
      (source_type, old_domain_id, new_domain_id, old_domain_url, new_domain_url, switch_reason, trigger_type, operator, failure_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await pool.query(query, [
        sourceType,
        oldDomainId,
        newDomainId,
        oldDomain[0]?.domain_url,
        newDomain[0]?.domain_url,
        switchReason,
        triggerType,
        operator || 'system',
        failureInfo
      ]);

      logger.info(`[UniversalDomainManager] 📝 [${sourceType}] 域名切换历史已记录`);
    } catch (error) {
      logger.error(`[UniversalDomainManager] ❌ [${sourceType}] 记录切换历史失败`, error);
    }
  }

  /**
   * 触发告警
   */
  async triggerAlert(alertType, context) {
    if (!this.alertService) {
      logger.debug('[UniversalDomainManager] 告警服务未配置，跳过告警');
      return;
    }

    try {
      const alertManager = (await import('../alerts/AlertManager.js')).default;
      const sourceName = this.sourceTypes[context.sourceType]?.name || context.sourceType;

      // 根据告警类型触发不同的告警
      if (alertType === 'domain_auto_switched') {
        logger.warn(`[UniversalDomainManager] 🚨 触发告警: [${context.sourceType}] 域名自动切换`);

        await alertManager.sendAlert({
          level: 'warning',
          title: `${sourceName} 域名自动切换`,
          message: `${sourceName} 域名已自动切换\n\n` +
                   `旧域名: ${context.oldDomain}\n` +
                   `新域名: ${context.newDomain}\n` +
                   `切换原因: ${context.reason}\n\n` +
                   `系统已自动切换至备用域名，服务继续正常运行。`,
          data: context,
          notifiers: ['all']
        });

      } else if (alertType === 'all_domains_failed') {
        logger.error(`[UniversalDomainManager] 🚨 触发告警: [${context.sourceType}] 所有域名不可用`);

        await alertManager.sendAlert({
          level: 'critical',
          title: `${sourceName} 所有域名不可用`,
          message: `⚠️ 严重告警：${sourceName} 所有域名均不可用！\n\n` +
                   `失效域名: ${context.failedDomain}\n` +
                   `错误信息: ${context.error}\n\n` +
                   `请立即检查并添加新的可用域名！\n` +
                   `管理界面: http://localhost:4000`,
          data: context,
          notifiers: ['all']
        });
      }
    } catch (error) {
      logger.error('[UniversalDomainManager] ❌ 触发告警失败', error);
    }
  }

  /**
   * 获取所有域名
   */
  async getAllDomains(sourceType = null) {
    const pool = this._initPool();
    const query = sourceType
      ? 'SELECT * FROM cwl_api_domains WHERE source_type = ? ORDER BY source_type, priority ASC'
      : 'SELECT * FROM cwl_api_domains ORDER BY source_type, priority ASC';

    try {
      const [rows] = sourceType
        ? await pool.query(query, [sourceType])
        : await pool.query(query);
      return rows;
    } catch (error) {
      logger.error('[UniversalDomainManager] ❌ 获取所有域名失败', error);
      return [];
    }
  }

  /**
   * 获取域名切换历史
   */
  async getDomainHistory(sourceType = null, limit = 50) {
    const pool = this._initPool();
    const query = sourceType
      ? 'SELECT * FROM cwl_domain_switch_history WHERE source_type = ? ORDER BY created_at DESC LIMIT ?'
      : 'SELECT * FROM cwl_domain_switch_history ORDER BY created_at DESC LIMIT ?';

    try {
      const [rows] = sourceType
        ? await pool.query(query, [sourceType, limit])
        : await pool.query(query, [limit]);
      return rows;
    } catch (error) {
      logger.error('[UniversalDomainManager] ❌ 获取切换历史失败', error);
      return [];
    }
  }

  /**
   * 获取所有数据源的统计信息
   */
  async getSourcesStats() {
    const pool = this._initPool();
    const query = `
      SELECT
        source_type,
        COUNT(*) as total_domains,
        SUM(CASE WHEN enabled = TRUE THEN 1 ELSE 0 END) as enabled_domains,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_domains,
        AVG(CASE WHEN enabled = TRUE THEN response_time_ms ELSE NULL END) as avg_response_time,
        AVG(CASE WHEN enabled = TRUE THEN success_rate ELSE NULL END) as avg_success_rate
      FROM cwl_api_domains
      GROUP BY source_type
      ORDER BY source_type
    `;

    try {
      const [rows] = await pool.query(query);
      return rows;
    } catch (error) {
      logger.error('[UniversalDomainManager] ❌ 获取数据源统计失败', error);
      return [];
    }
  }
}

// 导出单例
const universalDomainManager = new UniversalDomainManager();
export default universalDomainManager;
