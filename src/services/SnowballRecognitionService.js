/**
 * 金多寶智能识别服务
 *
 * 用于自动识别和分类香港六合彩金多寶类型
 * 基于2011-2025年历史数据分析结果
 */

class SnowballRecognitionService {
  constructor() {
    // 金多寶类型定义 (基于15年历史数据分析)
    this.SNOWBALL_TYPES = {
      // 节日类 (Festival-based)
      CHINESE_NEW_YEAR: { code: 'CHINESE_NEW_YEAR', name: '新春金多寶', category: 'festival' },
      NEW_YEAR: { code: 'NEW_YEAR', name: '新年金多寶', category: 'festival' },
      DRAGON_BOAT: { code: 'DRAGON_BOAT', name: '端午金多寶', category: 'festival' },
      SUMMER: { code: 'SUMMER', name: '暑期金多寶', category: 'festival' },
      MID_AUTUMN: { code: 'MID_AUTUMN', name: '中秋金多寶', category: 'festival' },
      HALLOWEEN: { code: 'HALLOWEEN', name: '萬聖節金多寶', category: 'festival' },
      CHRISTMAS: { code: 'CHRISTMAS', name: '聖誕金多寶', category: 'festival' },
      EASTER: { code: 'EASTER', name: '復活節金多寶', category: 'festival' },
      CHRISTMAS_NEW_YEAR: { code: 'CHRISTMAS_NEW_YEAR', name: '聖誕新年金多寶', category: 'festival' },

      // 纪念类 (Commemorative)
      NATIONAL_DAY: { code: 'NATIONAL_DAY', name: '國慶金多寶', category: 'commemorative' },
      HANDOVER: { code: 'HANDOVER', name: '回歸金多寶', category: 'commemorative' },
      ANNIVERSARY: { code: 'ANNIVERSARY', name: '週年金多寶', category: 'commemorative' },

      // 特殊类 (Special - 2025新类型)
      LUCKY_TUESDAY: { code: 'LUCKY_TUESDAY', name: '幸運二金多寶', category: 'special' },
      OPENING: { code: 'OPENING', name: '開鑼金多寶', category: 'special' },

      // 未知类型
      UNKNOWN: { code: 'UNKNOWN', name: '未知金多寶', category: 'unknown' }
    };

    // 识别规则 (按优先级排序 - 更具体的规则放在前面)
    this.recognitionRules = [
      // 节日类 - 高置信度 (99%)
      // 注意: 复合词必须在单一词之前匹配
      { pattern: /聖誕新年/, type: 'CHRISTMAS_NEW_YEAR', confidence: 0.99, monthRange: [12, 1] },
      { pattern: /新春/, type: 'CHINESE_NEW_YEAR', confidence: 0.99, monthRange: [1, 2] },
      { pattern: /新年/, type: 'NEW_YEAR', confidence: 0.99, monthRange: [1, 1], dayRange: [1, 15] },
      { pattern: /端午/, type: 'DRAGON_BOAT', confidence: 0.99, monthRange: [5, 6] },
      { pattern: /暑期/, type: 'SUMMER', confidence: 0.99, monthRange: [7, 8] },
      { pattern: /中秋/, type: 'MID_AUTUMN', confidence: 0.99, monthRange: [9, 9] },
      { pattern: /萬聖節/, type: 'HALLOWEEN', confidence: 0.99, monthRange: [10, 10], dayRange: [25, 31] },
      { pattern: /復活節/, type: 'EASTER', confidence: 0.99, monthRange: [3, 4] },
      { pattern: /聖誕/, type: 'CHRISTMAS', confidence: 0.99, monthRange: [12, 12] },

      // 纪念类 - 中等置信度 (95%)
      { pattern: /國慶/, type: 'NATIONAL_DAY', confidence: 0.95, monthRange: [10, 10], dayRange: [1, 1] },
      { pattern: /回歸/, type: 'HANDOVER', confidence: 0.95, monthRange: [7, 7], dayRange: [1, 1] },
      { pattern: /週年|周年/, type: 'ANNIVERSARY', confidence: 0.90 },

      // 特殊类 - 高置信度 (95%)
      { pattern: /幸運二/, type: 'LUCKY_TUESDAY', confidence: 0.95, weekDay: 2 },
      { pattern: /開鑼/, type: 'OPENING', confidence: 0.95 }
    ];
  }

  /**
   * 识别金多寶类型 (主方法)
   *
   * @param {string} snowballName - 金多寶名称 (e.g., "新春金多寶", "中秋金多寶")
   * @param {Date|string} drawDate - 开奖日期 (可选，用于验证)
   * @returns {Object} 识别结果
   */
  recognize(snowballName, drawDate = null) {
    // 如果没有金多寶名称，返回null
    if (!snowballName || snowballName.trim() === '') {
      return null;
    }

    // 基于关键词匹配识别类型
    const keywordResult = this.recognizeByKeyword(snowballName);

    // 如果提供了日期，进行日期验证
    if (drawDate && keywordResult.type !== 'UNKNOWN') {
      const dateValidation = this.validateByDate(keywordResult.type, drawDate);

      // 如果日期验证失败，降低置信度
      if (!dateValidation.valid) {
        keywordResult.confidence *= 0.8;
        keywordResult.warnings = keywordResult.warnings || [];
        keywordResult.warnings.push(dateValidation.reason);
      }
    }

    return keywordResult;
  }

  /**
   * 基于关键词识别金多寶类型
   *
   * @param {string} snowballName - 金多寶名称
   * @returns {Object} 识别结果
   */
  recognizeByKeyword(snowballName) {
    for (const rule of this.recognitionRules) {
      if (rule.pattern.test(snowballName)) {
        const typeInfo = this.SNOWBALL_TYPES[rule.type];

        return {
          isSnowball: true,
          snowballName: snowballName,
          snowballType: rule.type,
          snowballTypeCode: typeInfo.code,
          snowballTypeName: typeInfo.name,
          category: typeInfo.category,
          confidence: rule.confidence,
          matchedPattern: rule.pattern.source
        };
      }
    }

    // 未识别的金多寶
    return {
      isSnowball: true,
      snowballName: snowballName,
      snowballType: 'UNKNOWN',
      snowballTypeCode: 'UNKNOWN',
      snowballTypeName: snowballName,
      category: 'unknown',
      confidence: 0.5,
      warnings: ['无法识别的金多寶类型']
    };
  }

  /**
   * 基于日期验证金多寶类型
   *
   * @param {string} type - 金多寶类型代码
   * @param {Date|string} drawDate - 开奖日期
   * @returns {Object} 验证结果
   */
  validateByDate(type, drawDate) {
    const date = new Date(drawDate);
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate(); // 1-31
    const weekDay = date.getDay(); // 0-6 (Sunday-Saturday)

    // 查找对应的规则
    const rule = this.recognitionRules.find(r => r.type === type);
    if (!rule) {
      return { valid: true, reason: 'No validation rule' };
    }

    // 验证月份范围
    if (rule.monthRange) {
      const [minMonth, maxMonth] = rule.monthRange;
      if (month < minMonth || month > maxMonth) {
        return {
          valid: false,
          reason: `日期不在预期月份范围内 (期望: ${minMonth}-${maxMonth}月, 实际: ${month}月)`
        };
      }
    }

    // 验证日期范围
    if (rule.dayRange) {
      const [minDay, maxDay] = rule.dayRange;
      if (day < minDay || day > maxDay) {
        return {
          valid: false,
          reason: `日期不在预期日期范围内 (期望: ${minDay}-${maxDay}日, 实际: ${day}日)`
        };
      }
    }

    // 验证星期几
    if (rule.weekDay !== undefined && weekDay !== rule.weekDay) {
      return {
        valid: false,
        reason: `星期不匹配 (期望: 星期${rule.weekDay}, 实际: 星期${weekDay})`
      };
    }

    return { valid: true };
  }

  /**
   * 批量识别金多寶
   *
   * @param {Array} records - 开奖记录数组
   * @returns {Array} 识别结果数组
   */
  recognizeBatch(records) {
    return records.map(record => {
      const snowballName = record.snowballName || record._metadata?.snowballName;
      const drawDate = record.draw_time || record.drawTime || record._metadata?.drawDate;

      if (!snowballName) {
        return {
          ...record,
          isSnowball: false
        };
      }

      const recognition = this.recognize(snowballName, drawDate);
      return {
        ...record,
        ...recognition
      };
    });
  }

  /**
   * 获取金多寶统计信息
   *
   * @param {Array} records - 开奖记录数组
   * @returns {Object} 统计信息
   */
  getStatistics(records) {
    const recognizedRecords = this.recognizeBatch(records);
    const snowballRecords = recognizedRecords.filter(r => r.isSnowball);

    // 按类型分组统计
    const typeStats = {};
    snowballRecords.forEach(record => {
      const type = record.snowballType;
      if (!typeStats[type]) {
        typeStats[type] = {
          type: type,
          typeName: record.snowballTypeName,
          category: record.category,
          count: 0,
          records: []
        };
      }
      typeStats[type].count++;
      typeStats[type].records.push({
        issue: record.issue || record.preDrawIssue,
        date: record.draw_time || record.drawTime || record.preDrawTime,
        name: record.snowballName
      });
    });

    // 按分类统计
    const categoryStats = {};
    Object.values(typeStats).forEach(stat => {
      const category = stat.category;
      if (!categoryStats[category]) {
        categoryStats[category] = {
          category: category,
          count: 0,
          types: []
        };
      }
      categoryStats[category].count += stat.count;
      categoryStats[category].types.push(stat.type);
    });

    return {
      total: snowballRecords.length,
      totalRecords: records.length,
      snowballRate: (snowballRecords.length / records.length * 100).toFixed(2) + '%',
      typeStats: Object.values(typeStats).sort((a, b) => b.count - a.count),
      categoryStats: categoryStats,
      unknownCount: typeStats['UNKNOWN']?.count || 0
    };
  }

  /**
   * 获取金多寶类型列表
   *
   * @returns {Array} 金多寶类型列表
   */
  getSnowballTypes() {
    return Object.values(this.SNOWBALL_TYPES);
  }

  /**
   * 根据类型代码获取类型信息
   *
   * @param {string} typeCode - 类型代码
   * @returns {Object} 类型信息
   */
  getTypeInfo(typeCode) {
    return this.SNOWBALL_TYPES[typeCode] || this.SNOWBALL_TYPES.UNKNOWN;
  }

  /**
   * 判断是否为金多寶
   *
   * @param {string} snowballName - 金多寶名称
   * @returns {boolean} 是否为金多寶
   */
  isSnowball(snowballName) {
    return snowballName && snowballName.trim() !== '';
  }

  /**
   * 健康检查
   *
   * @returns {Object} 健康状态
   */
  healthCheck() {
    return {
      healthy: true,
      service: 'SnowballRecognitionService',
      totalTypes: Object.keys(this.SNOWBALL_TYPES).length,
      totalRules: this.recognitionRules.length,
      version: '1.0.0'
    };
  }
}

// 导出单例
const snowballRecognitionService = new SnowballRecognitionService();
export default snowballRecognitionService;
