import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './assets/styles/variables.css'
import './assets/styles/animations.css'
import './assets/styles/theme-light.css'  // ☀️ 亮色主题
import './assets/styles/theme-dark.css'   // 🌙 深色主题
// 🎨 科技风格主题（Tech/Cyberpunk Theme）
import './assets/styles/tech-theme.css'      // 科技主题变量
import './assets/styles/neon-effects.css'    // 霓虹效果
import './assets/styles/tech-animations.css' // 科技动画
import App from './App.vue'
import router from './router'

// 🔥 关键修复：在 Element Plus 加载之前初始化主题
import { initTheme } from './config/theme'
initTheme()

// Element Plus - 先导入 Element Plus CSS
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

// 在 Element Plus CSS 之后导入覆盖样式，确保主题生效
// 先导入变量定义，再导入覆盖样式
import './assets/styles/variables.css'
import './assets/styles/element-plus-override.css'
import './assets/styles/global.css'

// 虚拟滚动优化
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

// NProgress全局加载进度条
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// 配置NProgress
NProgress.configure({
  showSpinner: false,  // 不显示旋转图标
  trickleSpeed: 200,   // 自动递增间隔
  minimum: 0.3,        // 最小百分比
  easing: 'ease',      // 动画方式
  speed: 500           // 递增进度条的速度
})

const app = createApp(App)
const pinia = createPinia()

// 使用 Pinia 状态管理
app.use(pinia)

// 注册虚拟滚动组件
app.component('RecycleScroller', RecycleScroller)

// 使用 Element Plus（中文）
app.use(ElementPlus, {
  locale: zhCn,
})

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 全局错误处理（增强版）
let globalToast = null

// 延迟获取Toast实例的函数
const getToast = () => {
  if (!globalToast) {
    // 尝试从window获取（在App.vue中会设置）
    globalToast = window.__toast__
  }
  return globalToast
}

app.config.errorHandler = (err, instance, info) => {
  console.error('❌ [Global Error Handler] Vue错误捕获:')
  console.error('错误:', err)
  console.error('组件:', instance?.$options?.name || '未知组件')
  console.error('触发位置:', info)
  console.error('堆栈:', err.stack)

  // 尝试显示Toast通知
  const toast = getToast()
  if (toast) {
    const componentName = instance?.$options?.name || '组件'
    const errorMessage = err.message || '未知错误'
    toast.error(
      `${componentName}渲染失败: ${errorMessage}`,
      '系统错误'
    )
  } else {
    // 如果Toast未初始化，使用浏览器alert
    console.warn('[Global Error Handler] Toast未初始化，无法显示错误通知')
  }

  // 如果是Promise未处理的rejection，也捕获
  if (err.promise) {
    console.error('未处理的Promise rejection:', err.reason)
  }
}

// 捕获全局未处理的Promise rejection
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [Unhandled Promise Rejection]:', event.reason)

  const toast = getToast()
  if (toast) {
    toast.error(
      event.reason?.message || '操作失败，请稍后重试',
      'Promise错误'
    )
  }

  // 阻止浏览器默认的错误提示
  event.preventDefault()
})

app.use(router)

// 路由守卫 - 集成NProgress（添加最小显示时间）
let progressTimer = null

router.beforeEach((to, from, next) => {
  // 清除之前的定时器
  if (progressTimer) {
    clearTimeout(progressTimer)
    progressTimer = null
  }

  // 开始进度条
  NProgress.start()

  console.log('🚀 导航到:', to.fullPath, '来自:', from.fullPath)
  console.log('📍 匹配的路由:', to.matched)
  next()
})

router.afterEach((to) => {
  // 确保进度条至少显示300ms，让用户能看到
  progressTimer = setTimeout(() => {
    NProgress.done()
    console.log('✅ 导航完成:', to.fullPath)
  }, 300)
})

// 移除加载提示并挂载应用
const loadingElement = document.getElementById('app-loading')
if (loadingElement) {
  loadingElement.remove()
}

app.mount('#app')
console.log('✅ Vue应用已挂载')
