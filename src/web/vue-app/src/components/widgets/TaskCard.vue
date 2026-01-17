<template>
  <div class="task-card">
    <!-- 任务头部 -->
    <div class="task-header">
      <div class="task-title">
        <span class="lottery-badge">{{ task.lotCode }}</span>
        <span class="lottery-name">{{ task.name }}</span>
      </div>
      <span :class="['task-status', `status-${task.status}`]">
        {{ getStatusText(task.status) }}
      </span>
    </div>

    <!-- 任务信息 -->
    <div class="task-info">
      <div class="info-item">
        <span class="info-label">下次开奖：</span>
        <span class="info-value">{{ getNextDrawTime() }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">调度模式：</span>
        <span class="info-value">{{ task.mode || task.baseInterval || '-' }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">上次轮询：</span>
        <span class="info-value">{{ formatTime(task.lastPollTime || task.lastCrawlTime) }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">下次轮询：</span>
        <span class="info-value countdown-value">{{ currentCountdown }}</span>
      </div>
    </div>

    <!-- 任务操作 -->
    <div class="task-actions">
      <button
        class="btn-action btn-trigger"
        @click="handleTrigger"
        :disabled="triggering"
      >
        <span>▶️</span>
        <span>{{ triggering ? '触发中...' : '手动触发' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

const props = defineProps({
  task: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['trigger'])

// 本地状态
const localCountdown = ref(props.task.countdown || 0)
const triggering = ref(false)
let countdownTimer = null

// 监听任务数据变化，无感更新
watch(() => props.task, (newTask, oldTask) => {
  // 检查是否真的有数据变化（排除引用变化）
  if (oldTask && JSON.stringify(newTask) !== JSON.stringify(oldTask)) {
    // 重新启动倒计时（无动画）
    startLocalCountdown()
  }
}, { deep: true })

// 当前倒计时（优先使用本地计算值）
const currentCountdown = computed(() => {
  return formatCountdown(localCountdown.value)
})

// 启动本地倒计时
const startLocalCountdown = () => {
  // 清除旧定时器
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  // 优先使用 nextPollDelaySeconds（下次轮询延迟秒数）
  // 如果没有，则使用 countdown
  let initialSeconds = 0

  if (props.task.nextPollDelaySeconds !== undefined && props.task.nextPollDelaySeconds >= 0) {
    initialSeconds = Math.floor(props.task.nextPollDelaySeconds)
  } else if (props.task.countdown !== undefined && props.task.countdown >= 0) {
    initialSeconds = props.task.countdown
  } else {
    // countdown 为 -1 或不存在，表示动态调度，不启动定时器
    localCountdown.value = -1
    return
  }

  localCountdown.value = initialSeconds

  // 每秒递减
  countdownTimer = setInterval(() => {
    if (localCountdown.value > 0) {
      localCountdown.value--
    } else {
      // 倒计时结束，停止定时器
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

// 获取下次开奖时间显示
const getNextDrawTime = () => {
  // 优先使用已格式化的字段（持续轮询模式）
  if (props.task.nextDrawTimeFormatted) {
    return props.task.nextDrawTimeFormatted
  }

  // 其次使用原始时间字段（动态调度模式）
  if (props.task.nextDrawTime) {
    return formatTime(props.task.nextDrawTime)
  }

  return '-'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'pending': '等待中',
    'running': '运行中',
    'crawling': '爬取中',
    'success': '成功',
    'ready': '就绪',
    'failed': '失败',
    'idle': '空闲',
    'waiting': '等待',
    'upcoming': '即将开始',
    'error': '错误',
    'scheduled': '已调度'
  }
  return statusMap[status] || status
}

// 格式化倒计时
const formatCountdown = (seconds) => {
  if (seconds === undefined || seconds === null) return '-'
  if (seconds < 0) return '持续轮询中'  // -1 表示动态调度模式
  if (seconds === 0) return '即将轮询'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (days > 0) return `${days}天${hours}小时`
  if (hours > 0) return `${hours}小时${minutes}分钟`
  if (minutes > 0) return `${minutes}:${String(secs).padStart(2, '0')}`
  return `${secs}秒后`
}

// 格式化时间
const formatTime = (dateStr) => {
  if (!dateStr) return '-'

  try {
    const date = new Date(dateStr)

    // 检查日期是否有效
    if (isNaN(date.getTime())) return '-'

    const now = new Date()
    const diff = date - now

    // 如果是未来时间，显示倒计时
    if (diff > 0) {
      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      if (minutes > 60) {
        return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟后`
      }
      if (minutes > 0) {
        return `${minutes}分钟${seconds}秒后`
      }
      return `${seconds}秒后`
    }

    // 如果是过去时间，显示具体时间
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    // 如果是今天，只显示时间
    if (date.toDateString() === now.toDateString()) {
      return `${hours}:${minutes}:${seconds}`
    }

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (error) {
    console.error('日期格式化错误:', error, dateStr)
    return '-'
  }
}

// 触发手动爬取
const handleTrigger = () => {
  triggering.value = true
  emit('trigger', props.task.lotCode)

  // 2秒后重置状态
  setTimeout(() => {
    triggering.value = false
  }, 2000)
}

// 组件挂载时启动倒计时
onMounted(() => {
  startLocalCountdown()
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})

// 监听任务数据变化，重新启动倒计时
defineExpose({
  refreshCountdown: () => {
    startLocalCountdown()
  }
})
</script>

<style scoped>
.task-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
  position: relative;
}

.task-card:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  transform: translateY(-2px);
}

/* 任务头部 */
.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.task-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lottery-badge {
  padding: 4px 10px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 8px;
  color: white;
  font-size: 12px;
  font-weight: 600;
}

.lottery-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.task-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--warning-color);
}

.status-running,
.status-crawling {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.status-success,
.status-ready {
  background: rgba(67, 233, 123, 0.1);
  border: 1px solid rgba(67, 233, 123, 0.3);
  color: var(--success-color);
}

.status-failed {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: var(--error-color);
}

.status-idle,
.status-waiting {
  background: rgba(156, 163, 175, 0.1);
  border: 1px solid rgba(156, 163, 175, 0.3);
  color: #9ca3af;
}

.status-upcoming {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--warning-color);
}

.status-error {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: var(--error-color);
}

.status-scheduled {
  background: rgba(67, 233, 123, 0.1);
  border: 1px solid rgba(67, 233, 123, 0.3);
  color: var(--success-color);
}

/* 任务信息 */
.task-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
}

.countdown-value {
  color: var(--success-color);
  font-weight: 600;
}

/* 任务操作 */
.task-actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-trigger {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-trigger:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 响应式 */
@media (max-width: 768px) {
  .task-info {
    grid-template-columns: 1fr;
  }
}
</style>
