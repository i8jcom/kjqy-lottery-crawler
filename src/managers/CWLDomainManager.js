import mysql from 'mysql2/promise';
import logger from '../utils/Logger.js';
import axios from 'axios';

/**
 * 中国福彩API域名管理器（企业版）
 *
 * 核心功能：
 * ✅ 多域名池管理
 * ✅ 智能故障转移（自动切换）
 * ✅ 健康检查和性能监控
 * ✅ 历史记录追踪
 * ✅ 告警触发集成
 *
 * 使用示例：
 * ```javascript
 * const domain = await cwlDomainManager.getBestDomain();
 * const success = await cwlDomainManager.recordSuccess(domain.id, 150);
 * ```
 */
class CWLDomainManager {
  constructor() {
    this.pool = null;
    this.currentDomain = null; // 缓存当前域名
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = 5 * 60 * 1000; // 5分钟健康检查
    this.failureThreshold = 3; // 连续失败阈值
    this.performanceDegradedThresholdMs = 5000; // 性能降级阈值（5秒）
    this.alertService = null; // 告警服务（延迟注入）
  }

  /**
   * 初始化数据库连接池
   */
  _initPool() {
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || '1Panel-mysql-7kLA',
        port: parseInt(process.env.DB_PORT) || 3306,
        database: process.env.DB_NAME || 'lottery_crawler',
        user: process.env.DB_USER || 'lottery',
        password: process.env.DB_PASSWORD || 'lottery123',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        dateStrings: true
      });
      logger.debug(`[CWLDomainManager] 数据库连接池已初始化: ${process.env.DB_HOST || '1Panel-mysql-7kLA'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'lottery_crawler'}`);
    }
    return this.pool;
  }

  /**
   * 注入告警服务（避免循环依赖）
   */
  setAlertService(alertService) {
    this.alertService = alertService;
    logger.debug('[CWLDomainManager] 告警服务已注入');
  }

  /**
   * 启动健康检查
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      logger.warn('[CWLDomainManager] 健康检查已在运行');
      return;
    }

    logger.info(`[CWLDomainManager] 🏥 启动域名健康检查（间隔：${this.healthCheckIntervalMs / 1000}秒）`);

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
      logger.info('[CWLDomainManager] 健康检查已停止');
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck() {
    try {
      const domains = await this.getAllDomains();
      const enabledDomains = domains.filter(d => d.enabled);

      logger.debug(`[CWLDomainManager] 🏥 开始健康检查（${enabledDomains.length}个域名）`);

      for (const domain of enabledDomains) {
        await this.testDomainHealth(domain);
      }

      logger.debug('[CWLDomainManager] ✅ 健康检查完成');
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 健康检查失败', error);
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

    // 🔧 根据数据源类型选择不同的测试端点（移到外部以便catch块访问）
    const testEndpoints = {
      'cwl': '/QuanGuoCai/getLotteryInfoList.do?lotCode=10041',
      'speedylot88': '/speedy10-result.php',
      'sglotteries': '/api/result/load-ft.php',
      'auluckylotteries': '/results/lucky-ball-5/',
      'luckysscai': '/index.php',
      'luckylottoz': '/api/latest/getLotteryPksInfo.do?lotCode=10057',
      'uklottos': '/api/result/load-lotto5.php',
      'hkjc': '/marksix/markSixRealTime.js',
      'sportslottery': '/gateway/lottery/getDigitalDrawInfoV1.qry?param=85,0&isVerify=1'
    };

    const testPath = testEndpoints[domain.source_type] || '/';
    const testUrl = `${domain.domain_url}${testPath}`;

    try {
      // 🔧 体彩API需要完整浏览器头（受腾讯云EdgeOne保护，会检测请求头）
      const headers = domain.source_type === 'sportslottery' ? {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://webapi.sporttery.cn/',
        'Origin': 'https://webapi.sporttery.cn'
      } : {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      const response = await axios.get(testUrl, {
        timeout: 8000,
        headers
      });

      httpStatus = response.status;
      const responseTime = Date.now() - startTime;

      // 记录成功
      await this.recordSuccess(domain.id, responseTime);

      logger.debug(`[CWLDomainManager] ✅ ${domain.domain_url} 健康检查通过 (${responseTime}ms)`);
    } catch (error) {
      checkResult = error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' ? 'timeout' : 'error';
      errorMessage = error.message;
      httpStatus = error.response?.status || null;
      const responseTime = Date.now() - startTime;

      // 🔧 体彩API特殊处理：记录详细错误信息
      if (domain.source_type === 'sportslottery') {
        logger.warn(`[CWLDomainManager] 🔍 体彩健康检查失败详情:`);
        logger.warn(`  - URL: ${testUrl}`);
        logger.warn(`  - 错误信息: ${errorMessage}`);
        logger.warn(`  - HTTP状态码: ${httpStatus || '无'}`);
        logger.warn(`  - 错误代码: ${error.code || '无'}`);
        if (error.response) {
          logger.warn(`  - 响应数据: ${JSON.stringify(error.response.data).substring(0, 200)}`);
          logger.warn(`  - 响应头: ${JSON.stringify(error.response.headers)}`);
        }
      }

      // 记录失败
      await this.recordFailure(domain.id, error, false); // 健康检查失败不触发自动切换

      logger.warn(`[CWLDomainManager] ⚠️ ${domain.domain_url} 健康检查失败: ${errorMessage}`);
    }

    // 记录健康检查日志
    await this.logHealthCheck(domain.id, domain.domain_url, checkResult, Date.now() - startTime, httpStatus, errorMessage);
  }

  /**
   * 记录健康检查日志
   */
  async logHealthCheck(domainId, domainUrl, checkResult, responseTimeMs, httpStatus, errorMessage) {
    const pool = this._initPool();

    // 🔧 修复列名匹配：is_success (1=成功, 0=失败), status_code (HTTP状态码)
    const isSuccess = checkResult === 'success' ? 1 : 0;

    const query = `
      INSERT INTO cwl_domain_health_logs
      (domain_id, domain_url, check_type, status_code, response_time_ms, is_success, error_message)
      VALUES (?, ?, 'scheduled', ?, ?, ?, ?)
    `;

    try {
      await pool.query(query, [domainId, domainUrl, httpStatus, responseTimeMs, isSuccess, errorMessage]);
      logger.debug(`[CWLDomainManager] 📝 健康检查日志已记录: ${domainUrl} - ${isSuccess ? '成功' : '失败'}`);
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 记录健康检查日志失败', error);
    }
  }

  /**
   * 获取当前最优域名
   * 策略：优先级最高 + 状态active + 已启用
   */
  async getBestDomain() {
    const pool = this._initPool();
    const query = `
      SELECT * FROM cwl_api_domains
      WHERE enabled = TRUE AND status IN ('active', 'degraded')
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
      const [rows] = await pool.query(query);

      if (rows.length === 0) {
        // 没有可用域名，尝试获取任何已启用的域名
        const [fallbackRows] = await pool.query(
          'SELECT * FROM cwl_api_domains WHERE enabled = TRUE ORDER BY priority ASC LIMIT 1'
        );

        if (fallbackRows.length === 0) {
          throw new Error('没有可用的域名配置');
        }

        logger.warn('[CWLDomainManager] ⚠️ 所有域名状态异常，使用备用域名');
        this.currentDomain = fallbackRows[0];
        return fallbackRows[0];
      }

      this.currentDomain = rows[0];
      logger.debug(`[CWLDomainManager] 🎯 当前最优域名: ${rows[0].domain_url} (优先级: ${rows[0].priority})`);
      return rows[0];
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 获取最优域名失败', error);
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

      logger.debug(`[CWLDomainManager] ✅ 记录成功: 域名ID=${domainId}, 响应时间=${responseTimeMs}ms`);
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 记录成功失败', error);
    }
  }

  /**
   * 记录失败请求
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

      logger.warn(`[CWLDomainManager] ⚠️ 记录失败: ${domain.domain_url}, 连续失败=${domain.consecutive_failures}次`);

      // 检查是否达到故障转移阈值
      if (autoSwitch && domain.consecutive_failures >= this.failureThreshold) {
        logger.error(`[CWLDomainManager] 🔥 域名故障: ${domain.domain_url} (连续${domain.consecutive_failures}次失败)`);

        // 触发自动故障转移
        await this.performAutoFailover(domain, errorMessage);
      }
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 记录失败失败', error);
    }
  }

  /**
   * 执行自动故障转移
   */
  async performAutoFailover(failedDomain, errorMessage) {
    try {
      logger.warn(`[CWLDomainManager] 🔄 开始自动故障转移: ${failedDomain.domain_url}`);

      // 获取下一个可用域名
      const newDomain = await this.getNextAvailableDomain(failedDomain.id);

      if (!newDomain) {
        logger.error('[CWLDomainManager] ❌ 没有可用的备用域名！');

        // 触发告警：所有域名均不可用
        await this.triggerAlert('all_domains_failed', {
          failedDomain: failedDomain.domain_url,
          error: errorMessage
        });

        return false;
      }

      // 记录切换历史
      await this.recordDomainSwitch(
        failedDomain.id,
        newDomain.id,
        'auto_failover',
        'system',
        null,
        `域名故障（连续${failedDomain.consecutive_failures}次失败）: ${errorMessage}`
      );

      // 清空缓存，下次getBestDomain会自动获取新域名
      this.currentDomain = null;

      logger.success(`[CWLDomainManager] ✅ 自动切换成功: ${failedDomain.domain_url} → ${newDomain.domain_url}`);

      // 触发告警：域名自动切换
      await this.triggerAlert('domain_auto_switched', {
        oldDomain: failedDomain.domain_url,
        newDomain: newDomain.domain_url,
        reason: errorMessage
      });

      return true;
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 自动故障转移失败', error);
      return false;
    }
  }

  /**
   * 获取下一个可用域名（排除当前失败的域名）
   */
  async getNextAvailableDomain(excludeDomainId) {
    const pool = this._initPool();
    const query = `
      SELECT * FROM cwl_api_domains
      WHERE enabled = TRUE
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
      const [rows] = await pool.query(query, [excludeDomainId]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 获取备用域名失败', error);
      return null;
    }
  }

  /**
   * 记录域名切换历史
   */
  async recordDomainSwitch(oldDomainId, newDomainId, switchReason, triggerType, operator, failureInfo) {
    const pool = this._initPool();

    // 获取域名URL
    const [oldDomain] = await pool.query('SELECT domain_url FROM cwl_api_domains WHERE id = ?', [oldDomainId]);
    const [newDomain] = await pool.query('SELECT domain_url FROM cwl_api_domains WHERE id = ?', [newDomainId]);

    const query = `
      INSERT INTO cwl_domain_switch_history
      (old_domain_id, new_domain_id, old_domain_url, new_domain_url, switch_reason, trigger_type, operator, failure_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await pool.query(query, [
        oldDomainId,
        newDomainId,
        oldDomain[0]?.domain_url,
        newDomain[0]?.domain_url,
        switchReason,
        triggerType,
        operator || 'system',
        failureInfo
      ]);

      logger.info(`[CWLDomainManager] 📝 域名切换历史已记录`);
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 记录切换历史失败', error);
    }
  }

  /**
   * 触发告警
   */
  async triggerAlert(alertType, context) {
    if (!this.alertService) {
      logger.debug('[CWLDomainManager] 告警服务未配置，跳过告警');
      return;
    }

    try {
      const alertManager = (await import('../alerts/AlertManager.js')).default;

      // 根据告警类型触发不同的告警
      if (alertType === 'domain_auto_switched') {
        logger.warn(`[CWLDomainManager] 🚨 触发告警: 域名自动切换`);

        await alertManager.sendAlert({
          level: 'warning',
          title: '福彩API域名自动切换',
          message: `福彩API域名已自动切换\n\n` +
                   `旧域名: ${context.oldDomain}\n` +
                   `新域名: ${context.newDomain}\n` +
                   `切换原因: ${context.reason}\n\n` +
                   `系统已自动切换至备用域名，服务继续正常运行。`,
          data: context,
          notifiers: ['all']
        });

      } else if (alertType === 'all_domains_failed') {
        logger.error(`[CWLDomainManager] 🚨 触发告警: 所有域名不可用`);

        await alertManager.sendAlert({
          level: 'critical',
          title: '福彩API所有域名不可用',
          message: `⚠️ 严重告警：福彩API所有域名均不可用！\n\n` +
                   `失效域名: ${context.failedDomain}\n` +
                   `错误信息: ${context.error}\n\n` +
                   `请立即检查并添加新的可用域名！\n` +
                   `管理界面: http://localhost:4000`,
          data: context,
          notifiers: ['all']
        });

      } else if (alertType === 'domain_performance_degraded') {
        logger.warn(`[CWLDomainManager] 🚨 触发告警: 域名性能降级`);

        await alertManager.sendAlert({
          level: 'warning',
          title: '福彩API域名性能降级',
          message: `福彩API域名响应缓慢\n\n` +
                   `域名: ${context.domainUrl}\n` +
                   `响应时间: ${context.responseTime}ms (正常<${this.performanceDegradedThresholdMs}ms)\n\n` +
                   `建议准备切换至其他域名。`,
          data: context,
          notifiers: ['dingtalk']
        });
      }
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 触发告警失败', error);
    }
  }

  /**
   * 手动切换域名
   */
  async switchDomain(newDomainId, reason = 'manual', operator = 'admin') {
    try {
      const currentDomain = await this.getBestDomain();
      const pool = this._initPool();

      // 获取新域名信息
      const [rows] = await pool.query('SELECT * FROM cwl_api_domains WHERE id = ?', [newDomainId]);

      if (rows.length === 0) {
        throw new Error('目标域名不存在');
      }

      const newDomain = rows[0];

      if (!newDomain.enabled) {
        throw new Error('目标域名未启用');
      }

      // 如果是切换到同一个域名，跳过
      if (currentDomain.id === newDomainId) {
        logger.info('[CWLDomainManager] 目标域名已是当前域名，无需切换');
        return { success: true, message: '目标域名已是当前域名' };
      }

      // 记录切换历史
      await this.recordDomainSwitch(
        currentDomain.id,
        newDomainId,
        reason,
        'user',
        operator,
        null
      );

      // 清空缓存
      this.currentDomain = null;

      logger.success(`[CWLDomainManager] ✅ 手动切换成功: ${currentDomain.domain_url} → ${newDomain.domain_url}`);

      return {
        success: true,
        message: '域名切换成功',
        oldDomain: currentDomain.domain_url,
        newDomain: newDomain.domain_url
      };
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 手动切换域名失败', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 获取所有域名
   */
  async getAllDomains() {
    const pool = this._initPool();
    const query = 'SELECT * FROM cwl_api_domains ORDER BY priority ASC';

    try {
      const [rows] = await pool.query(query);
      return rows;
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 获取所有域名失败', error);
      return [];
    }
  }

  /**
   * 获取域名切换历史
   */
  async getDomainHistory(limit = 50) {
    const pool = this._initPool();
    const query = `
      SELECT * FROM cwl_domain_switch_history
      ORDER BY created_at DESC
      LIMIT ?
    `;

    try {
      const [rows] = await pool.query(query, [limit]);
      return rows;
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 获取切换历史失败', error);
      return [];
    }
  }

  /**
   * 添加新域名
   */
  async addDomain(domainUrl, domainType = 'backup', priority = 100) {
    const pool = this._initPool();
    const query = `
      INSERT INTO cwl_api_domains
      (domain_url, domain_type, priority, status, enabled)
      VALUES (?, ?, ?, 'active', TRUE)
    `;

    try {
      const [result] = await pool.query(query, [domainUrl, domainType, priority]);
      logger.success(`[CWLDomainManager] ✅ 添加域名成功: ${domainUrl}`);
      return { success: true, id: result.insertId };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        logger.warn(`[CWLDomainManager] ⚠️ 域名已存在: ${domainUrl}`);
        return { success: false, message: '域名已存在' };
      }
      logger.error('[CWLDomainManager] ❌ 添加域名失败', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 更新域名配置
   */
  async updateDomain(domainId, updates) {
    const pool = this._initPool();
    const allowedFields = ['source_type', 'domain_url', 'domain_type', 'priority', 'status', 'enabled', 'notes'];
    const updateFields = [];
    const updateValues = [];

    // 详细日志：收到的更新请求
    logger.info(`[CWLDomainManager] 📝 收到更新请求 - ID=${domainId}, 更新内容:`, updates);

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        updateValues.push(value);
        logger.debug(`[CWLDomainManager]   - ${key} = ${value}`);
      } else {
        logger.warn(`[CWLDomainManager]   - 忽略字段 ${key} (不在允许列表中)`);
      }
    }

    if (updateFields.length === 0) {
      logger.warn(`[CWLDomainManager] ⚠️ 没有可更新的字段`);
      return { success: false, message: '没有可更新的字段' };
    }

    // 自动更新 updated_at 时间戳
    updateFields.push('updated_at = NOW()');

    updateValues.push(domainId);
    const query = `UPDATE cwl_api_domains SET ${updateFields.join(', ')} WHERE id = ?`;

    // 详细日志：执行的SQL
    logger.info(`[CWLDomainManager] 🔍 执行SQL: ${query}`);
    logger.info(`[CWLDomainManager] 🔍 参数值: [${updateValues.join(', ')}]`);

    try {
      const [result] = await pool.query(query, updateValues);

      // 详细日志：更新结果
      logger.info(`[CWLDomainManager] 📊 更新结果 - 影响行数: ${result.affectedRows}, 改变行数: ${result.changedRows}`);

      if (result.affectedRows === 0) {
        logger.warn(`[CWLDomainManager] ⚠️ 未找到ID=${domainId}的域名`);
        return { success: false, message: '域名不存在' };
      }

      if (result.changedRows === 0) {
        logger.warn(`[CWLDomainManager] ⚠️ 域名数据未发生变化（可能值相同）`);
      }

      // 查询更新后的数据验证
      const [rows] = await pool.query('SELECT * FROM cwl_api_domains WHERE id = ?', [domainId]);
      if (rows.length > 0) {
        logger.info(`[CWLDomainManager] ✅ 更新后的域名数据: domain_url=${rows[0].domain_url}, updated_at=${rows[0].updated_at}`);
      }

      logger.success(`[CWLDomainManager] ✅ 更新域名成功: ID=${domainId}`);
      return { success: true };
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 更新域名失败', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 删除域名
   */
  async deleteDomain(domainId) {
    const pool = this._initPool();

    // 检查是否是最后一个启用的域名
    const [enabledDomains] = await pool.query('SELECT COUNT(*) as count FROM cwl_api_domains WHERE enabled = TRUE');

    if (enabledDomains[0].count <= 1) {
      return { success: false, message: '至少需要保留一个启用的域名' };
    }

    const query = 'DELETE FROM cwl_api_domains WHERE id = ?';

    try {
      await pool.query(query, [domainId]);
      logger.success(`[CWLDomainManager] ✅ 删除域名成功: ID=${domainId}`);

      // 清空缓存
      this.currentDomain = null;

      return { success: true };
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 删除域名失败', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 测试域名可用性
   */
  async testDomain(domainUrl) {
    const startTime = Date.now();

    try {
      // 使用福彩3D API测试
      const testUrl = `${domainUrl}/QuanGuoCai/getLotteryInfoList.do?lotCode=10041`;
      const response = await axios.get(testUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        responseTime,
        httpStatus: response.status,
        message: '域名可用'
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        success: false,
        responseTime,
        error: error.message,
        message: '域名不可用'
      };
    }
  }

  /**
   * 获取域名健康统计
   */
  async getDomainHealthStats(domainId, hours = 24) {
    const pool = this._initPool();
    const query = `
      SELECT
        check_result,
        COUNT(*) as count,
        AVG(response_time_ms) as avg_response_time
      FROM cwl_domain_health_logs
      WHERE domain_id = ?
        AND checked_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
      GROUP BY check_result
    `;

    try {
      const [rows] = await pool.query(query, [domainId, hours]);
      return rows;
    } catch (error) {
      logger.error('[CWLDomainManager] ❌ 获取健康统计失败', error);
      return [];
    }
  }
}

// 导出单例
const cwlDomainManager = new CWLDomainManager();
export default cwlDomainManager;
