<script setup>
import { ref, onMounted } from 'vue';
import { getCurrentTheme, toggleTheme, getThemeInfo } from '@/config/theme';

// 当前主题
const currentTheme = ref('light');

// 切换动画状态
const isSwitching = ref(false);

// 主题切换处理
const handleToggle = () => {
  // 触发切换动画
  isSwitching.value = true;

  // 切换主题
  const newTheme = toggleTheme();
  currentTheme.value = newTheme;

  // 动画结束后重置状态
  setTimeout(() => {
    isSwitching.value = false;
  }, 500);
};

// 获取主题信息
const themeInfo = () => {
  return getThemeInfo(currentTheme.value);
};

// 组件挂载时初始化
onMounted(() => {
  currentTheme.value = getCurrentTheme();

  // 监听主题变化（如果其他地方也能切换主题）
  window.addEventListener('theme-changed', (e) => {
    currentTheme.value = e.detail.theme;
  });
});
</script>

<template>
  <button
    class="theme-toggle"
    :class="{ switching: isSwitching }"
    @click="handleToggle"
    :title="currentTheme === 'light' ? '切换到深色模式' : '切换到亮色模式'"
    :aria-label="currentTheme === 'light' ? '切换到深色模式' : '切换到亮色模式'"
  >
    <span class="theme-icon" :key="currentTheme">
      {{ themeInfo().icon }}
    </span>
    <span class="theme-name">
      {{ currentTheme === 'light' ? '深色' : '亮色' }}
    </span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  border-radius: 22px;
  background: var(--glass-bg, var(--text-secondary));
  backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border, var(--glass-border));
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #1f2937);
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.1));
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.theme-toggle:hover {
  background: var(--glass-bg-hover, var(--text-primary));
  border-color: var(--glass-border-strong, var(--glass-border-strong));
  transform: translateY(-1px);
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
}

.theme-toggle:active {
  transform: translateY(0);
}

.theme-toggle.switching {
  pointer-events: none;
}

.theme-icon {
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.theme-toggle.switching .theme-icon {
  animation: rotateIcon 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes rotateIcon {
  0% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) scale(1.2);
  }
  100% {
    transform: rotate(360deg) scale(1);
  }
}

.theme-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: opacity 0.3s ease;
}

.theme-toggle.switching .theme-name {
  opacity: 0.5;
}

/* 响应式：小屏幕隐藏文字 */
@media (max-width: 768px) {
  .theme-toggle {
    width: 44px;
    height: 44px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }

  .theme-name {
    display: none;
  }

  .theme-icon {
    margin: 0;
  }
}

/* 深色模式特殊样式 */
[data-theme="dark"] .theme-toggle {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

[data-theme="dark"] .theme-toggle:hover {
  background: var(--glass-bg-hover);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
}

/* 可访问性：聚焦样式 */
.theme-toggle:focus-visible {
  outline: 2px solid var(--primary-color, #667eea);
  outline-offset: 2px;
}

/* 禁用状态（如果需要） */
.theme-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.theme-toggle:disabled:hover {
  transform: none;
}
</style>
