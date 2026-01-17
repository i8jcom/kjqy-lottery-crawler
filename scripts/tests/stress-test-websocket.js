#!/usr/bin/env node

/**
 * WebSocket压力测试工具 - 5000+客户端负载测试
 *
 * 功能:
 * 1. 模拟多个WebSocket客户端并发连接
 * 2. 随机订阅彩种
 * 3. 接收倒计时推送
 * 4. 统计性能指标
 *
 * 使用方法:
 * node stress-test-websocket.js [客户端数量] [持续时间(秒)]
 *
 * 示例:
 * node stress-test-websocket.js 100 30    # 100个客户端，运行30秒
 * node stress-test-websocket.js 1000 60   # 1000个客户端，运行60秒
 * node stress-test-websocket.js 5000 120  # 5000个客户端，运行120秒
 */

import WebSocket from 'ws';
import { performance } from 'perf_hooks';

// ========== 配置参数 ==========
const WS_URL = 'ws://localhost:4000';  // WebSocket服务器地址
const DEFAULT_CLIENTS = 100;            // 默认客户端数量
const DEFAULT_DURATION = 30;            // 默认测试时长（秒）
const CONNECT_INTERVAL = 10;            // 每批连接间隔（毫秒）
const BATCH_SIZE = 50;                  // 每批连接数量

// 可订阅的彩种列表
const LOTTERY_CODES = [
  '10035', '10036', '10037', '10052', '10053', '10054', '10055',  // 极速彩种
  '20001', '20002', '20003', '20004', '20005', '20006',           // SG彩种
  '30001', '30002', '30003', '30004',                             // AU彩种
  '90001', '90002', '90003', '90004',                             // UK彩种
  '100007'                                                         // 台湾宾果
];

// ========== 统计指标 ==========
class StressTestStats {
  constructor() {
    this.startTime = Date.now();
    this.connections = {
      attempted: 0,      // 尝试连接数
      succeeded: 0,      // 成功连接数
      failed: 0,         // 失败连接数
      active: 0,         // 当前活跃连接
      closed: 0          // 已关闭连接
    };
    this.messages = {
      sent: 0,           // 发送消息数
      received: 0,       // 接收消息数
      countdownUpdates: 0, // 倒计时更新数
      batchUpdates: 0,   // 批量更新数
      errors: 0          // 错误消息数
    };
    this.latency = {
      samples: [],       // 延迟样本
      min: Infinity,
      max: 0,
      avg: 0
    };
    this.errors = [];    // 错误列表
  }

  recordConnection(success) {
    if (success) {
      this.connections.succeeded++;
      this.connections.active++;
    } else {
      this.connections.failed++;
    }
  }

  recordDisconnection() {
    this.connections.active--;
    this.connections.closed++;
  }

  recordMessageSent() {
    this.messages.sent++;
  }

  recordMessageReceived(type) {
    this.messages.received++;
    if (type === 'countdown_batch_update') {
      this.messages.batchUpdates++;
    } else if (type === 'lottery_update') {
      this.messages.countdownUpdates++;
    }
  }

  recordLatency(latency) {
    this.latency.samples.push(latency);
    this.latency.min = Math.min(this.latency.min, latency);
    this.latency.max = Math.max(this.latency.max, latency);
    this.latency.avg = this.latency.samples.reduce((a, b) => a + b, 0) / this.latency.samples.length;
  }

  recordError(error) {
    this.messages.errors++;
    this.errors.push({
      time: Date.now() - this.startTime,
      message: error.message || error
    });
  }

  getReport() {
    const duration = (Date.now() - this.startTime) / 1000;
    const successRate = (this.connections.succeeded / this.connections.attempted * 100).toFixed(2);
    const messagesPerSecond = (this.messages.received / duration).toFixed(2);

    return {
      duration: duration.toFixed(2),
      connections: {
        ...this.connections,
        successRate: `${successRate}%`
      },
      messages: {
        ...this.messages,
        messagesPerSecond: `${messagesPerSecond}/s`
      },
      latency: {
        min: `${this.latency.min.toFixed(2)}ms`,
        max: `${this.latency.max.toFixed(2)}ms`,
        avg: `${this.latency.avg.toFixed(2)}ms`,
        samples: this.latency.samples.length
      },
      errors: {
        count: this.errors.length,
        recent: this.errors.slice(-5)
      }
    };
  }
}

// ========== WebSocket客户端模拟器 ==========
class WebSocketClient {
  constructor(id, stats) {
    this.id = id;
    this.stats = stats;
    this.ws = null;
    this.subscriptions = [];
    this.messageTimestamps = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.stats.connections.attempted++;
        const connectStart = performance.now();

        this.ws = new WebSocket(WS_URL);

        this.ws.on('open', () => {
          const connectTime = performance.now() - connectStart;
          this.stats.recordConnection(true);
          this.stats.recordLatency(connectTime);

          // 随机订阅1-5个彩种
          const subscribeCount = Math.floor(Math.random() * 5) + 1;
          const lotteryCodes = [];

          for (let i = 0; i < subscribeCount; i++) {
            const randomLottery = LOTTERY_CODES[Math.floor(Math.random() * LOTTERY_CODES.length)];
            if (!lotteryCodes.includes(randomLottery)) {
              lotteryCodes.push(randomLottery);
            }
          }

          this.subscriptions = lotteryCodes;
          this.subscribe(lotteryCodes);

          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          this.stats.recordError(error);
          reject(error);
        });

        this.ws.on('close', () => {
          this.stats.recordDisconnection();
        });

        // 超时处理
        setTimeout(() => {
          if (this.ws.readyState !== WebSocket.OPEN) {
            this.stats.recordConnection(false);
            reject(new Error('Connection timeout'));
          }
        }, 5000);

      } catch (error) {
        this.stats.recordConnection(false);
        reject(error);
      }
    });
  }

  subscribe(lotteryCodes) {
    const message = {
      type: 'subscribe',
      data: { lotCodes: lotteryCodes }
    };
    this.sendMessage(message);
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const messageId = `${this.id}_${Date.now()}`;
      this.messageTimestamps.set(messageId, Date.now());
      this.ws.send(JSON.stringify(message));
      this.stats.recordMessageSent();
    }
  }

  handleMessage(data) {
    try {
      // 检查是否是二进制数据（压缩）
      let message;
      if (data instanceof Buffer) {
        // 压缩消息暂不解压，只统计
        this.stats.recordMessageReceived('compressed');
        return;
      } else {
        message = JSON.parse(data.toString());
      }

      this.stats.recordMessageReceived(message.type);

      // 计算消息延迟（如果消息带有timestamp）
      if (message.data && message.data.timestamp) {
        const latency = Date.now() - message.data.timestamp;
        if (latency >= 0 && latency < 10000) {  // 合理范围内
          this.stats.recordLatency(latency);
        }
      }

    } catch (error) {
      this.stats.recordError(error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// ========== 压力测试管理器 ==========
class StressTestManager {
  constructor(totalClients, duration) {
    this.totalClients = totalClients;
    this.duration = duration;
    this.stats = new StressTestStats();
    this.clients = [];
    this.progressInterval = null;
    this.testTimeout = null;
  }

  async run() {
    console.log('🚀 WebSocket压力测试启动');
    console.log(`📊 配置: ${this.totalClients}个客户端, 持续${this.duration}秒`);
    console.log(`🔗 目标: ${WS_URL}`);
    console.log('─'.repeat(60));

    // 开始连接客户端
    await this.connectClients();

    // 启动实时进度显示
    this.startProgressMonitor();

    // 设置测试结束定时器
    await this.waitForDuration();

    // 断开所有客户端
    this.disconnectAll();

    // 生成报告
    this.printReport();
  }

  async connectClients() {
    console.log(`\n⏳ 正在建立${this.totalClients}个连接...`);

    const batches = Math.ceil(this.totalClients / BATCH_SIZE);

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * BATCH_SIZE;
      const batchEnd = Math.min((batch + 1) * BATCH_SIZE, this.totalClients);
      const batchPromises = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const client = new WebSocketClient(i, this.stats);
        this.clients.push(client);
        batchPromises.push(
          client.connect().catch(err => {
            // 连接失败不中断整体测试
            console.error(`❌ 客户端 ${i} 连接失败: ${err.message}`);
          })
        );
      }

      await Promise.all(batchPromises);

      // 显示进度
      const progress = ((batchEnd / this.totalClients) * 100).toFixed(1);
      process.stdout.write(`\r📡 连接进度: ${batchEnd}/${this.totalClients} (${progress}%)`);

      // 批次间隔
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, CONNECT_INTERVAL));
      }
    }

    console.log('\n✅ 连接阶段完成\n');
  }

  startProgressMonitor() {
    this.progressInterval = setInterval(() => {
      const elapsed = ((Date.now() - this.stats.startTime) / 1000).toFixed(0);
      const remaining = this.duration - elapsed;

      process.stdout.write(
        `\r📊 运行中: ${elapsed}s/${this.duration}s | ` +
        `活跃连接: ${this.stats.connections.active} | ` +
        `接收消息: ${this.stats.messages.received} | ` +
        `错误: ${this.stats.messages.errors}    `
      );

      if (remaining <= 0) {
        clearInterval(this.progressInterval);
      }
    }, 1000);
  }

  waitForDuration() {
    return new Promise(resolve => {
      this.testTimeout = setTimeout(() => {
        clearInterval(this.progressInterval);
        console.log('\n\n⏱️  测试时间到，开始清理...');
        resolve();
      }, this.duration * 1000);
    });
  }

  disconnectAll() {
    console.log(`🔌 断开所有连接...`);
    this.clients.forEach(client => client.disconnect());
  }

  printReport() {
    const report = this.stats.getReport();

    console.log('\n');
    console.log('═'.repeat(60));
    console.log('📈 压力测试报告');
    console.log('═'.repeat(60));

    console.log('\n🔗 连接统计:');
    console.log(`  尝试连接: ${report.connections.attempted}`);
    console.log(`  成功连接: ${report.connections.succeeded} (${report.connections.successRate})`);
    console.log(`  失败连接: ${report.connections.failed}`);
    console.log(`  最终活跃: ${report.connections.active}`);
    console.log(`  已关闭: ${report.connections.closed}`);

    console.log('\n📨 消息统计:');
    console.log(`  发送消息: ${report.messages.sent}`);
    console.log(`  接收消息: ${report.messages.received} (${report.messages.messagesPerSecond})`);
    console.log(`  倒计时更新: ${report.messages.countdownUpdates}`);
    console.log(`  批量更新: ${report.messages.batchUpdates}`);
    console.log(`  错误消息: ${report.messages.errors}`);

    console.log('\n⏱️  延迟统计:');
    console.log(`  最小延迟: ${report.latency.min}`);
    console.log(`  最大延迟: ${report.latency.max}`);
    console.log(`  平均延迟: ${report.latency.avg}`);
    console.log(`  样本数量: ${report.latency.samples}`);

    if (report.errors.count > 0) {
      console.log('\n❌ 错误汇总:');
      console.log(`  错误总数: ${report.errors.count}`);
      console.log('  最近错误:');
      report.errors.recent.forEach(err => {
        console.log(`    [${err.time}ms] ${err.message}`);
      });
    }

    console.log('\n⏱️  测试时长: ' + report.duration + '秒');
    console.log('═'.repeat(60));

    // 性能评分
    this.printPerformanceScore(report);
  }

  printPerformanceScore(report) {
    console.log('\n🏆 性能评分:');

    const successRate = parseFloat(report.connections.successRate);
    const avgLatency = parseFloat(report.latency.avg);
    const errorRate = (report.messages.errors / report.messages.received * 100) || 0;

    let score = 100;

    // 连接成功率扣分
    if (successRate < 99) score -= (99 - successRate) * 2;

    // 延迟扣分
    if (avgLatency > 100) score -= Math.min(20, (avgLatency - 100) / 10);

    // 错误率扣分
    score -= errorRate * 5;

    score = Math.max(0, Math.floor(score));

    let grade = 'F';
    if (score >= 90) grade = 'A+';
    else if (score >= 80) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 60) grade = 'C';
    else if (score >= 50) grade = 'D';

    console.log(`  综合得分: ${score}/100 (${grade})`);

    if (score >= 90) {
      console.log('  ✅ 优秀！系统表现非常稳定');
    } else if (score >= 70) {
      console.log('  ⚠️  良好，但仍有优化空间');
    } else {
      console.log('  ❌ 需要优化系统性能');
    }

    console.log('\n💡 建议:');
    if (successRate < 95) {
      console.log('  - 连接成功率偏低，检查服务器连接限制');
    }
    if (avgLatency > 200) {
      console.log('  - 平均延迟较高，考虑优化网络或消息处理');
    }
    if (errorRate > 1) {
      console.log('  - 错误率偏高，检查错误日志');
    }
    if (score >= 90) {
      console.log('  - 系统运行良好，可以尝试更大规模测试');
    }
  }
}

// ========== 主程序入口 ==========
async function main() {
  const args = process.argv.slice(2);
  const totalClients = parseInt(args[0]) || DEFAULT_CLIENTS;
  const duration = parseInt(args[1]) || DEFAULT_DURATION;

  if (totalClients <= 0 || duration <= 0) {
    console.error('❌ 参数错误：客户端数量和持续时间必须大于0');
    process.exit(1);
  }

  if (totalClients > 10000) {
    console.warn('⚠️  警告：客户端数量超过10000，可能导致系统资源耗尽');
    console.log('   建议从小规模开始测试（100 -> 1000 -> 5000）');
  }

  const manager = new StressTestManager(totalClients, duration);

  try {
    await manager.run();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 处理进程信号
process.on('SIGINT', () => {
  console.log('\n\n⚠️  收到中断信号，正在清理...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  收到终止信号，正在清理...');
  process.exit(0);
});

main();
