import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export const useDataCompletionStore = defineStore('dataCompletion', () => {
  // 状态
  const isRunning = ref(false)
  const currentProgress = ref(null)
  const historyRecords = ref([])
  const stats = ref({
    totalChecks: 0,
    totalFilled: 0,
    lastRunTime: null,
    lastRunResults: {}
  })

  // WebSocket 连接
  const wsConnected = ref(false)
  let ws = null

  // 计算属性
  const hasHistory = computed(() => historyRecords.value.length > 0)
  const progressPercent = computed(() => {
    if (!currentProgress.value || !currentProgress.value.total) return 0
    return Math.round((currentProgress.value.current / currentProgress.value.total) * 100)
  })

  // 获取补全状态
  async function fetchStatus() {
    try {
      const response = await axios.get('/api/data-completion/status')
      if (response.data.success) {
        stats.value = response.data.data
        isRunning.value = response.data.data.isRunning
      }
    } catch (error) {
      console.error('获取补全状态失败:', error)
      throw error
    }
  }

  // 获取补全历史
  async function fetchHistory(limit = 20, offset = 0) {
    try {
      const response = await axios.get('/api/data-completion/history', {
        params: { limit, offset }
      })
      if (response.data.success) {
        historyRecords.value = response.data.data
      }
    } catch (error) {
      console.error('获取补全历史失败:', error)
      throw error
    }
  }

  // 触发全量补全
  async function runFullCompletion() {
    try {
      const response = await axios.post('/api/data-completion/run')
      if (response.data.success) {
        isRunning.value = true
        return response.data
      }
    } catch (error) {
      console.error('触发补全失败:', error)
      throw error
    }
  }

  // 触发自定义补全
  async function runCustomCompletion(options) {
    try {
      const response = await axios.post('/api/data-completion/custom', options)
      if (response.data.success) {
        isRunning.value = true
        return response.data
      }
    } catch (error) {
      console.error('触发自定义补全失败:', error)
      throw error
    }
  }

  // 连接 WebSocket 监听实时进度
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}`

    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      wsConnected.value = true
      console.log('✅ WebSocket 已连接')
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        // 处理补全进度消息
        if (message.type === 'completion_progress') {
          handleProgressUpdate(message.data)
        }
      } catch (error) {
        console.error('WebSocket 消息解析失败:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket 错误:', error)
      wsConnected.value = false
    }

    ws.onclose = () => {
      wsConnected.value = false
      console.log('WebSocket 连接关闭')

      // 5秒后尝试重连
      setTimeout(() => {
        if (!wsConnected.value) {
          connectWebSocket()
        }
      }, 5000)
    }
  }

  // 处理进度更新
  function handleProgressUpdate(data) {
    switch (data.type) {
      case 'start':
        isRunning.value = true
        currentProgress.value = {
          current: 0,
          total: data.total,
          custom: data.custom || false
        }
        break

      case 'lottery_checked':
      case 'lottery_failed':
        if (currentProgress.value) {
          currentProgress.value.current = data.current
        }
        break

      case 'complete':
        isRunning.value = false
        currentProgress.value = null
        // 刷新历史记录
        fetchHistory()
        fetchStatus()
        break
    }
  }

  // 断开 WebSocket
  function disconnectWebSocket() {
    if (ws) {
      ws.close()
      ws = null
      wsConnected.value = false
    }
  }

  return {
    // 状态
    isRunning,
    currentProgress,
    historyRecords,
    stats,
    wsConnected,

    // 计算属性
    hasHistory,
    progressPercent,

    // 方法
    fetchStatus,
    fetchHistory,
    runFullCompletion,
    runCustomCompletion,
    connectWebSocket,
    disconnectWebSocket
  }
})
