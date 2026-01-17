/**
 * 告警服务 - 监控系统运行状态并触发告警
 *
 * 功能：
 * 1. 告警规则管理（增删改查）
 * 2. 实时监控各项指标
 * 3. 触发告警并记录历史
 * 4. 发送通知（邮件/钉钉/Webhook）
 *
 * @author Claude
 * @date 2026-01-11
 */

import axios from 'axios';
import os from 'os';
import nodemailer from 'nodemailer';

class AlertService {
  constructor(dbConnection, settingsService = null) {
    this.db = dbConnection
    this.settingsService = settingsService // 设置服务
    this.monitoringIntervals = new Map() // 监控定时器
    this.alertCache = new Map() // 告警缓存，防止重复告警
    this.COOLDOWN_PERIOD = 300000 // 冷却期5分钟，防止同一告警频繁触发
    this.emailTransporter = null // 邮件传输器
    this.smtpConfig = null // SMTP配置缓存
  }

  /**
   * 初始化告警服务
   */
  async initialize() {
    console.log('📢 [AlertService] 初始化告警服务...')

    // 加载所有启用的规则
    const rules = await this.getEnabledRules()
    console.log(`📢 [AlertService] 加载了 ${rules.length} 条启用的告警规则`)

    // 启动系统监控
    this.startSystemMonitoring()

    console.log('✅ [AlertService] 告警服务初始化完成')
  }

  // ==================== 规则管理 ====================

  /**
   * 获取所有告警规则
   */
  async getAllRules() {
    const [rows] = await this.db.query(
      'SELECT * FROM alert_rules ORDER BY id ASC'
    )
    return rows.map(row => this.parseRuleConfig(row))
  }

  /**
   * 获取所有启用的规则
   */
  async getEnabledRules() {
    const [rows] = await this.db.query(
      'SELECT * FROM alert_rules WHERE enabled = 1 ORDER BY id ASC'
    )
    return rows.map(row => this.parseRuleConfig(row))
  }

  /**
   * 根据ID获取单个告警规则
   */
  async getRuleById(id) {
    const [rows] = await this.db.query(
      'SELECT * FROM alert_rules WHERE id = ?',
      [id]
    )

    if (rows.length === 0) {
      return null
    }

    return this.parseRuleConfig(rows[0])
  }

  /**
   * 解析规则配置（JSON字段）
   */
  parseRuleConfig(row) {
    return {
      ...row,
      condition_config: typeof row.condition_config === 'string'
        ? JSON.parse(row.condition_config)
        : row.condition_config,
      notification_channels: typeof row.notification_channels === 'string'
        ? JSON.parse(row.notification_channels)
        : row.notification_channels,
      notification_config: typeof row.notification_config === 'string'
        ? JSON.parse(row.notification_config)
        : row.notification_config
    }
  }

  /**
   * 创建新规则
   */
  async createRule(ruleData) {
    const {
      name,
      rule_type,
      condition_config,
      level,
      notification_channels,
      notification_config,
      description
    } = ruleData

    const [result] = await this.db.query(
      `INSERT INTO alert_rules
       (name, rule_type, condition_config, level, notification_channels, notification_config, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        rule_type,
        JSON.stringify(condition_config),
        level,
        JSON.stringify(notification_channels || []),
        JSON.stringify(notification_config || {}),
        description
      ]
    )

    return { id: result.insertId, ...ruleData }
  }

  /**
   * 更新规则
   */
  async updateRule(id, updates) {
    const fields = []
    const values = []

    if (updates.name) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.condition_config) {
      fields.push('condition_config = ?')
      values.push(JSON.stringify(updates.condition_config))
    }
    if (updates.level) {
      fields.push('level = ?')
      values.push(updates.level)
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?')
      values.push(updates.enabled ? 1 : 0)
    }
    if (updates.notification_channels) {
      fields.push('notification_channels = ?')
      values.push(JSON.stringify(updates.notification_channels))
    }
    if (updates.notification_config) {
      fields.push('notification_config = ?')
      values.push(JSON.stringify(updates.notification_config))
    }
    if (updates.description !== undefined) {
      fields.push('description = ?')
      values.push(updates.description)
    }

    if (fields.length === 0) {
      throw new Error('No fields to update')
    }

    values.push(id)

    await this.db.query(
      `UPDATE alert_rules SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return { id, ...updates }
  }

  /**
   * 删除规则
   */
  async deleteRule(id) {
    await this.db.query('DELETE FROM alert_rules WHERE id = ?', [id])
    return { id }
  }

  // ==================== 告警触发 ====================

  /**
   * 检查爬取失败告警
   */
  async checkCrawlFailure(lotCode, lotName, failureCount, timeWindow = 600) {
    const rules = await this.getRulesByType('crawl_fail')

    for (const rule of rules) {
      const { threshold, timeWindow: configWindow } = rule.condition_config
      const actualWindow = configWindow || timeWindow

      if (failureCount >= threshold) {
        await this.triggerAlert(rule, {
          message: `${lotName} 连续爬取失败 ${failureCount} 次`,
          details: JSON.stringify({
            lotCode,
            lotName,
            failureCount,
            threshold,
            timeWindow: actualWindow
          }),
          lot_code: lotCode,
          lot_name: lotName,
          metric_value: `${failureCount}次`
        })
      }
    }
  }

  /**
   * 检查响应超时告警
   */
  async checkTimeout(lotCode, lotName, responseTime) {
    const rules = await this.getRulesByType('timeout')

    for (const rule of rules) {
      const { threshold } = rule.condition_config

      if (responseTime > threshold) {
        await this.triggerAlert(rule, {
          message: `${lotName} 响应超时 ${(responseTime / 1000).toFixed(2)}秒`,
          details: JSON.stringify({
            lotCode,
            lotName,
            responseTime,
            threshold
          }),
          lot_code: lotCode,
          lot_name: lotName,
          metric_value: `${(responseTime / 1000).toFixed(2)}秒`
        })
      }
    }
  }

  /**
   * 检查HTTP错误告警 (502/503)
   */
  async checkHttpError(lotCode, lotName, statusCode, consecutiveErrors) {
    const rules = await this.getRulesByType('http_error')

    for (const rule of rules) {
      const { threshold, statusCodes } = rule.condition_config

      if (statusCodes.includes(statusCode) && consecutiveErrors >= threshold) {
        await this.triggerAlert(rule, {
          message: `${lotName} 连续 ${consecutiveErrors} 次遭遇 HTTP ${statusCode} 错误`,
          details: JSON.stringify({
            lotCode,
            lotName,
            statusCode,
            consecutiveErrors,
            threshold
          }),
          lot_code: lotCode,
          lot_name: lotName,
          metric_value: `${consecutiveErrors}次 HTTP ${statusCode}`
        })
      }
    }
  }

  /**
   * 检查数据完整性告警
   */
  async checkDataCompleteness(lotCode, lotName, completeness) {
    const rules = await this.getRulesByType('data_completeness')

    for (const rule of rules) {
      const { threshold, operator } = rule.condition_config

      const isTriggered = operator === '<' ? completeness < threshold : completeness <= threshold

      if (isTriggered) {
        await this.triggerAlert(rule, {
          message: `${lotName} 数据完整率仅 ${completeness.toFixed(1)}%`,
          details: JSON.stringify({
            lotCode,
            lotName,
            completeness,
            threshold
          }),
          lot_code: lotCode,
          lot_name: lotName,
          metric_value: `${completeness.toFixed(1)}%`
        })
      }
    }
  }

  /**
   * 检查彩种长时间无更新告警
   */
  async checkLotteryStale(lotCode, lotName, minutesSinceLastUpdate, isHighFreq = true) {
    const rules = await this.getRulesByType('lottery_stale')

    for (const rule of rules) {
      const { threshold, highFreqOnly } = rule.condition_config
      const thresholdMinutes = threshold / 60 // 转换为分钟

      // 如果规则仅针对高频彩，且当前彩种不是高频彩，则跳过
      if (highFreqOnly && !isHighFreq) continue

      if (minutesSinceLastUpdate > thresholdMinutes) {
        await this.triggerAlert(rule, {
          message: `${lotName} 已超过 ${minutesSinceLastUpdate} 分钟未更新`,
          details: JSON.stringify({
            lotCode,
            lotName,
            minutesSinceLastUpdate,
            thresholdMinutes,
            isHighFreq
          }),
          lot_code: lotCode,
          lot_name: lotName,
          metric_value: `${minutesSinceLastUpdate}分钟`
        })
      }
    }
  }

  /**
   * 根据类型获取规则
   */
  async getRulesByType(ruleType) {
    const [rows] = await this.db.query(
      'SELECT * FROM alert_rules WHERE rule_type = ? AND enabled = 1',
      [ruleType]
    )
    return rows.map(row => this.parseRuleConfig(row))
  }

  /**
   * 触发告警
   */
  async triggerAlert(rule, alertData) {
    // 检查冷却期，防止同一告警短时间内重复触发
    const cacheKey = `${rule.id}_${alertData.lot_code || 'system'}`
    const lastAlertTime = this.alertCache.get(cacheKey)

    if (lastAlertTime && Date.now() - lastAlertTime < this.COOLDOWN_PERIOD) {
      console.log(`⏸️ [AlertService] 告警在冷却期内，跳过: ${rule.name}`)
      return null
    }

    // 记录告警历史
    const [result] = await this.db.query(
      `INSERT INTO alert_history
       (rule_id, rule_name, level, message, details, lot_code, lot_name, metric_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.id,
        rule.name,
        rule.level,
        alertData.message,
        alertData.details,
        alertData.lot_code || null,
        alertData.lot_name || null,
        alertData.metric_value || null
      ]
    )

    const alertId = result.insertId

    // 更新冷却期缓存
    this.alertCache.set(cacheKey, Date.now())

    // 发送通知
    const notificationsSent = await this.sendNotifications(rule, alertData)

    // 更新通知发送状态
    if (notificationsSent.length > 0) {
      await this.db.query(
        'UPDATE alert_history SET notification_sent = 1, notification_channels = ? WHERE id = ?',
        [JSON.stringify(notificationsSent), alertId]
      )
    }

    console.log(`🚨 [AlertService] 告警触发: ${rule.name} - ${alertData.message}`)

    return { alertId, rule, alertData }
  }

  // ==================== 通知发送 ====================

  /**
   * 发送告警通知
   */
  async sendNotifications(rule, alertData) {
    const sentChannels = []
    const channels = rule.notification_channels || []

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(rule, alertData)
            sentChannels.push('email')
            break
          case 'dingtalk':
            await this.sendDingTalkNotification(rule, alertData)
            sentChannels.push('dingtalk')
            break
          case 'webhook':
            await this.sendWebhookNotification(rule, alertData)
            sentChannels.push('webhook')
            break
          case 'wechat':
            await this.sendWeChatNotification(rule, alertData)
            sentChannels.push('wechat')
            break
        }
      } catch (error) {
        console.error(`❌ [AlertService] 发送 ${channel} 通知失败:`, error.message)
      }
    }

    return sentChannels
  }

  /**
   * 发送邮件通知
   */
  async sendEmailNotification(rule, alertData) {
    const emailConfig = rule.notification_config?.email
    if (!emailConfig) {
      console.warn('⚠️ [AlertService] 邮箱地址未配置')
      return
    }

    // 获取SMTP配置（优先从数据库读取，其次环境变量）
    let smtpConfig = this.smtpConfig

    if (!smtpConfig && this.settingsService) {
      try {
        smtpConfig = await this.settingsService.getSMTPConfig()
        if (smtpConfig) {
          this.smtpConfig = smtpConfig // 缓存配置
          console.log('📧 [AlertService] 从数据库加载SMTP配置')
        }
      } catch (error) {
        console.log('⚠️ [AlertService] 数据库中未找到SMTP配置，使用环境变量')
      }
    }

    // 如果数据库和缓存都没有，使用环境变量
    if (!smtpConfig) {
      smtpConfig = {
        host: process.env.SMTP_HOST || 'smtp.qq.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER || 'your-email@qq.com',
        pass: process.env.SMTP_PASS || 'your-smtp-password'
      }
    }

    // 验证SMTP配置
    if (!smtpConfig.user || !smtpConfig.pass || smtpConfig.user === 'your-email@qq.com') {
      console.error('❌ [AlertService] SMTP未配置，请在系统设置中配置或使用环境变量')
      throw new Error('SMTP未配置')
    }

    // 初始化邮件传输器（如果还未初始化或配置已更改）
    if (!this.emailTransporter) {
      // 构建邮件传输器配置
      const transportConfig = {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465, // true for 465, false for other ports
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        }
      }

      // 163邮箱特殊配置：使用25端口时需要禁用TLS
      if (smtpConfig.host === 'smtp.163.com' && smtpConfig.port === 25) {
        transportConfig.ignoreTLS = true
        transportConfig.secure = false
      }

      this.emailTransporter = nodemailer.createTransport(transportConfig)
      console.log(`📧 [AlertService] SMTP传输器已初始化: ${smtpConfig.host}:${smtpConfig.port}`)
    }

    // 根据告警级别设置不同的emoji和颜色
    const levelEmoji = {
      critical: '🔴',
      error: '🟠',
      warning: '🟡',
      info: '🔵'
    }

    const levelText = {
      critical: '严重',
      error: '错误',
      warning: '警告',
      info: '信息'
    }

    // 构建邮件内容
    const subject = `${levelEmoji[rule.level]} [${levelText[rule.level]}] ${rule.name}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; margin: 0;">🔔 彩票爬虫告警通知</h2>
        </div>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px;">
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 15px;">
            <h3 style="margin-top: 0; color: #333;">${levelEmoji[rule.level]} ${rule.name}</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;">告警级别</td>
                <td style="padding: 8px 0; font-weight: bold;">${levelText[rule.level]}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">告警消息</td>
                <td style="padding: 8px 0;">${alertData.message}</td>
              </tr>
              ${alertData.lot_name ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">彩种名称</td>
                <td style="padding: 8px 0;">${alertData.lot_name}</td>
              </tr>
              ` : ''}
              ${alertData.metric_value !== undefined ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">当前值</td>
                <td style="padding: 8px 0;">${alertData.metric_value}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #666;">触发时间</td>
                <td style="padding: 8px 0;">${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
              </tr>
            </table>
          </div>
          <div style="background: white; padding: 15px; border-radius: 8px; font-size: 12px; color: #999;">
            <p style="margin: 0;">此邮件由彩票爬虫告警系统自动发送，请勿回复。</p>
            <p style="margin: 5px 0 0 0;">查看详情：<a href="http://localhost:4000/alerts">http://localhost:4000/alerts</a></p>
          </div>
        </div>
      </div>
    `

    // 发送邮件
    try {
      await this.emailTransporter.sendMail({
        from: smtpConfig.user,
        to: emailConfig,
        subject: subject,
        html: html
      })
      console.log(`📧 [AlertService] 邮件通知已发送至: ${emailConfig}`)
    } catch (error) {
      console.error(`❌ [AlertService] 邮件发送失败:`, error.message)
      throw error
    }
  }

  /**
   * 发送钉钉通知
   */
  async sendDingTalkNotification(rule, alertData) {
    const webhookUrl = rule.notification_config?.dingtalk
    if (!webhookUrl) {
      console.warn('⚠️ [AlertService] 钉钉Webhook未配置')
      return
    }

    const levelEmoji = {
      critical: '🔴',
      error: '🟠',
      warning: '🟡',
      info: '🔵'
    }

    const message = {
      msgtype: 'markdown',
      markdown: {
        title: `${levelEmoji[rule.level]} ${rule.name}`,
        text: `### ${levelEmoji[rule.level]} ${rule.name}\n\n` +
              `**告警消息**: ${alertData.message}\n\n` +
              `**告警级别**: ${rule.level.toUpperCase()}\n\n` +
              `**彩种名称**: ${alertData.lot_name || '系统'}\n\n` +
              `**触发时间**: ${new Date().toLocaleString('zh-CN')}\n\n`
      }
    }

    try {
      // 获取钉钉加签secret（如果配置了）
      const secret = rule.notification_config?.dingtalkSecret
      let finalUrl = webhookUrl

      // 如果配置了加签secret，生成签名
      if (secret) {
        const timestamp = Date.now()
        const crypto = await import('crypto')
        const stringToSign = `${timestamp}\n${secret}`
        const sign = crypto.createHmac('sha256', secret)
          .update(stringToSign)
          .digest('base64')

        finalUrl = `${webhookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
        console.log(`🔐 [AlertService] 钉钉消息已加签`)
      }

      const response = await axios.post(finalUrl, message, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10秒超时
      })

      if (response.data && response.data.errcode === 0) {
        console.log(`💬 [AlertService] 发送钉钉通知成功: ${rule.name} -> ${webhookUrl}`)
      } else {
        console.warn(`⚠️ [AlertService] 钉钉通知响应异常:`, response.data)
      }
    } catch (error) {
      console.error(`❌ [AlertService] 发送钉钉通知失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 发送企业微信通知
   */
  async sendWeChatNotification(rule, alertData) {
    const webhookUrl = rule.notification_config?.wechat
    if (!webhookUrl) {
      console.warn('⚠️ [AlertService] 企业微信Webhook未配置')
      return
    }

    const levelEmoji = {
      critical: '🔴',
      error: '🟠',
      warning: '🟡',
      info: '🔵'
    }

    const message = {
      msgtype: 'markdown',
      markdown: {
        content: `### ${levelEmoji[rule.level]} ${rule.name}\n\n` +
                `**告警消息**: ${alertData.message}\n\n` +
                `**告警级别**: ${rule.level.toUpperCase()}\n\n` +
                `**彩种名称**: ${alertData.lot_name || '系统'}\n\n` +
                `**触发时间**: ${new Date().toLocaleString('zh-CN')}\n\n`
      }
    }

    try {
      const response = await axios.post(webhookUrl, message, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10秒超时
      })

      if (response.data && response.data.errcode === 0) {
        console.log(`💬 [AlertService] 发送企业微信通知成功: ${rule.name} -> ${webhookUrl}`)
      } else {
        console.warn(`⚠️ [AlertService] 企业微信通知响应异常:`, response.data)
      }
    } catch (error) {
      console.error(`❌ [AlertService] 发送企业微信通知失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 发送Webhook通知
   */
  async sendWebhookNotification(rule, alertData) {
    const webhookUrl = rule.notification_config?.webhook || process.env.ALERT_WEBHOOK
    if (!webhookUrl) {
      console.warn('⚠️ [AlertService] Webhook未配置')
      return
    }

    const payload = {
      rule_name: rule.name,
      rule_type: rule.rule_type,
      level: rule.level,
      message: alertData.message,
      lot_code: alertData.lot_code,
      lot_name: alertData.lot_name,
      metric_value: alertData.metric_value,
      timestamp: new Date().toISOString()
    }

    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Crawler-Alert-System/1.0'
        },
        timeout: 10000 // 10秒超时
      })
      console.log(`🔗 [AlertService] 发送Webhook通知成功: ${rule.name} -> ${webhookUrl}`)
    } catch (error) {
      console.error(`❌ [AlertService] 发送Webhook通知失败: ${error.message}`)
      throw error
    }
  }

  // ==================== 系统监控 ====================

  /**
   * 启动系统监控
   */
  startSystemMonitoring() {
    // 每分钟检查一次系统资源
    const interval = setInterval(async () => {
      await this.checkSystemResources()
    }, 60000)

    this.monitoringIntervals.set('system', interval)
    console.log('🖥️ [AlertService] 系统监控已启动')
  }

  /**
   * 检查系统资源
   */
  async checkSystemResources() {
    const rules = await this.getRulesByType('system_error')
    if (rules.length === 0) return

    const cpuUsage = await this.getCpuUsage()
    const memUsage = this.getMemoryUsage()

    for (const rule of rules) {
      const { cpuThreshold, memThreshold } = rule.condition_config

      if (cpuUsage > cpuThreshold) {
        await this.triggerAlert(rule, {
          message: `系统CPU使用率过高: ${cpuUsage.toFixed(1)}%`,
          details: JSON.stringify({ cpuUsage, threshold: cpuThreshold }),
          metric_value: `${cpuUsage.toFixed(1)}%`
        })
      }

      if (memUsage > memThreshold) {
        await this.triggerAlert(rule, {
          message: `系统内存使用率过高: ${memUsage.toFixed(1)}%`,
          details: JSON.stringify({ memUsage, threshold: memThreshold }),
          metric_value: `${memUsage.toFixed(1)}%`
        })
      }
    }
  }

  /**
   * 获取CPU使用率
   */
  async getCpuUsage() {
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type]
      }
      totalIdle += cpu.times.idle
    })

    return ((1 - totalIdle / totalTick) * 100)
  }

  /**
   * 获取内存使用率
   */
  getMemoryUsage() {
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    return ((totalMem - freeMem) / totalMem) * 100
  }

  // ==================== 统计查询 ====================

  /**
   * 获取今日告警统计
   */
  async getTodayStats() {
    const [rows] = await this.db.query('SELECT * FROM alert_stats_today')
    return rows[0] || {
      total: 0,
      pending: 0,
      resolved: 0,
      critical_count: 0,
      error_count: 0,
      warning_count: 0,
      resolve_rate: 0
    }
  }

  /**
   * 获取告警历史
   */
  async getAlertHistory(filters = {}) {
    let query = 'SELECT * FROM alert_history WHERE 1=1'
    const params = []

    if (filters.level) {
      query += ' AND level = ?'
      params.push(filters.level)
    }

    if (filters.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }

    if (filters.lotCode) {
      query += ' AND lot_code = ?'
      params.push(filters.lotCode)
    }

    if (filters.startDate) {
      query += ' AND created_at >= ?'
      params.push(filters.startDate)
    }

    if (filters.endDate) {
      query += ' AND created_at <= ?'
      params.push(filters.endDate)
    }

    query += ' ORDER BY created_at DESC'

    if (filters.limit) {
      query += ' LIMIT ?'
      params.push(parseInt(filters.limit))
    }

    const [rows] = await this.db.query(query, params)
    return rows
  }

  /**
   * 停止所有监控
   */
  stopMonitoring() {
    for (const [name, interval] of this.monitoringIntervals) {
      clearInterval(interval)
      console.log(`🛑 [AlertService] 停止监控: ${name}`)
    }
    this.monitoringIntervals.clear()
  }
}

export default AlertService;
