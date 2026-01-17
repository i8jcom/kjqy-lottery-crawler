<template>
  <div class="compact-luxury-dashboard">
    <!-- 紧凑型头部 -->
    <div class="compact-header">
      <div class="header-left">
        <h2 class="page-title">
          <span class="gradient-text">数据仪表盘</span>
          <span class="current-time">{{ currentTime }}</span>
        </h2>
      </div>
      <div class="header-right">
        <div class="quick-stats">
          <div class="stat-mini" v-for="stat in quickStats" :key="stat.label">
            <span class="stat-label">{{ stat.label }}</span>
            <span class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要内容区 -->
    <div class="dashboard-content">
      <!-- 左侧主要区域 -->
      <div class="main-area">
        <!-- 核心指标卡片 - 紧凑型 -->
        <div class="metrics-grid-compact">
          <!-- 加载状态骨架屏 -->
          <SkeletonCard v-if="loading" v-for="i in 4" :key="`skeleton-${i}`" />

          <!-- 实际数据 -->
          <div
            v-else
            v-for="(metric, index) in coreMetrics"
            :key="index"
            class="metric-card-compact glass-card"
            :style="{ '--accent-color': metric.color }"
          >
            <div class="metric-icon">
              <span class="icon-text">{{ metric.icon }}</span>
            </div>
            <div class="metric-content">
              <div class="metric-title">{{ metric.title }}</div>
              <div class="metric-value">
                {{ formatNumber(metric.value) }}
                <span class="metric-unit">{{ metric.unit }}</span>
              </div>
              <div class="metric-trend" :class="metric.trend > 0 ? 'up' : metric.trend < 0 ? 'down' : 'stable'">
                <span v-if="metric.trend > 0">↑</span>
                <span v-else-if="metric.trend < 0">↓</span>
                <span v-else>-</span>
                {{ metric.trend !== 0 ? Math.abs(metric.trend) + '%' : '稳定' }}
              </div>
            </div>
            <div class="metric-spark">
              <svg viewBox="0 0 60 20" class="sparkline-mini">
                <polyline
                  :points="generateSparkPoints(metric.sparkData)"
                  fill="none"
                  :stroke="metric.color"
                  stroke-width="1.5"
                />
              </svg>
            </div>
          </div>
        </div>

        <!-- 实时监控区 - 紧凑型 -->
        <div class="monitor-row">
          <!-- 性能监控 -->
          <div class="monitor-card-compact glass-card">
            <div class="card-header-compact">
              <h4 class="card-title">性能指标</h4>
              <span class="card-badge">实时</span>
            </div>
            <div class="performance-grid">
              <div v-for="perf in performanceData" :key="perf.name" class="perf-item">
                <div class="perf-header">
                  <span class="perf-name">{{ perf.name }}</span>
                  <span class="perf-value">{{ perf.value }}{{ perf.unit }}</span>
                </div>
                <div class="perf-bar">
                  <div
                    class="perf-fill"
                    :style="{
                      width: `${Math.min(perf.value, 100)}%`,
                      background: getPerfColor(perf.value)
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 活动监控 -->
          <div class="monitor-card-compact glass-card">
            <div class="card-header-compact">
              <h4 class="card-title">最近活动</h4>
              <span class="card-indicator online"></span>
            </div>
            <div class="activity-list">
              <div v-for="(activity, index) in recentActivities" :key="index" class="activity-item">
                <span class="activity-icon" :style="{ background: activity.color }">
                  {{ activity.icon }}
                </span>
                <div class="activity-content">
                  <div class="activity-text">{{ activity.text }}</div>
                  <div class="activity-time">{{ activity.time }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 数据图表区 - 紧凑型 -->
        <div class="charts-row">
          <!-- 趋势图 -->
          <div class="chart-card-compact glass-card">
            <div class="card-header-compact">
              <h4 class="card-title">趋势分析</h4>
              <div class="chart-legend-mini">
                <span class="legend-item" v-for="item in trendLegend" :key="item.name">
                  <span class="legend-dot" :style="{ background: item.color }"></span>
                  {{ item.name }}
                </span>
              </div>
            </div>
            <LineChart
              :data="trendChartData"
              height="200px"
              :smooth="true"
              :showArea="true"
            />
          </div>

          <!-- 分布图 -->
          <div class="chart-card-compact glass-card">
            <div class="card-header-compact">
              <h4 class="card-title">数据分布</h4>
            </div>
            <PieChart
              :data="distributionChartData"
              height="200px"
              :isDonut="true"
              innerRadius="40%"
              outerRadius="75%"
              :showLabel="false"
              roseType="radius"
            />
          </div>
        </div>
      </div>

      <!-- 右侧边栏 -->
      <div class="sidebar-area">
        <!-- 快速操作 -->
        <div class="quick-actions glass-card">
          <h4 class="sidebar-title">快捷操作</h4>
          <div class="action-grid">
            <button
              v-for="action in quickActions"
              :key="action.id"
              class="action-btn"
              @click="handleAction(action)"
            >
              <span class="action-icon">{{ action.icon }}</span>
              <span>{{ action.name }}</span>
            </button>
          </div>
        </div>

        <!-- 排行榜 -->
        <div class="ranking-card glass-card">
          <h4 class="sidebar-title">彩种排行</h4>
          <div class="ranking-list">
            <div v-for="(item, index) in rankingData" :key="index" class="rank-item">
              <span class="rank-num" :class="`rank-${index + 1}`">
                {{ index + 1 }}
              </span>
              <span class="rank-name">{{ item.name }}</span>
              <span class="rank-value">{{ formatNumber(item.value) }}</span>
            </div>
          </div>
        </div>

        <!-- 系统状态 -->
        <div class="status-card glass-card">
          <h4 class="sidebar-title">系统状态</h4>
          <div class="status-list">
            <div v-for="status in systemStatus" :key="status.name" class="status-item">
              <span class="status-dot" :class="status.status"></span>
              <span class="status-name">{{ status.name }}</span>
              <span class="status-text">{{ status.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import api from '../services/api'
import { useWebSocket } from '../composables/useWebSocket'
import { useToast } from '../composables/useToast'
import LineChart from '../components/charts/LineChart.vue'
import PieChart from '../components/charts/PieChart.vue'
import BarChart from '../components/charts/BarChart.vue'
import SkeletonCard from '../components/common/SkeletonCard.vue'

const toast = useToast()

// WebSocket连接
const { connected, subscribe } = useWebSocket()

// 响应式数据
const currentTime = ref('')
const loading = ref(false)
let timeInterval = null
let unsubscribeWs = null

// 更新时间
const updateTime = () => {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}:${seconds}`
}

// 快速统计
const quickStats = ref([
  { label: '在线用户', value: '16', color: 'var(--success-color)' },
  { label: '今日数据', value: '3.2K', color: 'var(--info-color)' },
  { label: '本周数据', value: '28K', color: '#f093fb' },
  { label: '成功率', value: '98%', color: '#fbbf24' }
])

// 核心指标 - 紧凑型
const coreMetrics = ref([
  {
    icon: '📊',
    title: '总记录数',
    value: 285430,
    unit: '',
    trend: 12.5,
    color: '#667eea',
    sparkData: [60, 65, 62, 70, 68, 75, 72, 78]
  },
  {
    icon: '🎯',
    title: '活跃彩种',
    value: 28,
    unit: '',
    trend: 0,
    color: '#f093fb',
    sparkData: [25, 26, 27, 26, 28, 28, 27, 28]
  },
  {
    icon: '✅',
    title: '成功率',
    value: 98.5,
    unit: '%',
    trend: 2.3,
    color: 'var(--info-color)',
    sparkData: [95, 96, 97, 96, 98, 98, 99, 98]
  },
  {
    icon: '⚡',
    title: '活跃任务数',
    value: 16,
    unit: '',
    trend: -5.2,
    color: 'var(--success-color)',
    sparkData: [20, 18, 19, 17, 16, 17, 16, 16]
  }
])

// 性能数据
const performanceData = ref([
  { name: '响应速度', value: 85, unit: 'ms' },
  { name: '成功率', value: 98, unit: '%' },
  { name: 'CPU使用率', value: 45, unit: '%' },
  { name: '内存使用率', value: 62, unit: '%' }
])

// 最近活动
const recentActivities = ref([
  { icon: '✅', text: '新加坡彩爬取成功', time: '2分钟前', color: 'var(--success-color)' },
  { icon: '⚠️', text: 'API响应延迟报警', time: '5分钟前', color: 'var(--warning-color)' },
  { icon: '📊', text: '数据统计报表生成', time: '8分钟前', color: 'var(--info-color)' },
  { icon: '🔄', text: '缓存更新完成', time: '12分钟前', color: '#667eea' }
])

// 趋势图例
const trendLegend = ref([
  { name: '成功', color: 'var(--success-color)' },
  { name: '失败', color: 'var(--error-color)' }
])

// 趋势数据
const trendData = ref([
  { label: '周一', success: 85, fail: 15 },
  { label: '周二', success: 90, fail: 10 },
  { label: '周三', success: 88, fail: 12 },
  { label: '周四', success: 92, fail: 8 },
  { label: '周五', success: 95, fail: 5 },
  { label: '周六', success: 87, fail: 13 },
  { label: '周日', success: 90, fail: 10 }
])

// 转换趋势数据为ECharts格式
const trendChartData = computed(() => ({
  xAxis: trendData.value.map(item => item.label),
  series: [
    {
      name: '成功',
      data: trendData.value.map(item => item.success)
    },
    {
      name: '失败',
      data: trendData.value.map(item => item.fail)
    }
  ]
}))

// 分布数据
const distributionData = ref([
  { name: '北京赛车', percent: 28, color: '#667eea' },
  { name: '重庆时时彩', percent: 22, color: '#f093fb' },
  { name: '江苏快3', percent: 18, color: 'var(--info-color)' },
  { name: '广东11选5', percent: 15, color: 'var(--success-color)' },
  { name: '其他', percent: 17, color: '#fbbf24' }
])

// 转换分布数据为ECharts格式
const distributionChartData = computed(() =>
  distributionData.value.map(item => ({
    name: item.name,
    value: item.percent
  }))
)

// 快速操作
const quickActions = ref([
  { id: 1, icon: '🔄', name: '手动刷新' },
  { id: 2, icon: '📥', name: '导出数据' },
  { id: 3, icon: '⚙️', name: '配置管理' },
  { id: 4, icon: '📊', name: '查看报告' }
])

// 排行榜数据
const rankingData = ref([
  { name: '北京赛车', value: 15420 },
  { name: '重庆时时彩', value: 13250 },
  { name: '江苏快3', value: 11830 },
  { name: '广东11选5', value: 10240 },
  { name: '福彩3D', value: 8360 }
])

// 系统状态
const systemStatus = ref([
  { name: '数据库', status: 'online', text: '正常' },
  { name: 'Redis', status: 'online', text: '正常' },
  { name: 'API', status: 'online', text: '正常' },
  { name: '调度器', status: 'running', text: '运行中' }
])

// 工具函数
const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

const generateSparkPoints = (data) => {
  const width = 60
  const height = 20
  const step = width / (data.length - 1)
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  return data.map((value, index) => {
    const x = index * step
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')
}

const getPerfColor = (value) => {
  if (value < 50) return 'var(--success-color)'
  if (value < 80) return '#fbbf24'
  return 'var(--error-color)'
}

const handleAction = (action) => {
  console.log('Action:', action.name)
  // 实现具体操作
}

// 加载仪表盘数据
const loadDashboardData = async () => {
  try {
    loading.value = true

    // 并行加载两个API
    const [statusResponse, latestDataResponse] = await Promise.all([
      api.getStatus(),
      api.getLatestData()
    ])

    // 从status响应中提取数据
    const statusData = statusResponse.success ? statusResponse.data : null

    // 更新核心指标
    if (statusData) {
      // 总记录数
      if (statusData.database?.totalRecords !== undefined) {
        coreMetrics.value[0].value = statusData.database.totalRecords
        // 趋势暂时设为0（后端没有提供）
        coreMetrics.value[0].trend = 0
      }

      // 活跃彩种数
      if (statusData.lotteries?.total !== undefined) {
        coreMetrics.value[1].value = statusData.lotteries.total
        coreMetrics.value[1].trend = 0
      }

      // 成功率（从调度器统计中获取）
      if (statusData.scheduler?.successRate !== undefined) {
        coreMetrics.value[2].value = statusData.scheduler.successRate
        coreMetrics.value[2].trend = 0
      }

      // 活跃任务数
      if (statusData.scheduler?.activeTasks !== undefined) {
        coreMetrics.value[3].value = statusData.scheduler.activeTasks
        coreMetrics.value[3].trend = 0
      }

      // 更新系统状态
      systemStatus.value = [
        { name: '数据库', status: 'online', text: '正常' },
        { name: 'Redis', status: 'online', text: '正常' },
        { name: 'API', status: 'online', text: '正常' },
        {
          name: '调度器',
          status: statusData.scheduler?.isRunning ? 'running' : 'offline',
          text: statusData.scheduler?.isRunning ? '运行中' : '已停止'
        }
      ]

      // 更新性能数据（使用模拟数据，因为后端没有提供）
      performanceData.value = [
        { name: '响应速度', value: 85, unit: 'ms' },
        { name: '成功率', value: statusData.scheduler?.successRate || 98, unit: '%' },
        { name: 'CPU使用率', value: 45, unit: '%' },
        { name: '内存使用率', value: 62, unit: '%' }
      ]
    }

    // 从latest-data响应中提取数据
    const latestData = latestDataResponse.success ? latestDataResponse.data : null

    // 更新最新数据和活动
    if (latestData && latestData.dataBySource) {
      // 转换为活动列表格式
      const activities = []
      Object.values(latestData.dataBySource).forEach(sourceData => {
        if (sourceData.results && sourceData.results.length > 0) {
          sourceData.results.slice(0, 2).forEach(result => {
            activities.push({
              type: 'success',
              message: `${result.lottery_name || result.lottery_code} 爬取成功`,
              timestamp: result.created_at || Date.now()
            })
          })
        }
      })

      recentActivities.value = activities.slice(0, 4).map(activity => ({
        icon: getActivityIcon(activity.type),
        text: activity.message,
        time: formatRelativeTime(activity.timestamp),
        color: getActivityColor(activity.type)
      }))
    }

    // 更新排行榜数据（从最新数据中统计）
    if (latestData && latestData.dataBySource) {
      const lotteryCount = {}
      Object.values(latestData.dataBySource).forEach(sourceData => {
        if (sourceData.results) {
          sourceData.results.forEach(result => {
            const name = result.lottery_name || result.lottery_code
            lotteryCount[name] = (lotteryCount[name] || 0) + 1
          })
        }
      })

      // 转换为排行榜格式并排序
      rankingData.value = Object.entries(lotteryCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    }

    console.log('✅ 仪表盘数据加载成功', { statusData, latestData })
  } catch (error) {
    toast.error('加载仪表盘数据失败')
    console.error('❌ 加载仪表盘数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 处理WebSocket消息
const handleWebSocketMessage = (data) => {
  console.log('收到WebSocket消息:', data)

  // 根据消息类型更新相应数据
  if (data.type === 'stats_update') {
    // 更新统计数据
    if (data.stats) {
      Object.assign(coreMetrics.value[0], { value: data.stats.totalRecords })
      Object.assign(coreMetrics.value[1], { value: data.stats.activeLotteries })
      Object.assign(coreMetrics.value[2], { value: data.stats.successRate })
      Object.assign(coreMetrics.value[3], { value: data.stats.activeTasks })
    }
  } else if (data.type === 'new_activity') {
    // 添加新活动到列表顶部
    recentActivities.value.unshift({
      icon: getActivityIcon(data.activity.type),
      text: data.activity.message,
      time: '刚刚',
      color: getActivityColor(data.activity.type)
    })
    // 保持只显示最新4条
    if (recentActivities.value.length > 4) {
      recentActivities.value.pop()
    }
  } else if (data.type === 'status_update') {
    // 更新系统状态
    if (data.status && data.status.services) {
      systemStatus.value = data.status.services.map(service => ({
        name: service.name,
        status: service.running ? 'online' : 'offline',
        text: service.running ? '正常' : '离线'
      }))
    }
  }
}

// 获取活动图标
const getActivityIcon = (type) => {
  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: '📊',
    update: '🔄'
  }
  return icons[type] || '📋'
}

// 获取活动颜色
const getActivityColor = (type) => {
  const colors = {
    success: 'var(--success-color)',
    warning: 'var(--warning-color)',
    error: 'var(--error-color)',
    info: 'var(--info-color)',
    update: '#667eea'
  }
  return colors[type] || '#667eea'
}

// 格式化相对时间
const formatRelativeTime = (timestamp) => {
  const now = Date.now()
  const diff = now - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

onMounted(() => {
  // 启动时间更新
  updateTime()
  timeInterval = setInterval(updateTime, 1000)

  // 加载初始数据
  loadDashboardData()

  // 订阅WebSocket消息
  unsubscribeWs = subscribe(handleWebSocketMessage)

  // 每30秒刷新一次数据
  const refreshInterval = setInterval(loadDashboardData, 30000)

  // 清理时移除定时器
  onUnmounted(() => {
    clearInterval(refreshInterval)
  })
})

onUnmounted(() => {
  // 清理时间定时器
  if (timeInterval) {
    clearInterval(timeInterval)
  }

  // 取消WebSocket订阅
  if (unsubscribeWs) {
    unsubscribeWs()
  }
})
</script>

<style scoped>
.compact-luxury-dashboard {
  min-height: calc(100vh - 64px);
}

/* 紧凑型头部 */
.compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.gradient-text {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.current-time {
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 400;
}

.quick-stats {
  display: flex;
  gap: 20px;
}

.stat-mini {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-bottom: 2px;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
}

/* 主要内容区 */
.dashboard-content {
  display: flex;
  gap: 16px;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.sidebar-area {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 核心指标 - 紧凑型 */
.metrics-grid-compact {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.metric-card-compact {
  padding: 14px;
  display: flex;
  gap: 10px;
  align-items: center;
  border-left: 3px solid var(--accent-color);
}

.metric-icon {
  width: 36px;
  height: 36px;
  background: var(--glass-bg);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-text {
  font-size: 18px;
}

.metric-content {
  flex: 1;
  min-width: 0;
}

.metric-title {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  margin-bottom: 4px;
}

.metric-unit {
  font-size: 12px;
  font-weight: 500;
  margin-left: 2px;
}

.metric-trend {
  font-size: 11px;
  font-weight: 600;
}

.metric-trend.up {
  color: var(--success-color);
}

.metric-trend.down {
  color: var(--error-color);
}

.metric-trend.stable {
  color: var(--text-tertiary);
}

.metric-spark {
  width: 60px;
  height: 20px;
  flex-shrink: 0;
}

.sparkline-mini {
  width: 100%;
  height: 100%;
  opacity: 0.7;
}

/* 监控卡片行 */
.monitor-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.monitor-card-compact {
  padding: 14px;
}

.card-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--glass-bg);
}

.card-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-badge {
  font-size: 10px;
  padding: 3px 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 10px;
  color: white;
  font-weight: 600;
}

.card-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.card-indicator.online {
  background: var(--success-color);
  box-shadow: 0 0 0 0 rgba(67, 233, 123, 0.7);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(67, 233, 123, 0.7);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(67, 233, 123, 0);
  }
}

/* 性能网格 */
.performance-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.perf-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.perf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.perf-name {
  font-size: 12px;
  color: var(--text-secondary);
}

.perf-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.perf-bar {
  height: 6px;
  background: var(--glass-bg);
  border-radius: 3px;
  overflow: hidden;
}

.perf-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 活动列表 */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.activity-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-text {
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.activity-time {
  font-size: 11px;
  color: var(--text-tertiary);
}

/* 图表行 */
.charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
}

.chart-card-compact {
  padding: 14px;
}

.chart-legend-mini {
  display: flex;
  gap: 12px;
  font-size: 11px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.chart-placeholder {
  height: 180px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.trend-bars {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 8px;
  padding: 0 10px;
}

.trend-bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
  justify-content: flex-end;
}

.trend-bar {
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
}

.trend-label {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

/* 分布图 */
.distribution-chart {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dist-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dist-name {
  font-size: 12px;
  color: var(--text-secondary);
}

.dist-percent {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.dist-bar {
  height: 6px;
  background: var(--glass-bg);
  border-radius: 3px;
  overflow: hidden;
}

.dist-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 右侧边栏 */
.sidebar-title {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 快速操作 */
.quick-actions {
  padding: 14px;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.action-btn {
  padding: 10px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.action-btn:hover {
  background: rgba(102, 126, 234, 0.15);
  border-color: rgba(102, 126, 234, 0.3);
  transform: translateY(-2px);
}

.action-icon {
  font-size: 14px;
}

/* 排行榜 */
.ranking-card {
  padding: 14px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rank-num {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  background: var(--glass-border);
}

.rank-num.rank-1 {
  background: linear-gradient(135deg, #fbbf24, #ffed4e);
}

.rank-num.rank-2 {
  background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
}

.rank-num.rank-3 {
  background: linear-gradient(135deg, #cd7f32, #e5a06e);
}

.rank-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
}

.rank-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* 系统状态 */
.status-card {
  padding: 14px;
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online {
  background: var(--success-color);
}

.status-dot.running {
  background: var(--info-color);
}

.status-dot.offline {
  background: var(--error-color);
}

.status-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 响应式 - 大平板 */
@media (max-width: 1400px) {
  .metrics-grid-compact {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-content {
    flex-direction: column;
  }

  .sidebar-area {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
}

/* 响应式 - 平板 */
@media (max-width: 1024px) {
  .compact-header {
    padding: 10px 0;
    margin-bottom: 12px;
  }

  .gradient-text {
    font-size: 20px;
  }

  .quick-stats {
    gap: 16px;
  }

  .stat-value {
    font-size: 14px;
  }

  .main-area {
    gap: 12px;
  }

  .sidebar-area {
    gap: 12px;
  }

  .metrics-grid-compact {
    gap: 10px;
  }

  .monitor-row {
    gap: 10px;
  }

  .charts-row {
    gap: 10px;
  }
}

/* 响应式 - 手机横屏 */
@media (max-width: 768px) {
  .compact-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 0;
    margin-bottom: 10px;
  }

  .page-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .gradient-text {
    font-size: 18px;
  }

  .current-time {
    font-size: 12px;
  }

  .quick-stats {
    width: 100%;
    justify-content: space-between;
    gap: 12px;
  }

  .stat-label {
    font-size: 10px;
  }

  .stat-value {
    font-size: 13px;
  }

  .dashboard-content {
    gap: 10px;
  }

  .main-area {
    gap: 10px;
  }

  .sidebar-area {
    gap: 10px;
  }

  .metrics-grid-compact {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .metric-card-compact {
    padding: 12px;
  }

  .metric-icon {
    width: 32px;
    height: 32px;
  }

  .icon-text {
    font-size: 16px;
  }

  .metric-title {
    font-size: 10px;
  }

  .metric-value {
    font-size: 18px;
  }

  .monitor-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .monitor-card-compact {
    padding: 12px;
  }

  .card-header-compact {
    margin-bottom: 10px;
    padding-bottom: 8px;
  }

  .card-title {
    font-size: 12px;
  }

  .charts-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .chart-card-compact {
    padding: 12px;
  }

  .sidebar-area {
    grid-template-columns: 1fr;
  }

  .sidebar-title {
    font-size: 12px;
    margin-bottom: 10px;
  }

  .quick-actions,
  .ranking-card,
  .status-card {
    padding: 12px;
  }

  .action-grid {
    gap: 6px;
  }

  .action-btn {
    padding: 8px;
    font-size: 10px;
  }

  .ranking-list,
  .status-list {
    gap: 6px;
  }
}

/* 响应式 - 手机竖屏 */
@media (max-width: 480px) {
  .compact-header {
    padding: 6px 0;
    margin-bottom: 8px;
  }

  .gradient-text {
    font-size: 16px;
  }

  .quick-stats {
    flex-wrap: wrap;
    gap: 8px;
  }

  .stat-mini {
    min-width: calc(50% - 4px);
  }

  .dashboard-content {
    gap: 8px;
  }

  .main-area,
  .sidebar-area {
    gap: 8px;
  }

  .metrics-grid-compact {
    gap: 6px;
  }

  .metric-card-compact {
    padding: 10px;
    gap: 8px;
  }

  .metric-icon {
    width: 28px;
    height: 28px;
  }

  .icon-text {
    font-size: 14px;
  }

  .metric-value {
    font-size: 16px;
  }

  .monitor-card-compact,
  .chart-card-compact {
    padding: 10px;
  }

  .card-header-compact {
    margin-bottom: 8px;
    padding-bottom: 6px;
  }

  .quick-actions,
  .ranking-card,
  .status-card {
    padding: 10px;
  }

  .action-grid {
    grid-template-columns: 1fr;
  }

  .chart-placeholder {
    height: 150px;
  }
}
</style>
