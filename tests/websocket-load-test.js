/**
 * WebSocket负载测试工具
 *
 * 用途：测试WebSocket服务器在高并发下的性能
 * 运行：node tests/websocket-load-test.js [客户端数量] [持续时间秒]
 *
 * 示例：
 * node tests/websocket-load-test.js 100 60  # 100个客户端，持续60秒
 * node tests/websocket-load-test.js 1000 300 # 1000个客户端，持续5分钟
 */

import WebSocket from 'ws';
import { performance } from 'perf_hooks';

class WebSocketLoadTester {
  constructor(options = {}) {
    this.wsUrl = options.url || 'ws://localhost:4000';
    this.clientCount = options.clientCount || 100;
    this.duration = options.duration || 60; // 秒
    this.rampUpTime = options.rampUpTime || 10; // 秒，渐进式增加连接

    this.clients = [];
    this.stats = {
      connected: 0,
      failed: 0,
      disconnected: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      latencies: [], // 消息延迟样本
      connectionTimes: [] // 连接建立时间样本
    };

    this.startTime = null;
    this.testRunning = false;
  }

  /**
   * 创建单个WebSocket客户端
   */
  async createClient(clientId) {
    return new Promise((resolve) => {
      const connectStart = performance.now();
      const ws = new WebSocket(this.wsUrl);

      const client = {
        id: clientId,
        ws,
        connected: false,
        messagesReceived: 0,
        messagesSent: 0,
        latencies: []
      };

      ws.on('open', () => {
        const connectTime = performance.now() - connectStart;
        this.stats.connectionTimes.push(connectTime);
        this.stats.connected++;
        client.connected = true;

        console.log(`✅ 客户端 ${clientId} 连接成功 (${connectTime.toFixed(2)}ms)`);

        // 订阅彩种（模拟真实场景）
        const lotteriesToSubscribe = ['10037', '10035', '10036', '10052', '10053'];
        const subscribeMessage = {
          type: 'subscribe',
          data: {
            lotteries: lotteriesToSubscribe
          }
        };

        ws.send(JSON.stringify(subscribeMessage));
        this.stats.messagesSent++;
        client.messagesSent++;

        resolve(client);
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.stats.messagesReceived++;
        client.messagesReceived++;

        // 计算延迟（如果消息包含timestamp）
        if (message.data && message.data.timestamp) {
          const latency = Date.now() - message.data.timestamp;
          this.stats.latencies.push(latency);
          client.latencies.push(latency);
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ 客户端 ${clientId} 错误:`, error.message);
        this.stats.errors++;
      });

      ws.on('close', () => {
        if (this.testRunning) {
          console.warn(`⚠️ 客户端 ${clientId} 断开连接`);
          this.stats.disconnected++;
        }
        client.connected = false;
      });

      // 连接超时处理
      setTimeout(() => {
        if (!client.connected) {
          console.error(`❌ 客户端 ${clientId} 连接超时`);
          this.stats.failed++;
          ws.terminate();
          resolve(null);
        }
      }, 10000); // 10秒连接超时
    });
  }

  /**
   * 渐进式创建客户端
   */
  async rampUpClients() {
    const interval = (this.rampUpTime * 1000) / this.clientCount;
    console.log(`\n🚀 开始渐进式连接 ${this.clientCount} 个客户端...`);
    console.log(`⏱️ 每 ${interval.toFixed(2)}ms 创建一个连接\n`);

    for (let i = 0; i < this.clientCount; i++) {
      const client = await this.createClient(i + 1);
      if (client) {
        this.clients.push(client);
      }

      // 渐进式延迟
      if (i < this.clientCount - 1) {
        await this.sleep(interval);
      }

      // 每100个连接打印一次进度
      if ((i + 1) % 100 === 0) {
        console.log(`📊 进度: ${i + 1}/${this.clientCount} 客户端已创建`);
      }
    }

    console.log(`\n✅ 所有客户端创建完成！`);
    console.log(`📊 成功: ${this.stats.connected}, 失败: ${this.stats.failed}\n`);
  }

  /**
   * 运行负载测试
   */
  async run() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('WebSocket负载测试工具');
    console.log(`${'='.repeat(60)}`);
    console.log(`🎯 目标服务器: ${this.wsUrl}`);
    console.log(`👥 客户端数量: ${this.clientCount}`);
    console.log(`⏱️ 测试持续时间: ${this.duration}秒`);
    console.log(`📈 渐进时间: ${this.rampUpTime}秒`);
    console.log(`${'='.repeat(60)}\n`);

    this.testRunning = true;
    this.startTime = Date.now();

    // 渐进式创建客户端
    await this.rampUpClients();

    // 持续运行测试
    console.log(`\n⏳ 测试运行中... (持续 ${this.duration} 秒)\n`);

    // 每10秒打印一次实时统计
    const statsInterval = setInterval(() => {
      this.printRealtimeStats();
    }, 10000);

    // 等待测试时长
    await this.sleep(this.duration * 1000);

    // 停止统计输出
    clearInterval(statsInterval);

    // 测试结束
    this.testRunning = false;
    await this.cleanup();
    this.printFinalReport();
  }

  /**
   * 打印实时统计
   */
  printRealtimeStats() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const avgLatency = this.calculateAverage(this.stats.latencies);
    const messagesPerSecond = this.stats.messagesReceived / (elapsed || 1);

    console.log(`\n📊 [${elapsed}s] 实时统计:`);
    console.log(`  连接数: ${this.stats.connected}/${this.clientCount}`);
    console.log(`  接收消息: ${this.stats.messagesReceived}`);
    console.log(`  消息速率: ${messagesPerSecond.toFixed(2)} msgs/s`);
    console.log(`  平均延迟: ${avgLatency.toFixed(2)}ms`);
    console.log(`  错误数: ${this.stats.errors}`);
  }

  /**
   * 打印最终报告
   */
  printFinalReport() {
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);

    // 计算统计指标
    const avgConnectionTime = this.calculateAverage(this.stats.connectionTimes);
    const avgLatency = this.calculateAverage(this.stats.latencies);
    const p50Latency = this.calculatePercentile(this.stats.latencies, 0.5);
    const p95Latency = this.calculatePercentile(this.stats.latencies, 0.95);
    const p99Latency = this.calculatePercentile(this.stats.latencies, 0.99);
    const maxLatency = Math.max(...this.stats.latencies, 0);
    const minLatency = Math.min(...this.stats.latencies, 0);

    const messagesPerSecond = this.stats.messagesReceived / (totalTime || 1);
    const successRate = (this.stats.connected / this.clientCount) * 100;

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 负载测试最终报告');
    console.log(`${'='.repeat(60)}\n`);

    console.log('连接统计:');
    console.log(`  总客户端: ${this.clientCount}`);
    console.log(`  成功连接: ${this.stats.connected}`);
    console.log(`  连接失败: ${this.stats.failed}`);
    console.log(`  中途断开: ${this.stats.disconnected}`);
    console.log(`  成功率: ${successRate.toFixed(2)}%`);
    console.log(`  平均连接时间: ${avgConnectionTime.toFixed(2)}ms\n`);

    console.log('消息统计:');
    console.log(`  发送消息: ${this.stats.messagesSent}`);
    console.log(`  接收消息: ${this.stats.messagesReceived}`);
    console.log(`  消息速率: ${messagesPerSecond.toFixed(2)} msgs/s`);
    console.log(`  错误数: ${this.stats.errors}\n`);

    console.log('延迟统计 (ms):');
    console.log(`  平均延迟: ${avgLatency.toFixed(2)}`);
    console.log(`  P50延迟: ${p50Latency.toFixed(2)}`);
    console.log(`  P95延迟: ${p95Latency.toFixed(2)}`);
    console.log(`  P99延迟: ${p99Latency.toFixed(2)}`);
    console.log(`  最小延迟: ${minLatency.toFixed(2)}`);
    console.log(`  最大延迟: ${maxLatency.toFixed(2)}\n`);

    console.log('测试时长:');
    console.log(`  总耗时: ${totalTime}秒\n`);

    console.log(`${'='.repeat(60)}\n`);

    // 性能评估
    console.log('性能评估:');
    if (successRate >= 99 && avgLatency < 100) {
      console.log('  ✅ 优秀：系统性能表现良好');
    } else if (successRate >= 95 && avgLatency < 500) {
      console.log('  ✔️ 良好：系统性能可以接受');
    } else if (successRate >= 90) {
      console.log('  ⚠️ 一般：建议优化性能');
    } else {
      console.log('  ❌ 较差：需要紧急优化');
    }
    console.log();
  }

  /**
   * 清理资源
   */
  async cleanup() {
    console.log(`\n🧹 清理资源...`);

    for (const client of this.clients) {
      if (client && client.ws && client.connected) {
        client.ws.close();
      }
    }

    console.log(`✅ 清理完成\n`);
  }

  /**
   * 计算平均值
   */
  calculateAverage(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  /**
   * 计算百分位数
   */
  calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 延迟工具
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========== 主程序 ==========

const args = process.argv.slice(2);
const clientCount = parseInt(args[0]) || 100;
const duration = parseInt(args[1]) || 60;

const tester = new WebSocketLoadTester({
  url: 'ws://localhost:4000',
  clientCount: clientCount,
  duration: duration,
  rampUpTime: Math.min(10, clientCount / 10) // 最多10秒渐进时间
});

tester.run().then(() => {
  console.log('🎉 测试完成！');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
