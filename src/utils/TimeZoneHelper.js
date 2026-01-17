/**
 * 时区处理工具类 - 统一处理所有时间转换，避免UTC/CST混乱
 *
 * 核心功能：
 * 1. 自动检测和配置时区
 * 2. 统一时间格式转换（MySQL格式 YYYY-MM-DD HH:MM:SS）
 * 3. 自动修复UTC时间到本地时间
 * 4. 支持多种输入格式
 */

import logger from './Logger.js';

class TimeZoneHelper {
  constructor() {
    // 默认时区：Asia/Shanghai (CST, UTC+8)
    this.timezone = process.env.TZ || 'Asia/Shanghai';

    // 时区偏移量（毫秒）
    this.timezoneOffset = this.detectTimezoneOffset();

    logger.info(`⏰ 时区工具初始化: ${this.timezone} (UTC${this.getOffsetHours()})`);
  }

  /**
   * 检测当前时区偏移量（相对UTC）
   */
  detectTimezoneOffset() {
    const now = new Date();
    // getTimezoneOffset返回的是本地时间与UTC的分钟差（负数表示东时区）
    // 例如CST（UTC+8）返回 -480分钟
    const offsetMinutes = -now.getTimezoneOffset();
    return offsetMinutes * 60 * 1000; // 转换为毫秒
  }

  /**
   * 获取时区偏移小时数（用于显示）
   */
  getOffsetHours() {
    const hours = this.timezoneOffset / (60 * 60 * 1000);
    return hours >= 0 ? `+${hours}` : `${hours}`;
  }

  /**
   * 🔧 核心方法：将任意时间格式转换为MySQL本地时间格式
   *
   * @param {string|Date|number} input - 输入时间（字符串/Date对象/时间戳）
   * @param {object} options - 选项
   * @param {boolean} options.isUTC - 输入是否为UTC时间（默认自动检测）
   * @param {boolean} options.forceLocal - 强制使用本地时间（不做UTC转换）
   * @returns {string} MySQL格式时间字符串 "YYYY-MM-DD HH:MM:SS"
   */
  toMySQLDateTime(input, options = {}) {
    try {
      let date;

      // 1. 解析输入为Date对象
      if (input instanceof Date) {
        date = input;
      } else if (typeof input === 'number') {
        date = new Date(input);
      } else if (typeof input === 'string') {
        // 检测是否为自然语言格式（SpeedyLot88）
        if (input.includes(',') && (input.includes('am') || input.includes('pm'))) {
          // "Tuesday,Dec 23,2025 06:26:45 pm" 格式
          const dateStr = input.split(',').slice(1).join(',').trim();
          date = new Date(dateStr);
        } else {
          date = new Date(input);
        }
      } else {
        throw new Error(`不支持的时间格式: ${typeof input}`);
      }

      // 2. 验证Date对象
      if (isNaN(date.getTime())) {
        logger.warn(`⚠️ 时间解析失败: ${input}`);
        return null;
      }

      // 3. JavaScript的Date对象会自动处理UTC时间
      // 如果输入是ISO 8601格式（如"2025-12-23T10:30:00.000Z"），
      // Date构造函数会自动转换为本地时间
      // 所以我们直接使用date对象的getFullYear()等方法即可获取本地时间

      // 4. 格式化为MySQL时间（使用本地时间的各个字段）
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      const second = String(date.getSeconds()).padStart(2, '0');

      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;

    } catch (error) {
      logger.error(`时间转换失败: ${input}`, error);
      return null;
    }
  }

  /**
   * 🔧 将MySQL时间字符串转换为Date对象（本地时间）
   *
   * @param {string} mysqlDateTime - MySQL格式 "YYYY-MM-DD HH:MM:SS"
   * @returns {Date} Date对象
   */
  fromMySQLDateTime(mysqlDateTime) {
    try {
      // MySQL时间视为本地时间
      const date = new Date(mysqlDateTime);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      return date;
    } catch (error) {
      logger.error(`MySQL时间解析失败: ${mysqlDateTime}`, error);
      return null;
    }
  }

  /**
   * 🔧 将时间戳转换为本地MySQL时间
   *
   * @param {number} timestamp - 时间戳（毫秒）
   * @returns {string} MySQL格式本地时间
   */
  timestampToLocal(timestamp) {
    return this.toMySQLDateTime(timestamp);
  }

  /**
   * 🔧 获取当前本地时间的MySQL格式
   *
   * @returns {string} MySQL格式当前时间
   */
  now() {
    return this.toMySQLDateTime(new Date());
  }

  /**
   * 🔧 计算两个时间的秒数差
   *
   * @param {string|Date} time1
   * @param {string|Date} time2
   * @returns {number} 秒数差
   */
  diffSeconds(time1, time2) {
    const date1 = time1 instanceof Date ? time1 : new Date(time1);
    const date2 = time2 instanceof Date ? time2 : new Date(time2);
    return Math.floor((date1.getTime() - date2.getTime()) / 1000);
  }

  /**
   * 🔧 添加时间间隔
   *
   * @param {string|Date} time - 基准时间
   * @param {number} seconds - 要添加的秒数
   * @returns {string} MySQL格式时间
   */
  addSeconds(time, seconds) {
    const date = time instanceof Date ? time : new Date(time);
    const newTime = date.getTime() + (seconds * 1000);
    return this.toMySQLDateTime(newTime);
  }

  /**
   * 🔧 检测并修复可能的UTC时间
   *
   * 如果MySQL时间字段存储的是UTC时间（相比本地时间慢8小时），自动修复
   *
   * @param {string} mysqlDateTime - MySQL时间字符串
   * @returns {object} { fixed: boolean, original: string, corrected: string }
   */
  autoFixUTC(mysqlDateTime) {
    try {
      // 假设mysqlDateTime是UTC时间，手动加上时区偏移
      const parts = mysqlDateTime.split(/[- :]/);
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // 月份从0开始
      const day = parseInt(parts[2]);
      const hour = parseInt(parts[3]);
      const minute = parseInt(parts[4]);
      const second = parseInt(parts[5]);

      // 创建一个UTC时间
      const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));

      // 获取本地时间
      const localDate = new Date(utcDate.getTime() + this.timezoneOffset);

      // 检查：如果修正后的时间与现在的时间差在合理范围内（比如24小时内），则认为原来是UTC时间
      const now = Date.now();
      const diffBeforeFix = Math.abs(now - utcDate.getTime());
      const diffAfterFix = Math.abs(now - localDate.getTime());

      // 如果修正后时间更接近当前时间，说明原来确实是UTC时间
      if (diffAfterFix < diffBeforeFix && diffBeforeFix > 6 * 60 * 60 * 1000) { // 差距超过6小时
        const corrected = this.toMySQLDateTime(localDate);
        logger.warn(`⚠️ 检测到UTC时间并修复: ${mysqlDateTime} → ${corrected}`);
        return {
          fixed: true,
          original: mysqlDateTime,
          corrected: corrected
        };
      }

      return {
        fixed: false,
        original: mysqlDateTime,
        corrected: mysqlDateTime
      };
    } catch (error) {
      return {
        fixed: false,
        original: mysqlDateTime,
        corrected: mysqlDateTime
      };
    }
  }

  /**
   * 格式化为易读的本地时间字符串
   *
   * @param {string|Date} time
   * @returns {string} "2025-12-23 18:30:00 CST"
   */
  toReadableString(time) {
    const mysqlTime = this.toMySQLDateTime(time);
    return `${mysqlTime} (${this.timezone})`;
  }

  /**
   * 验证时间字符串是否为有效的MySQL格式
   *
   * @param {string} mysqlDateTime
   * @returns {boolean}
   */
  isValidMySQLDateTime(mysqlDateTime) {
    if (!mysqlDateTime || typeof mysqlDateTime !== 'string') {
      return false;
    }
    const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (!pattern.test(mysqlDateTime)) {
      return false;
    }
    const date = new Date(mysqlDateTime);
    return !isNaN(date.getTime());
  }
}

// 导出单例
export default new TimeZoneHelper();
