<template>
  <div v-if="error" class="error-boundary" role="alert" aria-live="assertive">
    <div class="error-content">
      <div class="error-icon" aria-hidden="true">⚠️</div>
      <h3 class="error-title">页面出现错误</h3>
      <p class="error-message">{{ errorMessage }}</p>
      <div class="error-actions">
        <button
          class="btn btn-primary"
          @click="handleReset"
          aria-label="重试"
        >
          <span aria-hidden="true">🔄</span> 重试
        </button>
        <button
          class="btn btn-secondary"
          @click="handleGoHome"
          aria-label="返回首页"
        >
          <span aria-hidden="true">🏠</span> 返回首页
        </button>
      </div>
      <details v-if="errorDetails" class="error-details">
        <summary>技术详情</summary>
        <pre role="region" aria-label="错误堆栈">{{ errorDetails }}</pre>
      </details>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup>
import { ref, onErrorCaptured } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const error = ref(false)
const errorMessage = ref('')
const errorDetails = ref('')

// 捕获子组件错误
onErrorCaptured((err, instance, info) => {
  error.value = true
  errorMessage.value = err.message || '抱歉，页面遇到了一些问题'
  errorDetails.value = `错误: ${err.stack}\n\n组件: ${instance?.$options?.name || '未知'}\n\n位置: ${info}`

  console.error('❌ [ErrorBoundary] 捕获到错误:', err)
  console.error('组件:', instance)
  console.error('信息:', info)

  // 阻止错误继续传播
  return false
})

const handleReset = () => {
  error.value = false
  errorMessage.value = ''
  errorDetails.value = ''
  // 刷新当前页面
  window.location.reload()
}

const handleGoHome = () => {
  error.value = false
  errorMessage.value = ''
  errorDetails.value = ''
  router.push('/')
}
</script>

<style scoped>
.error-boundary {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.error-content {
  max-width: 600px;
  width: 100%;
  text-align: center;
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.error-icon {
  font-size: 64px;
  margin-bottom: 20px;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.error-title {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.error-message {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 32px;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 24px;
}

.error-details {
  margin-top: 24px;
  text-align: left;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
}

.error-details summary {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.error-details summary:hover {
  color: var(--text-primary);
}

.error-details pre {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .error-content {
    padding: 30px 20px;
  }

  .error-icon {
    font-size: 48px;
  }

  .error-title {
    font-size: 24px;
  }

  .error-actions {
    flex-direction: column;
  }

  .error-actions .btn {
    width: 100%;
  }
}
</style>
