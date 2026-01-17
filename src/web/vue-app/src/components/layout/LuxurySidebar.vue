<template>
  <!-- 移动端遮罩层 -->
  <div
    v-if="mobileMenuOpen"
    class="sidebar-overlay"
    @click="closeMobileMenu"
    aria-hidden="true"
  ></div>

  <aside
    class="sidebar"
    :class="{ collapsed: isCollapsed, 'mobile-open': mobileMenuOpen }"
    role="navigation"
    aria-label="开奖数据爬虫监控"
  >
    <!-- Logo -->
    <div class="sidebar-header">
      <div class="logo" role="banner">
        <span class="logo-icon" aria-hidden="true">K</span>
        <span v-if="!isCollapsed" class="logo-text">开奖数据爬虫监控</span>
      </div>
    </div>

    <!-- 菜单 -->
    <nav class="menu" aria-label="主导航菜单">
      <div class="menu-section" role="group" aria-label="核心功能">
        <div v-if="!isCollapsed" class="menu-section-title" aria-hidden="true">核心功能</div>
        <a
          v-for="item in mainMenuItems"
          :key="item.path"
          :class="['menu-link', { active: isActive(item.path) }]"
          @click="navigateTo(item.path)"
          role="menuitem"
          :aria-label="item.title"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          tabindex="0"
          @keydown.enter="navigateTo(item.path)"
          @keydown.space.prevent="navigateTo(item.path)"
        >
          <span class="menu-link-icon" aria-hidden="true">{{ item.icon }}</span>
          <span v-if="!isCollapsed" class="menu-link-text">{{ item.title }}</span>
          <span v-if="!isCollapsed && item.badge" class="badge" aria-label="实时">{{ item.badge }}</span>
        </a>
      </div>

      <div class="menu-section" role="group" aria-label="系统管理">
        <div v-if="!isCollapsed" class="menu-section-title" aria-hidden="true">系统管理</div>
        <a
          v-for="item in systemMenuItems"
          :key="item.path"
          :class="['menu-link', { active: isActive(item.path) }]"
          @click="navigateTo(item.path)"
          role="menuitem"
          :aria-label="item.title"
          :aria-current="isActive(item.path) ? 'page' : undefined"
          tabindex="0"
          @keydown.enter="navigateTo(item.path)"
          @keydown.space.prevent="navigateTo(item.path)"
        >
          <span class="menu-link-icon" aria-hidden="true">{{ item.icon }}</span>
          <span v-if="!isCollapsed" class="menu-link-text">{{ item.title }}</span>
          <span v-if="!isCollapsed && item.badge" class="badge">{{ item.badge }}</span>
        </a>
      </div>
    </nav>

    <!-- 折叠按钮 -->
    <div class="sidebar-footer">
      <button
        class="collapse-btn"
        @click="toggleCollapse"
        :aria-label="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
        :aria-expanded="!isCollapsed"
      >
        <span aria-hidden="true">{{ isCollapsed ? '→' : '←' }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  collapsed: Boolean,
  mobileMenuOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:collapsed', 'update:mobileMenuOpen', 'navigate'])

const route = useRoute()
const isCollapsed = computed({
  get: () => props.collapsed,
  set: (val) => emit('update:collapsed', val)
})

const mainMenuItems = computed(() => [
  { path: '/dashboard', icon: '📊', title: '仪表盘' },
  { path: '/system-monitor', icon: '🖥️', title: '系统监控' },
  { path: '/realtime', icon: '⚡', title: '实时监控', badge: 'Live' },
  { path: '/scheduler', icon: '⏰', title: '调度中心' },
  { path: '/history', icon: '📚', title: '历史记录' },
  { path: '/data-management', icon: '💾', title: '数据管理' },
  { path: '/alerts', icon: '📢', title: '告警中心' }
])

const systemMenuItems = computed(() => [
  { path: '/sources', icon: '🔗', title: '数据源管理' },
  { path: '/lottery-configs', icon: '⚙️', title: '彩种配置' },
  { path: '/logs', icon: '📋', title: '系统日志' },
  { path: '/domain-management', icon: '🌐', title: '域名管理' },
  { path: '/websocket-monitor', icon: '📊', title: 'WebSocket监控' },
  { path: '/data-completion', icon: '🔧', title: '数据补全' },
  { path: '/settings', icon: '⚙️', title: '系统设置' },
  { path: '/element-theme-test', icon: '🎨', title: '主题测试', badge: 'Test' }
])

const isActive = (path) => {
  return route.path === path || route.path.startsWith(path + '/')
}

const navigateTo = (path) => {
  emit('navigate', path)
  // 移动端点击菜单后自动关闭
  closeMobileMenu()
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const closeMobileMenu = () => {
  emit('update:mobileMenuOpen', false)
}

// 暴露方法供父组件调用
defineExpose({
  closeMobileMenu
})
</script>

<style scoped>
/* 侧边栏容器 */
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  width: 260px;
  height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  z-index: 1000;
}

.sidebar.collapsed {
  width: 70px;
}

/* Logo区域 */
.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--tech-cyan), var(--tech-purple));
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
  white-space: nowrap;
}

/* 菜单区域 */
.menu {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
}

.menu::-webkit-scrollbar {
  width: 4px;
}

.menu::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: 2px;
}

.menu-section {
  margin-bottom: 32px;
}

.menu-section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 20px 12px;
}

/* 菜单链接 - 核心布局 */
.menu-link {
  position: relative;
  display: block;
  width: 100%;
  padding: 14px 20px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
  min-height: 48px;
}

.menu-link:hover {
  background: rgba(0, 255, 255, 0.05);
  color: var(--tech-cyan);
  border-left-color: rgba(0, 255, 255, 0.5);
  box-shadow: inset 0 0 20px rgba(0, 255, 255, 0.1);
}

.menu-link.active {
  background: rgba(0, 255, 255, 0.1);
  color: var(--tech-cyan);
  border-left-color: var(--tech-cyan);
  box-shadow: inset 0 0 20px rgba(0, 255, 255, 0.15);
}

.menu-link-icon {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
}

.menu-link-text {
  position: absolute;
  left: 52px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  font-weight: 500;
}

.badge {
  float: right;
  padding: 2px 8px;
  background: linear-gradient(135deg, var(--tech-cyan), var(--tech-purple));
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.8);
  }
}

/* 底部折叠按钮 */
.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.collapse-btn {
  width: 100%;
  padding: 10px;
  background: rgba(0, 255, 255, 0.05);
  border: 1px solid rgba(0, 255, 255, 0.2);
  border-radius: 8px;
  color: var(--tech-cyan);
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

.collapse-btn:hover {
  background: rgba(0, 255, 255, 0.1);
  border-color: var(--tech-cyan);
  color: var(--tech-cyan);
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
}

/* 折叠状态 */
.sidebar.collapsed .menu-link {
  padding: 12px;
  text-align: center;
}

.sidebar.collapsed .menu-link-icon {
  margin-right: 0;
}

.sidebar.collapsed .menu-section-title {
  text-align: center;
  padding: 0 8px 12px;
}

/* ========== 移动端适配 ========== */

/* 遮罩层 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 移动端侧边栏 */
@media (max-width: 768px) {
  .sidebar {
    /* 默认隐藏在屏幕左侧 */
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.3);
  }

  /* 移动端打开状态 */
  .sidebar.mobile-open {
    transform: translateX(0);
  }

  /* 移动端不使用collapsed模式 */
  .sidebar.collapsed {
    width: 260px;
    transform: translateX(-100%);
  }

  .sidebar.collapsed.mobile-open {
    transform: translateX(0);
  }

  /* 隐藏折叠按钮（移动端不需要） */
  .sidebar-footer {
    display: none;
  }

  /* 优化触摸区域 */
  .menu-link {
    min-height: 52px;
    padding: 16px 20px;
  }

  .menu-link-icon {
    font-size: 20px;
  }

  .menu-link-text {
    font-size: 15px;
  }
}

/* 小屏手机 */
@media (max-width: 480px) {
  .sidebar {
    width: 280px;
  }

  .menu-link {
    min-height: 56px;
    padding: 18px 20px;
  }
}
</style>
