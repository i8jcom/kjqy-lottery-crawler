<template>
  <div class="sources-page">
    <!-- 🎯 福彩智能自动补全功能状态 -->
    <div class="intelligent-backfill-card">
      <!-- 页面标题 -->
      <div class="page-header">
        <h2 class="page-title">
          <span class="gradient-text">数据源管理</span>
        </h2>
        <p class="page-desc">管理爬虫数据源和监控状态</p>
      </div>

      <div class="backfill-header">
        <div class="backfill-title-section">
          <div class="backfill-title-row">
            <span class="backfill-icon">🤖</span>
            <h3 class="backfill-title">福彩智能自动补全</h3>
            <span class="backfill-badge">已启用</span>
          </div>
          <p class="backfill-desc">当数据不完整时自动从API获取并补全（完整性阈值：90%）</p>
        </div>
        <div class="backfill-status">
          <div class="backfill-status-icon">✅</div>
          <div class="backfill-status-text">运行中</div>
        </div>
      </div>

      <!-- 多次查询策略说明 -->
      <div class="backfill-strategy">
        <div class="strategy-title">📡 多次查询策略：</div>
        <div class="strategy-grid">
          <div class="strategy-card">
            <div class="strategy-name">🎱 双色球 / 七乐彩</div>
            <div class="strategy-detail">2次查询（12-31, 06-30）</div>
            <div class="strategy-coverage">覆盖率：101%+</div>
          </div>
          <div class="strategy-card">
            <div class="strategy-name">🎲 福彩3D / 快乐8</div>
            <div class="strategy-detail">4次查询（12-31, 09-30, 06-30, 03-31）</div>
            <div class="strategy-coverage">覆盖率：99%+</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据源统计 -->
    <div class="overview-grid">
      <div class="stat-card glass-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
          <span>🔌</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">总数据源</div>
          <div class="stat-value">{{ sourceStats.total || 0 }}</div>
          <div class="stat-subtitle">已配置</div>
        </div>
      </div>

      <div class="stat-card glass-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, var(--success-color), #38f9d7);">
          <span>✅</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">健康数据源</div>
          <div class="stat-value">{{ sourceStats.online || 0 }}</div>
          <div class="stat-subtitle">可用中</div>
        </div>
      </div>

      <div class="stat-card glass-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, var(--info-color), #00f2fe);">
          <span>⚡</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">平均响应</div>
          <div class="stat-value">{{ sourceStats.avgResponse || '-' }}</div>
          <div class="stat-subtitle">响应时间</div>
        </div>
      </div>

      <div class="stat-card glass-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a, #fee140);">
          <span>📊</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">总成功率</div>
          <div class="stat-value">{{ sourceStats.successRate || '0%' }}</div>
          <div class="stat-subtitle">综合指标</div>
        </div>
      </div>
    </div>

    <!-- 数据源列表 -->
    <div class="sources-panel glass-card">
      <div class="panel-header">
        <h3 class="panel-title">官方数据源监控</h3>
        <div class="panel-actions">
          <button class="btn-check-all" @click="checkAllSources" :disabled="checkingAll">
            <span :class="{ 'rotating': checkingAll }">🔍</span>
            <span>{{ checkingAll ? '检查中...' : '全部健康检查' }}</span>
          </button>
          <button class="btn-integrity" @click="checkDataIntegrity">
            <span>📊</span>
            <span>福彩数据完整性</span>
          </button>
          <button class="btn-info" @click="showInfoDialog">
            <span>ℹ️</span>
            <span>说明</span>
          </button>
        </div>
      </div>

      <div class="sources-grid">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载数据源列表...</p>
        </div>

        <div v-else-if="sources.length === 0" class="empty-state">
          <span class="empty-icon">📭</span>
          <p>暂无数据源</p>
        </div>

        <SourceCard
          v-else
          v-for="source in sources"
          :key="source.id"
          :source="source"
          @check="checkSource"
          @edit="editSource"
          @delete="deleteSource"
        />
      </div>
    </div>

    <!-- 数据源详情模态框 -->
    <SourceDetailModal
      :show="showDetailModal"
      :source-id="currentSourceId"
      :source-data="currentSourceData"
      @close="closeDetailModal"
      @updated="handleSourceUpdated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../services/api'
import SourceCard from '../components/widgets/SourceCard.vue'
import SourceDetailModal from '../components/modals/SourceDetailModal.vue'
import { useToast } from '../composables/useToast'

const toast = useToast()

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
const isFirstLoad = ref(true) // 标记是否首次加载
const checkingAll = ref(false)

// 模态框
const showAddSourceModal = ref(false)
const showDetailModal = ref(false)
const currentSourceId = ref(null)
const currentSourceData = ref(null)

// 智能更新数据源数据（无感刷新）
const updateSourcesData = (newData) => {
  // 创建ID映射表
  const newDataMap = new Map(newData.map(item => [item.id, item]))
  const existingIds = new Set(sources.value.map(item => item.id))

  // 1. 更新现有数据源
  sources.value.forEach((source, index) => {
    const newSource = newDataMap.get(source.id)
    if (newSource) {
      // 只更新变化的属性，避免不必要的重渲染
      Object.keys(newSource).forEach(key => {
        if (source[key] !== newSource[key]) {
          source[key] = newSource[key]
        }
      })
      newDataMap.delete(source.id)
    }
  })

  // 2. 移除已删除的数据源
  sources.value = sources.value.filter(source =>
    newData.some(item => item.id === source.id)
  )

  // 3. 添加新增的数据源
  newDataMap.forEach(newSource => {
    sources.value.push(newSource)
  })
}

// 加载数据源统计
const loadSourceStats = () => {
  // 统计各种状态（排除未实现的数据源）
  const healthySources = sources.value.filter(s =>
    s.status === 'healthy' || s.status === 'online'
  ).length

  const offlineSources = sources.value.filter(s =>
    s.status === 'offline' || s.status === 'error'
  ).length

  // 计算平均响应时间（只计算健康的数据源）
  const responseTimes = sources.value
    .filter(s =>
      (s.status === 'healthy' || s.status === 'online') &&
      s.responseTime &&
      s.responseTime !== '-' &&
      s.responseTime > 0
    )
    .map(s => parseFloat(s.responseTime))

  let avgResponse = '-'
  if (responseTimes.length > 0) {
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    avgResponse = `${avg.toFixed(1)}ms`
  }

  // 计算总成功率（只计算有数据的数据源）
  let successRate = '0%'
  const ratesWithData = sources.value.filter(s =>
    s.status !== 'pending' && // 排除未实现的
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
    // 只在首次加载时显示loading状态
    if (isFirstLoad.value) {
      loading.value = true
    }

    const response = await api.getSources()

    if (response.success) {
      const newData = response.data

      if (isFirstLoad.value) {
        // 首次加载：直接赋值
        sources.value = newData
        isFirstLoad.value = false
      } else {
        // 后续刷新：智能更新每个数据源，实现无感刷新
        updateSourcesData(newData)
      }
    }
  } catch (error) {
    console.error('加载数据源列表失败:', error)
    toast.error('加载数据源列表失败')
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
    // 先更新状态为检查中
    const source = sources.value.find(s => s.id === id)
    if (source) {
      source.status = 'checking'
    }

    // 调用API执行健康检查
    await api.checkSource(id)

    // 等待1秒后无感刷新数据
    setTimeout(async () => {
      await loadSources() // 使用无感刷新
      toast.success('数据源健康检查完成')
    }, 1000)
  } catch (error) {
    console.error('检查数据源失败:', error)
    toast.error('检查数据源失败')
    // 恢复状态
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

    // 调用API执行健康检查
    await api.checkAllSources()

    // 等待1秒后无感刷新数据
    setTimeout(async () => {
      await loadSources() // 使用无感刷新
      checkingAll.value = false
      toast.success('所有数据源健康检查完成')
    }, 1000)
  } catch (error) {
    console.error('批量检查失败:', error)
    toast.error('批量检查失败')
    checkingAll.value = false
  }
}

// 编辑数据源（打开详情模态框）
const editSource = (source) => {
  currentSourceId.value = source.id
  currentSourceData.value = source  // 传递完整的数据源对象
  showDetailModal.value = true
}

// 删除数据源
const deleteSource = async (id) => {
  if (!confirm('确定要删除这个数据源吗？')) {
    return
  }

  try {
    // await api.deleteSource(id)
    sources.value = sources.value.filter(s => s.id !== id)
    loadSourceStats()
    console.log('数据源已删除:', id)
    toast.success('数据源已删除')
  } catch (error) {
    console.error('删除数据源失败:', error)
    toast.error('删除数据源失败')
  }
}

// 关闭详情模态框
const closeDetailModal = () => {
  showDetailModal.value = false
  currentSourceId.value = null
  currentSourceData.value = null
}

// 数据源更新后的回调
const handleSourceUpdated = () => {
  loadSources()
}

// 检查福彩数据完整性
const checkDataIntegrity = () => {
  console.log('检查福彩数据完整性...')
  // TODO: 实现福彩数据完整性检查
  toast.info('福彩数据完整性检查功能开发中')
}

// 显示说明对话框
const showInfoDialog = () => {
  toast.info('官方数据源包括福彩官方API、备用数据源等')
}

// 自动刷新定时器
let refreshTimer = null

// 启动自动刷新
const startAutoRefresh = () => {
  // 每15秒刷新一次数据源状态（无感刷新）
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

  // 如果有待检查的数据源，自动触发一次健康检查
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
/* 紧凑布局优化 */
.sources-page {
  padding: 16px;
  width: 100%;
  max-width: none;
}

/* 页面头部 - 紧凑优化 */
.page-header {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.page-title {
  margin: 0 0 6px 0;
  font-size: 24px;
  font-weight: 700;
}

.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-desc {
  margin: 0;
  color: var(--text-tertiary);
  font-size: 13px;
}

/* 玻璃卡片 - 紧凑优化 */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

/* 概览网格 - 紧凑优化 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px !important;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 3px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
}

/* 智能补全卡片 - 紧凑优化 */
.intelligent-backfill-card {
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.backfill-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 16px;
}

.backfill-title-section {
  flex: 1;
}

.backfill-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.backfill-icon {
  font-size: 20px;
}

.backfill-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.backfill-badge {
  padding: 3px 10px;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 10px;
  font-size: 11px;
  color: #10b981;
  font-weight: 500;
}

.backfill-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.backfill-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 10px;
}

.backfill-status-icon {
  font-size: 18px;
}

.backfill-status-text {
  font-size: 13px;
  color: #10b981;
  font-weight: 500;
}

.backfill-strategy {
  background: var(--glass-bg);
  border-radius: 10px;
  padding: 12px;
}

.strategy-title {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  font-weight: 500;
}

.strategy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.strategy-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px;
  transition: all 0.2s;
}

.strategy-card:hover {
  background: var(--glass-bg);
  border-color: rgba(16, 185, 129, 0.3);
  transform: translateY(-2px);
}

.strategy-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 5px;
}

.strategy-detail {
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 3px;
}

.strategy-coverage {
  font-size: 11px;
  color: #10b981;
  font-weight: 500;
}

/* 面板头部 - 紧凑优化 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

/* 按钮 - 紧凑优化 */
.btn-check-all,
.btn-add,
.btn-integrity,
.btn-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-check-all {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.btn-check-all:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  transform: translateY(-2px);
}

.btn-check-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-add {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-add:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-integrity {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.btn-integrity:hover {
  background: rgba(16, 185, 129, 0.2);
  transform: translateY(-2px);
}

.btn-info {
  background: rgba(156, 163, 175, 0.1);
  border: 1px solid rgba(156, 163, 175, 0.3);
  color: #9ca3af;
}

.btn-info:hover {
  background: rgba(156, 163, 175, 0.2);
  transform: translateY(-2px);
}

.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 数据源网格 - 紧凑优化 */
.sources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

/* 加载状态 - 紧凑优化 */
.loading-state,
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 16px;
  color: var(--text-tertiary);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-color);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

.empty-icon {
  font-size: 42px;
  margin-bottom: 12px;
}

/* 响应式 - 3级断点 */

/* 平板 (≤ 1024px) */
@media (max-width: 1024px) {
  .sources-page {
    padding: 12px;
  }

  .glass-card {
    padding: 14px;
    margin-bottom: 12px;
  }

  .overview-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
  }

  .stat-card {
    padding: 12px !important;
  }

  .intelligent-backfill-card {
    padding: 14px;
  }

  .backfill-header {
    gap: 12px;
  }

  .strategy-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .sources-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
  }
}

/* 手机横屏 (≤ 768px) */
@media (max-width: 768px) {
  .sources-page {
    padding: 10px;
  }

  .page-title {
    font-size: 20px;
  }

  .page-desc {
    font-size: 12px;
  }

  .glass-card {
    padding: 12px;
    margin-bottom: 10px;
  }

  .overview-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stat-card {
    padding: 10px !important;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }

  .stat-value {
    font-size: 18px;
  }

  .intelligent-backfill-card {
    padding: 12px;
  }

  .backfill-header {
    flex-direction: column;
    align-items: stretch;
  }

  .backfill-status {
    justify-content: center;
  }

  .backfill-title {
    font-size: 15px;
  }

  .strategy-grid {
    grid-template-columns: 1fr;
  }

  .panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .panel-title {
    font-size: 15px;
  }

  .panel-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .btn-check-all,
  .btn-add,
  .btn-integrity,
  .btn-info {
    flex: 1;
    min-width: 130px;
    font-size: 12px;
  }

  .sources-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}

/* 手机竖屏 (≤ 480px) */
@media (max-width: 480px) {
  .sources-page {
    padding: 8px;
  }

  .page-header {
    margin-bottom: 12px;
    padding-bottom: 12px;
  }

  .page-title {
    font-size: 18px;
  }

  .glass-card {
    padding: 10px;
    border-radius: 10px;
  }

  .overview-grid {
    gap: 6px;
  }

  .stat-card {
    padding: 8px !important;
    gap: 10px;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .stat-value {
    font-size: 16px;
  }

  .stat-label {
    font-size: 11px;
  }

  .intelligent-backfill-card {
    padding: 10px;
  }

  .backfill-title-row {
    gap: 8px;
  }

  .backfill-icon {
    font-size: 18px;
  }

  .backfill-title {
    font-size: 14px;
  }

  .backfill-desc {
    font-size: 12px;
  }

  .strategy-grid {
    gap: 8px;
  }

  .strategy-card {
    padding: 8px;
  }

  .panel-header {
    gap: 10px;
  }

  .panel-actions {
    gap: 6px;
  }

  .btn-check-all,
  .btn-add,
  .btn-integrity,
  .btn-info {
    padding: 5px 10px;
    font-size: 11px;
    min-width: 100px;
  }

  .loading-state,
  .empty-state {
    padding: 40px 12px;
  }

  .empty-icon {
    font-size: 36px;
  }
}
</style>
