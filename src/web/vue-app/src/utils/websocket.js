/**
 * WebSocket 工具模块
 * 提供 WebSocket 连接管理和消息订阅功能
 */

let ws = null
let handlers = []
let reconnectTimer = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_INTERVAL = 3000

/**
 * 获取 WebSocket URL
 */
function getWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/ws`
}

/**
 * 连接 WebSocket
 */
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return
  }

  try {
    const wsUrl = getWebSocketUrl()
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('[WebSocket] 连接已建立')
      reconnectAttempts = 0
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // 分发消息到所有订阅的处理器
        handlers.forEach(handler => {
          try {
            handler(data)
          } catch (error) {
            console.error('[WebSocket] 处理器执行错误:', error)
          }
        })
      } catch (error) {
        console.error('[WebSocket] 消息解析错误:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('[WebSocket] 连接错误:', error)
    }

    ws.onclose = () => {
      console.log('[WebSocket] 连接已关闭')
      ws = null

      // 自动重连
      if (handlers.length > 0 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        console.log(`[WebSocket] ${RECONNECT_INTERVAL}ms 后尝试第 ${reconnectAttempts} 次重连...`)
        reconnectTimer = setTimeout(() => {
          connectWebSocket()
        }, RECONNECT_INTERVAL)
      }
    }
  } catch (error) {
    console.error('[WebSocket] 创建连接失败:', error)
  }
}

/**
 * 订阅 WebSocket 消息
 * @param {Function} handler - 消息处理函数
 * @returns {Function} 取消订阅函数
 */
export function subscribe(handler) {
  if (typeof handler !== 'function') {
    console.error('[WebSocket] subscribe 参数必须是函数')
    return () => {}
  }

  // 注册处理器
  handlers.push(handler)

  // 如果 WebSocket 未连接，创建连接
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    connectWebSocket()
  }

  // 返回取消订阅函数
  return function unsubscribe() {
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }

    // 如果没有订阅者了，关闭连接
    if (handlers.length === 0 && ws) {
      console.log('[WebSocket] 无订阅者，关闭连接')
      ws.close()
      ws = null
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }
  }
}

/**
 * 发送消息到 WebSocket 服务器
 * @param {Object} data - 要发送的数据
 * @returns {Boolean} 是否发送成功
 */
export function send(data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('[WebSocket] 连接未就绪，无法发送消息')
    return false
  }

  try {
    ws.send(JSON.stringify(data))
    return true
  } catch (error) {
    console.error('[WebSocket] 发送消息失败:', error)
    return false
  }
}

/**
 * 获取 WebSocket 连接状态
 * @returns {String} 连接状态
 */
export function getStatus() {
  if (!ws) return 'CLOSED'

  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      return 'CONNECTING'
    case WebSocket.OPEN:
      return 'OPEN'
    case WebSocket.CLOSING:
      return 'CLOSING'
    case WebSocket.CLOSED:
      return 'CLOSED'
    default:
      return 'UNKNOWN'
  }
}

/**
 * 手动关闭 WebSocket 连接
 */
export function close() {
  if (ws) {
    handlers = []
    ws.close()
    ws = null
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }
}
