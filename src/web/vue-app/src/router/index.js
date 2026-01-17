import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// 配置NProgress
NProgress.configure({
  easing: 'ease',
  speed: 500,
  showSpinner: false,
  trickleSpeed: 200,
  minimum: 0.3
})

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardElementPlus.vue')
  },
  {
    path: '/system-monitor',
    name: 'system-monitor',
    component: () => import('../views/SystemMonitorElementPlus.vue'),
    meta: { title: '系统监控 - Element Plus' }
  },
  {
    path: '/realtime',
    name: 'realtime',
    component: () => import('../views/RealtimeElementPlus.vue'),
    meta: { title: '实时彩种 - Element Plus' }
  },
  {
    path: '/scheduler',
    name: 'scheduler',
    component: () => import('../views/SchedulerElementPlus.vue'),
    meta: { title: '调度管理 - Element Plus' }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/HistoryElementPlus.vue'),
    meta: { title: '历史查询 - Element Plus' }
  },
  {
    path: '/data-management',
    name: 'data-management',
    component: () => import('../views/DataManagementElementPlus.vue'),
    meta: { title: '数据管理 - Element Plus' }
  },
  {
    path: '/alerts',
    name: 'alerts',
    component: () => import('../views/AlertsLuxuryElementPlus.vue'),
    meta: { title: '告警管理 - Element Plus' }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsElementPlus.vue'),
    meta: { title: '系统设置' }
  },
  {
    path: '/sources',
    name: 'sources',
    component: () => import('../views/SourcesElementPlus.vue'),
    meta: { title: '数据源管理 - Element Plus' }
  },
  {
    path: '/lottery-configs',
    name: 'lottery-configs',
    component: () => import('../views/LotteryConfigsElementPlus.vue'),
    meta: { title: '彩种配置 - Element Plus' }
  },
  {
    path: '/logs',
    name: 'logs',
    component: () => import('../views/LogsProElementPlus.vue'),
    meta: { title: '日志管理 - Element Plus' }
  },
  {
    path: '/domain-management',
    name: 'domain-management',
    component: () => import('../views/DomainManagementElementPlus.vue'),
    meta: { title: '域名管理 - Element Plus' }
  },
  {
    path: '/websocket-monitor',
    name: 'websocket-monitor',
    component: () => import('../views/WebSocketMonitorElementPlus.vue'),
    meta: { title: 'WebSocket 监控 - Element Plus' }
  },
  {
    path: '/data-completion',
    name: 'data-completion',
    component: () => import('../views/DataCompletionElementPlus.vue'),
    meta: { title: '数据补全 - Element Plus' }
  },
  {
    path: '/element-theme-test',
    name: 'element-theme-test',
    component: () => import('../views/ElementThemeTest.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),  // 使用Vite配置的base路径 (/v2/)
  routes
})

// 全局前置守卫 - 页面加载进度条
router.beforeEach((to, from, next) => {
  // 开始进度条
  NProgress.start()
  next()
})

// 全局后置钩子 - 完成进度条
router.afterEach(() => {
  // 完成进度条
  NProgress.done()
})

// 处理路由错误
router.onError(() => {
  NProgress.done()
})

export default router
