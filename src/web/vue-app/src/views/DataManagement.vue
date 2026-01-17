<template>
  <div class="data-management-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <span class="gradient-text">数据管理</span>
      </h2>
      <p class="page-desc">检测缺失数据、批量补填、数据导出</p>
    </div>

    <!-- 功能卡片网格 -->
    <div class="cards-grid">
      <!-- 缺失数据检测卡片 -->
      <div class="function-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">🔍</span>
            <span>缺失数据检测</span>
          </h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label>彩种</label>
            <select v-model="checkParams.lottery" class="form-select">
              <option value="">选择彩种</option>
              <option v-for="lottery in lotteries" :key="lottery.code" :value="lottery.code">
                {{ lottery.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>日期范围</label>
            <div class="date-range">
              <input type="date" v-model="checkParams.startDate" class="form-input" />
              <span>至</span>
              <input type="date" v-model="checkParams.endDate" class="form-input" />
            </div>
          </div>
          <button class="btn-primary" :disabled="checking" @click="handleCheckMissing">
            <span v-if="checking">检测中...</span>
            <span v-else>开始检测</span>
          </button>

          <!-- 检测结果 -->
          <div v-if="missingData.length > 0" class="result-panel">
            <div class="result-header">
              <span>检测到 <strong>{{ missingData.length }}</strong> 条缺失数据</span>
            </div>
            <div class="missing-list">
              <div v-for="(item, idx) in missingData.slice(0, 5)" :key="idx" class="missing-item">
                <span class="missing-date">{{ item.date }}</span>
                <span class="missing-lottery">{{ item.lotteryName }}</span>
                <span class="missing-count">{{ item.count }} 期</span>
              </div>
              <div v-if="missingData.length > 5" class="more-text">
                还有 {{ missingData.length - 5 }} 条...
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 数据补填卡片 -->
      <div class="function-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">📥</span>
            <span>数据补填</span>
          </h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label>彩种</label>
            <select v-model="fillParams.lottery" class="form-select">
              <option value="">选择彩种</option>
              <option v-for="lottery in lotteries" :key="lottery.code" :value="lottery.code">
                {{ lottery.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>补填日期</label>
            <input type="date" v-model="fillParams.date" class="form-input" />
          </div>
          <button class="btn-primary" :disabled="filling" @click="handleFillMissing">
            <span v-if="filling">补填中...</span>
            <span v-else>开始补填</span>
          </button>

          <!-- 补填进度 -->
          <div v-if="fillProgress.total > 0" class="progress-panel">
            <div class="progress-info">
              <span>进度: {{ fillProgress.current }} / {{ fillProgress.total }}</span>
              <span>{{ fillProgress.percentage }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: fillProgress.percentage + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 数据导出卡片 -->
      <div class="function-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">📤</span>
            <span>数据导出</span>
          </h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label>彩种</label>
            <select v-model="exportParams.lottery" class="form-select">
              <option value="">全部彩种</option>
              <option v-for="lottery in lotteries" :key="lottery.code" :value="lottery.code">
                {{ lottery.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>日期范围</label>
            <div class="date-range">
              <input type="date" v-model="exportParams.startDate" class="form-input" />
              <span>至</span>
              <input type="date" v-model="exportParams.endDate" class="form-input" />
            </div>
          </div>
          <div class="form-group">
            <label>导出格式</label>
            <select v-model="exportParams.format" class="form-select">
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="excel">Excel</option>
            </select>
          </div>
          <button class="btn-primary" :disabled="exporting" @click="handleExport">
            <span v-if="exporting">导出中...</span>
            <span v-else>导出数据</span>
          </button>
        </div>
      </div>

      <!-- 数据统计卡片 -->
      <div class="function-card glass-card">
        <div class="card-header">
          <h3 class="card-title">
            <span class="card-icon">📊</span>
            <span>数据统计</span>
          </h3>
        </div>
        <div class="card-body">
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ stats.totalRecords }}</div>
              <div class="stat-label">总记录数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ stats.todayRecords }}</div>
              <div class="stat-label">今日新增</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ stats.lotteryCount }}</div>
              <div class="stat-label">彩种数量</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ stats.completeness }}%</div>
              <div class="stat-label">数据完整度</div>
            </div>
          </div>
          <button class="btn-secondary" @click="loadStats">
            <span>🔄</span>
            <span>刷新统计</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'
import { useToast } from '../composables/useToast'

const toast = useToast()

// 彩种列表
const lotteries = ref([])

// 检测缺失数据
const checkParams = ref({
  lottery: '',
  startDate: '',
  endDate: ''
})
const checking = ref(false)
const missingData = ref([])

// 数据补填
const fillParams = ref({
  lottery: '',
  date: ''
})
const filling = ref(false)
const fillProgress = ref({
  current: 0,
  total: 0,
  percentage: 0
})

// 数据导出
const exportParams = ref({
  lottery: '',
  startDate: '',
  endDate: '',
  format: 'csv'
})
const exporting = ref(false)

// 数据统计
const stats = ref({
  totalRecords: 0,
  todayRecords: 0,
  lotteryCount: 0,
  completeness: 0
})

// 加载彩种列表
const loadLotteries = async () => {
  try {
    const response = await api.getLotteryConfigs()
    if (response.success) {
      lotteries.value = response.data || []
    }
  } catch (error) {
    toast.error('加载彩种列表失败')
    console.error('加载彩种列表失败:', error)
  }
}

// 加载统计数据
const loadStats = async () => {
  try {
    const response = await api.getStatus()
    if (response.success && response.data) {
      stats.value = {
        totalRecords: response.data.database?.totalRecords || 0,
        todayRecords: 0, // 后端暂无提供
        lotteryCount: response.data.lotteries?.total || 0,
        completeness: 95 // 模拟数据
      }
    }
  } catch (error) {
    toast.error('加载统计数据失败')
    console.error('加载统计数据失败:', error)
  }
}

// 检测缺失数据
const handleCheckMissing = async () => {
  if (!checkParams.value.lottery || !checkParams.value.startDate || !checkParams.value.endDate) {
    toast.warning('请选择彩种和日期范围')
    return
  }

  try {
    checking.value = true
    const response = await api.checkMissingData(checkParams.value)

    if (response.success) {
      missingData.value = response.data || []
      const count = missingData.value.length
      if (count > 0) {
        toast.success(`检测完成，发现 ${count} 条缺失数据`)
      } else {
        toast.info('未发现缺失数据')
      }
    }
  } catch (error) {
    toast.error('检测缺失数据失败')
    console.error('❌ 检测缺失数据失败:', error)
    missingData.value = []
  } finally {
    checking.value = false
  }
}

// 数据补填
const handleFillMissing = async () => {
  if (!fillParams.value.lottery || !fillParams.value.date) {
    toast.warning('请选择彩种和补填日期')
    return
  }

  try {
    filling.value = true
    fillProgress.value = { current: 0, total: 100, percentage: 0 }

    const response = await api.fillMissingData(fillParams.value)

    if (response.success) {
      toast.success('数据补填成功')
      fillProgress.value = { current: 100, total: 100, percentage: 100 }

      // 3秒后重置进度
      setTimeout(() => {
        fillProgress.value = { current: 0, total: 0, percentage: 0 }
      }, 3000)
    }
  } catch (error) {
    toast.error('数据补填失败')
    console.error('❌ 数据补填失败:', error)
  } finally {
    filling.value = false
  }
}

// 数据导出
const handleExport = async () => {
  if (!exportParams.value.startDate || !exportParams.value.endDate) {
    toast.warning('请选择日期范围')
    return
  }

  try {
    exporting.value = true
    const response = await api.exportData(exportParams.value)

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url
    link.download = `data_export_${new Date().getTime()}.${exportParams.value.format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    toast.success('数据导出成功')
  } catch (error) {
    toast.error('数据导出失败')
    console.error('❌ 数据导出失败:', error)
  } finally {
    exporting.value = false
  }
}

// 初始化
onMounted(() => {
  // 设置默认日期
  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)

  checkParams.value.endDate = today.toISOString().split('T')[0]
  checkParams.value.startDate = sevenDaysAgo.toISOString().split('T')[0]

  exportParams.value.endDate = today.toISOString().split('T')[0]
  exportParams.value.startDate = sevenDaysAgo.toISOString().split('T')[0]

  fillParams.value.date = today.toISOString().split('T')[0]

  // 加载数据
  loadLotteries()
  loadStats()
})
</script>

<style scoped>
.data-management-page {
  padding: 16px;
  width: 100%;
  max-width: none;
}

/* 页面头部 */
.page-header {
  margin-bottom: 16px;
}

.page-title {
  margin: 0 0 6px 0;
  font-size: 24px;
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

/* 卡片网格 */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

/* 功能卡片 */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.card-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--glass-bg);
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.card-icon {
  font-size: 18px;
}

.card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 表单 - 紧凑优化 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
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
  border-radius: 8px;
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

.date-range {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-range span {
  color: var(--text-tertiary);
  font-size: 13px;
}

/* 按钮 - 紧凑优化 */
.btn-primary,
.btn-secondary {
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--glass-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--border-color);
}

/* 检测结果面板 - 紧凑优化 */
.result-panel {
  padding: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.result-header {
  margin-bottom: 10px;
  color: var(--text-secondary);
  font-size: 12px;
}

.result-header strong {
  color: var(--warning-color);
  font-weight: 600;
}

.missing-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.missing-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--glass-bg);
  border-radius: 6px;
  font-size: 12px;
}

.missing-date {
  color: var(--text-secondary);
}

.missing-lottery {
  color: var(--text-primary);
  font-weight: 500;
}

.missing-count {
  color: var(--warning-color);
  font-weight: 600;
}

.more-text {
  text-align: center;
  color: var(--text-tertiary);
  font-size: 12px;
  padding: 6px 0;
}

/* 进度面板 - 紧凑优化 */
.progress-panel {
  padding: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.progress-bar {
  height: 6px;
  background: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

/* 统计网格 - 紧凑优化 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.stat-item {
  padding: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 3px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
}

/* 响应式 - 3级断点 */

/* 平板 (≤ 1024px) */
@media (max-width: 1024px) {
  .data-management-page {
    padding: 12px;
  }

  .cards-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
  }

  .card-header {
    padding: 12px 14px;
  }

  .card-body {
    padding: 14px;
  }

  .stats-grid {
    gap: 8px;
  }

  .stat-item {
    padding: 10px;
  }
}

/* 手机横屏 (≤ 768px) */
@media (max-width: 768px) {
  .data-management-page {
    padding: 10px;
  }

  .page-title {
    font-size: 20px;
  }

  .page-desc {
    font-size: 12px;
  }

  .cards-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .card-header {
    padding: 10px 12px;
  }

  .card-title {
    font-size: 15px;
  }

  .card-icon {
    font-size: 16px;
  }

  .card-body {
    padding: 12px;
    gap: 10px;
  }

  .form-group label {
    font-size: 11px;
  }

  .form-select,
  .form-input {
    height: 34px;
    font-size: 12px;
  }

  .btn-primary,
  .btn-secondary {
    height: 34px;
    padding: 0 14px;
    font-size: 12px;
  }

  .date-range {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .stats-grid {
    gap: 6px;
  }

  .stat-value {
    font-size: 18px;
  }

  .stat-label {
    font-size: 10px;
  }
}

/* 手机竖屏 (≤ 480px) */
@media (max-width: 480px) {
  .data-management-page {
    padding: 8px;
  }

  .page-title {
    font-size: 18px;
  }

  .cards-grid {
    gap: 8px;
  }

  .card-header {
    padding: 10px;
  }

  .card-title {
    font-size: 14px;
    gap: 6px;
  }

  .card-icon {
    font-size: 15px;
  }

  .card-body {
    padding: 10px;
    gap: 8px;
  }

  .form-group {
    gap: 4px;
  }

  .form-select,
  .form-input {
    height: 32px;
    padding: 0 8px;
  }

  .btn-primary,
  .btn-secondary {
    height: 32px;
    padding: 0 12px;
    font-size: 12px;
  }

  .result-panel,
  .progress-panel {
    padding: 10px;
  }

  .missing-item {
    padding: 6px 8px;
    font-size: 11px;
  }

  .stat-item {
    padding: 8px;
  }

  .stat-value {
    font-size: 16px;
  }
}
</style>
