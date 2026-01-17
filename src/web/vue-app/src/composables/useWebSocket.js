import { ref, onMounted, onUnmounted } from 'vue'

/**
 * WebSocket Composable - 独立连接模式（方案A）
 * 每个标签页独立建立WebSocket连接，稳定可靠
 */
export function useWebSocket(url = 'ws://localhost:4000') {
  console.log('🔧 useWebSocket 初始化, URL:', url)

  const ws = ref(null)
  const connected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000

  let reconnectTimer = null

  /**
   * 连接WebSocket
   */
  const connect = () => {
    try {
      ws.value = new WebSocket(url)

      ws.value.onopen = () => {
        connected.value = true
        reconnectAttempts.value = 0
        console.log('✅ [WebSocket] 连接成功')
      }

      ws.value.onmessage = async (event) => {
        try {
          let data

          // 🎯 处理后端GZIP压缩的二进制消息
          if (event.data instanceof Blob) {
            // 将Blob转换为ArrayBuffer
            const arrayBuffer = await event.data.arrayBuffer()

            // 检查是否是GZIP压缩数据（魔数：0x1f 0x8b）
            const bytes = new Uint8Array(arrayBuffer)
            if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
              // GZIP压缩数据，使用DecompressionStream解压
              try {
                const decompressedStream = new Blob([arrayBuffer])
                  .stream()
                  .pipeThrough(new DecompressionStream('gzip'))
                const decompressedBlob = await new Response(decompressedStream).blob()
                const text = await decompressedBlob.text()
                data = JSON.parse(text)
              } catch (decompressError) {
                console.error('[WebSocket] GZIP解压失败:', decompressError)
                return
              }
            } else {
              // 非压缩的二进制数据，当作文本解析
              const text = new TextDecoder().decode(arrayBuffer)
              data = JSON.parse(text)
            }
          } else {
            // 文本消息直接解析
            data = JSON.parse(event.data)
          }

          handleMessage(data)
        } catch (error) {
          console.error('[WebSocket] 消息解析失败:', error)
        }
      }

      ws.value.onerror = (error) => {
        console.error('❌ [WebSocket] 连接错误:', error)
      }

      ws.value.onclose = () => {
        connected.value = false
        console.log('🔌 [WebSocket] 连接关闭')

        // 自动重连
        if (reconnectAttempts.value < maxReconnectAttempts) {
          reconnectAttempts.value++
          console.log(`🔄 [WebSocket] ${reconnectDelay / 1000}秒后尝试第${reconnectAttempts.value}次重连...`)

          reconnectTimer = setTimeout(() => {
            connect()
          }, reconnectDelay)
        } else {
          console.error('❌ [WebSocket] 达到最大重连次数，停止重连')
        }
      }
    } catch (error) {
      console.error('❌ [WebSocket] 连接失败:', error)
    }
  }

  /**
   * 断开连接
   */
  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    connected.value = false
    reconnectAttempts.value = 0
  }

  /**
   * 发送消息
   * @param {object} data - 要发送的数据
   */
  const send = (data) => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      try {
        ws.value.send(JSON.stringify(data))
        return true
      } catch (error) {
        console.error('[WebSocket] 发送消息失败:', error)
        return false
      }
    } else {
      console.warn('[WebSocket] 未连接，无法发送消息')
      return false
    }
  }

  /**
   * 订阅彩种更新
   * @param {string|Array} lotCodes - 彩种代码或彩种代码数组
   */
  const subscribeLotteries = (lotCodes) => {
    const codes = Array.isArray(lotCodes) ? lotCodes : [lotCodes]
    send({
      type: 'subscribe',
      data: { lotteries: codes }
    })
    console.log('[WebSocket] 订阅彩种:', codes)
  }

  /**
   * 取消订阅彩种
   * @param {string|Array} lotCodes - 彩种代码或彩种代码数组
   */
  const unsubscribeLotteries = (lotCodes) => {
    const codes = Array.isArray(lotCodes) ? lotCodes : [lotCodes]
    send({
      type: 'unsubscribe',
      data: { lotteries: codes }
    })
    console.log('[WebSocket] 取消订阅彩种:', codes)
  }

  /**
   * 处理接收到的消息
   * @param {object} data - 消息数据
   */
  const handleMessage = (data) => {
    // 过滤connection类型的消息（不需要处理）
    if (data.type === 'connection') {
      console.log('[WebSocket] 连接确认:', data.data?.message || '连接成功')
      return
    }

    console.log('[WebSocket] 收到消息:', data)

    // 触发自定义事件，让组件可以监听
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ws-message', { detail: data }))
    }
  }

  /**
   * 订阅WebSocket消息
   * @param {function} callback - 回调函数
   * @returns {function} 取消订阅函数
   */
  const subscribe = (callback) => {
    const handler = (event) => {
      callback(event.detail)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('ws-message', handler)

      // 返回取消订阅函数
      return () => {
        window.removeEventListener('ws-message', handler)
      }
    }

    return () => {}
  }

  // 组件挂载时连接
  onMounted(() => {
    connect()
  })

  // 组件卸载时断开
  onUnmounted(() => {
    disconnect()
  })

  return {
    connected,
    reconnectAttempts,
    connect,
    disconnect,
    send,
    subscribe,
    subscribeLotteries,
    unsubscribeLotteries
  }
}
