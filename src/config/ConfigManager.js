import fs from 'fs';
import path from 'path';
import logger from '../utils/Logger.js';

/**
 * 配置管理器 - 管理运行时配置
 */
class ConfigManager {
  constructor() {
    this.configFile = path.join(process.cwd(), 'data', 'runtime-config.json');
    this.config = this.loadConfig();
  }

  /**
   * 加载配置文件
   */
  loadConfig() {
    try {
      // 确保 data 目录存在
      const dataDir = path.dirname(this.configFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // 读取配置文件
      if (fs.existsSync(this.configFile)) {
        const content = fs.readFileSync(this.configFile, 'utf-8');
        const config = JSON.parse(content);
        logger.debug('配置文件加载成功');
        return config;
      } else {
        // 创建默认配置
        const defaultConfig = {
          enableAutoCrawl: process.env.ENABLE_AUTO_CRAWL !== 'false',
          lastUpdated: new Date().toISOString()
        };
        this.saveConfig(defaultConfig);
        return defaultConfig;
      }
    } catch (error) {
      logger.error('加载配置文件失败', error);
      // 返回默认配置
      return {
        enableAutoCrawl: process.env.ENABLE_AUTO_CRAWL !== 'false',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * 保存配置文件
   */
  saveConfig(config = this.config) {
    try {
      config.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf-8');
      logger.debug('配置文件保存成功');
      return true;
    } catch (error) {
      logger.error('保存配置文件失败', error);
      return false;
    }
  }

  /**
   * 获取自动爬取开关状态
   */
  getAutoCrawlEnabled() {
    return this.config.enableAutoCrawl;
  }

  /**
   * 设置自动爬取开关
   */
  setAutoCrawlEnabled(enabled) {
    this.config.enableAutoCrawl = enabled;
    this.saveConfig();
    logger.info(`自动爬取已${enabled ? '启用' : '禁用'}`);
    return true;
  }

  /**
   * 获取所有配置
   */
  getAllConfig() {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates) {
    this.config = {
      ...this.config,
      ...updates
    };
    this.saveConfig();
    return this.config;
  }
}

export default new ConfigManager();
