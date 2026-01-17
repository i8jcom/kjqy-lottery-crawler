<template>
  <div class="logs-pro-page" :class="{ 'fullscreen': isFullscreen }">
    <!-- 📊 统计面板 -->
    <div class="stats-panel glass-card" v-if="!isFullscreen">
      <div class="stats-grid">
        <div class="stat-card" v-for="stat in stats" :key="stat.level">
          <div class="stat-icon" :class="`icon-${stat.level}`">{{ stat.icon }}</div>
          <div class="stat-content">
            <div class="stat-label">{{ stat.label }}</div>
            <div class="stat-value">{{ stat.count }}</div>
          </div>
        </div>

        <!-- 总日志数 -->
        <div class="stat-card stat-total">
          <div class="stat-icon icon-total">📋</div>
          <div class="stat-content">
            <div class="stat-label">总日志数</div>
            <div class="stat-value">{{ totalLogs }}</div>
          </div>
        </div>

        <!-- WebSocket状态 -->
        <div class="stat-card">
          <div class="stat-icon" :class="wsConnected ? 'icon-online' : 'icon-offline'">
            {{ wsConnected ? '🟢' : '🔴' }}
          </div>
          <div class="stat-content">
            <div class="stat-label">实时推送 (仅ERROR/WARN)</div>
            <div class="stat-value">{{ wsConnected ? '已连接' : '已断开' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 🎛️ 控制面板 -->
    <div class="control-panel glass-card">
      <!-- 过滤器区域 -->
      <div class="filters-section">
        <div class="section-title">🔍 筛选条件</div>
        <div class="filters-grid">
          <!-- 日志级别 -->
          <div class="control-item">
            <label>日志级别</label>
            <select v-model="filters.level" class="form-select" @change="applyFilters">
              <option value="">全部</option>
              <option value="info">INFO</option>
              <option value="warn">WARN</option>
              <option value="error">ERROR</option>
              <option value="debug">DEBUG</option>
            </select>
          </div>

          <!-- 日志来源 -->
          <div class="control-item">
            <label>日志来源</label>
            <input
              type="text"
              v-model="filters.source"
              class="form-input"
              placeholder="输入来源筛选..."
              @input="applyFilters"
            />
          </div>

          <!-- 关键词搜索 -->
          <div class="control-item">
            <label>关键词搜索 (Ctrl+F)</label>
            <input
              type="text"
              ref="searchInput"
              v-model="filters.keyword"
              class="form-input"
              placeholder="输入关键词..."
              @input="applyFilters"
            />
          </div>

          <!-- 时间范围 -->
          <div class="control-item">
            <label>时间范围</label>
            <select v-model="timeRange" class="form-select" @change="handleTimeRangeChange">
              <option value="all">全部时间</option>
              <option value="1h">最近1小时</option>
              <option value="6h">最近6小时</option>
              <option value="24h">最近24小时</option>
              <option value="custom">自定义范围</option>
            </select>
          </div>

          <!-- 显示行数 -->
          <div class="control-item">
            <label>显示行数 ⚡</label>
            <select v-model="displayLines" class="form-select" @change="handleLinesChange">
              <option :value="100">100行</option>
              <option :value="300">300行</option>
              <option :value="500">500行</option>
              <option :value="1000">1000行 ✨ 推荐</option>
              <option :value="2000">2000行</option>
              <option :value="5000">5000行 (谨慎)</option>
              <option :value="10000">10000行 (慎用)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 操作按钮区域 -->
      <div class="actions-section">
        <div class="section-title">⚡ 操作</div>
        <div class="actions-grid">
          <button class="btn-action" @click="loadLogs" :disabled="loading" title="刷新日志">
            <span :class="{ 'rotating': loading }">🔄</span>
            <span class="btn-text">刷新</span>
          </button>
          <button
            class="btn-action"
            :class="{ 'btn-warning': logPushPaused }"
            @click="toggleLogPush"
            :title="logPushPaused ? '继续实时推送ERROR/WARN日志' : '暂停实时推送（当前仅推送ERROR/WARN）'"
          >
            <span>{{ logPushPaused ? '▶️' : '⏸️' }}</span>
            <span class="btn-text">{{ logPushPaused ? '继续' : '暂停' }}</span>
          </button>
          <button class="btn-action" @click="exportLogs('txt')" title="导出TXT">
            <span>📄</span>
            <span class="btn-text">TXT</span>
          </button>
          <button class="btn-action" @click="exportLogs('json')" title="导出JSON">
            <span>📦</span>
            <span class="btn-text">JSON</span>
          </button>
          <button class="btn-action" @click="toggleAutoScroll" title="自动滚动">
            <span>{{ autoScroll ? '📌' : '📍' }}</span>
            <span class="btn-text">{{ autoScroll ? '锁定' : '跟随' }}</span>
          </button>
          <button class="btn-action" @click="toggleFullscreen" title="全屏 (F11)">
            <span>{{ isFullscreen ? '🔲' : '⛶' }}</span>
            <span class="btn-text">全屏</span>
          </button>
        </div>
      </div>

      <!-- 自定义时间范围 -->
      <div class="time-range-custom" v-if="timeRange === 'custom'">
        <div class="custom-range-inputs">
          <div class="range-input">
            <label>开始时间</label>
            <input type="datetime-local" v-model="customTimeRange.start" @change="applyFilters" class="form-input" />
          </div>
          <div class="range-input">
            <label>结束时间</label>
            <input type="datetime-local" v-model="customTimeRange.end" @change="applyFilters" class="form-input" />
          </div>
        </div>
      </div>
    </div>

    <!-- 📜 日志查看器 -->
    <div class="log-viewer glass-card">
      <div class="viewer-header">
        <div class="viewer-info">
          <span class="info-badge">显示: {{ displayedLogs.length }} / {{ filteredLogs.length }} 条</span>
          <span class="info-badge" v-if="filters.level">级别: {{ filters.level.toUpperCase() }}</span>
          <span class="info-badge" v-if="filters.source">来源: {{ filters.source }}</span>
          <span class="info-badge" v-if="filters.keyword">
            🔍 关键词: {{ filters.keyword }} ({{ matchCount }}处匹配)
          </span>
        </div>
        <div class="viewer-tools">
          <button class="btn-tool" @click="copySelected" :disabled="selectedLines.size === 0" title="复制选中 (Ctrl+C)">
            📋 复制 ({{ selectedLines.size }})
          </button>
          <button class="btn-tool" @click="clearSelection" :disabled="selectedLines.size === 0">
            ❌ 清除选择
          </button>
        </div>
      </div>

      <div class="log-container" ref="logContainer">
        <div v-if="loading && logs.length === 0" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载日志中...</p>
        </div>

        <div v-else-if="displayedLogs.length === 0" class="empty-state">
          <span class="empty-icon">📋</span>
          <p>{{ logs.length > 0 ? '没有符合条件的日志' : '暂无日志数据' }}</p>
        </div>

        <!-- 使用虚拟滚动优化 -->
        <RecycleScroller
          v-else
          class="log-lines"
          ref="logLines"
          :items="displayedLogs"
          :item-size="28"
          key-field="id"
          v-slot="{ item: log, index }"
        >
          <div
            :class="['log-line', `log-${log.level || 'info'}`, { 'selected': selectedLines.has(log.id || index) }]"
            @click="handleLineClick(log.id || index, $event)"
            @dblclick="showLogDetail(log)"
          >
            <span class="log-line-number">{{ (log.id || index) + 1 }}</span>
            <span class="log-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
            <span :class="['log-level', `level-${log.level || 'info'}`]">
              {{ (log.level || 'info').toUpperCase().padEnd(5) }}
            </span>
            <span class="log-source" v-if="log.source">[{{ log.source }}]</span>
            <span class="log-message" v-html="highlightKeyword(log.message)"></span>
          </div>
        </RecycleScroller>
      </div>
    </div>

    <!-- 📋 日志详情模态框 -->
    <div class="modal-overlay" v-if="showDetailModal" @click="showDetailModal = false">
      <div class="modal-content glass-card" @click.stop>
        <div class="modal-header">
          <h3>📋 日志详情</h3>
          <button class="btn-close" @click="showDetailModal = false">✕</button>
        </div>
        <div class="modal-body" v-if="selectedLog">
          <div class="detail-item">
            <label>时间戳</label>
            <div class="detail-value">{{ selectedLog.timestamp }}</div>
          </div>
          <div class="detail-item">
            <label>日志级别</label>
            <div class="detail-value">
              <span :class="['log-level', `level-${selectedLog.level}`]">
                {{ selectedLog.level?.toUpperCase() }}
              </span>
            </div>
          </div>
          <div class="detail-item">
            <label>日志来源</label>
            <div class="detail-value">{{ selectedLog.source || 'system' }}</div>
          </div>
          <div class="detail-item">
            <label>消息内容</label>
            <div class="detail-value message-content">
              <pre>{{ selectedLog.message }}</pre>
            </div>
          </div>
          <div class="detail-item">
            <label>原始日志</label>
            <div class="detail-value raw-content">
              <pre>{{ selectedLog.raw }}</pre>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-action" @click="copyLogDetail">📋 复制</button>
          <button class="btn-action" @click="showDetailModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import api from '../services/api'
import { useToast } from '../composables/useToast'

const toast = useToast()

// ==================== 状态管理 ====================
const logs = ref([])
const loading = ref(false)
const autoScroll = ref(true)
const wsConnected = ref(false)
const logPushPaused = ref(false)  // 🆕 日志推送暂停状态
const isFullscreen = ref(false)
const showDetailModal = ref(false)
const selectedLog = ref(null)

// 过滤条件
const filters = ref({
  level: '',
  source: '',
  keyword: ''
})

// 时间范围
const timeRange = ref('all')
const customTimeRange = ref({
  start: '',
  end: ''
})

// 显示设置
const displayLines = ref(1000)  // ✨ 使用虚拟滚动，可以安全显示更多行
const selectedLines = ref(new Set())

// DOM引用
const logContainer = ref(null)
const logLines = ref(null)
const searchInput = ref(null)

// WebSocket
let ws = null

// ==================== 计算属性 ====================

// 过滤后的日志
const filteredLogs = computed(() => {
  let result = logs.value

  // 按级别过滤
  if (filters.value.level) {
    result = result.filter(log => log.level === filters.value.level)
  }

  // 按来源过滤
  if (filters.value.source) {
    result = result.filter(log =>
      log.source?.toLowerCase().includes(filters.value.source.toLowerCase())
    )
  }

  // 按关键词过滤
  if (filters.value.keyword) {
    const keyword = filters.value.keyword.toLowerCase()
    result = result.filter(log =>
      log.message?.toLowerCase().includes(keyword)
    )
  }

  // 按时间范围过滤
  if (timeRange.value !== 'all') {
    const now = new Date()
    let startTime

    switch (timeRange.value) {
      case '1h':
        startTime = new Date(now - 3600000)
        break
      case '6h':
        startTime = new Date(now - 6 * 3600000)
        break
      case '24h':
        startTime = new Date(now - 24 * 3600000)
        break
      case 'custom':
        if (customTimeRange.value.start) {
          startTime = new Date(customTimeRange.value.start)
        }
        break
    }

    if (startTime) {
      result = result.filter(log => new Date(log.timestamp) >= startTime)
    }

    if (timeRange.value === 'custom' && customTimeRange.value.end) {
      const endTime = new Date(customTimeRange.value.end)
      result = result.filter(log => new Date(log.timestamp) <= endTime)
    }
  }

  return result
})

// 显示的日志（限制行数）
const displayedLogs = computed(() => {
  return filteredLogs.value.slice(-displayLines.value)
})

// 统计信息
const stats = computed(() => [
  {
    level: 'info',
    icon: 'ℹ️',
    label: 'INFO',
    count: logs.value.filter(l => l.level === 'info').length
  },
  {
    level: 'warn',
    icon: '⚠️',
    label: 'WARN',
    count: logs.value.filter(l => l.level === 'warn').length
  },
  {
    level: 'error',
    icon: '❌',
    label: 'ERROR',
    count: logs.value.filter(l => l.level === 'error').length
  },
  {
    level: 'debug',
    icon: '🐛',
    label: 'DEBUG',
    count: logs.value.filter(l => l.level === 'debug').length
  }
])

const totalLogs = computed(() => logs.value.length)

const matchCount = computed(() => {
  if (!filters.value.keyword) return 0
  const keyword = filters.value.keyword.toLowerCase()
  return displayedLogs.value.reduce((count, log) => {
    const message = log.message?.toLowerCase() || ''
    const matches = message.split(keyword).length - 1
    return count + matches
  }, 0)
})

// ==================== 方法 ====================

// 日志ID计数器（用于给每条日志生成唯一ID）
let logIdCounter = 0

// 加载日志
const loadLogs = async () => {
  try {
    loading.value = true

    const params = {
      lines: displayLines.value,
      level: filters.value.level || undefined,
      source: filters.value.source || undefined,
      keyword: filters.value.keyword || undefined
    }

    const response = await api.getLogs(params)

    if (response.success) {
      // 🔧 确保每条日志都有唯一ID（虚拟滚动需要）
      logs.value = (response.data || []).map(log => ({
        ...log,
        id: log.id !== undefined ? log.id : logIdCounter++
      }))
      console.log('✅ 日志加载成功:', logs.value.length, '条')

      if (autoScroll.value) {
        scrollToBottom()
      }
    }
  } catch (error) {
    toast.error('加载日志失败')
    console.error('❌ 加载日志失败:', error)
  } finally {
    loading.value = false
  }
}

// 应用过滤
const applyFilters = () => {
  if (autoScroll.value) {
    nextTick(() => scrollToBottom())
  }
}

// 处理时间范围变化
const handleTimeRangeChange = () => {
  if (timeRange.value === 'custom') {
    // 设置默认时间范围（最近24小时）
    const now = new Date()
    const yesterday = new Date(now - 24 * 3600000)

    customTimeRange.value.start = yesterday.toISOString().slice(0, 16)
    customTimeRange.value.end = now.toISOString().slice(0, 16)
  }
  applyFilters()
}

// 处理显示行数变化
const handleLinesChange = () => {
  // 性能警告（虚拟滚动提高了阈值）
  if (displayLines.value >= 10000) {
    const confirmed = confirm(
      `⚠️ 性能警告\n\n` +
      `您选择显示 ${displayLines.value} 行日志，这可能导致：\n` +
      `• 内存占用增加\n` +
      `• 搜索和过滤变慢\n\n` +
      `建议：\n` +
      `• 使用更精确的过滤条件（级别/关键词/时间范围）\n` +
      `• 推荐使用1000行以获得最佳体验\n` +
      `• 大量日志请使用"导出"功能\n\n` +
      `是否继续？`
    )

    if (!confirmed) {
      // 用户取消，恢复到推荐值
      displayLines.value = 1000
      return
    }
  }

  loadLogs()
}

// 切换自动滚动
const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value) {
    scrollToBottom()
  }
}

// 🆕 切换日志推送
const toggleLogPush = () => {
  logPushPaused.value = !logPushPaused.value
  if (logPushPaused.value) {
    console.log('⏸️ 日志实时推送已暂停')
  } else {
    console.log('▶️ 日志实时推送已恢复')
  }
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}

// 格式化时间戳
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${ms}`
}

// 关键词高亮
const highlightKeyword = (text) => {
  if (!filters.value.keyword || !text) return text

  const keyword = filters.value.keyword
  const regex = new RegExp(`(${keyword})`, 'gi')
  return text.replace(regex, '<mark class="highlight">$1</mark>')
}

// 处理行点击（多选）
const handleLineClick = (lineId, event) => {
  if (event.ctrlKey || event.metaKey) {
    // Ctrl/Cmd + Click: 切换选择
    if (selectedLines.value.has(lineId)) {
      selectedLines.value.delete(lineId)
    } else {
      selectedLines.value.add(lineId)
    }
  } else if (event.shiftKey && selectedLines.value.size > 0) {
    // Shift + Click: 范围选择
    const lastSelected = Array.from(selectedLines.value).pop()
    const start = Math.min(lastSelected, lineId)
    const end = Math.max(lastSelected, lineId)

    for (let i = start; i <= end; i++) {
      selectedLines.value.add(i)
    }
  } else {
    // 普通点击: 单选
    selectedLines.value.clear()
    selectedLines.value.add(lineId)
  }

  // 触发响应式更新
  selectedLines.value = new Set(selectedLines.value)
}

// 复制选中的日志
const copySelected = () => {
  if (selectedLines.value.size === 0) return

  const selectedIds = Array.from(selectedLines.value).sort((a, b) => a - b)
  const selectedLogsText = selectedIds
    .map(id => {
      const log = logs.value.find(l => (l.id || logs.value.indexOf(l)) === id)
      return log ? log.raw || log.message : ''
    })
    .filter(text => text)
    .join('\n')

  navigator.clipboard.writeText(selectedLogsText).then(() => {
    toast.success(`已复制 ${selectedLines.value.size} 行日志到剪贴板`)
  }).catch(err => {
    toast.error('复制失败')
    console.error('复制失败:', err)
  })
}

// 清除选择
const clearSelection = () => {
  selectedLines.value.clear()
  selectedLines.value = new Set()
}

// 显示日志详情
const showLogDetail = (log) => {
  selectedLog.value = log
  showDetailModal.value = true
}

// 复制日志详情
const copyLogDetail = () => {
  if (!selectedLog.value) return

  const detailText = `
时间戳: ${selectedLog.value.timestamp}
日志级别: ${selectedLog.value.level?.toUpperCase()}
日志来源: ${selectedLog.value.source || 'system'}
消息内容: ${selectedLog.value.message}
原始日志: ${selectedLog.value.raw}
  `.trim()

  navigator.clipboard.writeText(detailText).then(() => {
    toast.success('日志详情已复制到剪贴板')
  }).catch(err => {
    toast.error('复制失败')
    console.error('复制失败:', err)
  })
}

// 导出日志
const exportLogs = (format) => {
  const logsToExport = displayedLogs.value

  if (logsToExport.length === 0) {
    toast.warning('没有可导出的日志')
    return
  }

  let content, filename, mimeType

  if (format === 'txt') {
    content = logsToExport.map(log => log.raw || log.message).join('\n')
    filename = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    mimeType = 'text/plain'
  } else if (format === 'json') {
    content = JSON.stringify(logsToExport, null, 2)
    filename = `logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    mimeType = 'application/json'
  }

  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)

  toast.success(`已导出 ${logsToExport.length} 条日志为 ${format.toUpperCase()} 格式`)
  console.log(`✅ 已导出 ${logsToExport.length} 条日志为 ${format.toUpperCase()} 格式`)
}

// 全屏切换
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value) {
    document.documentElement.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}

// WebSocket连接
const setupWebSocket = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // 开发环境（4002端口）连接到4000端口的后端WebSocket服务器
  // 生产环境使用当前页面的端口
  const wsHost = window.location.hostname
  const wsPort = window.location.port === '4002' ? '4000' : window.location.port
  const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}`

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    wsConnected.value = true
    console.log('✅ WebSocket已连接')

    // 订阅日志
    ws.send(JSON.stringify({
      type: 'subscribe_logs'
    }))
  }

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)

      if (message.type === 'log_message') {
        // 🔧 性能优化：只在推送启用时接收日志
        if (!logPushPaused.value) {
          // 接收新日志并确保有ID
          const newLog = {
            ...message.data,
            id: message.data.id !== undefined ? message.data.id : logIdCounter++
          }
          logs.value.push(newLog)

          // 🔧 更激进的限制：2000条就裁剪到1000条
          if (logs.value.length > 2000) {
            logs.value = logs.value.slice(-1000).map((log, index) => ({
              ...log,
              id: logIdCounter++  // 重新分配ID确保连续
            }))
            console.warn('⚠️ 日志数量过多，已自动裁剪到1000条')
          }

          // 自动滚动
          if (autoScroll.value) {
            scrollToBottom()
          }
        }
      }
    } catch (error) {
      console.error('WebSocket消息解析失败:', error)
    }
  }

  ws.onclose = () => {
    wsConnected.value = false
    console.log('❌ WebSocket已断开，5秒后重连...')

    // 自动重连
    setTimeout(setupWebSocket, 5000)
  }

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error)
  }
}

// 快捷键
const handleKeydown = (event) => {
  // Ctrl/Cmd + F: 聚焦搜索框
  if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
    event.preventDefault()
    searchInput.value?.focus()
  }

  // Ctrl/Cmd + C: 复制选中
  if ((event.ctrlKey || event.metaKey) && event.key === 'c' && selectedLines.value.size > 0) {
    event.preventDefault()
    copySelected()
  }

  // F11: 全屏
  if (event.key === 'F11') {
    event.preventDefault()
    toggleFullscreen()
  }

  // ESC: 关闭模态框或退出全屏
  if (event.key === 'Escape') {
    if (showDetailModal.value) {
      showDetailModal.value = false
    } else if (isFullscreen.value) {
      toggleFullscreen()
    }
  }
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadLogs()
  setupWebSocket()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (ws) {
    // 检查WebSocket是否已连接再发送消息
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'unsubscribe_logs' }))
    }
    ws.close()
  }
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* ==================== 基础布局 ==================== */
.logs-pro-page {
  padding: 20px;
  width: 100%;
  max-width: none;
  min-height: 100vh;
}

.logs-pro-page.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: #0a0e27;
  padding: 10px;
}

/* ==================== 玻璃卡片 ==================== */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
}

/* ==================== 统计面板 ==================== */
.stats-panel {
  padding: 16px 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-bg);
  border-radius: 12px;
  transition: all 0.3s;
}

.stat-card:hover {
  background: var(--glass-bg);
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--glass-bg);
}

.icon-info { background: rgba(59, 130, 246, 0.15); }
.icon-warn { background: rgba(245, 158, 11, 0.15); }
.icon-error { background: rgba(239, 68, 68, 0.15); }
.icon-debug { background: rgba(156, 163, 175, 0.15); }
.icon-total { background: rgba(102, 126, 234, 0.15); }
.icon-online { background: rgba(67, 233, 123, 0.15); }
.icon-offline { background: rgba(255, 107, 107, 0.15); }

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ==================== 控制面板 ==================== */
.control-panel {
  padding: 0;
  overflow: hidden;
}

/* 区域分组样式 */
.filters-section,
.actions-section {
  padding: 12px 16px;
}

.filters-section {
  background: rgba(102, 126, 234, 0.03);
  border-bottom: 1px solid var(--glass-bg);
}

.actions-section {
  background: rgba(118, 75, 162, 0.03);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 2px solid rgba(102, 126, 234, 0.3);
  display: inline-block;
  letter-spacing: 0.5px;
}

/* 过滤器网格 */
.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

/* 操作按钮网格 */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-item label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-select,
.form-input {
  height: 36px;
  padding: 0 10px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.2s;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #667eea;
  background: var(--glass-bg);
}

.form-select option {
  background: #1a1a2e;
  color: white;
}

/* 操作按钮样式 */
.btn-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 52px;
  padding: 6px 8px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.btn-action::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  opacity: 0;
  transition: opacity 0.3s;
}

.btn-action:hover::before {
  opacity: 1;
}

.btn-action .btn-text {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.btn-action:hover:not(:disabled) {
  background: var(--border-color);
  border-color: var(--glass-border);
  transform: translateY(-1px);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 🆕 暂停按钮警告样式 */
.btn-action.btn-warning {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.5);
  color: #fbbf24;
  animation: pulse-warning 2s infinite;
}

.btn-action.btn-warning:hover {
  background: rgba(245, 158, 11, 0.3);
  border-color: rgba(245, 158, 11, 0.7);
}

@keyframes pulse-warning {
  0%, 100% {
    box-shadow: 0 0 0 rgba(245, 158, 11, 0.4);
  }
  50% {
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.6);
  }
}

.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 自定义时间范围 */
.time-range-custom {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.custom-range-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.range-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ==================== 日志查看器 ==================== */
.log-viewer {
  padding: 0 !important;
  overflow: hidden;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 12px;
}

.viewer-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.info-badge {
  padding: 6px 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.viewer-tools {
  display: flex;
  gap: 8px;
}

.btn-tool {
  padding: 6px 12px;
  background: rgba(102, 126, 234, 0.15);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 8px;
  color: #667eea;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-tool:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.25);
}

.btn-tool:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.log-container {
  height: 700px;
  overflow: hidden;  /* 改为hidden，让RecycleScroller内部控制滚动 */
  padding: 0;  /* RecycleScroller内部会有自己的padding */
  background: rgba(0, 0, 0, 0.3);
  font-family: 'Courier New', 'Consolas', monospace;
  display: flex;  /* 让子元素填充容器 */
  flex-direction: column;
}

.fullscreen .log-container {
  height: calc(100vh - 120px);
}

/* 自定义滚动条 - 应用到RecycleScroller内部 */
.log-lines ::-webkit-scrollbar {
  width: 8px;
}

.log-lines ::-webkit-scrollbar-track {
  background: var(--glass-bg);
}

.log-lines ::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: 4px;
}

.log-lines ::-webkit-scrollbar-thumb:hover {
  background: var(--text-subtle);
}

/* 日志行容器 - RecycleScroller */
.log-lines {
  /* RecycleScroller需要明确的高度来启用虚拟滚动 */
  flex: 1;
  height: 100%;  /* 填充父容器 */
  padding: 16px 20px;  /* 移到这里，因为log-container的padding被移除了 */
}

.log-line {
  display: flex;
  gap: 12px;
  padding: 6px 8px;
  font-size: 13px;
  line-height: 1.6;
  transition: all 0.2s;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.log-line:hover {
  background: var(--glass-bg);
}

.log-line.selected {
  background: rgba(102, 126, 234, 0.2) !important;
  border-left: 3px solid #667eea;
}

.log-line-number {
  color: var(--text-subtle);
  font-size: 12px;
  white-space: nowrap;
  min-width: 50px;
  text-align: right;
  font-family: 'Courier New', monospace;
}

.log-timestamp {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
  font-family: 'Courier New', monospace;
  min-width: 120px;
}

.log-level {
  font-weight: 600;
  white-space: nowrap;
  font-family: 'Courier New', monospace;
  min-width: 60px;
}

.level-info { color: #3b82f6; }
.level-warn { color: var(--warning-color); }
.level-error { color: #ef4444; }
.level-debug { color: #9ca3af; }

.log-source {
  color: var(--text-tertiary);
  font-size: 12px;
  white-space: nowrap;
}

.log-message {
  color: var(--text-primary);
  flex: 1;
  word-break: break-word;
}

/* 关键词高亮 */
:deep(.highlight) {
  background: rgba(245, 158, 11, 0.4);
  color: #fbbf24;
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: 600;
}

/* 加载和空状态 */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* ==================== 模态框 ==================== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal-content {
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.btn-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close:hover {
  background: rgba(255, 107, 107, 0.2);
  color: var(--error-color);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.detail-value {
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
}

.message-content pre,
.raw-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
  margin-top: 20px;
}

/* ==================== 响应式 ==================== */

/* 平板和小屏幕 (≤ 1024px) */
@media (max-width: 1024px) {
  .filters-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .actions-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 手机横屏和小平板 (≤ 768px) */
@media (max-width: 768px) {
  .logs-pro-page {
    padding: 12px;
    gap: 12px;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }

  .stat-label {
    font-size: 11px;
  }

  .stat-value {
    font-size: 18px;
  }

  .filters-section,
  .actions-section {
    padding: 16px;
  }

  .filters-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .actions-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .btn-action {
    height: 56px;
    font-size: 20px;
    padding: 6px 8px;
  }

  .btn-action .btn-text {
    font-size: 10px;
  }

  .custom-range-inputs {
    grid-template-columns: 1fr;
  }

  .log-container {
    height: 500px;
  }

  .log-line {
    flex-wrap: wrap;
    font-size: 12px;
  }

  .line-number {
    min-width: 40px;
  }

  .viewer-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .viewer-tools {
    width: 100%;
    flex-wrap: wrap;
  }

  .btn-tool {
    flex: 1 1 auto;
    min-width: 80px;
    min-height: 44px; /* 移动端触摸目标最小尺寸 */
    padding: 10px 12px; /* 增加内边距以达到44px */
  }
}

/* 手机竖屏 (≤ 480px) */
@media (max-width: 480px) {
  .logs-pro-page {
    padding: 8px;
    gap: 8px;
  }

  .stats-panel {
    padding: 12px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stat-card {
    padding: 10px;
  }

  .filters-section,
  .actions-section {
    padding: 12px;
  }

  .filters-grid {
    gap: 10px;
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .control-item label {
    font-size: 12px;
  }

  .form-select,
  .form-input {
    height: 36px;
    font-size: 13px;
  }

  .btn-action {
    height: 52px;
    font-size: 18px;
    padding: 6px;
  }

  .btn-action .btn-text {
    font-size: 9px;
  }

  .section-title {
    font-size: 12px;
    margin-bottom: 12px;
  }

  .log-container {
    height: 400px;
  }

  .log-line {
    font-size: 11px;
    padding: 6px 8px;
  }

  .line-number {
    min-width: 35px;
    font-size: 10px;
  }

  .log-timestamp {
    font-size: 10px;
  }

  .log-level {
    padding: 2px 6px;
    font-size: 10px;
  }
}
</style>
