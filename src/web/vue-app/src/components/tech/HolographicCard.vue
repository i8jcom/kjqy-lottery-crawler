<template>
  <div
    :class="[
      'holographic-card',
      { 'holographic-card--hover': hover },
      { 'holographic-card--shine': shine },
      { 'holographic-card--shadow': shadow }
    ]"
    :style="cardStyle"
  >
    <div v-if="border" class="holographic-card__border"></div>
    <div class="holographic-card__content">
      <!-- 标题槽 -->
      <div v-if="$slots.header || title" class="holographic-card__header">
        <slot name="header">
          <h3 class="holographic-card__title">{{ title }}</h3>
        </slot>
      </div>

      <!-- 主内容槽 -->
      <div class="holographic-card__body">
        <slot />
      </div>

      <!-- 底部槽 -->
      <div v-if="$slots.footer" class="holographic-card__footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 标题
  title: {
    type: String,
    default: ''
  },

  // 是否显示渐变边框
  border: {
    type: Boolean,
    default: true
  },

  // Hover 效果
  hover: {
    type: Boolean,
    default: true
  },

  // 光泽效果
  shine: {
    type: Boolean,
    default: false
  },

  // 阴影效果
  shadow: {
    type: Boolean,
    default: true
  },

  // 自定义背景透明度 (0-1)
  opacity: {
    type: Number,
    default: 0.6,
    validator: (value) => value >= 0 && value <= 1
  },

  // 自定义内边距
  padding: {
    type: String,
    default: '20px'
  }
})

const cardStyle = computed(() => {
  return {
    '--card-opacity': props.opacity
  }
})
</script>

<style scoped>
.holographic-card {
  position: relative;
  background: rgba(26, 26, 46, var(--card-opacity, 0.6));
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all var(--transition-base);
}

/* ========================================
   渐变边框
   ======================================== */

.holographic-card__border {
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
  opacity: 0.6;
  pointer-events: none;
  transition: opacity var(--transition-base);
}

.holographic-card:hover .holographic-card__border {
  opacity: 1;
  filter: drop-shadow(0 0 10px rgba(0, 255, 255, 0.5));
}

/* ========================================
   内容容器
   ======================================== */

.holographic-card__content {
  position: relative;
  z-index: 1;
  padding: var(--spacing-lg);
}

.holographic-card__header {
  margin-bottom: var(--spacing-md);
}

.holographic-card__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--tech-text-primary);
  background: var(--gradient-cyber-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.holographic-card__body {
  color: var(--tech-text-secondary);
}

.holographic-card__footer {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--tech-border-subtle);
}

/* ========================================
   Hover 效果
   ======================================== */

.holographic-card--hover:hover {
  transform: translateY(-4px);
  background: rgba(26, 26, 46, calc(var(--card-opacity, 0.6) + 0.1));
}

/* ========================================
   光泽效果
   ======================================== */

.holographic-card--shine {
  position: relative;
  overflow: hidden;
}

.holographic-card--shine::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 30%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 70%
  );
  transform: translateX(-100%);
  transition: transform 0.6s ease;
  pointer-events: none;
}

.holographic-card--shine:hover::after {
  transform: translateX(100%);
}

/* ========================================
   阴影效果
   ======================================== */

.holographic-card--shadow {
  box-shadow: var(--shadow-lg);
}

.holographic-card--shadow:hover {
  box-shadow:
    var(--shadow-xl),
    0 0 20px rgba(0, 255, 255, 0.2);
}

/* ========================================
   全息覆盖层（可选）
   ======================================== */

.holographic-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--gradient-holographic);
  opacity: 0.15;
  pointer-events: none;
  transition: opacity var(--transition-base);
}

.holographic-card:hover::before {
  opacity: 0.25;
}

/* ========================================
   响应式调整
   ======================================== */

@media (max-width: 768px) {
  .holographic-card__content {
    padding: var(--spacing-md);
  }

  .holographic-card__title {
    font-size: var(--font-size-lg);
  }
}

/* ========================================
   无障碍：禁用动画
   ======================================== */

@media (prefers-reduced-motion: reduce) {
  .holographic-card,
  .holographic-card__border,
  .holographic-card::before,
  .holographic-card--shine::after {
    transition: none !important;
  }

  .holographic-card--hover:hover {
    transform: none;
  }

  .holographic-card--shine::after {
    display: none;
  }
}

/* ========================================
   暗色主题覆盖
   ======================================== */

[data-theme="dark"] .holographic-card {
  background: rgba(26, 26, 46, var(--card-opacity, 0.6));
}

/* ========================================
   亮色主题覆盖
   ======================================== */

[data-theme="light"] .holographic-card {
  background: rgba(255, 255, 255, var(--card-opacity, 0.8));
}

[data-theme="light"] .holographic-card__title {
  color: var(--tech-bg-primary);
}

[data-theme="light"] .holographic-card__body {
  color: var(--tech-text-secondary);
}
</style>
