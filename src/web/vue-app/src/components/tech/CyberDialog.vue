<template>
  <Teleport to="body">
    <Transition name="cyber-dialog-fade">
      <div
        v-if="modelValue"
        class="cyber-dialog-overlay"
        @click="handleOverlayClick"
      >
        <Transition name="cyber-dialog-slide">
          <div
            v-if="modelValue"
            :class="['cyber-dialog', `cyber-dialog--${size}`]"
            :style="dialogStyle"
            @click.stop
          >
            <!-- 扫描线效果 -->
            <div v-if="scanline" class="scanline"></div>

            <!-- 渐变边框 -->
            <div class="cyber-dialog__border"></div>

            <!-- 对话框内容 -->
            <div class="cyber-dialog__content">
              <!-- 头部 -->
              <div class="cyber-dialog__header">
                <h3 class="cyber-dialog__title">
                  {{ title }}
                </h3>
                <button
                  v-if="showClose"
                  class="cyber-dialog__close"
                  @click="handleClose"
                >
                  ✕
                </button>
              </div>

              <!-- 主体 -->
              <div class="cyber-dialog__body">
                <slot />
              </div>

              <!-- 底部 -->
              <div v-if="$slots.footer" class="cyber-dialog__footer">
                <slot name="footer" />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // v-model 绑定
  modelValue: {
    type: Boolean,
    default: false
  },

  // 标题
  title: {
    type: String,
    required: true
  },

  // 尺寸
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large', 'full'].includes(value)
  },

  // 自定义宽度
  width: {
    type: String,
    default: ''
  },

  // 是否显示关闭按钮
  showClose: {
    type: Boolean,
    default: true
  },

  // 点击遮罩层是否关闭
  closeOnClickOverlay: {
    type: Boolean,
    default: true
  },

  // 是否显示扫描线
  scanline: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'close', 'open'])

const dialogStyle = computed(() => {
  if (props.width) {
    return {
      width: props.width,
      maxWidth: props.width
    }
  }
  return {}
})

const handleClose = () => {
  emit('update:modelValue', false)
  emit('close')
}

const handleOverlayClick = () => {
  if (props.closeOnClickOverlay) {
    handleClose()
  }
}

// 监听 ESC 键关闭
const handleEscape = (event) => {
  if (event.key === 'Escape' && props.modelValue) {
    handleClose()
  }
}

// 添加键盘监听
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleEscape)
}

// 组件卸载时移除监听
import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleEscape)
  }
})
</script>

<style scoped>
/* ========================================
   遮罩层
   ======================================== */

.cyber-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 14, 39, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--spacing-lg);
}

/* ========================================
   对话框主体
   ======================================== */

.cyber-dialog {
  position: relative;
  background: var(--tech-bg-secondary);
  border-radius: var(--radius-lg);
  max-height: 90vh;
  overflow: hidden;
  box-shadow:
    var(--shadow-xl),
    0 0 30px rgba(0, 255, 255, 0.3);
}

/* ========================================
   尺寸变体
   ======================================== */

.cyber-dialog--small {
  width: 400px;
  max-width: 90vw;
}

.cyber-dialog--medium {
  width: 600px;
  max-width: 90vw;
}

.cyber-dialog--large {
  width: 900px;
  max-width: 90vw;
}

.cyber-dialog--full {
  width: 95vw;
  height: 95vh;
  max-width: none;
  max-height: 95vh;
}

/* ========================================
   渐变边框
   ======================================== */

.cyber-dialog__border {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-lg);
  padding: 2px;
  background: var(--gradient-cyber-primary);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.8;
  pointer-events: none;
}

/* ========================================
   扫描线效果
   ======================================== */

.scanline {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--tech-cyan) 50%,
    transparent 100%
  );
  box-shadow: 0 0 10px var(--tech-cyan);
  animation: scanline-move 2s linear infinite;
  pointer-events: none;
  z-index: 10;
}

@keyframes scanline-move {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(90vh);
    opacity: 0;
  }
}

/* ========================================
   对话框内容
   ======================================== */

.cyber-dialog__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

/* ========================================
   头部
   ======================================== */

.cyber-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 2px solid;
  border-image: var(--gradient-cyber-accent) 1;
}

.cyber-dialog__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  background: var(--gradient-cyber-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.cyber-dialog__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 2px solid var(--tech-cyan);
  border-radius: var(--radius-sm);
  color: var(--tech-cyan);
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: all var(--transition-base);
}

.cyber-dialog__close:hover {
  background: rgba(0, 255, 255, 0.2);
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
  transform: scale(1.1);
}

.cyber-dialog__close:active {
  transform: scale(0.95);
}

/* ========================================
   主体
   ======================================== */

.cyber-dialog__body {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;
  color: var(--tech-text-secondary);
}

/* 滚动条样式 */
.cyber-dialog__body::-webkit-scrollbar {
  width: 8px;
}

.cyber-dialog__body::-webkit-scrollbar-track {
  background: var(--tech-bg-tertiary);
  border-radius: var(--radius-sm);
}

.cyber-dialog__body::-webkit-scrollbar-thumb {
  background: var(--gradient-cyber-primary);
  border-radius: var(--radius-sm);
  box-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
}

.cyber-dialog__body::-webkit-scrollbar-thumb:hover {
  background: var(--gradient-cyber-accent);
}

/* ========================================
   底部
   ======================================== */

.cyber-dialog__footer {
  padding: var(--spacing-lg);
  border-top: 2px solid;
  border-image: var(--gradient-cyber-accent) 1;
  display: flex;
  gap: var(--spacing-md);
  justify-content: flex-end;
}

/* ========================================
   过渡动画
   ======================================== */

/* 遮罩层淡入淡出 */
.cyber-dialog-fade-enter-active,
.cyber-dialog-fade-leave-active {
  transition: opacity 0.3s ease;
}

.cyber-dialog-fade-enter-from,
.cyber-dialog-fade-leave-to {
  opacity: 0;
}

/* 对话框滑入滑出 */
.cyber-dialog-slide-enter-active {
  animation: dialog-slide-in 0.3s ease-out;
}

.cyber-dialog-slide-leave-active {
  animation: dialog-slide-out 0.3s ease-in;
}

@keyframes dialog-slide-in {
  from {
    opacity: 0;
    transform: translateY(-30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dialog-slide-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-30px) scale(0.95);
  }
}

/* ========================================
   响应式调整
   ======================================== */

@media (max-width: 768px) {
  .cyber-dialog-overlay {
    padding: var(--spacing-sm);
  }

  .cyber-dialog--small,
  .cyber-dialog--medium,
  .cyber-dialog--large {
    width: 100%;
    max-width: none;
  }

  .cyber-dialog__header,
  .cyber-dialog__body,
  .cyber-dialog__footer {
    padding: var(--spacing-md);
  }

  .cyber-dialog__title {
    font-size: var(--font-size-lg);
  }

  .cyber-dialog__footer {
    flex-direction: column;
  }
}

/* ========================================
   无障碍：禁用动画
   ======================================== */

@media (prefers-reduced-motion: reduce) {
  .scanline {
    animation: none !important;
    display: none;
  }

  .cyber-dialog-fade-enter-active,
  .cyber-dialog-fade-leave-active,
  .cyber-dialog-slide-enter-active,
  .cyber-dialog-slide-leave-active {
    animation: none !important;
    transition: none !important;
  }

  .cyber-dialog__close {
    transition: none !important;
  }

  .cyber-dialog__close:hover {
    transform: none;
  }
}

/* ========================================
   焦点可见性（无障碍）
   ======================================== */

.cyber-dialog__close:focus-visible {
  outline: 2px solid var(--tech-cyan);
  outline-offset: 2px;
}
</style>
