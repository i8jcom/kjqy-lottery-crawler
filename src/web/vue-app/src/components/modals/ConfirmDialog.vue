<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="isVisible" class="modal-overlay" @click.self="handleCancel">
        <div class="confirm-dialog" :class="typeClass">
          <div class="dialog-header">
            <span class="dialog-icon">{{ icon }}</span>
            <h3 class="dialog-title">{{ title }}</h3>
          </div>

          <div class="dialog-body">
            <p class="dialog-message">{{ message }}</p>

            <!-- 输入框（用于输入确认码） -->
            <div v-if="requireConfirmCode" class="confirm-input-wrapper">
              <label class="confirm-label">{{ confirmLabel }}</label>
              <input
                ref="confirmInput"
                v-model="inputValue"
                type="text"
                class="confirm-input"
                :placeholder="confirmPlaceholder"
                @keyup.enter="handleConfirm"
              />
              <p v-if="showError" class="error-hint">{{ errorMessage }}</p>
            </div>
          </div>

          <div class="dialog-footer">
            <button class="btn-cancel" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="btn-confirm" :class="typeClass" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'warning', // 'warning', 'danger', 'info', 'success'
    validator: (value) => ['warning', 'danger', 'info', 'success'].includes(value)
  },
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    required: true
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  requireConfirmCode: {
    type: Boolean,
    default: false
  },
  confirmCode: {
    type: String,
    default: ''
  },
  confirmLabel: {
    type: String,
    default: '请输入确认码：'
  },
  confirmPlaceholder: {
    type: String,
    default: '输入后点击确定'
  }
})

const emit = defineEmits(['confirm', 'cancel', 'update:visible'])

const isVisible = ref(false)
const inputValue = ref('')
const showError = ref(false)
const errorMessage = ref('')
const confirmInput = ref(null)

const typeClass = computed(() => {
  return `type-${props.type}`
})

const icon = computed(() => {
  const icons = {
    warning: '⚠️',
    danger: '🔒',
    info: 'ℹ️',
    success: '✅'
  }
  return icons[props.type] || '⚠️'
})

// 打开对话框
const show = () => {
  isVisible.value = true
  inputValue.value = ''
  showError.value = false

  // 如果需要输入确认码，自动聚焦
  if (props.requireConfirmCode) {
    nextTick(() => {
      confirmInput.value?.focus()
    })
  }
}

// 关闭对话框
const hide = () => {
  isVisible.value = false
  inputValue.value = ''
  showError.value = false
}

// 确认按钮
const handleConfirm = () => {
  if (props.requireConfirmCode) {
    // 验证确认码
    if (inputValue.value !== props.confirmCode) {
      showError.value = true
      errorMessage.value = `输入错误，请输入：${props.confirmCode}`
      return
    }
  }

  hide()
  emit('confirm')
}

// 取消按钮
const handleCancel = () => {
  hide()
  emit('cancel')
}

// 暴露方法给父组件
defineExpose({
  show,
  hide
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.confirm-dialog {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.9) 100%);
  border-radius: 16px;
  box-shadow:
    0 20px 60px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.5);
  max-width: 480px;
  width: 100%;
  overflow: hidden;
  animation: dialogSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes dialogSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.dialog-header {
  padding: 24px 24px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.dialog-icon {
  font-size: 28px;
  line-height: 1;
}

.dialog-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.dialog-body {
  padding: 24px;
}

.dialog-message {
  font-size: 15px;
  color: #4b5563;
  line-height: 1.6;
  margin: 0;
  white-space: pre-line;
}

.confirm-input-wrapper {
  margin-top: 20px;
}

.confirm-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
}

.confirm-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 15px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  letter-spacing: 2px;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.8);
}

.confirm-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: white;
}

.error-hint {
  margin-top: 8px;
  font-size: 13px;
  color: #ef4444;
  animation: shake 0.4s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

.dialog-footer {
  padding: 16px 24px 24px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  min-width: 80px;
}

.btn-cancel {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.btn-cancel:hover {
  background: rgba(107, 114, 128, 0.2);
}

.btn-confirm {
  color: white;
}

.btn-confirm.type-warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.btn-confirm.type-warning:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
}

.btn-confirm.type-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-confirm.type-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
}

.btn-confirm.type-info {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-confirm.type-success {
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

/* 过渡动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .confirm-dialog {
  animation: dialogSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-fade-leave-active .confirm-dialog {
  animation: dialogSlideOut 0.2s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes dialogSlideOut {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-10px) scale(0.98);
  }
}

/* 暗色主题适配 */
:root[data-theme="dark"] .confirm-dialog {
  background: linear-gradient(135deg, rgba(31, 41, 55, 0.98) 0%, rgba(17, 24, 39, 0.95) 100%);
}

:root[data-theme="dark"] .dialog-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

:root[data-theme="dark"] .dialog-title {
  color: #f9fafb;
}

:root[data-theme="dark"] .dialog-message {
  color: #d1d5db;
}

:root[data-theme="dark"] .confirm-label {
  color: #e5e7eb;
}

:root[data-theme="dark"] .confirm-input {
  background: rgba(0, 0, 0, 0.3);
  border-color: rgba(255, 255, 255, 0.1);
  color: white;
}

:root[data-theme="dark"] .confirm-input:focus {
  background: rgba(0, 0, 0, 0.4);
  border-color: #667eea;
}

:root[data-theme="dark"] .btn-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #d1d5db;
}

:root[data-theme="dark"] .btn-cancel:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
