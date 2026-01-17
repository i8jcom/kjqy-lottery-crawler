<template>
  <div :class="['skeleton', `skeleton-${type}`, { animated }]" :style="customStyle">
    <!-- 文本骨架 -->
    <div v-if="type === 'text'" class="skeleton-line"></div>

    <!-- 标题骨架 -->
    <div v-else-if="type === 'title'" class="skeleton-title"></div>

    <!-- 卡片骨架 -->
    <div v-else-if="type === 'card'" class="skeleton-card">
      <div class="skeleton-card-header">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-card-title">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </div>
      <div class="skeleton-card-body">
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>

    <!-- 表格行骨架 -->
    <div v-else-if="type === 'table-row'" class="skeleton-table-row">
      <div class="skeleton-cell" v-for="i in columns" :key="i"></div>
    </div>

    <!-- 圆形骨架（头像） -->
    <div v-else-if="type === 'circle'" class="skeleton-circle"></div>

    <!-- 矩形骨架（图片） -->
    <div v-else-if="type === 'rect'" class="skeleton-rect"></div>

    <!-- 按钮骨架 -->
    <div v-else-if="type === 'button'" class="skeleton-button"></div>

    <!-- 自定义骨架 -->
    <slot v-else></slot>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 骨架屏类型
  type: {
    type: String,
    default: 'text',
    validator: (value) => ['text', 'title', 'card', 'table-row', 'circle', 'rect', 'button'].includes(value)
  },
  // 是否显示动画
  animated: {
    type: Boolean,
    default: true
  },
  // 宽度
  width: {
    type: String,
    default: ''
  },
  // 高度
  height: {
    type: String,
    default: ''
  },
  // 表格列数（仅type=table-row时有效）
  columns: {
    type: Number,
    default: 4
  }
})

const customStyle = computed(() => {
  const style = {}
  if (props.width) style.width = props.width
  if (props.height) style.height = props.height
  return style
})
</script>

<style scoped>
/* 基础骨架样式 */
.skeleton {
  background: var(--skeleton-bg, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

[data-theme="dark"] .skeleton {
  background: rgba(255, 255, 255, 0.08);
}

/* 脉冲动画 */
.skeleton.animated::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

[data-theme="dark"] .skeleton.animated::before {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
}

@keyframes skeleton-loading {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* 文本骨架 */
.skeleton-text {
  width: 100%;
  height: auto;
  background: transparent;
}

.skeleton-line {
  height: 16px;
  background: var(--skeleton-bg, #f0f0f0);
  border-radius: 4px;
  margin-bottom: 8px;
}

[data-theme="dark"] .skeleton-line {
  background: rgba(255, 255, 255, 0.08);
}

.skeleton-line:last-child {
  margin-bottom: 0;
}

.skeleton-line.short {
  width: 60%;
}

/* 标题骨架 */
.skeleton-title {
  height: 24px;
  width: 40%;
  background: var(--skeleton-bg, #f0f0f0);
  border-radius: 4px;
}

[data-theme="dark"] .skeleton-title {
  background: rgba(255, 255, 255, 0.08);
}

/* 卡片骨架 */
.skeleton-card {
  padding: 16px;
  background: transparent;
}

.skeleton-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--skeleton-bg, #f0f0f0);
  flex-shrink: 0;
}

[data-theme="dark"] .skeleton-avatar {
  background: rgba(255, 255, 255, 0.08);
}

.skeleton-card-title {
  flex: 1;
}

.skeleton-card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 表格行骨架 */
.skeleton-table-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 16px;
  padding: 12px 16px;
  background: transparent;
}

.skeleton-cell {
  height: 20px;
  background: var(--skeleton-bg, #f0f0f0);
  border-radius: 4px;
}

[data-theme="dark"] .skeleton-cell {
  background: rgba(255, 255, 255, 0.08);
}

/* 圆形骨架 */
.skeleton-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}

/* 矩形骨架 */
.skeleton-rect {
  width: 100%;
  height: 200px;
  border-radius: 8px;
}

/* 按钮骨架 */
.skeleton-button {
  width: 120px;
  height: 40px;
  border-radius: 8px;
}

/* 响应式 */
@media (max-width: 768px) {
  .skeleton-card {
    padding: 12px;
  }

  .skeleton-avatar {
    width: 40px;
    height: 40px;
  }

  .skeleton-table-row {
    gap: 12px;
    padding: 8px 12px;
  }
}
</style>
