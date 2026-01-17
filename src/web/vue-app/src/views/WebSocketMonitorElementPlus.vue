<template>
  <div class="websocket-monitor-luxury" v-loading="loading && !monitorData.summary">
    <!-- 豪华页面头部 -->
    <div class="page-header-luxury">
      <div class="header-left">
        <div class="page-title-luxury">
          <span class="title-icon">📊</span>
          <span>WebSocket 实时监控</span>
        </div>
        <p class="page-subtitle">
          <span class="status-dot" :class="monitorData.summary?.currentConnections > 0 ? 'online' : 'offline'"></span>
          当前连接数: {{ monitorData.summary?.currentConnections || 0 }} ·
          总消息数: {{ formatNumber(monitorData.summary?.totalMessages || 0) }}
        </p>
      </div>

      <div class="header-right">
        <div class="refresh-controls">
          <NeonButton
            type="primary"
            :loading="loading"
            :icon="Refresh"
            @click="fetchMonitorData"
          >
            刷新
          </NeonButton>
          <div class="auto-refresh-toggle">
            <span class="toggle-label">自动刷新</span>
            <el-switch v-model="autoRefresh" />
          </div>
        </div>
      </div>
    </div>

    <!-- 错误状态 -->
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
      class="error-alert"
    >
      <template #default>
        <NeonButton type="primary" size="small" @click="fetchMonitorData">
          重试
        </NeonButton>
      </template>
    </el-alert>

    <!-- 主要内容 -->
    <div v-else class="monitor-content">
      <!-- 无连接提示 -->
      <HolographicCard v-if="monitorData.summary?.currentConnections === 0" class="no-connection-notice" :border="true">
        <div class="notice-icon-large">🔌</div>
        <h3 class="notice-title">当前无活跃连接</h3>
        <p class="notice-description">
          WebSocket 监控页面正在等待连接。要查看实时数据，请先访问
          <router-link to="/realtime" class="notice-link">实时开奖页面</router-link>
          建立 WebSocket 连接。
        </p>
        <div class="notice-steps">
          <GlowingTag v-for="(step, index) in connectionSteps" :key="index" size="large" effect="plain" :text="`${index + 1}. ${step}`" type="info" />
        </div>
        <NeonButton type="primary" size="large" @click="$router.push('/realtime')">
          前往实时页面
        </NeonButton>
      </HolographicCard>

      <!-- 核心指标卡片网格 -->
      <div class="metrics-grid-luxury">
        <!-- 当前连接数 -->
        <HolographicCard class="metric-card-luxury" :border="true" :hover="true">
          <div class="metric-icon-luxury" style="--icon-color: #667eea">👥</div>
          <div class="metric-info-luxury">
            <div class="metric-label-luxury">当前连接</div>
            <div class="metric-value-luxury">{{ monitorData.summary?.currentConnections || 0 }}</div>
            <div class="metric-detail-luxury">
              峰值: {{ monitorData.connections?.peakConnections || 0 }}
            </div>
          </div>
          <GlowingTag type="success" effect="plain" class="metric-trend-luxury" :text="`↑ ${((monitorData.summary?.currentConnections || 0) / Math.max(monitorData.connections?.peakConnections || 1, 1) * 100).toFixed(0)}%`" size="small" />
        </HolographicCard>

        <!-- 总消息数 -->
        <HolographicCard class="metric-card-luxury" :border="true" :hover="true">
          <div class="metric-icon-luxury" style="--icon-color: #10b981">📨</div>
          <div class="metric-info-luxury">
            <div class="metric-label-luxury">总消息数</div>
            <div class="metric-value-luxury">{{ formatNumber(monitorData.summary?.totalMessages || 0) }}</div>
            <div class="metric-detail-luxury">
              {{ (monitorData.messages?.sentMessages || 0).toLocaleString() }} 发送 /
              {{ (monitorData.messages?.receivedMessages || 0).toLocaleString() }} 接收
            </div>
          </div>
          <div class="metric-sparkline">
            <svg viewBox="0 0 60 20" class="sparkline-svg">
              <polyline
                points="0,15 10,12 20,8 30,10 40,5 50,7 60,3"
                fill="none"
                stroke="#10b981"
                stroke-width="2"
              />
            </svg>
          </div>
        </HolographicCard>

        <!-- 平均延迟 -->
        <HolographicCard class="metric-card-luxury" :border="true" :hover="true">
          <div class="metric-icon-luxury" style="--icon-color: #f59e0b">⚡</div>
          <div class="metric-info-luxury">
            <div class="metric-label-luxury">平均延迟</div>
            <div class="metric-value-luxury">{{ monitorData.summary?.avgDelay || '0ms' }}</div>
            <div class="metric-detail-luxury" :class="getLatencyClass(parseFloat(monitorData.summary?.avgDelay) || 0)">
              {{ getLatencyStatus(parseFloat(monitorData.summary?.avgDelay) || 0) }}
            </div>
          </div>
          <div class="metric-progress">
            <el-progress
              type="circle"
              :percentage="Math.min(parseFloat(monitorData.summary?.avgDelay) || 0, 100)"
              :width="60"
              :stroke-width="4"
              :color="getLatencyColor(parseFloat(monitorData.summary?.avgDelay) || 0)"
              :show-text="false"
            />
          </div>
        </HolographicCard>

        <!-- 内存使用 -->
        <HolographicCard class="metric-card-luxury" :border="true" :hover="true">
          <div class="metric-icon-luxury" style="--icon-color: #ef4444">💾</div>
          <div class="metric-info-luxury">
            <div class="metric-label-luxury">内存使用</div>
            <div class="metric-value-luxury">{{ monitorData.summary?.memoryUsage || '0' }} MB</div>
            <div class="metric-detail-luxury" :class="getMemoryClass(parseFloat(monitorData.summary?.memoryUsage) || 0)">
              {{ getMemoryStatus(parseFloat(monitorData.summary?.memoryUsage) || 0) }}
            </div>
          </div>
          <div class="metric-progress">
            <div class="progress-bar-vertical">
              <div
                class="progress-fill-vertical"
                :style="{
                  height: `${Math.min((parseFloat(monitorData.summary?.memoryUsage) || 0) / 500 * 100, 100)}%`,
                  background: getMemoryColor(parseFloat(monitorData.summary?.memoryUsage) || 0)
                }"
              ></div>
            </div>
          </div>
        </HolographicCard>
      </div>

      <!-- 详细统计区域 - 使用 Element Plus 标签 -->
      <HolographicCard class="stats-tabs-container" :border="true">
        <el-tabs v-model="currentTab" type="border-card">
          <el-tab-pane label="连接统计" name="connections">
            <template #label>
              <span class="tab-icon">🔗</span>
              <span>连接统计</span>
            </template>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">当前连接数</span>
                <span class="stat-value highlight">{{ monitorData.connections?.currentConnections || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">峰值连接数</span>
                <span class="stat-value">{{ monitorData.connections?.peakConnections || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总连接数</span>
                <span class="stat-value">{{ monitorData.connections?.totalConnections || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">断开次数</span>
                <span class="stat-value">{{ monitorData.connections?.disconnects || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">拒绝连接</span>
                <span class="stat-value warning">{{ monitorData.connections?.rejectedConnections || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">连接成功率</span>
                <span class="stat-value success">{{ monitorData.connections?.successRate || '100%' }}</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="消息统计" name="messages">
            <template #label>
              <span class="tab-icon">📨</span>
              <span>消息统计</span>
            </template>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">发送消息</span>
                <span class="stat-value highlight">{{ (monitorData.messages?.sentMessages || 0).toLocaleString() }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">接收消息</span>
                <span class="stat-value">{{ (monitorData.messages?.receivedMessages || 0).toLocaleString() }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">错误数</span>
                <span class="stat-value warning">{{ monitorData.messages?.messageErrors || 0 }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">发送字节</span>
                <span class="stat-value">{{ formatBytes(monitorData.messages?.bytesSent || 0) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">接收字节</span>
                <span class="stat-value">{{ formatBytes(monitorData.messages?.bytesReceived || 0) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">消息成功率</span>
                <span class="stat-value success">{{ monitorData.messages?.successRate || '100%' }}</span>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="性能指标" name="performance">
            <template #label>
              <span class="tab-icon">⚡</span>
              <span>性能指标</span>
            </template>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">平均消息延迟</span>
                <span class="stat-value highlight">{{ (monitorData.performance?.avgMessageDelay || 0).toFixed(2) }}ms</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">平均广播时间</span>
                <span class="stat-value">{{ (monitorData.performance?.avgBroadcastTime || 0).toFixed(2) }}ms</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">错误率</span>
                <span class="stat-value" :class="parseFloat(monitorData.performance?.errorRate) > 1 ? 'warning' : 'success'">
                  {{ (monitorData.performance?.errorRate || '0%') }}
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">运行时间</span>
                <span class="stat-value">{{ monitorData.performance?.uptime || '0s' }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Heap内存</span>
                <span class="stat-value">{{ monitorData.performance?.heapUsed || '0 MB' }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">RSS内存</span>
                <span class="stat-value">{{ monitorData.performance?.rss || '0 MB' }}</span>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </HolographicCard>

      <!-- 热门彩种订阅 -->
      <HolographicCard class="hottest-section" :border="true">
        <template #header>
          <div class="section-header-luxury">
            <h3 class="section-title-luxury">
              <span class="title-icon">🔥</span>
              <span>热门彩种订阅</span>
            </h3>
            <el-tag type="primary" effect="dark" round>
              TOP {{ monitorData.subscriptions?.hottest?.length || 0 }}
            </el-tag>
          </div>
        </template>

        <div class="hottest-grid">
          <div
            v-for="(item, index) in monitorData.subscriptions?.hottest || []"
            :key="item.lotCode"
            class="hottest-card"
          >
            <el-tag :type="getRankType(index)" :effect="index < 3 ? 'dark' : 'plain'" size="large" class="hottest-rank">
              {{ index + 1 }}
            </el-tag>
            <div class="hottest-info">
              <div class="hottest-header">
                <span class="hottest-name">{{ item.lotName }}</span>
                <el-tag size="small" effect="plain">{{ item.lotCode }}</el-tag>
              </div>
              <div class="hottest-stats">
                <div class="stat-mini">
                  <span class="stat-mini-icon">👥</span>
                  <span class="stat-mini-value">{{ item.count }} 个订阅者</span>
                </div>
                <div class="stat-mini">
                  <span class="stat-mini-icon">📊</span>
                  <span class="stat-mini-value">{{ ((item.count / (monitorData.summary?.currentConnections || 1)) * 100).toFixed(0) }}% 覆盖率</span>
                </div>
              </div>
            </div>
            <div class="hottest-chart">
              <el-progress
                :percentage="(item.count / (monitorData.subscriptions?.hottest?.[0]?.count || 1)) * 100"
                :stroke-width="6"
                :color="getRankColor(index)"
                :show-text="false"
              />
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <el-empty
          v-if="!monitorData.subscriptions?.hottest?.length"
          description="暂无订阅数据"
          :image-size="80"
        />
      </HolographicCard>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { HolographicCard, NeonButton, GlowingTag } from '../components/tech'
import api from '../services/api'

// 响应式数据
const loading = ref(true)
const error = ref(null)
const autoRefresh = ref(true)
const currentTab = ref('connections')
const monitorData = ref({
  summary: null,
  connections: null,
  messages: null,
  performance: null,
  subscriptions: null
})

// 连接步骤
const connectionSteps = ['打开实时开奖页面', '选择要监控的彩种', '返回此页面查看统计']

// 自动刷新定时器
let refreshTimer = null

// 获取监控数据
const fetchMonitorData = async () => {
  try {
    loading.value = true
    error.value = null

    const response = await api.getWebSocketStats()
    const stats = response.data
    const monitor = stats.monitor || {}

    // 转换数据格式
    monitorData.value = {
      summary: {
        currentConnections: stats.connectedClients || 0,
        totalMessages: (monitor.messages?.sent || 0) + (monitor.messages?.received || 0),
        avgDelay: monitor.performance?.avgMessageDelay
          ? (monitor.performance.avgMessageDelay.toFixed(2) + 'ms')
          : '0ms',
        memoryUsage: monitor.memory?.heapUsed
          ? ((monitor.memory.heapUsed / 1024 / 1024).toFixed(0))
          : '0'
      },
      connections: {
        currentConnections: stats.connectedClients || 0,
        peakConnections: monitor.connections?.peak || stats.connectedClients || 0,
        totalConnections: monitor.connections?.total || stats.connectedClients || 0,
        disconnects: monitor.connections?.disconnects || 0,
        rejectedConnections: monitor.connections?.rejected || 0,
        successRate: monitor.connections?.total > 0
          ? (((monitor.connections.total - (monitor.connections.rejected || 0)) / monitor.connections.total) * 100).toFixed(1) + '%'
          : '100%'
      },
      messages: {
        sentMessages: monitor.messages?.sent || 0,
        receivedMessages: monitor.messages?.received || 0,
        messageErrors: monitor.messages?.errors || 0,
        bytesSent: monitor.messages?.byteSent || 0,
        bytesReceived: monitor.messages?.byteReceived || 0,
        successRate: monitor.messages?.sent > 0
          ? (((monitor.messages.sent - (monitor.messages.errors || 0)) / monitor.messages.sent) * 100).toFixed(1) + '%'
          : '100%'
      },
      performance: {
        avgMessageDelay: monitor.performance?.avgMessageDelay || 0,
        avgBroadcastTime: monitor.performance?.avgBroadcastTime || 0,
        errorRate: monitor.performance?.errorRate
          ? ((monitor.performance.errorRate * 100).toFixed(2) + '%')
          : '0.00%',
        uptime: monitor.performance?.uptime
          ? formatUptime(monitor.performance.uptime / 1000)
          : '0分钟',
        heapUsed: monitor.memory?.heapUsed
          ? ((monitor.memory.heapUsed / 1024 / 1024).toFixed(0) + ' MB')
          : '0 MB',
        rss: monitor.memory?.rss
          ? ((monitor.memory.rss / 1024 / 1024).toFixed(0) + ' MB')
          : '0 MB'
      },
      subscriptions: {
        // 优先使用monitor的hottest，否则从subscriptions构建
        hottest: monitor.subscriptions?.hottest?.length > 0
          ? monitor.subscriptions.hottest.map(item => ({
              lotCode: item.lotCode,
              lotName: getLotteryName(item.lotCode),
              count: item.subscribers || 0
            }))
          : (stats.subscriptions || [])
              .sort((a, b) => b.subscribers - a.subscribers)
              .slice(0, 10)
              .map(item => ({
                lotCode: item.lotCode,
                lotName: getLotteryName(item.lotCode),
                count: item.subscribers || 0
              }))
      }
    }
  } catch (err) {
    console.error('获取监控数据失败:', err)
    error.value = '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 彩种名称映射
const lotteryNames = {
  '10037': '极速赛车', '10035': '极速飞艇', '10036': '极速时时彩',
  '10052': '极速快3', '10053': '极速快乐十分', '10054': '极速快乐8',
  '10055': '极速11选5', '20001': 'SG飞艇', '20002': 'SG时时彩',
  '20003': 'SG快3', '20004': 'SG快乐十分', '20005': 'SG快乐8',
  '20006': 'SG 11选5', '10098': '极速六合彩', '30001': '澳洲幸运5',
  '30002': '澳洲幸运8', '30003': '澳洲幸运10', '30004': '澳洲幸运20',
  '40001': '幸运时时彩', '50001': '幸运飞艇', '60001': '香港六合彩',
  '70001': '福彩双色球', '70002': '福彩3D', '70003': '福彩七乐彩',
  '70004': '福彩快乐8', '80001': '超级大乐透', '80002': '排列3',
  '80003': '排列5', '80004': '七星彩', '90001': '英国乐透5',
  '90002': '英国乐透8', '90003': '英国乐透10', '90004': '英国乐透20'
}

const getLotteryName = (lotCode) => lotteryNames[lotCode] || `彩种${lotCode}`

// 格式化函数
const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const formatBytes = (bytes) => {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return bytes + ' B'
}

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}天${hours}小时`
  if (hours > 0) return `${hours}小时${minutes}分钟`
  return `${minutes}分钟`
}

// 延迟状态
const getLatencyClass = (ms) => {
  if (ms < 50) return 'success'
  if (ms < 100) return 'warning'
  return 'danger'
}

const getLatencyStatus = (ms) => {
  if (ms < 50) return '优秀'
  if (ms < 100) return '良好'
  return '需优化'
}

const getLatencyColor = (ms) => {
  if (ms < 50) return '#10b981'
  if (ms < 100) return '#f59e0b'
  return '#ef4444'
}

// 内存状态
const getMemoryClass = (mb) => {
  if (mb < 200) return 'success'
  if (mb < 400) return 'warning'
  return 'danger'
}

const getMemoryStatus = (mb) => {
  if (mb < 200) return '正常'
  if (mb < 400) return '偏高'
  return '过高'
}

const getMemoryColor = (mb) => {
  if (mb < 200) return '#10b981'
  if (mb < 400) return '#f59e0b'
  return '#ef4444'
}

// 排名样式
const getRankType = (index) => {
  if (index === 0) return 'warning'  // 金色
  if (index === 1) return 'info'     // 银色
  if (index === 2) return 'danger'   // 铜色
  return 'primary'
}

const getRankColor = (index) => {
  if (index === 0) return '#ffd700'
  if (index === 1) return '#c0c0c0'
  if (index === 2) return '#cd7f32'
  return '#667eea'
}

// 生命周期
onMounted(() => {
  fetchMonitorData()

  // 自动刷新
  refreshTimer = setInterval(() => {
    if (autoRefresh.value) {
      fetchMonitorData()
    }
  }, 5000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style scoped>
/* ========== 基础容器 ========== */
.websocket-monitor-luxury {
  padding: 24px;
  min-height: 100vh;
}

/* ========== 豪华页面头部 ========== */
.page-header-luxury {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--el-border-color);
}

.header-left {
  flex: 1;
}

.page-title-luxury {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 32px;
  font-weight: 700;
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
  margin-bottom: 8px;
}

.title-icon {
  font-size: 36px;
  filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.6));
}

.page-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--tech-text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
}

.status-dot.online {
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  animation: pulse-dot 2s infinite;
}

.status-dot.offline {
  background: #ef4444;
}

@keyframes pulse-dot {
  0%, 100% {
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.1);
  }
}

.header-right {
  display: flex;
  gap: 16px;
}

.refresh-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.auto-refresh-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

/* ========== 错误警告 ========== */
.error-alert {
  margin-bottom: 24px;
}

/* ========== 监控内容 ========== */
.monitor-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ========== 豪华指标卡片网格 ========== */
.metrics-grid-luxury {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.metric-card-luxury {
  position: relative;
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(20px);
  border: 1px solid var(--el-border-color);
  transition: all 0.3s ease;
}

.metric-card-luxury:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.15);
}

.metric-icon-luxury {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: linear-gradient(135deg, var(--icon-color, #667eea), var(--icon-color, #764ba2));
  border-radius: 14px;
  margin-bottom: 16px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.metric-info-luxury {
  margin-bottom: 16px;
}

.metric-label-luxury {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value-luxury {
  font-size: 36px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1;
  margin-bottom: 8px;
}

.metric-detail-luxury {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.metric-detail-luxury.success {
  color: #10b981;
}

.metric-detail-luxury.warning {
  color: #f59e0b;
}

.metric-detail-luxury.danger {
  color: #ef4444;
}

.metric-trend-luxury {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.trend-arrow {
  font-size: 16px;
}

.metric-sparkline {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 100px;
  height: 40px;
  opacity: 0.3;
}

.sparkline-svg {
  width: 100%;
  height: 100%;
}

.metric-progress {
  position: absolute;
  top: 24px;
  right: 24px;
}

.progress-bar-vertical {
  width: 8px;
  height: 60px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-fill-vertical {
  position: absolute;
  bottom: 0;
  width: 100%;
  border-radius: 4px;
  transition: height 0.5s ease;
}

/* ========== 统计标签容器 ========== */
.stats-tabs-container {
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(20px);
  border: 1px solid var(--el-border-color);
}

.tab-icon {
  font-size: 18px;
  margin-right: 4px;
}

/* ========== 统计网格 ========== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 16px 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.stat-item:hover {
  background: rgba(102, 126, 234, 0.1);
  transform: translateY(-2px);
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.stat-value.highlight {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-value.success {
  color: #10b981;
}

.stat-value.warning {
  color: #f59e0b;
}

.stat-value.danger {
  color: #ef4444;
}

/* ========== 热门彩种部分 ========== */
.hottest-section {
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(20px);
  border: 1px solid var(--el-border-color);
}

.section-header-luxury {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title-luxury {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0;
}

.hottest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.hottest-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.hottest-card:hover {
  background: rgba(102, 126, 234, 0.1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.hottest-rank {
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}

.hottest-info {
  flex: 1;
  min-width: 0;
}

.hottest-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.hottest-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hottest-stats {
  display: flex;
  gap: 12px;
}

.stat-mini {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.stat-mini-icon {
  font-size: 12px;
}

.hottest-chart {
  width: 100px;
  flex-shrink: 0;
}

/* ========== 无连接提示 ========== */
.no-connection-notice {
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(20px);
  border: 1px solid var(--el-border-color);
  text-align: center;
  padding: 40px;
  margin-bottom: 24px;
  animation: fadeIn 0.5s ease;
}

.notice-icon-large {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.8;
}

.notice-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 12px;
}

.notice-description {
  font-size: 15px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto 24px;
}

.notice-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
  border-bottom: 2px solid rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.notice-link:hover {
  border-bottom-color: #667eea;
}

.notice-steps {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.step-number {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  font-weight: 700;
  font-size: 12px;
  margin-right: 6px;
}

.step-text {
  font-weight: 500;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== 响应式 ========== */
@media (max-width: 1200px) {
  .hottest-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .websocket-monitor-luxury {
    padding: 16px;
  }

  .page-header-luxury {
    flex-direction: column;
    gap: 16px;
  }

  .page-title-luxury {
    font-size: 24px;
  }

  .metrics-grid-luxury {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .hottest-grid {
    grid-template-columns: 1fr;
  }

  .hottest-chart {
    width: 80px;
  }
}
</style>
