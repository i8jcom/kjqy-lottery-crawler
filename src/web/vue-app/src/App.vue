<script setup>
import { ref, onMounted } from 'vue'
import LuxurySidebar from './components/layout/LuxurySidebar.vue'
import Toast from './components/feedback/Toast.vue'
import ErrorBoundary from './components/common/ErrorBoundary.vue'
import ThemeToggle from './components/common/ThemeToggle.vue'
import { useRouter } from 'vue-router'
import { setToastInstance } from './composables/useToast'
import { initTheme } from './config/theme'

const router = useRouter()
const collapsed = ref(false)
const mobileMenuOpen = ref(false)
const toastRef = ref(null)

const handleNavigate = (path) => {
  router.push(path)
}

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

// 设置全局Toast实例 + 初始化主题
onMounted(() => {
  if (toastRef.value) {
    setToastInstance(toastRef.value)
    // 同时设置到window，供全局错误处理使用
    window.__toast__ = toastRef.value
  }

  // 🌙 初始化主题系统
  initTheme()
})
</script>

<template>
  <div class="luxury-layout">
    <!-- 豪华侧边栏 -->
    <LuxurySidebar
      v-model:collapsed="collapsed"
      v-model:mobileMenuOpen="mobileMenuOpen"
      @navigate="handleNavigate"
    />

    <!-- 主内容区 -->
    <div class="main-container" :class="{ collapsed }" role="main">
      <!-- 顶部信息栏 -->
      <header class="top-bar" role="banner">
        <!-- 移动端汉堡菜单按钮 -->
        <button
          class="mobile-menu-btn"
          @click="toggleMobileMenu"
          aria-label="打开菜单"
          :aria-expanded="mobileMenuOpen"
        >
          <span class="hamburger-icon" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        <nav class="breadcrumb" aria-label="面包屑导航">
          <span class="breadcrumb-home" aria-hidden="true">🏠 首页</span>
          <span class="breadcrumb-separator" aria-hidden="true">/</span>
          <span class="breadcrumb-current">{{ $route.meta.title || '仪表盘' }}</span>
        </nav>
        <div class="top-actions">
          <!-- 🌙 主题切换按钮 -->
          <ThemeToggle />

          <div class="status-indicator" role="status" aria-label="系统状态">
            <span class="status-dot pulsing" aria-hidden="true"></span>
            <span class="status-text">系统在线</span>
          </div>
        </div>
      </header>

      <!-- 路由视图 - 添加错误边界 -->
      <div class="main-content" role="region" aria-label="主内容区">
        <ErrorBoundary>
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </ErrorBoundary>
      </div>
    </div>

    <!-- 全局Toast通知 -->
    <Toast ref="toastRef" />
  </div>
</template>

<style>
html, body {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}

.luxury-layout {
  display: flex;
  min-height: 100vh;
  width: 100%;
  max-width: none;
  background: var(--bg-primary);
  background-attachment: fixed;
  color: var(--text-primary);
  transition: background 0.3s ease, color 0.3s ease;
}

.main-container {
  flex: 1;
  margin-left: 0;
  padding-left: 260px;
  transition: padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.main-container.collapsed {
  padding-left: 70px;
}

.top-bar {
  height: 64px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.breadcrumb-home {
  color: var(--text-secondary);
}

.breadcrumb-separator {
  color: var(--text-quaternary);
}

.breadcrumb-current {
  color: var(--text-primary);
  font-weight: 500;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
}

.status-dot.pulsing {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
}

.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-height: calc(100vh - 64px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ========== 移动端汉堡菜单按钮 ========== */
.mobile-menu-btn {
  display: none;
  width: 44px;
  height: 44px;
  padding: 0;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 12px;
}

.mobile-menu-btn:hover {
  background: var(--glass-bg-hover);
}

.mobile-menu-btn:active {
  transform: scale(0.95);
}

.hamburger-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
}

.hamburger-icon span {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--text-primary);
  border-radius: 2px;
  transition: all 0.3s ease;
}

/* ========== 平板端适配 ========== */
@media (max-width: 768px) {
  /* 显示汉堡菜单按钮 */
  .mobile-menu-btn {
    display: flex;
  }

  /* 移动端移除左padding */
  .main-container {
    padding-left: 0 !important;
  }

  .main-container.collapsed {
    padding-left: 0 !important;
  }

  /* 优化顶部栏 */
  .top-bar {
    padding: 0 12px;
  }

  /* 调整面包屑显示 */
  .breadcrumb {
    font-size: 13px;
  }

  .breadcrumb-home {
    display: none;
  }

  .breadcrumb-separator {
    display: none;
  }
}

/* ========== 小屏手机适配 ========== */
@media (max-width: 480px) {
  .main-container {
    margin-left: 0;
  }

  .main-content {
    padding: 12px;
  }

  .top-bar {
    height: 56px;
    padding: 0 12px;
  }

  /* 移动端隐藏状态指示器 */
  .status-indicator {
    display: none;
  }

  /* 面包屑更紧凑 */
  .breadcrumb {
    font-size: 14px;
    font-weight: 500;
  }

  .breadcrumb-current {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 汉堡菜单按钮更大 */
  .mobile-menu-btn {
    width: 48px;
    height: 48px;
  }
}
</style>
