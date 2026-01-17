<template>
  <div class="dashboard-container">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">
          <span class="title-icon">📊</span>
          仪表盘总览
        </h1>
        <p class="page-subtitle">实时监控系统运行状态</p>
      </div>
      <div class="header-right">
        <div class="current-time">{{ currentTime }}</div>
        <NeonButton type="primary" :icon="Refresh" @click="loadDashboardData" :loading="loading">
          刷新数据
        </NeonButton>
      </div>
    </div>

    <!-- Skeleton Loading State -->
    <template v-if="loading && !coreMetrics[0].value">
      <el-skeleton :rows="8" animated />
    </template>

    <!-- Main Content -->
    <template v-else>
      <!-- Core Metrics Grid -->
      <div class="metrics-grid">
        <HolographicCard
          v-for="(metric, index) in coreMetrics"
          :key="index"
          class="metric-card"
          :border="true"
          :hover="true"
        >
          <div class="metric-wrapper" :style="{ '--accent-color': metric.color }">
            <div class="metric-header">
              <div class="metric-icon">
                <span class="icon-text">{{ metric.icon }}</span>
              </div>
              <div class="metric-info">
                <div class="metric-title">{{ metric.title }}</div>
                <el-statistic
                  :value="metric.value"
                  :precision="0"
                  class="metric-statistic"
                >
                  <template #suffix>
                    <span class="metric-unit">{{ metric.unit }}</span>
                  </template>
                </el-statistic>
              </div>
            </div>
            <div class="metric-footer">
              <div class="metric-trend" :class="getTrendClass(metric.trend)">
                <span class="trend-icon">{{ getTrendIcon(metric.trend) }}</span>
                <span class="trend-text">{{ getTrendText(metric.trend) }}</span>
              </div>
              <div class="metric-sparkline">
                <div class="sparkline-bar" v-for="(value, i) in metric.sparkline" :key="i"
                     :style="{ height: value + '%', backgroundColor: metric.color }"></div>
              </div>
            </div>
          </div>
        </HolographicCard>
      </div>

      <!-- Performance Indicators -->
      <HolographicCard class="section-card" :border="true" :hover="true">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <span class="title-icon">⚡</span>
              性能指标
            </span>
          </div>
        </template>
        <div class="performance-grid">
          <div v-for="(perf, index) in performanceIndicators" :key="index" class="perf-item">
            <div class="perf-header">
              <span class="perf-label">{{ perf.label }}</span>
              <span class="perf-value">{{ perf.value }}{{ perf.unit }}</span>
            </div>
            <el-progress
              :percentage="perf.percentage"
              :color="getPerfColor(perf.percentage)"
              :stroke-width="8"
              :show-text="false"
            />
            <div class="perf-status" :style="{ color: getPerfColor(perf.percentage) }">
              {{ getPerfStatus(perf.percentage) }}
            </div>
          </div>
        </div>
      </HolographicCard>

      <!-- Recent Activities & System Status Row -->
      <div class="info-grid">
        <!-- Recent Activities -->
        <HolographicCard class="section-card" :border="true" :hover="true">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                <span class="title-icon">📋</span>
                最近活动
              </span>
            </div>
          </template>
          <el-empty v-if="recentActivities.length === 0" description="暂无活动记录" :image-size="80" />
          <el-timeline v-else>
            <el-timeline-item
              v-for="(activity, index) in recentActivities"
              :key="index"
              :icon="activity.icon"
              :color="activity.color"
              :timestamp="activity.time"
              placement="top"
            >
              {{ activity.text }}
            </el-timeline-item>
          </el-timeline>
        </HolographicCard>

        <!-- System Status -->
        <HolographicCard class="section-card" :border="true" :hover="true">
          <template #header>
            <div class="card-header">
              <span class="card-title">
                <span class="title-icon">🖥️</span>
                系统状态
              </span>
            </div>
          </template>
          <div class="system-status-grid">
            <div v-for="(service, index) in systemStatus" :key="index" class="status-item">
              <div class="status-info">
                <span class="status-name">{{ service.name }}</span>
                <GlowingTag :type="service.status === 'online' ? 'success' : 'danger'" :text="service.text" size="small" effect="dark" />
              </div>
              <div class="status-indicator" :class="service.status"></div>
            </div>
          </div>
        </HolographicCard>
      </div>

      <!-- Trend Analysis -->
      <HolographicCard class="section-card" :border="true" :hover="true">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <span class="title-icon">📈</span>
              趋势分析
            </span>
            <el-space>
              <NeonButton size="small" :type="trendPeriod === '24h' ? 'primary' : ''" @click="trendPeriod = '24h'">24小时</NeonButton>
              <NeonButton size="small" :type="trendPeriod === '7d' ? 'primary' : ''" @click="trendPeriod = '7d'">7天</NeonButton>
              <NeonButton size="small" :type="trendPeriod === '30d' ? 'primary' : ''" @click="trendPeriod = '30d'">30天</NeonButton>
            </el-space>
          </div>
        </template>
        <LineChart v-if="trendData.length > 0" :data="trendData" :height="240" />
        <el-empty v-else description="暂无趋势数据" :image-size="100" />
      </HolographicCard>

      <!-- Data Distribution -->
      <HolographicCard class="section-card" :border="true" :hover="true">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <span class="title-icon">🎯</span>
              数据分布
            </span>
          </div>
        </template>
        <PieChart v-if="distributionData.length > 0" :data="distributionData" :height="240" />
        <el-empty v-else description="暂无分布数据" :image-size="100" />
      </HolographicCard>

      <!-- Quick Actions -->
      <HolographicCard class="section-card" :border="true" :hover="true">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <span class="title-icon">⚡</span>
              快捷操作
            </span>
          </div>
        </template>
        <el-space wrap :size="15">
          <NeonButton type="primary" :icon="DataAnalysis" @click="navigateTo('/realtime')">
            实时数据
          </NeonButton>
          <NeonButton type="success" :icon="Search" @click="navigateTo('/history')">
            历史查询
          </NeonButton>
          <NeonButton type="warning" :icon="Setting" @click="navigateTo('/scheduler')">
            调度器
          </NeonButton>
          <NeonButton type="danger" :icon="Warning" @click="navigateTo('/alerts-luxury')">
            告警管理
          </NeonButton>
          <NeonButton type="info" :icon="Document" @click="navigateTo('/logs-pro')">
            系统日志
          </NeonButton>
        </el-space>
      </HolographicCard>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, DataAnalysis, Search, Setting, Warning, Document } from '@element-plus/icons-vue'
import LineChart from '@/components/charts/LineChart.vue'
import PieChart from '@/components/charts/PieChart.vue'
import { subscribe } from '@/utils/websocket'
import api from '@/api'
import { HolographicCard, NeonButton, GlowingTag } from '../components/tech'

const router = useRouter()

// ==================== State ====================
const loading = ref(false)
const currentTime = ref('')
const trendPeriod = ref('24h')

// Core Metrics
const coreMetrics = ref([
  {
    title: '总记录数',
    icon: '📊',
    value: 0,
    unit: '条',
    trend: 0,
    color: '#409EFF',
    sparkline: [60, 70, 65, 80, 75, 85, 90]
  },
  {
    title: '活跃彩种',
    icon: '🎯',
    value: 0,
    unit: '个',
    trend: 0,
    color: '#67C23A',
    sparkline: [50, 55, 60, 58, 65, 70, 68]
  },
  {
    title: '成功率',
    icon: '✅',
    value: 0,
    unit: '%',
    trend: 0,
    color: '#E6A23C',
    sparkline: [80, 82, 85, 83, 88, 90, 92]
  },
  {
    title: '活跃任务',
    icon: '⚙️',
    value: 0,
    unit: '个',
    trend: 0,
    color: '#F56C6C',
    sparkline: [40, 45, 42, 50, 48, 52, 55]
  }
])

// Performance Indicators
const performanceIndicators = ref([
  { label: 'CPU使用率', value: 0, unit: '%', percentage: 0 },
  { label: '内存使用', value: 0, unit: 'MB', percentage: 0 },
  { label: '网络流量', value: 0, unit: 'MB/s', percentage: 0 },
  { label: '磁盘使用', value: 0, unit: 'GB', percentage: 0 }
])

// Recent Activities
const recentActivities = ref([])

// System Status
const systemStatus = ref([
  { name: '爬虫服务', status: 'online', text: '正常' },
  { name: '数据库', status: 'online', text: '正常' },
  { name: 'WebSocket', status: 'online', text: '正常' },
  { name: '调度器', status: 'online', text: '正常' }
])

// Charts Data
const trendData = ref([])
const distributionData = ref([])

// ==================== Methods ====================
const updateTime = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const date = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`
}

const loadDashboardData = async () => {
  try {
    loading.value = true

    // Parallel API loading
    const [statusResponse, latestDataResponse] = await Promise.all([
      api.getStatus(),
      api.getLatestData()
    ])

    const statusData = statusResponse.success ? statusResponse.data : null
    const latestData = latestDataResponse.success ? latestDataResponse.data : null

    // Update core metrics from status API
    if (statusData) {
      // Total records
      if (statusData.database?.totalRecords !== undefined) {
        coreMetrics.value[0].value = statusData.database.totalRecords
        coreMetrics.value[0].trend = 0
      }

      // Active lotteries
      if (statusData.lotteries?.active !== undefined) {
        coreMetrics.value[1].value = statusData.lotteries.active
        coreMetrics.value[1].trend = 0
      }

      // Success rate
      if (statusData.crawler?.successRate !== undefined) {
        coreMetrics.value[2].value = Math.round(statusData.crawler.successRate * 100)
        coreMetrics.value[2].trend = 0
      }

      // Active tasks
      if (statusData.scheduler?.activeTasks !== undefined) {
        coreMetrics.value[3].value = statusData.scheduler.activeTasks
        coreMetrics.value[3].trend = 0
      }

      // Performance indicators
      if (statusData.system) {
        performanceIndicators.value[0].value = statusData.system.cpu || 0
        performanceIndicators.value[0].percentage = statusData.system.cpu || 0
        performanceIndicators.value[1].value = Math.round((statusData.system.memory || 0) / 1024 / 1024)
        performanceIndicators.value[1].percentage = statusData.system.memoryPercent || 0
      }

      // System status
      if (statusData.services) {
        systemStatus.value = statusData.services.map(service => ({
          name: service.name,
          status: service.running ? 'online' : 'offline',
          text: service.running ? '正常' : '离线'
        }))
      }
    }

    // Update trend data
    if (latestData && latestData.trends) {
      trendData.value = latestData.trends
    }

    // Update distribution data
    if (latestData && latestData.distribution) {
      distributionData.value = latestData.distribution
    }

    // Update activities
    if (latestData && latestData.activities) {
      recentActivities.value = latestData.activities.slice(0, 4).map(activity => ({
        icon: getActivityIcon(activity.type),
        text: activity.message,
        time: formatTime(activity.time),
        color: getActivityColor(activity.type)
      }))
    }
  } catch (error) {
    ElMessage.error('加载仪表盘数据失败')
    console.error('❌ 加载仪表盘数据失败:', error)
  } finally {
    loading.value = false
  }
}

const handleWebSocketMessage = (data) => {
  console.log('📨 收到WebSocket消息:', data)

  if (data.type === 'stats_update') {
    // Update statistics
    if (data.stats) {
      if (data.stats.totalRecords !== undefined) {
        coreMetrics.value[0].value = data.stats.totalRecords
      }
      if (data.stats.activeLotteries !== undefined) {
        coreMetrics.value[1].value = data.stats.activeLotteries
      }
      if (data.stats.successRate !== undefined) {
        coreMetrics.value[2].value = Math.round(data.stats.successRate * 100)
      }
      if (data.stats.activeTasks !== undefined) {
        coreMetrics.value[3].value = data.stats.activeTasks
      }
    }
  } else if (data.type === 'new_activity') {
    // Add new activity to top
    recentActivities.value.unshift({
      icon: getActivityIcon(data.activity.type),
      text: data.activity.message,
      time: '刚刚',
      color: getActivityColor(data.activity.type)
    })
    if (recentActivities.value.length > 4) {
      recentActivities.value.pop()
    }
  } else if (data.type === 'status_update') {
    // Update system status
    if (data.status && data.status.services) {
      systemStatus.value = data.status.services.map(service => ({
        name: service.name,
        status: service.running ? 'online' : 'offline',
        text: service.running ? '正常' : '离线'
      }))
    }
  }
}

const getTrendClass = (trend) => {
  if (trend > 0) return 'trend-up'
  if (trend < 0) return 'trend-down'
  return 'trend-neutral'
}

const getTrendIcon = (trend) => {
  if (trend > 0) return '↑'
  if (trend < 0) return '↓'
  return '→'
}

const getTrendText = (trend) => {
  if (trend > 0) return `+${trend}%`
  if (trend < 0) return `${trend}%`
  return '持平'
}

const getPerfColor = (percentage) => {
  if (percentage >= 90) return '#F56C6C'
  if (percentage >= 70) return '#E6A23C'
  return '#67C23A'
}

const getPerfStatus = (percentage) => {
  if (percentage >= 90) return '压力较大'
  if (percentage >= 70) return '正常'
  return '良好'
}

const getActivityIcon = (type) => {
  const iconMap = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  }
  return iconMap[type] || 'ℹ️'
}

const getActivityColor = (type) => {
  const colorMap = {
    success: '#67C23A',
    warning: '#E6A23C',
    error: '#F56C6C',
    info: '#409EFF'
  }
  return colorMap[type] || '#409EFF'
}

const formatTime = (timestamp) => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

const navigateTo = (path) => {
  router.push(path)
}

// ==================== Lifecycle ====================
let timeInterval = null
let refreshInterval = null
let unsubscribeWs = null

onMounted(() => {
  // Start time update
  updateTime()
  timeInterval = setInterval(updateTime, 1000)

  // Load initial data
  loadDashboardData()

  // Subscribe to WebSocket
  unsubscribeWs = subscribe(handleWebSocketMessage)

  // Auto-refresh every 30 seconds
  refreshInterval = setInterval(loadDashboardData, 30000)
})

onUnmounted(() => {
  // Cleanup
  if (timeInterval) clearInterval(timeInterval)
  if (refreshInterval) clearInterval(refreshInterval)
  if (unsubscribeWs) unsubscribeWs()
})
</script>

<style scoped>
/* ==================== Glass Morphism Base ==================== */
.dashboard-container {
  padding: 20px;
  min-height: 100vh;
  background: var(--bg-primary);
  transition: background 0.3s ease;
}

.glass-card {
  background: var(--glass-bg) !important;
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border) !important;
  border-radius: 16px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-card:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* ==================== Page Header ==================== */
.page-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px;
  background: rgba(26, 26, 46, 0.6);
  backdrop-filter: blur(20px);
  border-radius: 16px;
}

.page-header::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 2px;
  background: linear-gradient(135deg, var(--tech-cyan), var(--tech-purple));
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  font-size: 32px;
  filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.6));
}

.page-subtitle {
  font-size: 14px;
  color: var(--tech-text-secondary);
  margin: 0;
}

.current-time {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  margin-right: 16px;
  font-family: 'Courier New', monospace;
}

/* ==================== Metrics Grid ==================== */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.metric-card {
  min-height: 160px;
}

.metric-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.metric-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}

.metric-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent-color), var(--accent-color));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.icon-text {
  font-size: 28px;
}

.metric-info {
  flex: 1;
}

.metric-title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.metric-statistic :deep(.el-statistic__content) {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
}

.metric-unit {
  font-size: 16px;
  font-weight: 400;
  color: var(--text-tertiary);
  margin-left: 4px;
}

.metric-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-trend {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

.trend-up {
  color: #67C23A;
}

.trend-down {
  color: #F56C6C;
}

.trend-neutral {
  color: var(--text-tertiary);
}

.metric-sparkline {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 24px;
}

.sparkline-bar {
  width: 4px;
  border-radius: 2px;
  transition: all 0.3s;
  opacity: 0.6;
}

/* ==================== Section Cards ==================== */
.section-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ==================== Performance Grid ==================== */
.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.perf-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.perf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.perf-label {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.perf-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.perf-status {
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}

/* ==================== Info Grid ==================== */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

/* ==================== System Status ==================== */
.system-status-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-name {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-indicator.online {
  background: #67C23A;
  box-shadow: 0 0 8px #67C23A;
}

.status-indicator.offline {
  background: #F56C6C;
  box-shadow: 0 0 8px #F56C6C;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* ==================== Element Plus Overrides ==================== */
:deep(.el-card__header) {
  background: var(--glass-bg);
  border-bottom: 1px solid var(--border-color);
  padding: 16px 20px;
}

:deep(.el-timeline-item__timestamp) {
  color: var(--text-tertiary);
  font-size: 12px;
}

:deep(.el-timeline-item__content) {
  color: var(--text-primary);
  font-size: 14px;
}

:deep(.el-empty__description p) {
  color: var(--text-tertiary);
}

:deep(.el-progress__text) {
  color: var(--text-primary);
}

:deep(.el-tag) {
  border: none;
}

:deep(.el-button) {
  border: none;
}

/* ==================== Responsive ==================== */
@media (max-width: 1400px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1024px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .performance-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 24px;
  }
}

@media (max-width: 480px) {
  .dashboard-container {
    padding: 12px;
  }

  .metric-icon {
    width: 48px;
    height: 48px;
  }

  .icon-text {
    font-size: 24px;
  }

  .metric-statistic :deep(.el-statistic__content) {
    font-size: 24px;
  }
}
</style>
