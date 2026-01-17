<template>
  <Teleport to="body">
    <div class="toast-container" role="region" aria-label="通知消息" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
          role="alert"
          :aria-label="`${getTypeLabel(toast.type)}通知`"
          @click="removeToast(toast.id)"
        >
          <div class="toast-icon" aria-hidden="true">{{ getIcon(toast.type) }}</div>
          <div class="toast-content">
            <div class="toast-title" v-if="toast.title">{{ toast.title }}</div>
            <div class="toast-message">{{ toast.message }}</div>
          </div>
          <button
            class="toast-close"
            @click.stop="removeToast(toast.id)"
            aria-label="关闭"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

// 添加Toast
const addToast = (options) => {
  const id = nextId++
  const toast = {
    id,
    type: options.type || 'info',
    title: options.title,
    message: options.message || '',
    duration: options.duration ?? 3000
  }

  toasts.value.push(toast)

  // 自动移除
  if (toast.duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, toast.duration)
  }

  return id
}

// 移除Toast
const removeToast = (id) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

// 获取图标
const getIcon = (type) => {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  }
  return icons[type] || icons.info
}

// 获取类型标签
const getTypeLabel = (type) => {
  const labels = {
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '信息'
  }
  return labels[type] || labels.info
}

// 暴露方法给外部调用
defineExpose({
  addToast,
  removeToast,
  success: (message, title) => addToast({ type: 'success', message, title }),
  error: (message, title) => addToast({ type: 'error', message, title }),
  warning: (message, title) => addToast({ type: 'warning', message, title }),
  info: (message, title) => addToast({ type: 'info', message, title })
})
</script>

<style scoped>
/* Toast容器 */
.toast-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

/* Toast卡片 */
.toast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 320px;
  max-width: 400px;
  padding: 16px 20px;
  background: var(--text-primary);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.1),
    0 0 0 1px var(--glass-border);
  cursor: pointer;
  pointer-events: auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.15),
    0 0 0 1px var(--glass-border-strong);
}

/* Toast图标 */
.toast-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 14px;
  font-weight: bold;
}

/* Toast内容 */
.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: rgba(0, 0, 0, 0.9);
}

.toast-message {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5;
  word-wrap: break-word;
}

/* Toast关闭按钮 */
.toast-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 4px;
  color: rgba(0, 0, 0, 0.4);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  padding: 0;
}

.toast-close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.7);
}

/* Toast类型样式 */
.toast-success {
  border-left: 4px solid #10b981;
}

.toast-success .toast-icon {
  background: #10b981;
  color: white;
}

.toast-error {
  border-left: 4px solid #ef4444;
}

.toast-error .toast-icon {
  background: #ef4444;
  color: white;
}

.toast-warning {
  border-left: 4px solid var(--warning-color);
}

.toast-warning .toast-icon {
  background: var(--warning-color);
  color: white;
}

.toast-info {
  border-left: 4px solid #3b82f6;
}

.toast-info .toast-icon {
  background: #3b82f6;
  color: white;
}

/* 动画 */
.toast-enter-active {
  animation: toast-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-leave-active {
  animation: toast-out 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .toast-container {
    left: 20px;
    right: 20px;
    top: 20px;
  }

  .toast {
    min-width: 0;
    max-width: none;
  }
}
</style>
