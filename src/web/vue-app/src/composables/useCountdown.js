import { ref, onUnmounted } from 'vue'

/**
 * 倒计时Composable
 * 用于管理多个彩种的倒计时
 */
export function useCountdown() {
  // 倒计时存储 { lotCode: seconds }
  const countdowns = ref({})

  // 定时器映射
  const timers = new Map()

  /**
   * 启动倒计时
   * @param {string} lotCode - 彩种代码
   * @param {number} seconds - 倒计时秒数
   * @param {function} callback - 倒计时结束回调
   */
  const startCountdown = (lotCode, seconds, callback) => {
    // 清除旧定时器
    if (timers.has(lotCode)) {
      clearInterval(timers.get(lotCode))
      timers.delete(lotCode)
    }

    // 初始化倒计时
    countdowns.value[lotCode] = seconds

    // 创建定时器
    const timer = setInterval(() => {
      if (countdowns.value[lotCode] > 0) {
        countdowns.value[lotCode]--
      } else {
        // 倒计时结束
        clearInterval(timer)
        timers.delete(lotCode)
        if (callback) {
          callback()
        }
      }
    }, 1000)

    timers.set(lotCode, timer)
  }

  /**
   * 停止倒计时
   * @param {string} lotCode - 彩种代码
   */
  const stopCountdown = (lotCode) => {
    if (timers.has(lotCode)) {
      clearInterval(timers.get(lotCode))
      timers.delete(lotCode)
      delete countdowns.value[lotCode]
    }
  }

  /**
   * 停止所有倒计时
   */
  const stopAllCountdowns = () => {
    timers.forEach(timer => clearInterval(timer))
    timers.clear()
    countdowns.value = {}
  }

  /**
   * 格式化倒计时显示
   * @param {number} seconds - 秒数
   * @returns {string} 格式化后的时间字符串
   */
  const formatCountdown = (seconds) => {
    if (seconds <= 0) {
      return '开奖中'
    }

    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (days > 0) {
      return `${days}天${hours}小时`
    }

    if (hours > 0) {
      return `${hours}小时${minutes}分`
    }

    if (minutes > 0) {
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }

    return `${secs}秒`
  }

  /**
   * 获取倒计时进度百分比
   * @param {number} current - 当前秒数
   * @param {number} total - 总秒数
   * @returns {number} 0-100的百分比
   */
  const getProgress = (current, total) => {
    if (total <= 0) return 0
    return Math.max(0, Math.min(100, ((total - current) / total) * 100))
  }

  /**
   * 获取倒计时状态
   * @param {number} seconds - 秒数
   * @returns {string} 状态: 'urgent'(紧急), 'warning'(警告), 'normal'(正常)
   */
  const getStatus = (seconds) => {
    if (seconds <= 60) return 'urgent'  // 1分钟内
    if (seconds <= 300) return 'warning'  // 5分钟内
    return 'normal'
  }

  // 组件卸载时清理所有定时器
  onUnmounted(() => {
    stopAllCountdowns()
  })

  return {
    countdowns,
    startCountdown,
    stopCountdown,
    stopAllCountdowns,
    formatCountdown,
    getProgress,
    getStatus
  }
}
