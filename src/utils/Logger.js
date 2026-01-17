import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 日志工具类
 */
class Logger {
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          return `[${timestamp}] ${level.toUpperCase()}: ${message}${stack ? '\n' + stack : ''}`;
        })
      ),
      transports: [
        // 控制台输出
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message }) => {
              return `[${timestamp}] ${level}: ${message}`;
            })
          )
        }),
        // 所有日志
        new winston.transports.File({
          filename: path.join(__dirname, '../../logs/crawler.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),
        // 错误日志
        new winston.transports.File({
          filename: path.join(__dirname, '../../logs/error.log'),
          level: 'error',
          maxsize: 10485760,
          maxFiles: 5
        })
      ]
    });
  }

  info(message) {
    this.logger.info(message);
  }

  warn(message) {
    this.logger.warn(message);
  }

  error(message, error) {
    if (error) {
      this.logger.error(message, { stack: error.stack });
    } else {
      this.logger.error(message);
    }
  }

  debug(message) {
    this.logger.debug(message);
  }

  success(message) {
    this.logger.info(`✅ ${message}`);
  }
}

export default new Logger();
