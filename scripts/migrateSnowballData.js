#!/usr/bin/env node

/**
 * 金多寶数据迁移脚本
 *
 * 功能:
 * 1. 添加金多寶相关数据库字段
 * 2. 回填现有数据的金多寶识别信息
 */

import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import snowballRecognitionService from '../src/services/SnowballRecognitionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库配置
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3308'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root123456',
  database: process.env.DB_NAME || 'lottery_crawler'
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class SnowballMigration {
  constructor() {
    this.connection = null;
    this.stats = {
      totalRecords: 0,
      updatedRecords: 0,
      snowballRecords: 0,
      errors: 0
    };
  }

  /**
   * 连接数据库
   */
  async connect() {
    try {
      log('\n🔌 正在连接数据库...', 'cyan');
      this.connection = await mysql.createConnection(DB_CONFIG);
      log('✅ 数据库连接成功', 'green');
      log(`   主机: ${DB_CONFIG.host}:${DB_CONFIG.port}`, 'blue');
      log(`   数据库: ${DB_CONFIG.database}`, 'blue');
    } catch (error) {
      log(`❌ 数据库连接失败: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * 步骤1: 应用数据库schema变更
   */
  async applySchemaChanges() {
    try {
      log('\n📝 步骤1: 应用数据库schema变更...', 'cyan');

      // 检查字段是否已存在
      const [columns] = await this.connection.query(
        `SHOW COLUMNS FROM lottery_results WHERE Field = 'snowball_name'`
      );

      if (columns.length > 0) {
        log('⚠️  金多寶字段已存在，跳过schema变更', 'yellow');
        return;
      }

      // 添加字段
      log('   添加字段: snowball_name, snowball_type, snowball_category, snowball_confidence...', 'blue');
      await this.connection.query(`
        ALTER TABLE lottery_results
        ADD COLUMN snowball_name VARCHAR(100) DEFAULT NULL COMMENT '金多寶名称',
        ADD COLUMN snowball_type VARCHAR(50) DEFAULT NULL COMMENT '金多寶类型代码',
        ADD COLUMN snowball_category VARCHAR(30) DEFAULT NULL COMMENT '金多寶分类',
        ADD COLUMN snowball_confidence DECIMAL(3,2) DEFAULT NULL COMMENT '识别置信度'
      `);

      log('✅ 字段添加成功', 'green');

      // 创建索引
      log('   创建索引...', 'blue');
      try {
        await this.connection.query('CREATE INDEX idx_snowball_type ON lottery_results(snowball_type)');
        await this.connection.query('CREATE INDEX idx_snowball_name ON lottery_results(snowball_name)');
        await this.connection.query('CREATE INDEX idx_snowball_type_time ON lottery_results(snowball_type, draw_time)');
        log('✅ 索引创建成功', 'green');
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          log('⚠️  索引已存在，跳过索引创建', 'yellow');
        } else {
          throw error;
        }
      }

    } catch (error) {
      log(`❌ Schema变更失败: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * 步骤2: 从On.cc API获取金多寶数据
   */
  async fetchSnowballDataFromAPI() {
    try {
      log('\n📥 步骤2: 从On.cc API获取金多寶数据...', 'cyan');

      // 导入 OnccHistoryScraper
      const { default: OnccHistoryScraper } = await import('../src/scrapers/OnccHistoryScraper.js');
      const scraper = new OnccHistoryScraper();

      // 获取所有年份的数据 (1985-2025)
      const currentYear = new Date().getFullYear();
      const snowballMap = new Map();

      log('   正在获取历史数据...', 'blue');

      for (let year = 2011; year <= currentYear; year++) {
        try {
          const results = await scraper.fetchYearData(year);

          results.forEach(result => {
            if (result._metadata && result._metadata.snowballName) {
              snowballMap.set(result.period, {
                issue: result.period,
                snowballName: result._metadata.snowballName,
                drawDate: result._metadata.drawDate
              });
            }
          });

          log(`   ✓ ${year}年: 找到 ${results.filter(r => r._metadata?.snowballName).length} 个金多寶`, 'green');
        } catch (error) {
          log(`   ⚠️  ${year}年数据获取失败: ${error.message}`, 'yellow');
        }
      }

      log(`\n✅ 共找到 ${snowballMap.size} 个金多寶`, 'green');
      return snowballMap;

    } catch (error) {
      log(`❌ 获取金多寶数据失败: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * 步骤3: 回填数据库记录
   */
  async backfillSnowballData(snowballMap) {
    try {
      log('\n🔄 步骤3: 回填数据库记录...', 'cyan');

      // 获取所有需要更新的记录
      const [records] = await this.connection.query(
        `SELECT issue, draw_time FROM lottery_results WHERE lot_code = '60001' ORDER BY draw_time ASC`
      );

      this.stats.totalRecords = records.length;
      log(`   总记录数: ${records.length}`, 'blue');

      let batchSize = 0;
      const BATCH_REPORT_SIZE = 10;

      for (const record of records) {
        const snowballData = snowballMap.get(record.issue);

        if (snowballData) {
          // 使用智能识别服务识别类型
          const recognition = snowballRecognitionService.recognize(
            snowballData.snowballName,
            snowballData.drawDate
          );

          if (recognition) {
            // 更新数据库
            await this.connection.query(
              `UPDATE lottery_results
               SET snowball_name = ?,
                   snowball_type = ?,
                   snowball_category = ?,
                   snowball_confidence = ?
               WHERE issue = ? AND lot_code = '60001'`,
              [
                recognition.snowballName,
                recognition.snowballType,
                recognition.category,
                recognition.confidence,
                record.issue
              ]
            );

            this.stats.updatedRecords++;
            this.stats.snowballRecords++;
            batchSize++;

            if (batchSize >= BATCH_REPORT_SIZE) {
              log(`   ✓ 已更新 ${this.stats.updatedRecords} 条记录...`, 'green');
              batchSize = 0;
            }
          }
        }
      }

      log(`\n✅ 回填完成`, 'green');
      log(`   总记录数: ${this.stats.totalRecords}`, 'blue');
      log(`   金多寶记录数: ${this.stats.snowballRecords}`, 'blue');
      log(`   更新记录数: ${this.stats.updatedRecords}`, 'blue');

    } catch (error) {
      log(`❌ 回填数据失败: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * 步骤4: 验证数据
   */
  async verifyData() {
    try {
      log('\n✅ 步骤4: 验证数据...', 'cyan');

      // 统计金多寶记录
      const [stats] = await this.connection.query(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN snowball_name IS NOT NULL THEN 1 ELSE 0 END) as snowball_count,
          ROUND(SUM(CASE WHEN snowball_name IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as percentage
        FROM lottery_results
        WHERE lot_code = '60001'
      `);

      log(`   总记录数: ${stats[0].total}`, 'blue');
      log(`   金多寶记录数: ${stats[0].snowball_count}`, 'blue');
      log(`   金多寶比例: ${stats[0].percentage}%`, 'blue');

      // 按类型统计
      const [typeStats] = await this.connection.query(`
        SELECT
          snowball_type,
          snowball_category,
          COUNT(*) as count,
          AVG(snowball_confidence) as avg_confidence
        FROM lottery_results
        WHERE lot_code = '60001' AND snowball_name IS NOT NULL
        GROUP BY snowball_type, snowball_category
        ORDER BY count DESC
      `);

      log('\n   按类型统计:', 'blue');
      typeStats.forEach(stat => {
        log(`     ${stat.snowball_type} (${stat.snowball_category}): ${stat.count}次, 平均置信度: ${(stat.avg_confidence * 100).toFixed(1)}%`, 'cyan');
      });

      log('\n✅ 数据验证完成', 'green');

    } catch (error) {
      log(`❌ 数据验证失败: ${error.message}`, 'red');
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  async close() {
    if (this.connection) {
      await this.connection.end();
      log('\n🔌 数据库连接已关闭', 'cyan');
    }
  }

  /**
   * 执行迁移
   */
  async run() {
    const startTime = Date.now();

    try {
      log('========================================', 'cyan');
      log('金多寶数据迁移脚本', 'cyan');
      log('========================================', 'cyan');

      await this.connect();
      await this.applySchemaChanges();

      const snowballMap = await this.fetchSnowballDataFromAPI();
      await this.backfillSnowballData(snowballMap);
      await this.verifyData();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      log('\n========================================', 'green');
      log('✅ 迁移完成', 'green');
      log('========================================', 'green');
      log(`总耗时: ${duration}秒`, 'blue');

    } catch (error) {
      log('\n========================================', 'red');
      log('❌ 迁移失败', 'red');
      log('========================================', 'red');
      log(`错误: ${error.message}`, 'red');
      log(`堆栈: ${error.stack}`, 'red');
      process.exit(1);
    } finally {
      await this.close();
    }
  }
}

// 运行迁移
const migration = new SnowballMigration();
migration.run().catch(error => {
  console.error('迁移脚本执行失败:', error);
  process.exit(1);
});
