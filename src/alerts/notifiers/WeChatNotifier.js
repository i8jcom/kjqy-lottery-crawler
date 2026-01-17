import logger from '../../utils/Logger.js';

/**
 * 企业微信机器人通知器
 */
class WeChatNotifier {
  constructor(config = {}) {
    this.enabled = config.enabled || false;
    this.config = {
      webhook: config.webhook || process.env.WECHAT_WEBHOOK,
      mentionedList: config.mentionedList || [], // @的用户ID列表
      mentionedMobileList: config.mentionedMobileList || [] // @的手机号列表
    };
  }

  /**
   * 发送企业微信通知
   */
  async send(alert) {
    if (!this.enabled || !this.config.webhook) {
      logger.warn('企业微信通知未启用或未配置');
      return;
    }

    const { level, title, message, data, timestamp } = alert;

    // 构建消息内容
    const content = this.buildMarkdown(level, title, message, data, timestamp);

    // 构建请求体
    const body = {
      msgtype: 'markdown',
      markdown: {
        content
      }
    };

    try {
      const response = await fetch(this.config.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (result.errcode === 0) {
        logger.info('📱 企业微信消息发送成功');
        return result;
      } else {
        throw new Error(`企业微信API错误: ${result.errmsg}`);
      }
    } catch (error) {
      logger.error('📱 企业微信消息发送失败', error);
      throw error;
    }
  }

  /**
   * 构建Markdown格式消息
   */
  buildMarkdown(level, title, message, data, timestamp) {
    const levelIcon = this.getLevelIcon(level);
    const levelText = this.getLevelText(level);
    const timeStr = timestamp.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

    let markdown = `## ${levelIcon} ${title}\n`;
    markdown += `> **级别**: <font color="${this.getLevelColor(level)}">${levelText}</font>\n`;
    markdown += `> **时间**: ${timeStr}\n\n`;
    markdown += `**详情**\n${message}\n\n`;

    // 添加详细数据
    if (Object.keys(data).length > 0) {
      markdown += `**数据信息**\n`;
      for (const [key, value] of Object.entries(data)) {
        markdown += `> ${key}: ${JSON.stringify(value)}\n`;
      }
      markdown += `\n`;
    }

    // @相关人员
    if (this.config.mentionedList.length > 0) {
      this.config.mentionedList.forEach(userId => {
        markdown += `<@${userId}>`;
      });
    }

    return markdown;
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
   * 获取级别文本
   */
  getLevelText(level) {
    const texts = {
      critical: '严重',
      error: '错误',
      warning: '警告',
      info: '信息'
    };
    return texts[level] || '未知';
  }

  /**
   * 获取级别颜色
   */
  getLevelColor(level) {
    const colors = {
      critical: 'warning', // 企业微信的红色
      error: 'warning',
      warning: 'comment', // 企业微信的灰色
      info: 'info' // 企业微信的绿色
    };
    return colors[level] || 'comment';
  }

  /**
   * 测试企业微信配置
   */
  async test() {
    return this.send({
      level: 'info',
      title: '企业微信通知测试',
      message: '这是一条测试消息，如果您收到此消息，说明企业微信机器人配置正确。',
      data: { test: true },
      timestamp: new Date()
    });
  }
}

export default WeChatNotifier;
