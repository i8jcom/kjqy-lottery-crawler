<template>
  <div class="source-card">
    <!-- 卡片头部 -->
    <div class="card-header">
      <div class="source-info">
        <span class="source-name">{{ source.name }}</span>
        <span :class="['status-badge', `status-${source.status}`]">
          {{ getStatusText(source.status) }}
        </span>
      </div>
      <div class="source-type">{{ getTypeText(source.type) }}</div>
    </div>

    <!-- 数据源 URL -->
    <div class="source-url">
      <span class="url-label">URL:</span>
      <span class="url-value">{{ source.baseUrl || source.url || '-' }}</span>
    </div>

    <!-- 待配置提示 -->
    <div v-if="source.status === 'pending'" class="pending-notice">
      <span class="notice-icon">⚙️</span>
      <span class="notice-text">此数据源尚未完成配置</span>
    </div>

    <!-- 统计信息 -->
    <div class="source-stats">
      <div class="stat-item">
        <span class="stat-label">成功率</span>
        <span class="stat-value" :class="getSuccessRateClass(source.successRate)">
          {{ source.successRate || '0%' }}
        </span>
      </div>
      <div class="stat-item">
        <span class="stat-label">响应时间</span>
        <span class="stat-value">{{ source.responseTime || '-' }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">最后检查</span>
        <span class="stat-value">{{ formatTime(source.lastCheck) }}</span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="card-actions">
      <button
        class="btn-action btn-check"
        @click="handleCheck"
        :disabled="checking || source.status === 'pending'"
        :title="source.status === 'pending' ? '该数据源尚未配置完成' : ''"
      >
        <span :class="{ 'rotating': checking }">🔍</span>
        <span>{{ checking ? '检查中' : '健康检查' }}</span>
      </button>
      <button class="btn-action btn-edit" @click="handleEdit">
        <span>✏️</span>
        <span>编辑</span>
      </button>
      <button class="btn-action btn-delete" @click="handleDelete">
        <span>🗑️</span>
        <span>删除</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  source: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['check', 'edit', 'delete'])

const checking = ref(false)

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'healthy': '健康',
    'pending': '待配置',
    'online': '在线',
    'offline': '离线',
    'error': '错误',
    'warning': '警告',
    'checking': '检查中',
    'unknown': '未知'
  }
  return statusMap[status] || status
}

// 获取类型文本
const getTypeText = (type) => {
  const typeMap = {
    'api': 'API接口',
    'web': '网页爬取',
    'database': '数据库',
    'file': '文件源'
  }
  return typeMap[type] || type
}

// 获取成功率样式类
const getSuccessRateClass = (rate) => {
  if (!rate) return ''
  const value = parseFloat(rate)
  if (value >= 95) return 'rate-high'
  if (value >= 80) return 'rate-medium'
  return 'rate-low'
}

// 格式化时间
const formatTime = (dateStr) => {
  if (!dateStr) return '-'

  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date

    // 1分钟内
    if (diff < 60000) {
      return '刚刚'
    }

    // 1小时内
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}分钟前`
    }

    // 24小时内
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}小时前`
    }

    // 显示日期
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${month}-${day} ${hours}:${minutes}`
  } catch (error) {
    return '-'
  }
}

// 健康检查
const handleCheck = () => {
  checking.value = true
  emit('check', props.source.id)

  // 3秒后重置状态
  setTimeout(() => {
    checking.value = false
  }, 3000)
}

// 编辑
const handleEdit = () => {
  emit('edit', props.source)
}

// 删除
const handleDelete = () => {
  emit('delete', props.source.id)
}
</script>

<style scoped>
.source-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
}

.source-card:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  transform: translateY(-2px);
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.source-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  align-self: flex-start;
}

.status-healthy {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.status-pending {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--warning-color);
}

.status-online {
  background: rgba(67, 233, 123, 0.1);
  border: 1px solid rgba(67, 233, 123, 0.3);
  color: var(--success-color);
}

.status-offline {
  background: rgba(156, 163, 175, 0.1);
  border: 1px solid rgba(156, 163, 175, 0.3);
  color: #9ca3af;
}

.status-error {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: var(--error-color);
}

.status-warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--warning-color);
}

.status-checking {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.status-unknown {
  background: rgba(156, 163, 175, 0.1);
  border: 1px solid rgba(156, 163, 175, 0.3);
  color: #9ca3af;
}

.source-type {
  padding: 4px 10px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 8px;
  font-size: 12px;
  color: #667eea;
}

/* URL */
.source-url {
  margin-bottom: 16px;
  font-size: 13px;
  word-break: break-all;
}

.url-label {
  color: var(--text-tertiary);
  margin-right: 8px;
}

.url-value {
  color: var(--text-secondary);
  font-family: 'Courier New', monospace;
}

/* 未实现提示 */
.pending-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
}

.notice-icon {
  font-size: 16px;
}

.notice-text {
  font-size: 13px;
  color: var(--warning-color);
  font-weight: 500;
}

/* 统计信息 */
.source-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--glass-bg);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.stat-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  font-family: 'Courier New', monospace;
}

.rate-high {
  color: var(--success-color);
}

.rate-medium {
  color: var(--warning-color);
}

.rate-low {
  color: var(--error-color);
}

/* 操作按钮 */
.card-actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover:not(:disabled) {
  background: var(--border-color);
  transform: translateY(-2px);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-check:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.btn-edit:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: var(--warning-color);
}

.btn-delete:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.1);
  border-color: rgba(255, 107, 107, 0.3);
  color: var(--error-color);
}

.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式 */
@media (max-width: 768px) {
  .source-stats {
    grid-template-columns: 1fr;
  }

  .card-actions {
    flex-direction: column;
  }
}
</style>
