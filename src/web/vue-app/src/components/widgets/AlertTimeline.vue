<template>
  <div class="alert-timeline">
    <div v-if="alerts.length === 0" class="empty-state">
      <span class="empty-icon">📭</span>
      <p>暂无告警</p>
    </div>

    <div v-else class="timeline-container">
      <div
        v-for="alert in alerts"
        :key="alert.id"
        class="timeline-item"
      >
        <div class="timeline-dot" :class="`dot-${alert.level}`"></div>
        <div class="timeline-content">
          <div class="alert-header">
            <span :class="['alert-level', `level-${alert.level}`]">
              {{ getLevelText(alert.level) }}
            </span>
            <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
          </div>
          <div class="alert-message">{{ alert.message }}</div>
          <div v-if="alert.details" class="alert-details">
            <span class="detail-label">详情：</span>
            <span class="detail-value">{{ alert.details }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  alerts: {
    type: Array,
    default: () => []
  }
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

  try {
    const date = new Date(timestamp)
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
</script>

<style scoped>
.alert-timeline {
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.timeline-container {
  position: relative;
  padding-left: 30px;
}

.timeline-container::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg,
    rgba(102, 126, 234, 0.5) 0%,
    rgba(102, 126, 234, 0.1) 100%
  );
}

.timeline-item {
  position: relative;
  padding-bottom: 24px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -26px;
  top: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  background: var(--glass-bg);
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.3);
}

.dot-critical {
  background: linear-gradient(135deg, var(--error-color), #ee5a6f);
  border-color: var(--error-color);
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.3), 0 0 10px rgba(255, 107, 107, 0.5);
}

.dot-error {
  background: linear-gradient(135deg, #fa709a, #fee140);
  border-color: #fa709a;
}

.dot-warning {
  background: linear-gradient(135deg, var(--warning-color), #fbbf24);
  border-color: var(--warning-color);
}

.dot-info {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  border-color: #3b82f6;
}

.timeline-content {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s;
}

.timeline-content:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border);
}

.alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.alert-level {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.level-critical {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: var(--error-color);
}

.level-error {
  background: rgba(250, 112, 154, 0.1);
  border: 1px solid rgba(250, 112, 154, 0.3);
  color: #fa709a;
}

.level-warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--warning-color);
}

.level-info {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.alert-time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.alert-message {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.alert-details {
  font-size: 13px;
  color: var(--text-secondary);
  padding-top: 8px;
  border-top: 1px solid var(--glass-bg);
}

.detail-label {
  color: var(--text-tertiary);
}

.detail-value {
  color: var(--text-secondary);
}
</style>
