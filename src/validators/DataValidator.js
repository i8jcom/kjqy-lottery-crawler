import logger from '../utils/Logger.js';

/**
 * 数据验证器 - 多源对比和数据质量检查
 */
class DataValidator {
  /**
   * 验证实时数据格式
   */
  validateRealtimeData(data) {
    if (!data) {
      logger.warn('数据为空');
      return false;
    }

    // 必填字段检查
    const requiredFields = ['issue', 'drawCode', 'drawTime', 'nextIssue', 'nextDrawTime'];
    for (const field of requiredFields) {
      if (!data[field]) {
        logger.warn(`缺少必填字段: ${field}`);
        return false;
      }
    }

    // 期号格式检查（纯数字）
    if (!/^\d+$/.test(data.issue)) {
      logger.warn(`期号格式错误: ${data.issue}`);
      return false;
    }

    // 开奖号码格式检查（不为空）
    if (!data.drawCode || data.drawCode.length === 0) {
      logger.warn('开奖号码为空');
      return false;
    }

    // 时间格式检查
    if (!this.isValidDateTime(data.drawTime)) {
      logger.warn(`开奖时间格式错误: ${data.drawTime}`);
      return false;
    }

    return true;
  }

  /**
   * 验证历史数据
   */
  validateHistoryData(records) {
    if (!Array.isArray(records) || records.length === 0) {
      logger.warn('历史数据为空或格式错误');
      return false;
    }

    for (const record of records) {
      if (!record.issue || !record.drawCode || !record.drawTime) {
        logger.warn('历史记录缺少必填字段');
        return false;
      }
    }

    return true;
  }

  /**
   * 数据新鲜度检查
   */
  checkDataFreshness(data, maxAgeMinutes = 10) {
    if (!data || !data.drawTime) {
      return false;
    }

    const drawTime = new Date(data.drawTime);
    const now = new Date();
    const ageMinutes = (now - drawTime) / 1000 / 60;

    if (ageMinutes > maxAgeMinutes) {
      logger.warn(`数据过期: ${data.issue}, 已过去 ${ageMinutes.toFixed(1)} 分钟`);
      return false;
    }

    return true;
  }

  /**
   * 多源数据对比
   * @param {Array} dataList - 来自不同数据源的数据列表
   * @returns {Object|null} - 返回验证通过的数据
   */
  compareMultiSourceData(dataList) {
    if (!dataList || dataList.length === 0) {
      logger.warn('没有可用的数据源');
      return null;
    }

    // 至少需要1个数据源
    const validData = dataList.filter(d => d && this.validateRealtimeData(d));

    if (validData.length === 0) {
      logger.warn('所有数据源都无效');
      return null;
    }

    // 如果只有1个有效数据源，直接返回
    if (validData.length === 1) {
      logger.info('只有1个有效数据源');
      return validData[0];
    }

    // 多个数据源：对比期号
    const issues = validData.map(d => d.issue);
    const uniqueIssues = [...new Set(issues)];

    if (uniqueIssues.length === 1) {
      // 所有数据源期号一致，返回第一个
      logger.success(`✅ 多源验证通过: 期号 ${uniqueIssues[0]}`);
      return validData[0];
    } else {
      // 期号不一致，选择最大的期号（最新数据）
      const latestData = validData.reduce((latest, current) => {
        return parseInt(current.issue) > parseInt(latest.issue) ? current : latest;
      });

      logger.warn(`⚠️ 数据源期号不一致: ${issues.join(', ')}, 选择最新: ${latestData.issue}`);
      return latestData;
    }
  }

  /**
   * 验证时间格式
   */
  isValidDateTime(dateTimeStr) {
    if (!dateTimeStr) return false;

    // 支持格式: YYYY-MM-DD HH:mm:ss
    const date = new Date(dateTimeStr);
    return !isNaN(date.getTime());
  }

  /**
   * 数据完整性评分
   */
  scoreDataQuality(data) {
    let score = 0;

    if (data.issue) score += 20;
    if (data.drawCode) score += 20;
    if (data.drawTime) score += 20;
    if (data.nextIssue) score += 20;
    if (data.nextDrawTime) score += 20;

    // 新鲜度加分
    if (this.checkDataFreshness(data, 5)) score += 10;
    if (this.checkDataFreshness(data, 2)) score += 10;

    return Math.min(score, 100);
  }
}

export default new DataValidator();
