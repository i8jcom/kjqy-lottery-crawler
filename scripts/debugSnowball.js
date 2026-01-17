#!/usr/bin/env node

/**
 * Debug script to check snowball data from API
 */

import OnccHistoryScraper from '../src/scrapers/OnccHistoryScraper.js';
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: 'localhost',
  port: 3308,
  user: 'root',
  password: 'root123456',
  database: 'lottery_crawler'
};

async function debug() {
  // Test API
  console.log('\n=== Testing API ===\n');
  const scraper = new OnccHistoryScraper();

  const results2025 = await scraper.fetchYearData(2025);
  const snowballs2025 = results2025.filter(r => r._metadata && r._metadata.snowballName);

  console.log(`2025年总记录: ${results2025.length}`);
  console.log(`2025年金多寶: ${snowballs2025.length}`);
  console.log('\n金多寶详情:');
  snowballs2025.forEach(s => {
    console.log(`  期号: ${s.issue}, 日期: ${s._metadata.drawDate}, 名称: ${s._metadata.snowballName}`);
  });

  // Test database
  console.log('\n\n=== Testing Database ===\n');
  const connection = await mysql.createConnection(DB_CONFIG);

  const [dbRecords] = await connection.query(
    `SELECT issue, DATE(draw_time) as draw_date FROM lottery_results WHERE lot_code='60001' AND YEAR(draw_time)=2025 ORDER BY draw_time`
  );

  console.log(`数据库2025年记录: ${dbRecords.length}`);
  console.log('\n数据库期号样本 (前10期):');
  dbRecords.slice(0, 10).forEach(r => {
    console.log(`  期号: ${r.issue}, 日期: ${r.draw_date}`);
  });

  // Match check
  console.log('\n\n=== Matching Check ===\n');
  const apiIssues = new Set(results2025.map(r => r.issue));
  const dbIssues = new Set(dbRecords.map(r => r.issue));

  console.log(`API期号数: ${apiIssues.size}`);
  console.log(`DB期号数: ${dbIssues.size}`);

  const snowballIssues = snowballs2025.map(s => s.issue);
  console.log('\n金多寶期号:', snowballIssues.join(', '));

  console.log('\n检查金多寶期号是否在数据库中:');
  snowballIssues.forEach(issue => {
    const inDB = dbIssues.has(issue);
    console.log(`  ${issue}: ${inDB ? '✓ 存在' : '✗ 不存在'}`);
  });

  await connection.end();
}

debug().catch(console.error);
