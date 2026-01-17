<template>
  <div class="sources-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title gradient-text">数据源管理</h2>
      <p class="page-desc">管理爬虫数据源和监控状态</p>
    </div>

    <!-- 福彩智能自动补全功能状态 -->
    <el-alert
      title="🤖 福彩智能自动补全已启用"
      type="success"
      :closable="false"
      class="backfill-alert"
    >
      <template #default>
        <div class="backfill-info">
          <p class="backfill-desc">当数据不完整时自动从API获取并补全（完整性阈值：90%）</p>
          <div class="backfill-strategy">
            <div class="strategy-item">
              <GlowingTag type="primary" text="🎱 双色球/七乐彩" size="small" effect="dark" />
              <span class="strategy-text">2次查询 - 覆盖率101%+</span>
            </div>
            <div class="strategy-item">
              <GlowingTag type="warning" text="🎲 福彩3D/快乐8" size="small" effect="dark" />
              <span class="strategy-text">4次查询 - 覆盖率99%+</span>
            </div>
          </div>
        </div>
      </template>
    </el-alert>

    <!-- 数据源统计 -->
    <div class="stats-grid">
      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-content">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
            <span>🔌</span>
          </div>
          <el-statistic :value="sourceStats.total" title="总数据源" suffix="个" />
        </div>
      </HolographicCard>

      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-content">
          <div class="stat-icon" style="background: linear-gradient(135deg, #10b981, #38f9d7);">
            <span>✅</span>
          </div>
          <el-statistic :value="sourceStats.online" title="健康数据源" suffix="个" />
        </div>
      </HolographicCard>

      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-content">
          <div class="stat-icon" style="background: linear-gradient(135deg, #3b82f6, #00f2fe);">
            <span>⚡</span>
          </div>
          <div class="stat-info">
            <div class="stat-title">平均响应</div>
            <div class="stat-value">{{ sourceStats.avgResponse }}</div>
          </div>
        </div>
      </HolographicCard>

      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-content">
          <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a, #fee140);">
            <span>📊</span>
          </div>
          <div class="stat-info">
            <div class="stat-title">总成功率</div>
            <div class="stat-value">{{ sourceStats.successRate }}</div>
          </div>
        </div>
      </HolographicCard>
    </div>

    <!-- 数据源列表 -->
    <HolographicCard class="table-card" :border="true">
      <template #header>
        <div class="card-header">
          <h3 class="card-title">官方数据源监控</h3>
          <div class="header-actions">
            <NeonButton type="primary" :loading="checkingAll" @click="checkAllSources">
              <template #icon>
                <span>🔍</span>
              </template>
              {{ checkingAll ? '检查中...' : '全部健康检查' }}
            </NeonButton>
            <NeonButton type="info" @click="checkDataIntegrity">
              <template #icon>
                <span>📊</span>
              </template>
              福彩数据完整性
            </NeonButton>
          </div>
        </div>
      </template>

      <div style="overflow-x: auto;">
        <el-table
          :data="sources"
          v-loading="loading"
          stripe
          border
          style="width: 100%; min-width: 1200px;"
          :empty-text="loading ? '加载中...' : '暂无数据源'"
        >
        <el-table-column prop="name" label="数据源名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="80" align="center" />
        <el-table-column prop="baseUrl" label="URL地址" min-width="350" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <GlowingTag
              :type="getStatusType(row.status)"
              :text="getStatusText(row.status)"
              size="small"
              effect="dark"
              :pulse="row.status === 'checking'"
            />
          </template>
        </el-table-column>
        <el-table-column prop="successRate" label="成功率" width="90" align="center" />
        <el-table-column prop="responseTime" label="响应时间" width="110" align="center" />
        <el-table-column label="最后检查" width="160" align="center">
          <template #default="{ row }">
            <span class="time-text">{{ formatTime(row.lastCheck) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="240" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <NeonButton
                type="primary"
                size="small"
                :loading="row.status === 'checking'"
                @click="checkSource(row.id)"
              >
                检查
              </NeonButton>
              <NeonButton type="info" size="small" @click="editSource(row)">编辑</NeonButton>
              <NeonButton type="danger" size="small" @click="deleteSource(row.id)">删除</NeonButton>
            </div>
          </template>
        </el-table-column>
      </el-table>
      </div>
    </HolographicCard>

    <!-- 编辑数据源对话框 -->
    <CyberDialog
      v-model="showEditDialog"
      title="编辑数据源"
      width="600px"
      :scanline="true"
      :close-on-click-modal="false"
    >
      <el-form :model="editForm" label-width="100px" v-if="editForm">
        <el-form-item label="数据源名称">
          <el-input v-model="editForm.name" placeholder="请输入数据源名称" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="editForm.type" placeholder="请选择类型">
            <el-option label="HTTP" value="HTTP" />
            <el-option label="HTTPS" value="HTTPS" />
          </el-select>
        </el-form-item>
        <el-form-item label="URL地址">
          <el-input v-model="editForm.baseUrl" placeholder="请输入URL地址" />
        </el-form-item>
        <el-form-item label="状态">
          <GlowingTag
            :type="getStatusType(editForm.status)"
            :text="getStatusText(editForm.status)"
            effect="dark"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <NeonButton @click="showEditDialog = false">取消</NeonButton>
        <NeonButton type="primary" @click="saveSource">保存</NeonButton>
      </template>
    </CyberDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'
import api from '../services/api'
import { HolographicCard, NeonButton, GlowingTag, CyberDialog } from '../components/tech'

// 数据源统计
const sourceStats = ref({
  total: 0,
  online: 0,
  offline: 0,
  avgResponse: '-',
  successRate: '0%'
})

// 数据源列表
const sources = ref([])
const loading = ref(false)
const isFirstLoad = ref(true)
const checkingAll = ref(false)

// 编辑对话框
const showEditDialog = ref(false)
const editForm = ref(null)

// 智能更新数据源数据（无感刷新）
const updateSourcesData = (newData) => {
  const newDataMap = new Map(newData.map(item => [item.id, item]))

  // 更新现有数据源
  sources.value.forEach((source) => {
    const newSource = newDataMap.get(source.id)
    if (newSource) {
      Object.keys(newSource).forEach(key => {
        if (source[key] !== newSource[key]) {
          source[key] = newSource[key]
        }
      })
      newDataMap.delete(source.id)
    }
  })

  // 移除已删除的数据源
  sources.value = sources.value.filter(source =>
    newData.some(item => item.id === source.id)
  )

  // 添加新增的数据源
  newDataMap.forEach(newSource => {
    sources.value.push(newSource)
  })
}

// 加载数据源统计
const loadSourceStats = () => {
  const healthySources = sources.value.filter(s =>
    s.status === 'healthy' || s.status === 'online'
  ).length

  const offlineSources = sources.value.filter(s =>
    s.status === 'offline' || s.status === 'error'
  ).length

  // 计算平均响应时间
  const responseTimes = sources.value
    .filter(s =>
      (s.status === 'healthy' || s.status === 'online') &&
      s.responseTime &&
      s.responseTime !== '-' &&
      parseFloat(s.responseTime) > 0
    )
    .map(s => parseFloat(s.responseTime))

  let avgResponse = '-'
  if (responseTimes.length > 0) {
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    avgResponse = `${avg.toFixed(1)}ms`
  }

  // 计算总成功率
  let successRate = '0%'
  const ratesWithData = sources.value.filter(s =>
    s.status !== 'pending' &&
    s.successRate &&
    s.successRate !== '-' &&
    parseFloat(s.successRate) > 0
  )
  if (ratesWithData.length > 0) {
    const rates = ratesWithData.map(s => parseFloat(s.successRate))
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length
    successRate = `${avgRate.toFixed(1)}%`
  }

  sourceStats.value = {
    total: sources.value.length,
    online: healthySources,
    offline: offlineSources,
    avgResponse,
    successRate
  }
}

// 加载数据源列表
const loadSources = async () => {
  try {
    if (isFirstLoad.value) {
      loading.value = true
    }

    const response = await api.getSources()

    if (response.success) {
      const newData = response.data

      if (isFirstLoad.value) {
        sources.value = newData
        isFirstLoad.value = false
      } else {
        updateSourcesData(newData)
      }
    }
  } catch (error) {
    console.error('加载数据源列表失败:', error)
    ElMessage.error('加载数据源列表失败')

    // 使用模拟数据
    sources.value = [
      {
        id: 1,
        name: '官方数据源 1',
        type: 'HTTP',
        url: 'https://api.lottery-official.com/data',
        status: 'online',
        successRate: '98.5%',
        responseTime: '125ms',
        lastCheck: new Date(Date.now() - 1000 * 60 * 5)
      },
      {
        id: 2,
        name: '备用数据源 A',
        type: 'HTTPS',
        url: 'https://backup-a.lottery.com/v1/results',
        status: 'online',
        successRate: '95.2%',
        responseTime: '230ms',
        lastCheck: new Date(Date.now() - 1000 * 60 * 10)
      },
      {
        id: 3,
        name: '第三方数据源',
        type: 'HTTP',
        url: 'http://third-party.lottery.net/api/data',
        status: 'warning',
        successRate: '87.5%',
        responseTime: '450ms',
        lastCheck: new Date(Date.now() - 1000 * 60 * 15)
      },
      {
        id: 4,
        name: '备用数据源 B',
        type: 'HTTPS',
        url: 'https://backup-b.lottery.org/results',
        status: 'offline',
        successRate: '0%',
        responseTime: '-',
        lastCheck: new Date(Date.now() - 1000 * 60 * 60 * 2)
      },
      {
        id: 5,
        name: '官方数据源 2',
        type: 'HTTP',
        url: 'https://api2.lottery-official.com/v2/data',
        status: 'online',
        successRate: '99.1%',
        responseTime: '98ms',
        lastCheck: new Date(Date.now() - 1000 * 60 * 3)
      },
      {
        id: 6,
        name: '镜像数据源',
        type: 'HTTPS',
        url: 'https://mirror.lottery.cn/api/results',
        status: 'error',
        successRate: '45.3%',
        responseTime: '1200ms',
        lastCheck: new Date(Date.now() - 1000 * 60 * 30)
      }
    ]
  } finally {
    loading.value = false
    loadSourceStats()
  }
}

// 检查单个数据源
const checkSource = async (id) => {
  try {
    const source = sources.value.find(s => s.id === id)
    if (source) {
      source.status = 'checking'
    }

    const response = await api.checkSource(id)

    // 等待后端更新完成后重新加载数据（跳过缓存）
    setTimeout(async () => {
      // 直接调用 axios，跳过缓存
      const freshResponse = await axios.get('/api/sources')
      if (freshResponse.data.success) {
        sources.value = freshResponse.data.data
        loadSourceStats()
      }
      ElMessage.success(response.data?.message || '数据源健康检查完成')
    }, 1500)
  } catch (error) {
    console.error('检查数据源失败:', error)
    ElMessage.error('检查数据源失败: ' + (error.response?.data?.error || error.message))

    const source = sources.value.find(s => s.id === id)
    if (source) {
      source.status = 'error'
    }
  }
}

// 检查所有数据源
const checkAllSources = async () => {
  try {
    checkingAll.value = true

    await api.checkAllSources()

    setTimeout(async () => {
      await loadSources()
      checkingAll.value = false
      ElMessage.success('所有数据源健康检查完成')
    }, 1000)
  } catch (error) {
    console.error('批量检查失败:', error)
    ElMessage.error('批量检查失败')
    checkingAll.value = false
  }
}

// 编辑数据源
const editSource = (source) => {
  editForm.value = { ...source }
  showEditDialog.value = true
}

// 保存数据源
const saveSource = () => {
  const source = sources.value.find(s => s.id === editForm.value.id)
  if (source) {
    Object.assign(source, editForm.value)
    ElMessage.success('数据源已更新')
  }
  showEditDialog.value = false
  editForm.value = null
}

// 删除数据源
const deleteSource = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这个数据源吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    sources.value = sources.value.filter(s => s.id !== id)
    loadSourceStats()
    ElMessage.success('数据源已删除')
  } catch (error) {
    // 用户取消
  }
}

// 检查福彩数据完整性
const checkDataIntegrity = () => {
  ElMessage.info('福彩数据完整性检查功能开发中')
}

// 获取状态类型
const getStatusType = (status) => {
  const typeMap = {
    online: 'success',
    healthy: 'success',
    warning: 'warning',
    offline: 'danger',
    error: 'danger',
    checking: 'info',
    pending: 'info'
  }
  return typeMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status) => {
  const textMap = {
    online: '在线',
    healthy: '健康',
    warning: '警告',
    offline: '离线',
    error: '错误',
    checking: '检查中',
    pending: '待检查'
  }
  return textMap[status] || '未知'
}

// 格式化时间
const formatTime = (date) => {
  if (!date) return '-'
  const d = new Date(date)
  const now = new Date()
  const diff = now - d

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 自动刷新定时器
let refreshTimer = null

// 启动自动刷新
const startAutoRefresh = () => {
  refreshTimer = setInterval(() => {
    loadSources()
  }, 15000) // 15秒
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// 初始化
onMounted(async () => {
  await loadSources()

  const hasPending = sources.value.some(s => s.status === 'pending')
  if (hasPending) {
    checkAllSources()
  }

  startAutoRefresh()
})

// 清理
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
/* 页面布局 */
.sources-page {
  padding: 20px;
  width: 100%;
  background: var(--tech-bg-primary);
  min-height: 100vh;
  transition: background 0.3s ease;
}

/* 页面头部 */
.page-header {
  margin-bottom: 20px;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 700;
}

.gradient-text {
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.page-desc {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 14px;
}

/* 福彩补全提示 */
.backfill-alert {
  margin-bottom: 20px;
}

.backfill-alert :deep(.el-alert__content) {
  width: 100%;
}

.backfill-info {
  margin-top: 10px;
}

.backfill-desc {
  margin: 0 0 12px 0;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
}

.backfill-strategy {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.strategy-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.strategy-text {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 统计卡片网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

/* 玻璃卡片效果（保留旧类名） */
.glass-card {
  background: var(--tech-bg-secondary) !important;
  backdrop-filter: blur(20px);
  border: 2px solid;
  border-image: var(--gradient-cyber-accent) 1;
  border-radius: 16px;
  box-shadow: var(--glow-cyan);
}

.glass-card :deep(.el-card__body) {
  padding: 20px;
}

.stat-card .stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
}

.stat-title {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

:deep(.el-statistic__head) {
  color: var(--text-secondary);
  font-size: 13px;
  margin-bottom: 6px;
}

:deep(.el-statistic__content) {
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 700;
}

/* 表格卡片 */
.table-card :deep(.el-card__header) {
  background: rgba(102, 126, 234, 0.15);
  border-bottom: 1px solid var(--border-color);
  padding: 16px 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.header-actions {
  display: flex;
  gap: 10px;
}

/* Element Plus 表格样式 */
:deep(.el-table) {
  background: transparent !important;
  color: var(--text-primary);
}

:deep(.el-table tr) {
  background: transparent !important;
}

:deep(.el-table th.el-table__cell) {
  background: rgba(102, 126, 234, 0.2) !important;
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.1);
  font-weight: 600;
}

:deep(.el-table td.el-table__cell) {
  border-color: rgba(255, 255, 255, 0.1);
}

:deep(.el-table__body tr:hover > td) {
  background-color: rgba(102, 126, 234, 0.15) !important;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: var(--table-stripe-bg) !important;
}

:deep(.el-table__empty-text) {
  color: var(--text-muted);
}

.time-text {
  font-family: 'Courier New', monospace;
  color: var(--text-secondary);
  font-size: 12px;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
}

/* 对话框样式 */
:deep(.el-dialog) {
  background: var(--bg-elevated);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid var(--border-color);
}

:deep(.el-dialog__title) {
  color: var(--text-primary);
}

:deep(.el-form-item__label) {
  color: var(--text-secondary);
}

:deep(.el-input__wrapper) {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: none;
}

:deep(.el-input__wrapper:hover),
:deep(.el-input__wrapper.is-focus) {
  background: var(--glass-bg-hover);
  border-color: #667eea;
  box-shadow: 0 0 0 1px #667eea inset;
}

:deep(.el-input__inner) {
  color: var(--text-primary);
}

/* 响应式 */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

@media (max-width: 768px) {
  .sources-page {
    padding: 12px;
  }

  .page-title {
    font-size: 22px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    flex-direction: column;
  }

  .header-actions .el-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .sources-page {
    padding: 10px;
  }

  .page-title {
    font-size: 20px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .backfill-strategy {
    flex-direction: column;
    gap: 8px;
  }
}
/* Element Plus 组件文本颜色覆盖 */
:deep(.el-select-dropdown__item) {
  color: var(--text-primary) !important;
}

:deep(.el-select-dropdown__item:hover) {
  background-color: var(--glass-bg-hover);
}

:deep(.el-select-dropdown__item.is-selected) {
  color: var(--primary-color) !important;
}

:deep(.el-picker-panel__content) {
  color: var(--text-primary);
}

:deep(.el-date-picker__header-label) {
  color: var(--text-primary);
}

:deep(.el-picker-panel__icon-btn) {
  color: var(--text-primary);
}

:deep(.el-date-table td.available:hover) {
  color: var(--primary-color);
}

:deep(.el-date-table td.current:not(.disabled)) {
  color: var(--primary-color);
}

</style>

<style>
/* 全局样式 - 修复对话框居中问题 */

/* 移除导致居中失败的中间层 */
.el-overlay-dialog {
  display: contents !important;
}

/* 编辑数据源对话框 - 使用更强的选择器 */
.el-dialog[class*="source-edit-dialog"],
div.source-edit-dialog.el-dialog,
.source-edit-dialog {
  max-width: 600px !important;
  width: 600px !important;
  min-width: 600px !important;
  margin-top: 20vh !important;
  box-sizing: border-box !important;
}

.el-dialog.source-edit-dialog .el-dialog__body {
  max-height: 70vh;
  overflow-y: auto;
}

/* 修复状态标签颜色 - 强制使用深色效果 */
.el-tag.el-tag--success {
  --el-tag-bg-color: var(--el-color-success) !important;
  --el-tag-text-color: #ffffff !important;
  background-color: var(--el-color-success) !important;
  color: #ffffff !important;
}

.el-tag.el-tag--danger {
  --el-tag-bg-color: var(--el-color-danger) !important;
  --el-tag-text-color: #ffffff !important;
  background-color: var(--el-color-danger) !important;
  color: #ffffff !important;
}

.el-tag.el-tag--warning {
  --el-tag-bg-color: var(--el-color-warning) !important;
  --el-tag-text-color: #ffffff !important;
  background-color: var(--el-color-warning) !important;
  color: #ffffff !important;
}

.el-tag.el-tag--info {
  --el-tag-bg-color: var(--el-color-info) !important;
  --el-tag-text-color: #ffffff !important;
  background-color: var(--el-color-info) !important;
  color: #ffffff !important;
}
</style>
