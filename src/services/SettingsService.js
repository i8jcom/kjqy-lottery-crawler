/**
 * 系统设置服务
 * 管理系统配置（SMTP等）
 */

class SettingsService {
  constructor(dbConnection) {
    this.db = dbConnection
  }

  /**
   * 获取配置
   */
  async getSetting(key) {
    const [rows] = await this.db.query(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      [key]
    )

    if (rows.length === 0) {
      return null
    }

    try {
      return JSON.parse(rows[0].setting_value)
    } catch {
      return rows[0].setting_value
    }
  }

  /**
   * 保存配置
   */
  async saveSetting(key, value, description = '') {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : value

    await this.db.query(
      `INSERT INTO system_settings (setting_key, setting_value, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         setting_value = VALUES(setting_value),
         description = VALUES(description),
         updated_at = CURRENT_TIMESTAMP`,
      [key, valueStr, description]
    )

    return true
  }

  /**
   * 获取SMTP配置
   */
  async getSMTPConfig() {
    return await this.getSetting('smtp_config')
  }

  /**
   * 保存SMTP配置
   */
  async saveSMTPConfig(config) {
    return await this.saveSetting('smtp_config', config, 'SMTP邮件服务器配置')
  }

  /**
   * 获取钉钉配置
   */
  async getDingTalkConfig() {
    return await this.getSetting('dingtalk_config')
  }

  /**
   * 保存钉钉配置
   */
  async saveDingTalkConfig(config) {
    return await this.saveSetting('dingtalk_config', config, '钉钉通知配置')
  }

  /**
   * 获取企业微信配置
   */
  async getWeChatConfig() {
    return await this.getSetting('wechat_config')
  }

  /**
   * 保存企业微信配置
   */
  async saveWeChatConfig(config) {
    return await this.saveSetting('wechat_config', config, '企业微信通知配置')
  }

  /**
   * 获取Webhook配置
   */
  async getWebhookConfig() {
    return await this.getSetting('webhook_config')
  }

  /**
   * 保存Webhook配置
   */
  async saveWebhookConfig(config) {
    return await this.saveSetting('webhook_config', config, 'Webhook通知配置')
  }

  async getSystemConfig() {
    return await this.getSetting('system_config')
  }

  async saveSystemConfig(config) {
    return await this.saveSetting('system_config', config, '系统参数配置')
  }

  async getSecurityConfig() {
    return await this.getSetting('security_config')
  }

  async saveSecurityConfig(config) {
    return await this.saveSetting('security_config', config, '安全配置')
  }

  async getDatabaseConfig() {
    return await this.getSetting('database_config')
  }

  async saveDatabaseConfig(config) {
    return await this.saveSetting('database_config', config, '数据库连接配置')
  }

  /**
   * 获取配置历史
   */
  async getHistory(limit = 10) {
    const [rows] = await this.db.query(
      `SELECT id, setting_key, description, updated_at, created_at
       FROM system_settings
       ORDER BY updated_at DESC
       LIMIT ?`,
      [limit]
    )
    return rows
  }
}

export default SettingsService
