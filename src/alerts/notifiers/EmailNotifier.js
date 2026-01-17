import nodemailer from 'nodemailer';
import logger from '../../utils/Logger.js';

/**
 * 邮件通知器
 */
class EmailNotifier {
  constructor(config = {}) {
    this.enabled = config.enabled || false;
    this.config = {
      host: config.host || process.env.SMTP_HOST,
      port: config.port || process.env.SMTP_PORT || 587,
      secure: config.secure || false,
      auth: {
        user: config.user || process.env.SMTP_USER,
        pass: config.pass || process.env.SMTP_PASS
      },
      from: config.from || process.env.SMTP_FROM || 'crawler@example.com',
      to: config.to || process.env.ALERT_EMAIL || 'admin@example.com'
    };

    this.transporter = null;
    if (this.enabled && this.config.host) {
      this.initTransporter();
    }
  }

  /**
   * 初始化邮件传输器
   */
  initTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth
      });
      logger.info('📧 邮件通知器初始化成功');
    } catch (error) {
      logger.error('📧 邮件通知器初始化失败', error);
      this.enabled = false;
    }
  }

  /**
   * 发送邮件通知
   */
  async send(alert) {
    if (!this.enabled || !this.transporter) {
      logger.warn('邮件通知未启用或未配置');
      return;
    }

    const { level, title, message, data, timestamp } = alert;

    // 邮件HTML模板
    const html = this.buildEmailHTML(level, title, message, data, timestamp);

    const mailOptions = {
      from: this.config.from,
      to: this.config.to,
      subject: `[${this.getLevelIcon(level)} ${level.toUpperCase()}] ${title}`,
      html
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`📧 邮件发送成功: ${info.messageId}`);
      return info;
    } catch (error) {
      // 检查是否为测试配置
      const isTestConfig = this.config.user && this.config.user.includes('test@');
      if (isTestConfig) {
        logger.debug('📧 邮件发送失败（测试配置）', error.message);
      } else {
        logger.error('📧 邮件发送失败', error.message);
      }
      throw error;
    }
  }

  /**
   * 构建邮件HTML
   */
  buildEmailHTML(level, title, message, data, timestamp) {
    const levelColor = this.getLevelColor(level);
    const levelIcon = this.getLevelIcon(level);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${levelColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
          .data-box { background: white; padding: 15px; margin: 15px 0; border-radius: 4px; border-left: 4px solid ${levelColor}; }
          .footer { text-align: center; color: #999; margin-top: 20px; font-size: 12px; }
          pre { background: #eee; padding: 10px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${levelIcon} ${title}</h2>
            <p style="margin: 5px 0;">级别: ${level.toUpperCase()}</p>
            <p style="margin: 5px 0;">时间: ${timestamp.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
          </div>
          <div class="content">
            <h3>告警信息</h3>
            <p>${message}</p>

            ${Object.keys(data).length > 0 ? `
              <div class="data-box">
                <h4>详细数据</h4>
                <pre>${JSON.stringify(data, null, 2)}</pre>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>此邮件由爬虫系统监控告警自动发送</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 获取级别颜色
   */
  getLevelColor(level) {
    const colors = {
      critical: '#d32f2f',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196f3'
    };
    return colors[level] || '#666';
  }

  /**
   * 获取级别图标
   */
  getLevelIcon(level) {
    const icons = {
      critical: '🔴',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[level] || '📢';
  }

  /**
   * 测试邮件配置
   */
  async test() {
    return this.send({
      level: 'info',
      title: '邮件通知测试',
      message: '这是一封测试邮件，如果您收到此邮件，说明邮件通知配置正确。',
      data: { test: true },
      timestamp: new Date()
    });
  }
}

export default EmailNotifier;
