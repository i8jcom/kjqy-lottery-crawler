import crypto from 'crypto';
import logger from '../../utils/Logger.js';

/**
 * 钉钉机器人通知器
 */
class DingTalkNotifier {
  constructor(config = {}) {
    this.enabled = config.enabled || false;
    this.config = {
      webhook: config.webhook || process.env.DINGTALK_WEBHOOK,
      secret: config.secret || process.env.DINGTALK_SECRET,
      atMobiles: config.atMobiles || [],
      atAll: config.atAll || false
    };
  }

  /**
   * 发送钉钉通知
   */
  async send(alert) {
    if (!this.enabled || !this.config.webhook) {
      logger.warn('钉钉通知未启用或未配置');
      return;
    }

    const { level, title, message, data, timestamp } = alert;

    // 构建消息内容
    const content = this.buildMarkdown(level, title, message, data, timestamp);

    // 构建请求URL（带签名）
    const url = this.buildSignedUrl();

    // 构建请求体
    const body = {
      msgtype: 'markdown',
      markdown: {
        title: `[${level.toUpperCase()}] ${title}`,
        text: content
      },
      at: {
        atMobiles: this.config.atMobiles,
        isAtAll: this.config.atAll
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (result.errcode === 0) {
        logger.info('💬 钉钉消息发送成功');
        return result;
      } else {
        throw new Error(`钉钉API错误: ${result.errmsg}`);
      }
    } catch (error) {
      // 检查是否为测试配置
      const isTestConfig = this.config.webhook && this.config.webhook.includes('/TEST');
      if (isTestConfig) {
        logger.debug('💬 钉钉消息发送失败（测试配置）', error.message);
      } else {
        logger.error('💬 钉钉消息发送失败', error.message);
      }
      throw error;
    }
  }

  /**
   * 构建Markdown格式消息
   */
  buildMarkdown(level, title, message, data, timestamp) {
    const levelIcon = this.getLevelIcon(level);
    const timeStr = timestamp.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let markdown = `## ${levelIcon} ${title}\n\n`;
    markdown += `**级别**: <font color="${this.getLevelColor(level)}">${level.toUpperCase()}</font>\n\n`;
    markdown += `**时间**: ${timeStr}\n\n`;
    markdown += `**详情**: ${message}\n\n`;

    // 添加详细数据
    if (Object.keys(data).length > 0) {
      markdown += `**数据**:\n\n`;
      markdown += '```json\n';
      markdown += JSON.stringify(data, null, 2);
      markdown += '\n```\n\n';
    }

    markdown += `---\n\n`;
    markdown += `> 爬虫系统监控告警`;

    return markdown;
  }

  /**
   * 构建带签名的URL
   */
  buildSignedUrl() {
    let url = this.config.webhook;

    // 如果配置了secret，添加签名
    if (this.config.secret) {
      const timestamp = Date.now();
      const sign = this.generateSign(timestamp);
      url += `&timestamp=${timestamp}&sign=${sign}`;
    }

    return url;
  }

  /**
   * 生成签名
   */
  generateSign(timestamp) {
    const stringToSign = `${timestamp}\n${this.config.secret}`;
    const hmac = crypto.createHmac('sha256', this.config.secret);
    hmac.update(stringToSign);
    return encodeURIComponent(hmac.digest('base64'));
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
   * 测试钉钉配置
   */
  async test() {
    return this.send({
      level: 'info',
      title: '钉钉通知测试',
      message: '这是一条测试消息，如果您收到此消息，说明钉钉机器人配置正确。',
      data: { test: true },
      timestamp: new Date()
    });
  }
}

export default DingTalkNotifier;
