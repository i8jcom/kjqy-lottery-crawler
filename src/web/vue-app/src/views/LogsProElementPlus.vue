<template>
  <div class="logs-pro-page" :class="{ 'fullscreen': isFullscreen }">
    <!-- 统计面板 - 使用 HolographicCard -->
    <div class="stats-panel" v-if="!isFullscreen">
      <div class="stats-grid">
        <HolographicCard
          v-for="stat in stats"
          :key="stat.level"
          :border="true"
          :hover="true"
          class="stat-card"
        >
          <div class="stat-wrapper">
            <div class="stat-icon" :class="`icon-${stat.level}`">{{ stat.icon }}</div>
            <el-statistic :value="stat.count" :title="stat.label" />
          </div>
        </HolographicCard>

        <!-- 总日志数 -->
        <HolographicCard :border="true" :hover="true" class="stat-card">
          <div class="stat-wrapper">
            <div class="stat-icon icon-total">📋</div>
            <el-statistic :value="totalLogs" title="总日志数" />
          </div>
        </HolographicCard>

        <!-- WebSocket状态 -->
        <HolographicCard :border="true" :hover="true" class="stat-card">
          <div class="stat-wrapper">
            <div class="stat-icon" :class="wsConnected ? 'icon-online' : 'icon-offline'">
              {{ wsConnected ? '🟢' : '🔴' }}
            </div>
            <div class="stat-content">
              <div class="stat-label">实时推送</div>
              <div class="stat-value">{{ wsConnected ? '已连接' : '已断开' }}</div>
            </div>
          </div>
        </HolographicCard>
      </div>
    </div>

    <!-- 控制面板 -->
    <HolographicCard :border="true" class="control-panel">
      <!-- 过滤器区域 -->
      <div class="filters-section">
        <div class="section-title">🔍 筛选条件</div>
        <div class="filters-grid">
          <!-- 日志级别 -->
          <div class="control-item">
            <label>日志级别</label>
            <el-select v-model="filters.level" placeholder="全部" @change="applyFilters">
              <el-option value="" label="全部" />
              <el-option value="info" label="INFO" />
              <el-option value="warn" label="WARN" />
              <el-option value="error" label="ERROR" />
              <el-option value="debug" label="DEBUG" />
            </el-select>
          </div>

          <!-- 日志来源 -->
          <div class="control-item">
            <label>日志来源</label>
            <el-input
              v-model="filters.source"
              placeholder="输入来源筛选..."
              clearable
              @input="applyFilters"
            />
          </div>

          <!-- 关键词搜索 -->
          <div class="control-item">
            <label>关键词搜索</label>
            <el-input
              ref="searchInput"
              v-model="filters.keyword"
              placeholder="输入关键词..."
              clearable
              @input="applyFilters"
            >
              <template #prefix>
                <span>🔍</span>
              </template>
            </el-input>
          </div>

          <!-- 时间范围 -->
          <div class="control-item">
            <label>时间范围</label>
            <el-select v-model="timeRange" @change="handleTimeRangeChange">
              <el-option value="all" label="全部时间" />
              <el-option value="1h" label="最近1小时" />
              <el-option value="6h" label="最近6小时" />
              <el-option value="24h" label="最近24小时" />
            </el-select>
          </div>

          <!-- 显示行数 -->
          <div class="control-item">
            <label>显示行数</label>
            <el-select v-model="displayLines" @change="handleLinesChange">
              <el-option :value="100" label="100行" />
              <el-option :value="300" label="300行" />
              <el-option :value="500" label="500行" />
              <el-option :value="1000" label="1000行 ✨ 推荐" />
              <el-option :value="2000" label="2000行" />
              <el-option :value="5000" label="5000行 (虚拟滚动)" />
              <el-option :value="10000" label="10000行 (虚拟滚动)" />
            </el-select>
          </div>
        </div>
      </div>

      <!-- 操作按钮区域 - 使用 NeonButton -->
      <div class="actions-section">
        <div class="section-title">⚡ 操作</div>
        <div class="actions-grid">
          <NeonButton
            type="primary"
            size="small"
            icon="🔄"
            :loading="loading"
            @click="loadLogs"
          >
            刷新
          </NeonButton>

          <NeonButton
            :type="logPushPaused ? 'warning' : 'success'"
            size="small"
            :icon="logPushPaused ? '▶️' : '⏸️'"
            @click="toggleLogPush"
          >
            {{ logPushPaused ? '继续' : '暂停' }}
          </NeonButton>

          <NeonButton
            type="info"
            size="small"
            icon="📄"
            @click="exportLogs('txt')"
          >
            TXT
          </NeonButton>

          <NeonButton
            type="info"
            size="small"
            icon="📦"
            @click="exportLogs('json')"
          >
            JSON
          </NeonButton>

          <NeonButton
            :type="autoScroll ? 'primary' : 'secondary'"
            size="small"
            :icon="autoScroll ? '📌' : '📍'"
            @click="toggleAutoScroll"
          >
            {{ autoScroll ? '锁定' : '跟随' }}
          </NeonButton>

          <NeonButton
            type="secondary"
            size="small"
            :icon="isFullscreen ? '🔲' : '⛶'"
            @click="toggleFullscreen"
          >
            全屏
          </NeonButton>
        </div>
      </div>
    </HolographicCard>

    <!-- 日志查看器 - 使用 TanStack Table -->
    <HolographicCard :border="true" class="log-viewer">
      <template #header>
        <div class="viewer-header">
          <div class="viewer-info">
            <GlowingTag type="primary" size="small" :text="`显示: ${displayedLogs.length} / ${filteredLogs.length} 条`" />
            <GlowingTag v-if="filters.level" type="info" size="small" :text="`级别: ${filters.level.toUpperCase()}`" />
            <GlowingTag v-if="filters.source" type="success" size="small" :text="`来源: ${filters.source}`" />
            <GlowingTag
              v-if="filters.keyword"
              type="warning"
              size="small"
              :text="`🔍 关键词: ${filters.keyword} (${matchCount}处匹配)`"
            />
          </div>
          <div class="viewer-tools">
            <NeonButton
              type="info"
              size="small"
              :disabled="selectedLines.size === 0"
              @click="copySelected"
            >
              📋 复制 ({{ selectedLines.size }})
            </NeonButton>
            <NeonButton
              type="danger"
              size="small"
              :disabled="selectedLines.size === 0"
              @click="clearSelection"
            >
              ❌ 清除
            </NeonButton>
          </div>
        </div>
      </template>

      <div class="log-container" ref="logContainer">
        <div v-if="loading && logs.length === 0" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载日志中...</p>
        </div>

        <div v-else-if="displayedLogs.length === 0" class="empty-state">
          <span class="empty-icon">📋</span>
          <p>{{ logs.length > 0 ? '没有符合条件的日志' : '暂无日志数据' }}</p>
        </div>

        <!-- TanStack Table 日志显示 (虚拟滚动) -->
        <div v-else class="log-lines">
          <div
            v-for="(log, index) in displayedLogs"
            :key="log.id || index"
            :class="['log-line', 'log-' + (log.level || 'info'), { 'selected': selectedLines.has(log.id || index) }]"
            @click="handleLineClick(log.id || index, $event)"
            @dblclick="showLogDetail(log)"
          >
            <span class="log-line-number">{{ (log.id || index) + 1 }}</span>
            <span class="log-timestamp">{{ formatTimestamp(log.timestamp) }}</span>
            <GlowingTag
              :type="getLogLevelType(log.level || 'info')"
              :text="(log.level || 'info').toUpperCase()"
              effect="dark"
              size="small"
              :pulse="log.level === 'error'"
              class="log-level-tag"
            />
            <span class="log-source" v-if="log.source">[{{ log.source }}]</span>
            <span class="log-message" v-html="highlightKeyword(log.message)"></span>
          </div>
        </div>
      </div>
    </HolographicCard>

    <!-- 日志详情对话框 - 使用 CyberDialog -->
    <CyberDialog
      v-model="showDetailModal"
      title="📋 日志详情"
      size="large"
      :scanline="true"
    >
      <div v-if="selectedLog">
        <div class="detail-item">
          <label>时间戳</label>
          <div class="detail-value">{{ selectedLog.timestamp }}</div>
        </div>
        <div class="detail-item">
          <label>日志级别</label>
          <div class="detail-value">
            <GlowingTag
              :type="getLogLevelType(selectedLog.level)"
              :text="selectedLog.level?.toUpperCase()"
              effect="dark"
              :pulse="selectedLog.level === 'error'"
            />
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

      <template #footer>
        <NeonButton type="info" @click="copyLogDetail">📋 复制</NeonButton>
        <NeonButton type="primary" @click="showDetailModal = false">关闭</NeonButton>
      </template>
    </CyberDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../services/api'
import { HolographicCard, NeonButton, GlowingTag, CyberDialog } from '../components/tech'

// ==================== 状态管理 ====================
const logs = ref([])
const loading = ref(false)
const autoScroll = ref(true)
const wsConnected = ref(false)
const logPushPaused = ref(false)
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

// 显示设置
const displayLines = ref(1000)
const selectedLines = ref(new Set())

// DOM引用
const logContainer = ref(null)
const searchInput = ref(null)

// WebSocket
let ws = null
let logIdCounter = 0

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
    }

    if (startTime) {
      result = result.filter(log => new Date(log.timestamp) >= startTime)
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
    ElMessage.error('加载日志失败')
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
  applyFilters()
}

// 处理显示行数变化
const handleLinesChange = () => {
  loadLogs()
}

// 切换自动滚动
const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value) {
    scrollToBottom()
    ElMessage.success('已启用自动滚动')
  } else {
    ElMessage.info('已禁用自动滚动')
  }
}

// 切换日志推送
const toggleLogPush = () => {
  logPushPaused.value = !logPushPaused.value
  if (logPushPaused.value) {
    console.log('⏸️ 日志实时推送已暂停')
    ElMessage.warning('日志实时推送已暂停')
  } else {
    console.log('▶️ 日志实时推送已恢复')
    ElMessage.success('日志实时推送已恢复')
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
    ElMessage.success(`已复制 ${selectedLines.value.size} 行日志到剪贴板`)
  }).catch(err => {
    ElMessage.error('复制失败')
    console.error('复制失败:', err)
  })
}

// 清除选择
const clearSelection = () => {
  selectedLines.value.clear()
  selectedLines.value = new Set()
  ElMessage.info('已清除选择')
}

// 显示日志详情
const showLogDetail = (log) => {
  selectedLog.value = log
  showDetailModal.value = true
}

// 获取日志级别类型
const getLogLevelType = (level) => {
  const typeMap = {
    'info': 'info',
    'warn': 'warning',
    'error': 'danger',
    'debug': 'secondary'
  }
  return typeMap[level] || 'info'
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
    ElMessage.success('日志详情已复制到剪贴板')
  }).catch(err => {
    ElMessage.error('复制失败')
    console.error('复制失败:', err)
  })
}

// 导出日志
const exportLogs = (format) => {
  const logsToExport = displayedLogs.value

  if (logsToExport.length === 0) {
    ElMessage.warning('没有可导出的日志')
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

  ElMessage.success(`已导出 ${logsToExport.length} 条日志为 ${format.toUpperCase()} 格式`)
  console.log(`✅ 已导出 ${logsToExport.length} 条日志为 ${format.toUpperCase()} 格式`)
}

// 全屏切换
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  if (isFullscreen.value) {
    document.documentElement.requestFullscreen?.()
    ElMessage.success('已进入全屏模式')
  } else {
    document.exitFullscreen?.()
    ElMessage.info('已退出全屏模式')
  }
}

// WebSocket连接
const setupWebSocket = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
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

      if (message.type === 'log_message' && !logPushPaused.value) {
        const newLog = {
          ...message.data,
          id: message.data.id !== undefined ? message.data.id : logIdCounter++
        }
        logs.value.push(newLog)

        // 限制日志数量
        if (logs.value.length > 5000) {
          logs.value = logs.value.slice(-2000).map((log, index) => ({
            ...log,
            id: logIdCounter++
          }))
        }

        // 自动滚动
        if (autoScroll.value) {
          scrollToBottom()
        }
      }
    } catch (error) {
      console.error('WebSocket消息解析失败:', error)
    }
  }

  ws.onclose = () => {
    wsConnected.value = false
    console.log('❌ WebSocket已断开，5秒后重连...')
    setTimeout(setupWebSocket, 5000)
  }

  ws.onerror = (error) => {
    console.error('WebSocket错误:', error)
  }
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadLogs()
  setupWebSocket()
})

onUnmounted(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'unsubscribe_logs' }))
    ws.close()
  }
})
</script>

<style scoped>
/* 基础布局 */
.logs-pro-page {
  padding: 20px;
  width: 100%;
  max-width: none;
  min-height: 100vh;
  background: var(--tech-bg-primary);
  transition: background 0.3s ease;
}

.logs-pro-page.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: var(--tech-bg-primary);
  padding: 10px;
}

/* 统计面板 */
.stats-panel {
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.stat-card {
  transition: all var(--transition-base);
}

.stat-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 4px;
}

.stat-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
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
  color: var(--tech-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--tech-text-primary);
}

/* 控制面板 */
.control-panel {
  margin-bottom: 20px;
}

.filters-section,
.actions-section {
  padding: 16px;
}

.filters-section {
  background: rgba(0, 255, 255, 0.03);
  border-bottom: 1px solid var(--tech-border-subtle);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.actions-section {
  background: rgba(168, 85, 247, 0.03);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tech-cyan);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--tech-cyan);
  display: inline-block;
  letter-spacing: 0.5px;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-item label {
  font-size: 12px;
  font-weight: 500;
  color: var(--tech-text-secondary);
}

/* 日志查看器 */
.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  background: rgba(0, 255, 255, 0.05);
  border-bottom: 2px solid var(--tech-border-primary);
}

.viewer-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.viewer-tools {
  display: flex;
  gap: 8px;
}

.log-container {
  height: 700px;
  overflow-y: auto;
  padding: 0;
  background: rgba(0, 0, 0, 0.4);
  font-family: 'Courier New', 'Consolas', monospace;
}

.fullscreen .log-container {
  height: calc(100vh - 140px);
}

.log-lines {
  padding: 16px 20px;
}

.log-line {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  transition: all var(--transition-fast);
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  border-left: 3px solid transparent;
  align-items: center;
}

.log-line:hover {
  background: rgba(0, 255, 255, 0.08);
  border-left-color: var(--tech-cyan);
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
}

.log-line.selected {
  background: rgba(0, 255, 255, 0.15) !important;
  border-left-color: var(--tech-cyan);
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
}

.log-line-number {
  color: var(--tech-text-tertiary);
  font-size: 12px;
  white-space: nowrap;
  min-width: 50px;
  text-align: right;
  opacity: 0.6;
}

.log-timestamp {
  color: var(--tech-purple);
  font-size: 12px;
  white-space: nowrap;
  min-width: 120px;
  font-weight: 500;
}

.log-level-tag {
  min-width: 70px;
}

.log-source {
  color: var(--tech-text-tertiary);
  font-size: 12px;
  white-space: nowrap;
  opacity: 0.8;
}

.log-message {
  color: var(--tech-text-primary);
  flex: 1;
  word-break: break-word;
}

:deep(.highlight) {
  background: rgba(245, 158, 11, 0.4);
  color: #fbbf24;
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: 600;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
}

/* 加载和空状态 */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--tech-text-tertiary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--tech-border-subtle);
  border-top-color: var(--tech-cyan);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  box-shadow: var(--glow-cyan);
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* 模态框详情 */
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.detail-item label {
  font-size: 13px;
  font-weight: 600;
  color: var(--tech-cyan);
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.detail-value {
  padding: 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--tech-border-primary);
  border-radius: var(--radius-md);
  color: var(--tech-text-primary);
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
  color: var(--tech-text-secondary);
}

/* 滚动条样式 */
.log-container::-webkit-scrollbar {
  width: 10px;
}

.log-container::-webkit-scrollbar-track {
  background: var(--tech-bg-tertiary);
  border-radius: var(--radius-sm);
}

.log-container::-webkit-scrollbar-thumb {
  background: var(--gradient-cyber-primary);
  border-radius: var(--radius-sm);
  box-shadow: var(--glow-cyan);
}

.log-container::-webkit-scrollbar-thumb:hover {
  background: var(--gradient-cyber-accent);
}

/* 响应式 */
@media (max-width: 1024px) {
  .filters-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .actions-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .logs-pro-page {
    padding: 12px;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .log-container {
    height: 500px;
  }

  .viewer-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .viewer-tools {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .logs-pro-page {
    padding: 8px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .log-container {
    height: 400px;
  }
}

/* 无障碍：禁用动画 */
@media (prefers-reduced-motion: reduce) {
  .loading-spinner,
  .log-line,
  .stat-card {
    animation: none !important;
    transition: none !important;
  }
}
</style>
