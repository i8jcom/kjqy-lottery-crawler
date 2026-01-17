<template>
  <div class="skeleton-table">
    <!-- 表头 -->
    <div class="skeleton-table-header">
      <div
        v-for="i in columns"
        :key="`header-${i}`"
        class="skeleton-table-cell header"
      ></div>
    </div>

    <!-- 表格行 -->
    <div
      v-for="row in rows"
      :key="`row-${row}`"
      class="skeleton-table-row"
    >
      <div
        v-for="col in columns"
        :key="`cell-${row}-${col}`"
        class="skeleton-table-cell"
      ></div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  // 行数
  rows: {
    type: Number,
    default: 5
  },
  // 列数
  columns: {
    type: Number,
    default: 4
  }
})
</script>

<style scoped>
.skeleton-table {
  width: 100%;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.skeleton-table-header {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 16px;
  padding: 16px;
  background: rgba(102, 126, 234, 0.05);
  border-bottom: 1px solid var(--border-color);
}

[data-theme="dark"] .skeleton-table-header {
  background: rgba(102, 126, 234, 0.1);
}

.skeleton-table-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.2s ease;
}

.skeleton-table-row:last-child {
  border-bottom: none;
}

.skeleton-table-row:hover {
  background: rgba(102, 126, 234, 0.03);
}

[data-theme="dark"] .skeleton-table-row:hover {
  background: rgba(102, 126, 234, 0.08);
}

.skeleton-table-cell {
  height: 20px;
  background: var(--skeleton-bg, #f0f0f0);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

[data-theme="dark"] .skeleton-table-cell {
  background: rgba(255, 255, 255, 0.08);
}

.skeleton-table-cell.header {
  height: 16px;
  width: 80%;
}

/* 脉冲动画 */
.skeleton-table-cell::before {
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

[data-theme="dark"] .skeleton-table-cell::before {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
}

/* 每行延迟不同，产生波浪效果 */
.skeleton-table-row:nth-child(1) .skeleton-table-cell::before {
  animation-delay: 0s;
}

.skeleton-table-row:nth-child(2) .skeleton-table-cell::before {
  animation-delay: 0.1s;
}

.skeleton-table-row:nth-child(3) .skeleton-table-cell::before {
  animation-delay: 0.2s;
}

.skeleton-table-row:nth-child(4) .skeleton-table-cell::before {
  animation-delay: 0.3s;
}

.skeleton-table-row:nth-child(5) .skeleton-table-cell::before {
  animation-delay: 0.4s;
}

@keyframes skeleton-loading {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .skeleton-table-header,
  .skeleton-table-row {
    gap: 12px;
    padding: 12px;
  }

  .skeleton-table-cell {
    height: 16px;
  }
}
</style>
