<template>
  <div class="skeleton-stat-card glass-card">
    <div class="skeleton-stat-header">
      <div class="skeleton-icon"></div>
      <div class="skeleton-stat-info">
        <div class="skeleton-line short"></div>
        <div class="skeleton-value"></div>
      </div>
    </div>
    <div class="skeleton-stat-footer">
      <div class="skeleton-line tiny"></div>
    </div>
  </div>
</template>

<script setup>
// 统计卡片骨架屏
</script>

<style scoped>
.skeleton-stat-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 140px;
  position: relative;
  overflow: hidden;
}

.skeleton-stat-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.skeleton-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--skeleton-bg, #f0f0f0);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

[data-theme="dark"] .skeleton-icon {
  background: rgba(255, 255, 255, 0.08);
}

.skeleton-stat-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  background: var(--skeleton-bg, #f0f0f0);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

[data-theme="dark"] .skeleton-line {
  background: rgba(255, 255, 255, 0.08);
}

.skeleton-line.short {
  width: 50%;
}

.skeleton-line.tiny {
  width: 30%;
}

.skeleton-value {
  height: 32px;
  width: 80%;
  background: var(--skeleton-bg, #f0f0f0);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

[data-theme="dark"] .skeleton-value {
  background: rgba(255, 255, 255, 0.08);
}

.skeleton-stat-footer {
  margin-top: auto;
}

/* 脉冲动画 */
.skeleton-icon::before,
.skeleton-line::before,
.skeleton-value::before {
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

[data-theme="dark"] .skeleton-icon::before,
[data-theme="dark"] .skeleton-line::before,
[data-theme="dark"] .skeleton-value::before {
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

@media (max-width: 768px) {
  .skeleton-stat-card {
    padding: 16px;
    min-height: 120px;
  }

  .skeleton-icon {
    width: 40px;
    height: 40px;
  }

  .skeleton-value {
    height: 28px;
  }
}
</style>
