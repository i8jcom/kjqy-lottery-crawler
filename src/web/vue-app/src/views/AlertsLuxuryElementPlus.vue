<template>
  <div class="alerts-luxury-element-plus">
    <!-- 页面标题区 -->
    <div class="page-header glass-card">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">
            <el-icon class="title-icon" :size="32"><Bell /></el-icon>
            <span class="title-gradient">告警管理中心</span>
          </h1>
          <p class="page-subtitle">实时监控系统告警 · 智能通知配置 · 多维度数据分析</p>
        </div>
        <div class="header-actions">
          <NeonButton type="primary" :icon="Refresh" @click="refreshAll" :loading="refreshing">
            刷新数据
          </NeonButton>
        </div>
      </div>
    </div>

    <!-- 统计卡片区 -->
    <div class="stats-grid">
      <HolographicCard
        v-for="stat in statsCards"
        :key="stat.id"
        class="stat-card"
        :border="true"
        :hover="true"
      >
        <div class="card-glow" :style="{ background: stat.gradient }"></div>
        <div class="stat-content">
          <div class="stat-icon-wrapper" :style="{ background: stat.gradient }">
            <span class="stat-icon">{{ stat.icon }}</span>
          </div>
          <div class="stat-details">
            <div class="stat-label">{{ stat.label }}</div>
            <div class="stat-value">{{ stat.value }}</div>
            <div class="stat-trend" :class="stat.trendClass">
              <span>{{ stat.trendIcon }}</span>
              <span>{{ stat.trend }}</span>
            </div>
          </div>
        </div>
      </HolographicCard>
    </div>

    <!-- 数据可视化区域 -->
    <div class="charts-section">
      <HolographicCard class="chart-card" :border="true" :hover="true">
        <template #header>
          <div class="card-header">
            <h3>
              <el-icon><TrendCharts /></el-icon>
              告警趋势分析
            </h3>
            <GlowingTag type="info" text="最近7天" size="small" effect="dark" />
          </div>
        </template>
        <LineChart
          :data="alertTrendData"
          height="220px"
          :smooth="true"
          :showArea="true"
        />
      </HolographicCard>

      <HolographicCard class="chart-card" :border="true" :hover="true">
        <template #header>
          <div class="card-header">
            <h3>
              <el-icon><PieChart /></el-icon>
              告警类型分布
            </h3>
          </div>
        </template>
        <PieChart
          :data="alertTypeData"
          height="220px"
          :isDonut="true"
          innerRadius="40%"
          outerRadius="75%"
          :showLabel="false"
          roseType="radius"
        />
      </HolographicCard>

      <HolographicCard class="chart-card" :border="true" :hover="true">
        <template #header>
          <div class="card-header">
            <h3>
              <el-icon><DataAnalysis /></el-icon>
              告警状态统计
            </h3>
          </div>
        </template>
        <PieChartComp
          :data="alertStatusData"
          height="220px"
          :isDonut="true"
          innerRadius="45%"
          outerRadius="75%"
          :showLabel="false"
          roseType="area"
        />
      </HolographicCard>
    </div>

    <!-- 主内容区 - 双栏布局 -->
    <div class="content-grid">
      <!-- 左侧：告警规则 -->
      <HolographicCard class="rules-panel" :border="true" :hover="true">
        <template #header>
          <div class="card-header">
            <div class="header-left">
              <h3>
                <el-icon><Setting /></el-icon>
                告警规则配置
              </h3>
              <el-badge :value="alertRules.length" class="badge-count" />
            </div>
            <NeonButton type="primary" :icon="Plus" size="small" @click="showAddRule">
              添加规则
            </NeonButton>
          </div>
        </template>

        <div class="rules-list">
          <el-empty v-if="alertRules.length === 0" description="暂无告警规则">
            <NeonButton type="primary" @click="showAddRule">添加第一条规则</NeonButton>
          </el-empty>

          <div
            v-for="rule in alertRules"
            :key="rule.id"
            class="rule-card"
            :class="{ 'rule-disabled': !rule.enabled }"
          >
            <div class="rule-header">
              <div class="rule-info">
                <div class="rule-name">{{ rule.name }}</div>
                <div class="rule-condition">{{ rule.condition }}</div>
              </div>
              <div class="rule-actions">
                <GlowingTag :type="getLevelType(rule.level)" :text="getLevelText(rule.level)" size="small" effect="dark" />
                <el-switch v-model="rule.enabled" @change="toggleRule(rule.id)" />
                <NeonButton size="small" @click="showEditRule(rule)">
                  编辑
                </NeonButton>
              </div>
            </div>
            <div class="rule-footer" v-if="rule.notifications">
              <span class="notification-label">通知方式：</span>
              <GlowingTag
                v-for="(notification, idx) in rule.notifications"
                :key="idx"
                :text="notification"
                type="info"
                size="small"
                effect="dark"
                class="notification-tag"
              />
            </div>
          </div>
        </div>
      </HolographicCard>

      <!-- 右侧：告警历史 -->
      <HolographicCard class="history-panel" :border="true" :hover="true">
        <template #header>
          <div class="card-header">
            <h3>
              <el-icon><Document /></el-icon>
              告警历史记录
            </h3>
            <el-radio-group v-model="currentFilter" size="small">
              <el-radio-button
                v-for="filter in filters"
                :key="filter.value"
                :label="filter.value"
              >
                {{ filter.label }}
              </el-radio-button>
            </el-radio-group>
          </div>
        </template>

        <div class="history-timeline">
          <el-empty v-if="filteredAlerts.length === 0" description="暂无告警记录">
            <template #description>系统运行正常</template>
          </el-empty>

          <el-timeline v-else>
            <el-timeline-item
              v-for="alert in filteredAlerts"
              :key="alert.id"
              :timestamp="formatTime(alert.timestamp)"
              placement="top"
              :type="getTimelineType(alert.level)"
              :hollow="alert.level === 'info'"
            >
              <el-card class="timeline-card" shadow="hover">
                <div class="alert-header">
                  <GlowingTag :type="getLevelType(alert.level)" :text="getLevelText(alert.level)" size="small" effect="dark" />
                </div>
                <div class="alert-body">
                  <div class="alert-message">{{ alert.message }}</div>
                  <div v-if="alert.details" class="alert-details">
                    {{ alert.details }}
                  </div>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>
      </HolographicCard>
    </div>

    <!-- 通知配置区域 -->
    <HolographicCard class="notification-panel" :border="true" :hover="true">
      <template #header>
        <div class="card-header">
          <h3>
            <el-icon><Message /></el-icon>
            通知渠道配置
          </h3>
        </div>
      </template>

      <div class="notification-cards">
        <div
          v-for="channel in notificationChannels"
          :key="channel.id"
          class="notification-card"
          :class="{ 'active': channel.enabled }"
        >
          <div class="channel-icon" :style="{ background: channel.gradient }">
            {{ channel.icon }}
          </div>
          <div class="channel-info">
            <div class="channel-name">{{ channel.name }}</div>
            <GlowingTag :type="channel.enabled ? 'success' : 'info'" :text="channel.enabled ? '已启用' : '未启用'" size="small" effect="dark" />
          </div>
          <NeonButton size="small" @click="testNotification(channel.id)">
            测试
          </NeonButton>
        </div>
      </div>
    </HolographicCard>

    <!-- 编辑规则对话框 -->
    <CyberDialog
      v-model="editDialogVisible"
      :title="`编辑规则: ${currentRule?.name || ''}`"
      width="600px"
      :scanline="true"
      :close-on-click-modal="false"
    >
      <el-form v-if="currentRule" label-width="120px">
        <el-form-item label="规则名称">
          <el-input v-model="currentRule.name" disabled />
        </el-form-item>

        <el-form-item label="告警级别">
          <GlowingTag :type="getLevelType(currentRule.level)" :text="getLevelText(currentRule.level)" />
        </el-form-item>

        <el-form-item label="触发条件">
          <el-input v-model="currentRule.condition" type="textarea" :rows="2" disabled />
        </el-form-item>

        <el-form-item label="通知渠道">
          <el-checkbox-group v-model="editForm.channels">
            <el-checkbox label="dingtalk">钉钉</el-checkbox>
            <el-checkbox label="email">邮件</el-checkbox>
            <el-checkbox label="wechat">企业微信</el-checkbox>
            <el-checkbox label="webhook">Webhook</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="钉钉Webhook" v-if="editForm.channels.includes('dingtalk')">
          <el-input
            v-model="editForm.dingtalkWebhook"
            placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxxxx"
            clearable
          />
          <div style="color: #909399; font-size: 12px; margin-top: 5px;">
            💡 在钉钉群中添加自定义机器人，配置关键词"告警"，然后复制Webhook地址
          </div>
        </el-form-item>

        <el-form-item label="邮箱地址" v-if="editForm.channels.includes('email')">
          <el-input
            v-model="editForm.email"
            placeholder="example@company.com"
            clearable
          />
        </el-form-item>

        <el-form-item label="企业微信" v-if="editForm.channels.includes('wechat')">
          <el-input
            v-model="editForm.wechatWebhook"
            placeholder="企业微信机器人Webhook地址"
            clearable
          />
        </el-form-item>

        <el-form-item label="Webhook URL" v-if="editForm.channels.includes('webhook')">
          <el-input
            v-model="editForm.webhookUrl"
            placeholder="https://your-webhook-url.com/alerts"
            clearable
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <NeonButton @click="editDialogVisible = false">取消</NeonButton>
        <NeonButton type="primary" @click="saveRule" :loading="saving">
          保存
        </NeonButton>
      </template>
    </CyberDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  Bell,
  Refresh,
  TrendCharts,
  PieChart,
  DataAnalysis,
  Setting,
  Plus,
  Document,
  Message
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import api from '../api'
import LineChart from '../components/charts/LineChart.vue'
import PieChartComp from '../components/charts/PieChart.vue'
import { HolographicCard, NeonButton, GlowingTag, CyberDialog } from '../components/tech'

console.log('✅ AlertsLuxury Element Plus 组件已加载')

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

// 刷新状态（防止重复点击）
const refreshing = ref(false)

// 规则切换loading状态
const togglingRules = ref(new Set())

// 编辑对话框相关
const editDialogVisible = ref(false)
const currentRule = ref(null)
const saving = ref(false)
const editForm = ref({
  channels: [],
  dingtalkWebhook: '',
  email: '',
  wechatWebhook: '',
  webhookUrl: ''
})

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
    gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)'
  },
  {
    id: 'webhook',
    name: 'Webhook',
    icon: '🔗',
    enabled: true,
    gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)'
  }
])

// 告警趋势数据（静态数据，不需要 computed）
const alertTrendData = {
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
}

// 告警类型分布数据（静态数据，不需要 computed）
const alertTypeData = [
  { name: '爬取失败', value: 35 },
  { name: '数据缺失', value: 28 },
  { name: '响应超时', value: 22 },
  { name: '系统异常', value: 15 }
]

// 告警状态分布数据（静态数据，不需要 computed）
const alertStatusData = [
  { name: '已处理', value: 75 },
  { name: '待处理', value: 25 }
]

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
    gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)',
    trend: '处理及时',
    trendIcon: '🎯',
    trendClass: 'trend-success'
  },
  {
    id: 'rate',
    label: '处理率',
    value: alertStats.value.rate,
    icon: '📈',
    gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    trend: '保持良好',
    trendIcon: '💯',
    trendClass: 'trend-info'
  }
])

// 筛选后的告警列表
const filteredAlerts = computed(() => {
  if (currentFilter.value === 'all') {
    return alertHistory.value
  }
  return alertHistory.value.filter(alert => alert.level === currentFilter.value)
})

// 获取级别文本
function getLevelText(level) {
  const levelMap = {
    critical: '严重',
    error: '错误',
    warning: '警告',
    info: '信息'
  }
  return levelMap[level] || level
}

// 获取级别类型（Element Plus）
function getLevelType(level) {
  const typeMap = {
    critical: 'danger',
    error: 'danger',
    warning: 'warning',
    info: 'info'
  }
  return typeMap[level] || 'info'
}

// 获取时间轴类型
function getTimelineType(level) {
  const typeMap = {
    critical: 'danger',
    error: 'danger',
    warning: 'warning',
    info: 'primary'
  }
  return typeMap[level] || 'primary'
}

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 刷新所有数据（带防抖保护）
async function refreshAll() {
  // 防止重复点击
  if (refreshing.value) {
    console.log('⚠️ 刷新操作进行中，请勿重复点击')
    return
  }

  try {
    refreshing.value = true
    await Promise.all([
      loadAlertStats(),
      loadAlertRules(),
      loadAlertHistory()
    ])
    ElMessage.success('数据刷新成功')
  } catch (error) {
    console.error('刷新数据失败:', error)
    ElMessage.error('刷新数据失败')
  } finally {
    refreshing.value = false
  }
}

// 加载统计数据
async function loadAlertStats() {
  try {
    const response = await api.get('/api/alerts/stats')
    if (response.success) {
      const stats = response.data
      // 计算处理率
      const resolveRate = stats.total > 0
        ? ((stats.resolved / stats.total) * 100).toFixed(1) + '%'
        : '0%'

      alertStats.value = {
        total: stats.total || 0,
        pending: stats.pending || 0,
        resolved: stats.resolved || 0,
        rate: resolveRate
      }
      console.log('✅ 告警统计数据已加载:', alertStats.value)
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
    ElMessage.error('加载统计数据失败')
  }
}

// 加载告警规则
async function loadAlertRules() {
  try {
    const response = await api.get('/api/alerts/rules')
    if (response.success) {
      const rules = response.data
      // 转换数据格式以适配前端
      alertRules.value = rules.map(rule => {
        // 解析condition_config生成condition描述
        let condition = ''
        const config = rule.condition_config || {}

        switch(rule.rule_type) {
          case 'crawl_fail':
            condition = `连续失败 >= ${config.threshold || 3}次`
            break
          case 'timeout':
            condition = `响应时间 > ${config.threshold || 10}s`
            break
          case 'data_missing':
            condition = `期号连续缺失 >= ${config.threshold || 2}期`
            break
          case 'system_error':
            condition = `CPU使用率 > ${config.cpuThreshold || 90}%`
            break
          case 'http_error':
            condition = `连续${config.statusCodes?.join('/')}错误 >= ${config.threshold || 5}次`
            break
          case 'data_completeness':
            condition = `单日数据完整率 < ${config.threshold || 90}%`
            break
          case 'websocket_error':
            condition = `WebSocket断开超过${(config.threshold || 300) / 60}分钟`
            break
          case 'lottery_stale':
            condition = `高频彩超过${(config.threshold || 600) / 60}分钟无新期号`
            break
          default:
            condition = rule.description || '未知条件'
        }

        // 解析notification_channels生成中文显示
        const channelMap = {
          'email': '邮件',
          'dingtalk': '钉钉',
          'wechat': '企业微信',
          'webhook': 'Webhook'
        }
        const notifications = (rule.notification_channels || []).map(ch => channelMap[ch] || ch)

        return {
          id: rule.id,
          name: rule.name,
          condition,
          level: rule.level,
          enabled: Boolean(rule.enabled),
          notifications
        }
      })
      console.log('✅ 告警规则已加载:', alertRules.value.length)
    }
  } catch (error) {
    console.error('加载告警规则失败:', error)
    ElMessage.error('加载告警规则失败')
  }
}

// 加载告警历史
async function loadAlertHistory() {
  try {
    const response = await api.get('/api/alerts/history', {
      params: { limit: 50 }  // 最多获取50条历史记录
    })
    if (response.success) {
      const history = response.data
      // 转换数据格式以适配前端
      alertHistory.value = history.map(alert => ({
        id: alert.id,
        level: alert.level,
        message: alert.message,
        details: alert.lot_name ? `彩种: ${alert.lot_name} | ${alert.details || ''}` : (alert.details || ''),
        timestamp: new Date(alert.created_at).getTime()
      }))
      console.log('✅ 告警历史已加载:', alertHistory.value.length)
    }
  } catch (error) {
    console.error('加载告警历史失败:', error)
    ElMessage.error('加载告警历史失败')
  }
}

// 切换规则开关（带loading保护）
async function toggleRule(ruleId) {
  // 防止同一个规则重复切换
  if (togglingRules.value.has(ruleId)) {
    console.log(`⚠️ 规则 ${ruleId} 正在切换中，请勿重复操作`)
    return
  }

  const rule = alertRules.value.find(r => r.id === ruleId)
  if (!rule) {
    ElMessage.error('规则不存在')
    return
  }

  const previousState = rule.enabled
  const newState = !previousState

  try {
    // 添加loading状态
    togglingRules.value.add(ruleId)

    // 立即更新UI（乐观更新）
    rule.enabled = newState

    // 调用后端API更新规则
    const response = await api.put(`/api/alerts/rules/${ruleId}`, {
      enabled: newState
    })

    if (response.data.success) {
      const status = newState ? '启用' : '禁用'
      ElMessage.success(`规则「${rule.name}」已${status}`)
      console.log(`✅ 规则 ${ruleId} 状态已更新: ${newState}`)
    } else {
      throw new Error(response.data.error || '更新失败')
    }
  } catch (error) {
    // 恢复原状态
    rule.enabled = previousState
    ElMessage.error(`更新规则「${rule.name}」失败`)
    console.error(`❌ 更新规则 ${ruleId} 失败:`, error)
  } finally {
    // 移除loading状态
    togglingRules.value.delete(ruleId)
  }
}

// 显示添加规则对话框
function showAddRule() {
  ElMessage.info('添加规则功能开发中...')
}

// 显示编辑规则对话框
async function showEditRule(rule) {
  try {
    // 从后端获取完整的规则数据（包括notification_config）
    const response = await api.get(`/api/alerts/rules/${rule.id}`)

    if (!response.success) {
      ElMessage.error('获取规则详情失败')
      return
    }

    const fullRule = response.data
    currentRule.value = rule

    // 填充编辑表单
    editForm.value = {
      channels: fullRule.notification_channels || [],
      dingtalkWebhook: fullRule.notification_config?.dingtalk || '',
      email: fullRule.notification_config?.email || '',
      wechatWebhook: fullRule.notification_config?.wechat || '',
      webhookUrl: fullRule.notification_config?.webhook || ''
    }

    editDialogVisible.value = true
  } catch (error) {
    console.error('获取规则详情失败:', error)
    ElMessage.error('获取规则详情失败')
  }
}

// 保存规则配置
async function saveRule() {
  if (!currentRule.value) return

  // 验证配置
  if (editForm.value.channels.includes('dingtalk') && !editForm.value.dingtalkWebhook) {
    ElMessage.warning('请填写钉钉Webhook地址')
    return
  }

  try {
    saving.value = true

    // 构建notification_config对象
    const notificationConfig = {}
    if (editForm.value.dingtalkWebhook) {
      notificationConfig.dingtalk = editForm.value.dingtalkWebhook
    }
    if (editForm.value.email) {
      notificationConfig.email = editForm.value.email
    }
    if (editForm.value.wechatWebhook) {
      notificationConfig.wechat = editForm.value.wechatWebhook
    }
    if (editForm.value.webhookUrl) {
      notificationConfig.webhook = editForm.value.webhookUrl
    }

    // 调用后端API更新规则
    const response = await api.put(`/api/alerts/rules/${currentRule.value.id}`, {
      notification_channels: editForm.value.channels,
      notification_config: notificationConfig
    })

    if (response.success) {
      ElMessage.success('规则配置已更新')
      editDialogVisible.value = false

      // 刷新规则列表
      await loadAlertRules()
    } else {
      throw new Error(response.error || '更新失败')
    }
  } catch (error) {
    console.error('保存规则失败:', error)
    ElMessage.error('保存规则失败: ' + (error.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

// 测试通知
function testNotification(channelId) {
  const channel = notificationChannels.value.find(c => c.id === channelId)
  if (channel) {
    if (channel.enabled) {
      ElMessage.success(`正在发送测试通知到${channel.name}...`)
    } else {
      ElMessage.warning(`${channel.name}未启用，请先启用`)
    }
  }
}

// 生命周期
onMounted(() => {
  loadAlertStats()
  loadAlertRules()
  loadAlertHistory()
})
</script>

<style scoped lang="scss">
.alerts-luxury-element-plus {
  padding: 20px;
  min-height: 100vh;
  background: var(--bg-primary);
  transition: background 0.3s ease;
}

// Glass Card 基础样式
.glass-card {
  background: var(--glass-bg) !important;
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border) !important;
  border-radius: 16px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  :deep(.el-card__header) {
    background: var(--glass-bg);
    border-bottom: 1px solid var(--border-color);
  }

  :deep(.el-card__body) {
    background: transparent;
  }

  &:hover {
    background: var(--glass-bg-hover);
    transform: translateY(-2px);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
  }
}

// 页面标题区
.page-header {
  padding: 30px;
  margin-bottom: 20px;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-section {
    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px 0;

      .title-icon {
        filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.6));
      }

      .title-gradient {
        color: var(--tech-cyan);
        text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      }
    }

    .page-subtitle {
      color: var(--tech-text-secondary);
      font-size: 14px;
      margin: 0;
    }
  }
}

// 统计卡片
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  position: relative;
  overflow: hidden;

  .card-glow {
    position: absolute;
    top: -50%;
    right: -50%;
    width: 200%;
    height: 200%;
    opacity: 0.1;
    border-radius: 50%;
    filter: blur(40px);
    pointer-events: none;
  }

  .stat-content {
    position: relative;
    display: flex;
    align-items: center;
    gap: 20px;

    .stat-icon-wrapper {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }

    .stat-details {
      flex: 1;

      .stat-label {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      .stat-trend {
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;

        &.trend-neutral { color: var(--text-secondary); }
        &.trend-success { color: #67C23A; }
        &.trend-warning { color: #E6A23C; }
        &.trend-info { color: #409EFF; }
      }
    }
  }
}

// 图表区域
.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.chart-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
  }
}

// 主内容区
.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

// 规则列表
.rules-panel {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;

      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }

      .badge-count {
        :deep(.el-badge__content) {
          background: rgba(255, 255, 255, 0.2);
        }
      }
    }
  }

  .rules-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 600px;
    overflow-y: auto;
    padding-right: 8px;

    // 美化滚动条
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(0, 255, 255, 0.05);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 255, 255, 0.3);
      border-radius: 3px;

      &:hover {
        background: rgba(0, 255, 255, 0.5);
      }
    }
  }

  .rule-card {
    padding: 16px;
    background: var(--glass-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    transition: all 0.3s;

    &:hover {
      background: var(--glass-bg);
    }

    &.rule-disabled {
      opacity: 0.5;
    }

    .rule-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .rule-info {
        flex: 1;

        .rule-name {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .rule-condition {
          font-size: 13px;
          color: var(--text-secondary);
        }
      }

      .rule-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    }

    .rule-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary);

      .notification-tag {
        margin-right: 4px;
      }
    }
  }
}

// 告警历史
.history-panel {
  .history-timeline {
    max-height: 600px;
    overflow-y: auto;
    padding-right: 8px;

    // 美化滚动条
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(0, 255, 255, 0.05);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 255, 255, 0.3);
      border-radius: 3px;

      &:hover {
        background: rgba(0, 255, 255, 0.5);
      }
    }

    :deep(.el-timeline) {
      padding-left: 0;
    }

    .timeline-card {
      background: var(--glass-bg);
      border: 1px solid var(--border-color);

      .alert-header {
        margin-bottom: 8px;
      }

      .alert-body {
        .alert-message {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .alert-details {
          font-size: 13px;
          color: var(--text-secondary);
        }
      }
    }
  }
}

// 通知渠道
.notification-panel {
  .notification-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .notification-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: var(--glass-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    transition: all 0.3s;

    &:hover {
      background: var(--glass-bg);
      transform: translateY(-2px);
    }

    &.active {
      border-color: var(--glass-border-strong);
    }

    .channel-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .channel-info {
      flex: 1;

      .channel-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 4px;
      }
    }
  }
}

// 响应式
@media (max-width: 768px) {
  .alerts-luxury-element-plus {
    padding: 10px;
  }

  .page-header .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .stats-grid,
  .charts-section,
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
