<template>
  <span
    :class="[
      'glowing-tag',
      `glowing-tag--${type}`,
      `glowing-tag--${size}`,
      { 'glowing-tag--dark': effect === 'dark' },
      { 'glowing-tag--pulse': pulse }
    ]"
  >
    <span v-if="icon" class="glowing-tag__icon">{{ icon }}</span>
    <span class="glowing-tag__text">{{ text }}</span>
    <span v-if="closable" class="glowing-tag__close" @click="handleClose">×</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 标签文本
  text: {
    type: String,
    required: true
  },

  // 类型：success | danger | warning | info | primary
  type: {
    type: String,
    default: 'primary',
    validator: (value) => [
      'success',
      'danger',
      'warning',
      'info',
      'primary',
      'secondary'
    ].includes(value)
  },

  // 尺寸
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },

  // 效果：light | dark
  effect: {
    type: String,
    default: 'dark'
  },

  // 图标（emoji 或文本）
  icon: {
    type: String,
    default: ''
  },

  // 是否可关闭
  closable: {
    type: Boolean,
    default: false
  },

  // 是否脉冲动画
  pulse: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const handleClose = (event) => {
  event.stopPropagation()
  emit('close')
}
</script>

<style scoped>
.glowing-tag {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  transition: all var(--transition-base);
  user-select: none;
}

/* ========================================
   尺寸变体
   ======================================== */

.glowing-tag--small {
  padding: 2px 8px;
  font-size: var(--font-size-xs);
}

.glowing-tag--medium {
  padding: 4px 12px;
  font-size: var(--font-size-sm);
}

.glowing-tag--large {
  padding: 6px 16px;
  font-size: var(--font-size-base);
}

/* ========================================
   类型变体 - 深色效果（默认）
   ======================================== */

.glowing-tag--primary.glowing-tag--dark {
  background: rgba(0, 255, 255, 0.2);
  color: var(--tech-cyan);
  border: 1px solid var(--tech-cyan);
  box-shadow:
    0 0 10px rgba(0, 255, 255, 0.3),
    inset 0 0 10px rgba(0, 255, 255, 0.1);
}

.glowing-tag--success.glowing-tag--dark {
  background: rgba(16, 185, 129, 0.2);
  color: var(--tech-green);
  border: 1px solid var(--tech-green);
  box-shadow:
    0 0 10px rgba(16, 185, 129, 0.3),
    inset 0 0 10px rgba(16, 185, 129, 0.1);
}

.glowing-tag--danger.glowing-tag--dark {
  background: rgba(239, 68, 68, 0.2);
  color: var(--tech-red);
  border: 1px solid var(--tech-red);
  box-shadow:
    0 0 10px rgba(239, 68, 68, 0.3),
    inset 0 0 10px rgba(239, 68, 68, 0.1);
}

.glowing-tag--warning.glowing-tag--dark {
  background: rgba(245, 158, 11, 0.2);
  color: var(--tech-orange);
  border: 1px solid var(--tech-orange);
  box-shadow:
    0 0 10px rgba(245, 158, 11, 0.3),
    inset 0 0 10px rgba(245, 158, 11, 0.1);
}

.glowing-tag--info.glowing-tag--dark {
  background: rgba(59, 130, 246, 0.2);
  color: var(--tech-blue);
  border: 1px solid var(--tech-blue);
  box-shadow:
    0 0 10px rgba(59, 130, 246, 0.3),
    inset 0 0 10px rgba(59, 130, 246, 0.1);
}

.glowing-tag--secondary.glowing-tag--dark {
  background: rgba(168, 85, 247, 0.2);
  color: var(--tech-purple);
  border: 1px solid var(--tech-purple);
  box-shadow:
    0 0 10px rgba(168, 85, 247, 0.3),
    inset 0 0 10px rgba(168, 85, 247, 0.1);
}

/* ========================================
   类型变体 - 浅色效果
   ======================================== */

.glowing-tag--primary:not(.glowing-tag--dark) {
  background: var(--tech-cyan);
  color: var(--tech-bg-primary);
  border: 1px solid var(--tech-cyan);
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.glowing-tag--success:not(.glowing-tag--dark) {
  background: var(--tech-green);
  color: var(--tech-bg-primary);
  border: 1px solid var(--tech-green);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
}

.glowing-tag--danger:not(.glowing-tag--dark) {
  background: var(--tech-red);
  color: var(--tech-bg-primary);
  border: 1px solid var(--tech-red);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
}

.glowing-tag--warning:not(.glowing-tag--dark) {
  background: var(--tech-orange);
  color: var(--tech-bg-primary);
  border: 1px solid var(--tech-orange);
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
}

.glowing-tag--info:not(.glowing-tag--dark) {
  background: var(--tech-blue);
  color: var(--tech-bg-primary);
  border: 1px solid var(--tech-blue);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
}

.glowing-tag--secondary:not(.glowing-tag--dark) {
  background: var(--tech-purple);
  color: var(--tech-bg-primary);
  border: 1px solid var(--tech-purple);
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
}

/* ========================================
   图标和文本
   ======================================== */

.glowing-tag__icon {
  display: inline-flex;
  align-items: center;
  font-size: 1.1em;
}

.glowing-tag__text {
  display: inline-flex;
  align-items: center;
}

.glowing-tag__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
  opacity: 0.7;
}

.glowing-tag__close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.2);
}

/* ========================================
   脉冲动画
   ======================================== */

.glowing-tag--pulse {
  animation: tag-pulse 2s ease-in-out infinite;
}

@keyframes tag-pulse {
  0%, 100% {
    box-shadow:
      0 0 10px currentColor,
      inset 0 0 10px rgba(255, 255, 255, 0.1);
  }
  50% {
    box-shadow:
      0 0 20px currentColor,
      0 0 30px rgba(0, 255, 255, 0.4),
      inset 0 0 15px rgba(255, 255, 255, 0.2);
  }
}

/* ========================================
   Hover 效果
   ======================================== */

.glowing-tag:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

/* ========================================
   无障碍：禁用动画
   ======================================== */

@media (prefers-reduced-motion: reduce) {
  .glowing-tag--pulse {
    animation: none;
  }

  .glowing-tag,
  .glowing-tag__close {
    transition: none;
  }
}
</style>
