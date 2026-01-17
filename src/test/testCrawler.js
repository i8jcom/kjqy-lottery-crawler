import dotenv from 'dotenv';
import Source3650098 from '../crawlers/Source3650098.js';
import validator from '../validators/DataValidator.js';
import logger from '../utils/Logger.js';

dotenv.config();

/**
 * 测试爬虫功能
 */
async function testCrawler() {
  logger.info('========== 开始测试爬虫 ==========');

  const source = new Source3650098();

  // 测试彩种列表
  const testLotteries = [
    { lotCode: '10037', name: '极速赛车' },
    { lotCode: '10083', name: 'SG快乐十分' },
    { lotCode: '10148', name: '极速时时彩' }
  ];

  for (const lottery of testLotteries) {
    logger.info(`\n测试彩种: ${lottery.name} (${lottery.lotCode})`);
    logger.info('----------------------------------------');

    try {
      // 测试实时数据
      logger.info('1. 获取实时数据...');
      const realtimeData = await source.fetchRealtimeData(lottery.lotCode);

      if (realtimeData) {
        logger.success(`✅ 实时数据获取成功`);
        logger.info(`   期号: ${realtimeData.issue}`);
        logger.info(`   开奖号码: ${realtimeData.drawCode}`);
        logger.info(`   开奖时间: ${realtimeData.drawTime}`);
        logger.info(`   下期期号: ${realtimeData.nextIssue}`);
        logger.info(`   下期开奖: ${realtimeData.nextDrawTime}`);
        logger.info(`   倒计时: ${realtimeData.countdown}秒`);

        // 验证数据
        const isValid = validator.validateRealtimeData(realtimeData);
        logger.info(`   数据验证: ${isValid ? '✅ 通过' : '❌ 失败'}`);

        const quality = validator.scoreDataQuality(realtimeData);
        logger.info(`   质量评分: ${quality}/100`);
      } else {
        logger.error(`❌ 实时数据获取失败`);
      }

      // 测试历史数据
      logger.info('\n2. 获取历史数据...');
      const historyData = await source.fetchHistoryData(lottery.lotCode, {
        pageNo: 1,
        pageSize: 5
      });

      if (historyData && historyData.length > 0) {
        logger.success(`✅ 历史数据获取成功 (${historyData.length}条)`);
        logger.info('   最新5期:');
        historyData.slice(0, 5).forEach((record, index) => {
          logger.info(`   ${index + 1}. 期号: ${record.issue}, 号码: ${record.drawCode}, 时间: ${record.drawTime}`);
        });

        const isValid = validator.validateHistoryData(historyData);
        logger.info(`   数据验证: ${isValid ? '✅ 通过' : '❌ 失败'}`);
      } else {
        logger.error(`❌ 历史数据获取失败`);
      }

    } catch (error) {
      logger.error(`❌ 测试出错: ${error.message}`);
    }

    // 等待1秒再测试下一个
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 打印统计
  logger.info('\n========== 爬虫统计 ==========');
  const stats = source.getStats();
  logger.info(`总请求数: ${stats.totalRequests}`);
  logger.info(`成功次数: ${stats.successCount}`);
  logger.info(`失败次数: ${stats.failureCount}`);
  logger.info(`成功率: ${stats.successRate}`);
  logger.info('============================');
}

// 运行测试
testCrawler().catch(error => {
  logger.error('测试失败:', error);
  process.exit(1);
});
