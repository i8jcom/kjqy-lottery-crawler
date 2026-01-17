import { getCurrentInstance } from 'vue'

// Toast实例引用
let toastInstance = null

// 设置Toast实例
export function setToastInstance(instance) {
  toastInstance = instance
}

// 使用Toast
export function useToast() {
  // 如果在组件内部调用，尝试获取全局Toast
  const instance = getCurrentInstance()
  const toast = toastInstance || instance?.appContext?.config?.globalProperties?.$toast

  if (!toast) {
    console.warn('[useToast] Toast组件未初始化，请在App.vue中添加Toast组件')
    // 返回一个fallback，防止报错
    return {
      success: (msg) => console.log('✓', msg),
      error: (msg) => console.error('✕', msg),
      warning: (msg) => console.warn('⚠', msg),
      info: (msg) => console.info('ℹ', msg)
    }
  }

  return {
    success: (message, title) => toast.success(message, title),
    error: (message, title) => toast.error(message, title),
    warning: (message, title) => toast.warning(message, title),
    info: (message, title) => toast.info(message, title)
  }
}
