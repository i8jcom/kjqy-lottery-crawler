<template>
  <button
    :class="[
      'neon-button',
      `neon-button--${type}`,
      `neon-button--${size}`,
      {
        'neon-button--loading': loading,
        'neon-button--disabled': disabled,
        'neon-button--icon-only': iconOnly
      }
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span class="neon-button__glow"></span>
    <span class="neon-button__content">
      <span v-if="loading" class="neon-button__loading">
        <span class="loading-spinner-sm"></span>
      </span>
      <span v-if="icon && !loading" class="neon-button__icon">
        <component v-if="typeof icon === 'object'" :is="icon" />
        <span v-else>{{ icon }}</span>
      </span>
      <span v-if="!iconOnly" class="neon-button__text">
        <slot />
      </span>
    </span>
  </button>
</template>

<script setup>
const props = defineProps({
  // 按钮类型
  type: {
    type: String,
    default: 'primary',
    validator: (value) => [
      'primary',
      'success',
      'danger',
      'warning',
      'info',
      'secondary',
      'default'
    ].includes(value)
  },

  // 尺寸
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },

  // 图标（emoji、文本 或 Vue组件）
  icon: {
    type: [String, Object],
    default: ''
  },

  // 仅图标模式
  iconOnly: {
    type: Boolean,
    default: false
  },

  // 加载状态
  loading: {
    type: Boolean,
    default: false
  },

  // 禁用状态
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const handleClick = (event) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped>
.neon-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  background: transparent;
  border: 2px solid currentColor;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  cursor: pointer;
  overflow: hidden;
  transition: all var(--transition-base);
  user-select: none;
  white-space: nowrap;
}

/* ========================================
   尺寸变体
   ======================================== */

.neon-button--small {
  padding: 6px 16px;
  font-size: var(--font-size-sm);
}

.neon-button--medium {
  padding: 10px 24px;
  font-size: var(--font-size-base);
}

.neon-button--large {
  padding: 14px 32px;
  font-size: var(--font-size-lg);
}

.neon-button--icon-only {
  padding: 10px;
}

.neon-button--icon-only.neon-button--small {
  padding: 6px;
}

.neon-button--icon-only.neon-button--large {
  padding: 14px;
}

/* ========================================
   类型变体
   ======================================== */

.neon-button--primary {
  color: var(--tech-cyan);
  border-color: var(--tech-cyan);
}

.neon-button--success {
  color: var(--tech-green);
  border-color: var(--tech-green);
}

.neon-button--danger {
  color: var(--tech-red);
  border-color: var(--tech-red);
}

.neon-button--warning {
  color: var(--tech-orange);
  border-color: var(--tech-orange);
}

.neon-button--info {
  color: var(--tech-blue);
  border-color: var(--tech-blue);
}

.neon-button--secondary {
  color: var(--tech-purple);
  border-color: var(--tech-purple);
}

.neon-button--default {
  color: var(--text-primary);
  border-color: var(--border-color);
}


/* ========================================
   发光背景层
   ======================================== */

.neon-button__glow {
  position: absolute;
  inset: 0;
  opacity: 0;
  background: currentColor;
  filter: blur(10px);
  transition: opacity var(--transition-base);
  pointer-events: none;
}

.neon-button:hover:not(.neon-button--disabled):not(.neon-button--loading) .neon-button__glow {
  opacity: 0.2;
  animation: button-pulse 1.5s ease-in-out infinite;
}

@keyframes button-pulse {
  0%, 100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.4;
  }
}

/* ========================================
   内容容器
   ======================================== */

.neon-button__content {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.neon-button__icon {
  display: inline-flex;
  align-items: center;
  font-size: 1.2em;
}

.neon-button__text {
  display: inline-flex;
  align-items: center;
}

/* ========================================
   加载状态
   ======================================== */

.neon-button__loading {
  display: inline-flex;
  align-items: center;
}

.loading-spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.neon-button--loading {
  cursor: not-allowed;
  opacity: 0.8;
}

/* ========================================
   禁用状态
   ======================================== */

.neon-button--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.neon-button--disabled .neon-button__glow {
  display: none;
}

/* ========================================
   Hover 和 Active 效果
   ======================================== */

.neon-button:hover:not(.neon-button--disabled):not(.neon-button--loading) {
  transform: translateY(-2px);
  box-shadow:
    0 0 20px currentColor,
    0 4px 8px rgba(0, 0, 0, 0.4);
}

.neon-button:active:not(.neon-button--disabled):not(.neon-button--loading) {
  transform: translateY(0);
  box-shadow:
    0 0 10px currentColor,
    0 2px 4px rgba(0, 0, 0, 0.4);
}

/* ========================================
   点击涟漪效果
   ======================================== */

.neon-button::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0) 70%
  );
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: width 0.6s ease, height 0.6s ease, opacity 0.6s ease;
  pointer-events: none;
}

.neon-button:active:not(.neon-button--disabled):not(.neon-button--loading)::after {
  width: 200%;
  height: 200%;
  opacity: 1;
  transition: width 0s, height 0s, opacity 0s;
}

/* ========================================
   焦点状态（无障碍）
   ======================================== */

.neon-button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
}

/* ========================================
   无障碍：禁用动画
   ======================================== */

@media (prefers-reduced-motion: reduce) {
  .neon-button,
  .neon-button__glow,
  .neon-button::after,
  .loading-spinner-sm {
    animation: none !important;
    transition: none !important;
  }

  .neon-button:hover:not(.neon-button--disabled):not(.neon-button--loading) {
    transform: none;
  }

  .neon-button:active:not(.neon-button--disabled):not(.neon-button--loading) {
    transform: none;
  }
}
</style>

<style>
/* 亮色模式下的 NeonButton 样式覆盖（不使用 scoped 以支持全局主题切换） */
[data-theme="light"] .neon-button--default {
  color: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
}

[data-theme="light"] .neon-button--default:hover:not(.neon-button--disabled):not(.neon-button--loading) {
  color: var(--primary-dark) !important;
  border-color: var(--primary-dark) !important;
}

[data-theme="light"] .neon-button--primary {
  color: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
}

[data-theme="light"] .neon-button--primary:hover:not(.neon-button--disabled):not(.neon-button--loading) {
  color: var(--primary-dark) !important;
  border-color: var(--primary-dark) !important;
}
</style>
