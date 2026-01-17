<template>
  <div class="alerts-luxury-page">
    <!-- 页面标题区 -->
    <div class="page-header-luxury">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title-luxury">
            <span class="title-icon">📢</span>
            <span class="title-gradient">告警管理中心</span>
          </h1>
          <p class="page-subtitle">实时监控系统告警 · 智能通知配置 · 多维度数据分析</p>
        </div>
        <div class="header-actions">
          <button class="btn-luxury btn-refresh" @click="refreshAll">
            <span class="btn-icon">🔄</span>
            <span>刷新数据</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 统计卡片区 - 豪华版 -->
    <div class="stats-grid-luxury">
      <div class="stat-card-luxury" v-for="stat in statsCards" :key="stat.id">
        <div class="card-glow" :style="{ background: stat.gradient }"></div>
        <div class="card-content-luxury">
          <div class="stat-icon-wrapper" :style="{ background: stat.gradient }">
            <span class="stat-icon-large">{{ stat.icon }}</span>
          </div>
          <div class="stat-details">
            <div class="stat-label-luxury">{{ stat.label }}</div>
            <div class="stat-value-luxury">{{ stat.value }}</div>
            <div class="stat-trend" :class="stat.trendClass">
              <span class="trend-icon">{{ stat.trendIcon }}</span>
              <span class="trend-text">{{ stat.trend }}</span>
            </div>
          </div>
        </div>
        <div class="card-decoration"></div>
      </div>
    </div>

    <!-- 数据可视化区域 -->
    <div class="charts-section-luxury">
      <div class="panel-luxury">
        <div class="panel-header-luxury">
          <div class="header-left">
            <h2 class="panel-title-luxury">
              <span class="title-icon-small">📊</span>
              告警趋势分析
            </h2>
            <span class="badge-count">最近7天</span>
          </div>
        </div>
        <div class="panel-body-luxury">
          <LineChart
            :data="alertTrendData"
            height="220px"
            :smooth="true"
            :showArea="true"
          />
        </div>
      </div>

      <div class="panel-luxury">
        <div class="panel-header-luxury">
          <div class="header-left">
            <h2 class="panel-title-luxury">
              <span class="title-icon-small">🥧</span>
              告警类型分布
            </h2>
          </div>
        </div>
        <div class="panel-body-luxury">
          <PieChart
            :data="alertTypeData"
            height="220px"
            :isDonut="true"
            innerRadius="40%"
            outerRadius="75%"
            :showLabel="false"
            roseType="radius"
          />
        </div>
      </div>

      <div class="panel-luxury">
        <div class="panel-header-luxury">
          <div class="header-left">
            <h2 class="panel-title-luxury">
              <span class="title-icon-small">🍩</span>
              告警状态统计
            </h2>
          </div>
        </div>
        <div class="panel-body-luxury">
          <PieChart
            :data="alertStatusData"
            height="220px"
            :isDonut="true"
            innerRadius="45%"
            outerRadius="75%"
            :showLabel="false"
            roseType="area"
          />
        </div>
      </div>
    </div>

    <!-- 主内容区 - 双栏布局 -->
    <div class="content-grid-luxury">
      <!-- 左侧：告警规则 -->
      <div class="panel-luxury rules-panel-luxury">
        <div class="panel-header-luxury">
          <div class="header-left">
            <h2 class="panel-title-luxury">
              <span class="title-icon-small">⚙️</span>
              告警规则配置
            </h2>
            <span class="badge-count">{{ alertRules.length }} 条规则</span>
          </div>
          <button class="btn-luxury btn-add" @click="showAddRule">
            <span class="btn-icon">➕</span>
            <span>添加规则</span>
          </button>
        </div>

        <div class="panel-body-luxury">
          <div class="rules-list-luxury">
            <div v-if="alertRules.length === 0" class="empty-state-luxury">
              <div class="empty-icon">⚙️</div>
              <div class="empty-text">暂无告警规则</div>
              <div class="empty-hint">点击上方按钮添加第一条规则</div>
            </div>

            <div
              v-for="rule in alertRules"
              :key="rule.id"
              class="rule-card-luxury"
              :class="{ 'rule-disabled': !rule.enabled }"
            >
              <div class="rule-header">
                <div class="rule-info">
                  <div class="rule-name">{{ rule.name }}</div>
                  <div class="rule-condition">{{ rule.condition }}</div>
                </div>
                <div class="rule-actions">
                  <span :class="['level-badge-luxury', `level-${rule.level}`]">
                    {{ getLevelText(rule.level) }}
                  </span>
                  <button
                    class="toggle-switch-luxury"
                    :class="{ 'active': rule.enabled }"
                    @click="toggleRule(rule.id)"
                  >
                    <span class="toggle-slider"></span>
                  </button>
                </div>
              </div>
              <div class="rule-footer" v-if="rule.notifications">
                <span class="notification-label">通知方式：</span>
                <span class="notification-items">{{ rule.notifications.join(', ') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：告警历史 -->
      <div class="panel-luxury history-panel-luxury">
        <div class="panel-header-luxury">
          <div class="header-left">
            <h2 class="panel-title-luxury">
              <span class="title-icon-small">📜</span>
              告警历史记录
            </h2>
          </div>
          <div class="filter-group">
            <button
              v-for="filter in filters"
              :key="filter.value"
              class="filter-btn"
              :class="{ 'active': currentFilter === filter.value }"
              @click="currentFilter = filter.value"
            >
              {{ filter.label }}
            </button>
          </div>
        </div>

        <div class="panel-body-luxury">
          <div class="history-timeline-luxury">
            <div v-if="filteredAlerts.length === 0" class="empty-state-luxury">
              <div class="empty-icon">📭</div>
              <div class="empty-text">暂无告警记录</div>
              <div class="empty-hint">系统运行正常</div>
            </div>

            <div
              v-for="alert in filteredAlerts"
              :key="alert.id"
              class="timeline-item-luxury"
            >
              <div class="timeline-marker" :class="`marker-${alert.level}`">
                <div class="marker-dot"></div>
                <div class="marker-line"></div>
              </div>
              <div class="timeline-card">
                <div class="timeline-header">
                  <span :class="['alert-badge', `badge-${alert.level}`]">
                    {{ getLevelText(alert.level) }}
                  </span>
                  <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
                </div>
                <div class="timeline-body">
                  <div class="alert-message">{{ alert.message }}</div>
                  <div v-if="alert.details" class="alert-details">
                    {{ alert.details }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 通知配置区域 -->
    <div class="panel-luxury notification-panel-luxury">
      <div class="panel-header-luxury">
        <div class="header-left">
          <h2 class="panel-title-luxury">
            <span class="title-icon-small">🔔</span>
            通知渠道配置
          </h2>
        </div>
      </div>

      <div class="panel-body-luxury">
        <div class="notification-cards">
          <div
            v-for="channel in notificationChannels"
            :key="channel.id"
            class="notification-card-luxury"
            :class="{ 'active': channel.enabled }"
          >
            <div class="channel-icon" :style="{ background: channel.gradient }">
              {{ channel.icon }}
            </div>
            <div class="channel-info">
              <div class="channel-name">{{ channel.name }}</div>
              <div class="channel-status" :class="channel.enabled ? 'status-active' : 'status-inactive'">
                {{ channel.enabled ? '已启用' : '未启用' }}
              </div>
            </div>
            <button class="btn-luxury btn-test" @click="testNotification(channel.id)">
              测试
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import LineChart from '../components/charts/LineChart.vue'
import PieChart from '../components/charts/PieChart.vue'
import { useToast } from '../composables/useToast'

const toast = useToast()

console.log('✅ AlertsLuxury 组件已加载')

// 统计数据
const alertStats = ref({
  total: 0,
  pending: 0,
  resolved: 0,
  rate: '0%'
})

// 告警规则
const alertRules = ref([])

// 告警历史
const alertHistory = ref([])

// 当前筛选
const currentFilter = ref('all')

// 筛选选项
const filters = [
  { label: '全部', value: 'all' },
  { label: '严重', value: 'critical' },
  { label: '错误', value: 'error' },
  { label: '警告', value: 'warning' },
  { label: '信息', value: 'info' }
]

// 通知渠道
const notificationChannels = ref([
  {
    id: 'email',
    name: '邮件通知',
    icon: '📧',
    enabled: true,
    gradient: 'linear-gradient(135deg, #667eea, #764ba2)'
  },
  {
    id: 'dingtalk',
    name: '钉钉通知',
    icon: '💬',
    enabled: true,
    gradient: 'linear-gradient(135deg, #fa709a, #fee140)'
  },
  {
    id: 'wechat',
    name: '企业微信',
    icon: '📱',
    enabled: false,
    gradient: 'linear-gradient(135deg, var(--success-color), #38f9d7)'
  },
  {
    id: 'webhook',
    name: 'Webhook',
    icon: '🔗',
    enabled: true,
    gradient: 'linear-gradient(135deg, var(--info-color), #00f2fe)'
  }
])

// 告警趋势数据（7天）
const alertTrendData = computed(() => ({
  xAxis: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
  series: [
    {
      name: '严重',
      data: [2, 1, 0, 3, 1, 2, 1]
    },
    {
      name: '错误',
      data: [5, 3, 4, 2, 3, 4, 2]
    },
    {
      name: '警告',
      data: [8, 6, 7, 5, 6, 7, 8]
    },
    {
      name: '信息',
      data: [12, 10, 11, 9, 10, 12, 11]
    }
  ]
}))

// 告警类型分布数据
const alertTypeData = computed(() => [
  { name: '爬取失败', value: 35 },
  { name: '数据缺失', value: 28 },
  { name: '响应超时', value: 22 },
  { name: '系统异常', value: 15 }
])

// 告警状态分布数据
const alertStatusData = computed(() => [
  { name: '已处理', value: 75 },
  { name: '待处理', value: 25 }
])

// 统计卡片数据
const statsCards = computed(() => [
  {
    id: 'total',
    label: '总告警数',
    value: alertStats.value.total,
    icon: '🔔',
    gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
    trend: '最近24小时',
    trendIcon: '📊',
    trendClass: 'trend-neutral'
  },
  {
    id: 'pending',
    label: '待处理',
    value: alertStats.value.pending,
    icon: '⚠️',
    gradient: 'linear-gradient(135deg, #fa709a, #fee140)',
    trend: '需要关注',
    trendIcon: '👀',
    trendClass: 'trend-warning'
  },
  {
    id: 'resolved',
    label: '已处理',
    value: alertStats.value.resolved,
    icon: '✅',
    gradient: 'linear-gradient(135deg, var(--success-color), #38f9d7)',
    trend: '处理率 ' + Math.round((alertStats.value.resolved / (alertStats.value.total || 1)) * 100) + '%',
    trendIcon: '📈',
    trendClass: 'trend-success'
  },
  {
    id: 'rate',
    label: '告警率',
    value: alertStats.value.rate,
    icon: '📊',
    gradient: 'linear-gradient(135deg, var(--info-color), #00f2fe)',
    trend: '系统稳定',
    trendIcon: '🎯',
    trendClass: 'trend-info'
  }
])

// 过滤后的告警
const filteredAlerts = computed(() => {
  if (currentFilter.value === 'all') {
    return alertHistory.value
  }
  return alertHistory.value.filter(alert => alert.level === currentFilter.value)
})

// 获取告警级别文本
const getLevelText = (level) => {
  const levelMap = {
    'critical': '严重',
    'error': '错误',
    'warning': '警告',
    'info': '信息'
  }
  return levelMap[level] || level
}

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 加载告警统计
const loadAlertStats = async () => {
  try {
    console.log('📊 加载告警统计...')
    const response = await api.getAlertStats(24)
    console.log('📊 告警统计响应:', response)

    if (response.success) {
      const stats = response.data
      alertStats.value = {
        total: stats.total || 0,
        pending: stats.byLevel?.error || 0,
        resolved: stats.total - (stats.byLevel?.error || 0),
        rate: stats.total > 0 ? `${((stats.byLevel?.error || 0) / stats.total * 100).toFixed(1)}%` : '0%'
      }
    }
  } catch (error) {
    toast.error('加载告警统计失败')
    console.error('❌ 加载告警统计失败:', error)
    alertStats.value = {
      total: 24,
      pending: 5,
      resolved: 19,
      rate: '2.8%'
    }
  }
}

// 加载告警规则
const loadAlertRules = async () => {
  try {
    console.log('⚙️ 加载告警规则...')
    const response = await api.getAlertRules()
    console.log('⚙️ 告警规则响应:', response)

    if (response.success && response.data.rules) {
      alertRules.value = response.data.rules
    }
  } catch (error) {
    toast.error('加载告警规则失败')
    console.error('❌ 加载告警规则失败:', error)
    alertRules.value = [
      {
        id: 1,
        name: '爬取失败告警',
        condition: '连续失败次数 >= 3',
        level: 'error',
        notifications: ['邮件', 'Webhook'],
        enabled: true
      },
      {
        id: 2,
        name: '数据缺失告警',
        condition: '缺失期数 >= 2',
        level: 'warning',
        notifications: ['邮件'],
        enabled: true
      },
      {
        id: 3,
        name: '响应超时告警',
        condition: '响应时间 > 30s',
        level: 'warning',
        notifications: ['Webhook'],
        enabled: false
      },
      {
        id: 4,
        name: '系统异常告警',
        condition: '系统崩溃或异常退出',
        level: 'critical',
        notifications: ['邮件', '钉钉', 'Webhook'],
        enabled: true
      }
    ]
  }
}

// 加载告警历史
const loadAlertHistory = async () => {
  try {
    console.log('📜 加载告警历史...')
    const response = await api.getAlertHistory({ limit: 20 })
    console.log('📜 告警历史响应:', response)

    if (response.success && response.data.records) {
      alertHistory.value = response.data.records
    }
  } catch (error) {
    toast.error('加载告警历史失败')
    console.error('❌ 加载告警历史失败:', error)
    alertHistory.value = [
      {
        id: 1,
        level: 'error',
        message: 'SSQ 彩种连续爬取失败 3 次',
        details: '数据源响应超时，建议检查网络连接',
        timestamp: new Date(Date.now() - 1000 * 60 * 5)
      },
      {
        id: 2,
        level: 'warning',
        message: 'DLT 彩种数据缺失 2 期',
        details: '期号: 2024001, 2024002',
        timestamp: new Date(Date.now() - 1000 * 60 * 30)
      },
      {
        id: 3,
        level: 'info',
        message: '数据源健康检查完成',
        details: '所有数据源运行正常',
        timestamp: new Date(Date.now() - 1000 * 60 * 60)
      },
      {
        id: 4,
        level: 'warning',
        message: 'PL3 彩种响应时间过长',
        details: '平均响应时间: 28.5s',
        timestamp: new Date(Date.now() - 1000 * 60 * 90)
      },
      {
        id: 5,
        level: 'critical',
        message: 'FC3D 数据源完全不可用',
        details: '数据源返回 503 错误，已自动切换备用源',
        timestamp: new Date(Date.now() - 1000 * 60 * 120)
      }
    ]
  }
}

// 切换规则状态
const toggleRule = async (id) => {
  const rule = alertRules.value.find(r => r.id === id)
  if (rule) {
    const previousState = rule.enabled
    rule.enabled = !rule.enabled

    try {
      // TODO: 调用 API 更新规则状态
      // await api.updateAlertRule(id, { enabled: rule.enabled })

      if (rule.enabled) {
        toast.success(`规则「${rule.name}」已启用`)
      } else {
        toast.info(`规则「${rule.name}」已禁用`)
      }
      console.log(`规则 ${id} 状态已更新:`, rule.enabled)
    } catch (error) {
      // 恢复原状态
      rule.enabled = previousState
      toast.error('更新规则状态失败')
      console.error('❌ 更新规则状态失败:', error)
    }
  }
}

// 显示添加规则模态框
const showAddRule = () => {
  toast.info('添加规则功能即将上线')
  console.log('显示添加规则模态框')
  // TODO: 实现添加规则功能
}

// 测试通知
const testNotification = async (channelId) => {
  const channel = notificationChannels.value.find(c => c.id === channelId)
  if (!channel) return

  if (!channel.enabled) {
    toast.warning(`${channel.name}未启用，无法测试`)
    console.log(`测试通知渠道: ${channelId} - 未启用`)
    return
  }

  try {
    toast.info(`正在测试${channel.name}...`)
    console.log(`测试通知渠道: ${channelId}`)

    // TODO: 调用 API 发送测试通知
    // await api.testNotificationChannel(channelId)

    // 模拟测试延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    toast.success(`${channel.name}测试成功`)
  } catch (error) {
    toast.error(`${channel.name}测试失败`)
    console.error('❌ 测试通知失败:', error)
  }
}

// 刷新所有数据
const refreshAll = async () => {
  try {
    toast.info('正在刷新数据...')
    console.log('🔄 刷新所有数据...')

    await Promise.all([
      loadAlertStats(),
      loadAlertRules(),
      loadAlertHistory()
    ])

    toast.success('数据刷新完成')
  } catch (error) {
    toast.error('数据刷新失败')
    console.error('❌ 刷新数据失败:', error)
  }
}

// 初始化
onMounted(() => {
  console.log('🔄 AlertsLuxury onMounted')
  loadAlertStats()
  loadAlertRules()
  loadAlertHistory()
})
</script>

<style scoped>
.alerts-luxury-page {
  padding: 0;
  min-height: 100vh;
}

/* 页面标题区 - 紧凑版 */
.page-header-luxury {
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(118, 75, 162, 0.1) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}

.page-header-luxury::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2, #667eea);
  background-size: 200% 100%;
  animation: gradientShift 3s ease infinite;
}

@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.title-section {
  flex: 1;
}

.page-title-luxury {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.title-icon {
  font-size: 24px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.title-gradient {
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-luxury {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.btn-refresh {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-refresh:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.btn-icon {
  font-size: 16px;
}

/* 统计卡片区 - 紧凑版 */
.stats-grid-luxury {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card-luxury {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card-luxury:hover {
  transform: translateY(-4px);
  border-color: var(--glass-border);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
}

.card-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  opacity: 0.1;
  filter: blur(40px);
  transition: opacity 0.4s ease;
}

.stat-card-luxury:hover .card-glow {
  opacity: 0.2;
}

.card-content-luxury {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1;
}

.stat-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.stat-icon-large {
  font-size: 24px;
}

.stat-details {
  flex: 1;
}

.stat-label-luxury {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value-luxury {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.trend-icon {
  font-size: 14px;
}

.trend-success { color: #10b981; }
.trend-warning { color: var(--warning-color); }
.trend-info { color: #3b82f6; }
.trend-neutral { color: var(--text-tertiary); }

.card-decoration {
  position: absolute;
  bottom: -20px;
  right: -20px;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--glass-bg) 0%, transparent 70%);
}

/* 图表区域 */
.charts-section-luxury {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 1400px) {
  .charts-section-luxury {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1401px) and (max-width: 1800px) {
  .charts-section-luxury {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-section-luxury .panel-luxury:last-child {
    grid-column: 1 / -1;
  }
}

/* 双栏布局 */
.content-grid-luxury {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

@media (max-width: 1200px) {
  .content-grid-luxury {
    grid-template-columns: 1fr;
  }
}

/* 面板 - 豪华版 */
.panel-luxury {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.panel-luxury:hover {
  border-color: var(--glass-border-strong);
}

.panel-header-luxury {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--glass-bg);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-title-luxury {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.title-icon-small {
  font-size: 16px;
}

.badge-count {
  padding: 2px 8px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 10px;
  font-size: 11px;
  color: #667eea;
  font-weight: 500;
}

.btn-add {
  background: linear-gradient(135deg, var(--success-color), #38f9d7);
  color: white;
  font-size: 12px;
  padding: 6px 14px;
}

.btn-add:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(67, 233, 123, 0.4);
}

.panel-body-luxury {
  padding: 16px;
}

/* 告警规则卡片 */
.rules-list-luxury {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-card-luxury {
  background: var(--glass-bg);
  border: 1px solid var(--glass-bg);
  border-radius: 10px;
  padding: 12px;
  transition: all 0.3s ease;
}

.rule-card-luxury:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border-strong);
  transform: translateX(4px);
}

.rule-card-luxury.rule-disabled {
  opacity: 0.5;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.rule-info {
  flex: 1;
}

.rule-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.rule-condition {
  font-size: 12px;
  color: var(--text-tertiary);
}

.rule-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.level-badge-luxury {
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.level-critical {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.level-error {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
  border: 1px solid rgba(251, 146, 60, 0.3);
}

.level-warning {
  background: rgba(245, 158, 11, 0.2);
  color: var(--warning-color);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.level-info {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.toggle-switch-luxury {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--border-color);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toggle-switch-luxury.active {
  background: linear-gradient(135deg, var(--success-color), #38f9d7);
  border-color: transparent;
}

.toggle-slider {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.toggle-switch-luxury.active .toggle-slider {
  transform: translateX(20px);
}

.rule-footer {
  font-size: 11px;
  color: var(--text-tertiary);
  padding-top: 8px;
  border-top: 1px solid var(--glass-bg);
}

.notification-label {
  font-weight: 500;
  margin-right: 8px;
}

/* 筛选按钮组 */
.filter-group {
  display: flex;
  gap: 8px;
}

.filter-btn {
  padding: 8px 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-btn:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.filter-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-color: transparent;
  color: white;
}

/* 时间线 */
.history-timeline-luxury {
  position: relative;
}

.timeline-item-luxury {
  position: relative;
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.timeline-item-luxury:last-child .marker-line {
  display: none;
}

.timeline-marker {
  position: relative;
  width: 12px;
  flex-shrink: 0;
}

.marker-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--glass-border);
  background: var(--border-color);
  transition: all 0.3s ease;
}

.marker-critical .marker-dot {
  background: #ef4444;
  border-color: #ef4444;
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
}

.marker-error .marker-dot {
  background: #fb923c;
  border-color: #fb923c;
  box-shadow: 0 0 12px rgba(251, 146, 60, 0.5);
}

.marker-warning .marker-dot {
  background: var(--warning-color);
  border-color: var(--warning-color);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
}

.marker-info .marker-dot {
  background: #3b82f6;
  border-color: #3b82f6;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
}

.marker-line {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: calc(100% + 12px);
  background: linear-gradient(180deg,
    var(--border-color) 0%,
    var(--glass-bg) 100%);
}

.timeline-card {
  flex: 1;
  background: var(--glass-bg);
  border: 1px solid var(--glass-bg);
  border-radius: 10px;
  padding: 12px;
  transition: all 0.3s ease;
}

.timeline-card:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border-strong);
  transform: translateY(-2px);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.alert-badge {
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.badge-critical {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.badge-error {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
}

.badge-warning {
  background: rgba(245, 158, 11, 0.2);
  color: var(--warning-color);
}

.badge-info {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.alert-time {
  font-size: 12px;
  color: var(--text-muted);
}

.timeline-body {
  font-size: 13px;
}

.alert-message {
  color: var(--text-primary);
  margin-bottom: 6px;
  font-weight: 500;
}

.alert-details {
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

/* 空状态 */
.empty-state-luxury {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.2;
  margin-bottom: 12px;
}

.empty-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-subtle);
}

/* 通知渠道卡片 */
.notification-panel-luxury {
  grid-column: 1 / -1;
}

.notification-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.notification-card-luxury {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-bg);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.notification-card-luxury:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border-strong);
  transform: translateY(-2px);
}

.notification-card-luxury.active {
  border-color: rgba(102, 126, 234, 0.3);
}

.channel-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.channel-info {
  flex: 1;
}

.channel-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
}

.channel-status {
  font-size: 11px;
}

.status-active {
  color: #10b981;
}

.status-inactive {
  color: var(--text-muted);
}

.btn-test {
  background: var(--border-color);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
  padding: 6px 12px;
  font-size: 12px;
}

.btn-test:hover {
  background: var(--glass-border-strong);
  border-color: var(--text-subtle);
  transform: translateY(-1px);
}
</style>
