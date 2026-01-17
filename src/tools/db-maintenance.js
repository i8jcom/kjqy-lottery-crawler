#!/usr/bin/env node

/**
 * 数据库维护命令行工具
 *
 * 用法:
 *   node src/tools/db-maintenance.js stats          # 查看数据库统计
 *   node src/tools/db-maintenance.js health         # 检查数据库健康
 *   node src/tools/db-maintenance.js suggestions    # 获取优化建议
 *   node src/tools/db-maintenance.js clean-dup      # 清理重复数据（模拟）
 *   node src/tools/db-maintenance.js clean-dup --real  # 清理重复数据（真实）
 *   node src/tools/db-maintenance.js clean-old      # 清理老数据（模拟，保留365天）
 *   node src/tools/db-maintenance.js clean-old --days=180 --real  # 清理180天前的数据
 *   node src/tools/db-maintenance.js optimize       # 优化表
 *   node src/tools/db-maintenance.js analyze        # 分析表
 *   node src/tools/db-maintenance.js full           # 完整维护（模拟）
 *   node src/tools/db-maintenance.js full --real    # 完整维护（真实）
 *   node src/tools/db-maintenance.js report         # 生成完整报告
 */

import dotenv from 'dotenv';
import databaseMonitor from '../db/DatabaseMonitor.js';
import databaseMaintenance from '../db/DatabaseMaintenance.js';
import logger from '../utils/Logger.js';

// 加载环境变量
dotenv.config();

const args = process.argv.slice(2);
const command = args[0];
const flags = {};

// 解析命令行参数
args.forEach(arg => {
  if (arg.startsWith('--')) {
    const parts = arg.substring(2).split('=');
    if (parts.length === 2) {
      flags[parts[0]] = parts[1];
    } else {
      flags[parts[0]] = true;
    }
  }
});

const dryRun = !flags.real;

async function main() {
  try {
    switch (command) {
      case 'stats':
      case 'statistics':
        await showStatistics();
        break;

      case 'health':
        await checkHealth();
        break;

      case 'suggestions':
        await showSuggestions();
        break;

      case 'clean-dup':
      case 'clean-duplicates':
        await cleanDuplicates();
        break;

      case 'clean-old':
      case 'clean-old-data':
        await cleanOldData();
        break;

      case 'optimize':
        await optimizeTable();
        break;

      case 'analyze':
        await analyzeTable();
        break;

      case 'full':
      case 'full-maintenance':
        await fullMaintenance();
        break;

      case 'report':
        await generateReport();
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error(`未知命令: ${command}`);
        showHelp();
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error('执行失败', error);
    process.exit(1);
  }
}

async function showStatistics() {
  console.log('\n📊 数据库统计信息\n');

  const stats = await databaseMonitor.getStatistics();

  if (!stats) {
    console.log('❌ 无法获取统计信息');
    return;
  }

  console.log('基础统计:');
  console.log(`  总记录数: ${stats.basic.total_records.toLocaleString()}`);
  console.log(`  彩种数量: ${stats.basic.total_lotteries}`);
  console.log(`  最早记录: ${stats.basic.earliest_record}`);
  console.log(`  最新记录: ${stats.basic.latest_record}`);
  console.log(`  时间跨度: ${stats.basic.days_span} 天`);

  console.log('\n表信息:');
  console.log(`  总大小: ${stats.table.size_mb} MB`);
  console.log(`  数据: ${stats.table.data_mb} MB`);
  console.log(`  索引: ${stats.table.index_mb} MB`);
  if (stats.table.table_rows) {
    console.log(`  行数: ${stats.table.table_rows.toLocaleString()}`);
  }

  console.log('\n索引:');
  stats.indexes.forEach(idx => {
    console.log(`  - ${idx.name}: [${idx.columns.join(', ')}] (基数: ${idx.cardinality})`);
  });

  console.log('\n24小时增长:');
  console.log(`  新增记录: ${stats.growth.records_24h}`);
  console.log(`  涉及彩种: ${stats.growth.lotteries_24h}`);

  console.log('\n各彩种数据量:');
  stats.lotteries.forEach(lot => {
    console.log(`  - ${lot.lot_code}: ${lot.record_count.toLocaleString()} 条 (${lot.earliest} ~ ${lot.latest})`);
  });

  console.log('');
}

async function checkHealth() {
  console.log('\n🏥 数据库健康检查\n');

  const health = await databaseMonitor.checkHealth();

  console.log(`状态: ${health.status.toUpperCase()}`);

  if (health.issues.length > 0) {
    console.log('\n⚠️  问题:');
    health.issues.forEach(issue => console.log(`  - ${issue}`));
  }

  if (health.warnings.length > 0) {
    console.log('\n💡 警告:');
    health.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  if (health.issues.length === 0 && health.warnings.length === 0) {
    console.log('\n✅ 数据库状态良好\n');
  } else {
    console.log('');
  }
}

async function showSuggestions() {
  console.log('\n💡 优化建议\n');

  const suggestions = await databaseMonitor.generateOptimizationSuggestions();

  suggestions.forEach((suggestion, index) => {
    console.log(`${index + 1}. ${suggestion}`);
  });

  console.log('');
}

async function cleanDuplicates() {
  console.log(`\n🧹 清理重复数据 ${dryRun ? '(模拟模式)' : '(真实模式)'}\n`);

  const result = await databaseMaintenance.cleanDuplicates({ dryRun });

  if (result.cleaned > 0) {
    console.log(`\n发现 ${result.duplicates.length} 组重复数据:`);
    result.duplicates.forEach(dup => {
      console.log(`  - ${dup.lotCode}-${dup.issue}: ${dup.count} 条`);
    });

    if (dryRun) {
      console.log(`\n💡 将清理 ${result.cleaned} 条重复记录（模拟）`);
      console.log('💡 使用 --real 参数执行真实清理\n');
    } else {
      console.log(`\n✅ 已清理 ${result.cleaned} 条重复记录\n`);
    }
  } else {
    console.log('✅ 未发现重复数据\n');
  }
}

async function cleanOldData() {
  const daysToKeep = parseInt(flags.days) || 365;

  console.log(`\n🧹 清理老数据 ${dryRun ? '(模拟模式)' : '(真实模式)'}`);
  console.log(`保留最近 ${daysToKeep} 天的数据\n`);

  const result = await databaseMaintenance.cleanOldData({ dryRun, daysToKeep });

  if (result.records && result.records.length > 0) {
    console.log(`发现老数据:`);
    result.records.forEach(record => {
      console.log(`  - ${record.lot_code}: ${record.count} 条 (${record.earliest} ~ ${record.latest})`);
    });

    if (dryRun) {
      const totalCount = result.records.reduce((sum, r) => sum + r.count, 0);
      console.log(`\n💡 将清理 ${totalCount} 条老数据（模拟）`);
      console.log('💡 使用 --real 参数执行真实清理\n');
    } else {
      console.log(`\n✅ 已清理 ${result.cleaned} 条老数据\n`);
    }
  } else {
    console.log(`✅ 未发现超过 ${daysToKeep} 天的数据\n`);
  }
}

async function optimizeTable() {
  console.log('\n🔧 优化表\n');

  const result = await databaseMaintenance.optimizeTable();

  console.log(`✅ 表优化完成`);
  console.log(`  表大小: ${result.size_mb}MB`);
  console.log(`  空闲空间: ${result.free_mb}MB`);
  console.log(`  行数: ${result.table_rows.toLocaleString()}\n`);
}

async function analyzeTable() {
  console.log('\n📊 分析表统计信息\n');

  await databaseMaintenance.analyzeTable();

  console.log('');
}

async function fullMaintenance() {
  console.log(`\n🔧 执行完整维护 ${dryRun ? '(模拟模式)' : '(真实模式)'}\n`);

  const result = await databaseMaintenance.performFullMaintenance({ dryRun });

  if (dryRun) {
    console.log('\n💡 使用 --real 参数执行真实维护\n');
  } else {
    console.log('\n✅ 维护完成\n');
  }
}

async function generateReport() {
  console.log('\n');
  await databaseMonitor.printMonitoringReport();
}

function showHelp() {
  console.log(`
数据库维护工具

用法:
  node src/tools/db-maintenance.js <command> [options]

命令:
  stats           查看数据库统计信息
  health          检查数据库健康状态
  suggestions     获取优化建议
  clean-dup       清理重复数据
  clean-old       清理老数据
  optimize        优化表（碎片整理）
  analyze         分析表统计信息
  full            执行完整维护
  report          生成完整监控报告
  help            显示帮助信息

选项:
  --real          执行真实操作（默认是模拟模式）
  --days=N        清理N天前的数据（默认365天）

示例:
  node src/tools/db-maintenance.js stats
  node src/tools/db-maintenance.js clean-dup --real
  node src/tools/db-maintenance.js clean-old --days=180 --real
  node src/tools/db-maintenance.js full
  node src/tools/db-maintenance.js report
  `);
}

main();
