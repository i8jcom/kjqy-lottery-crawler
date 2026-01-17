<template>
  <div class="data-management-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title gradient-text">数据管理</h2>
      <p class="page-desc">检测缺失数据、批量补填、数据导出</p>
    </div>

    <!-- 功能卡片网格 -->
    <div class="cards-grid">
      <!-- 缺失数据检测卡片 -->
      <HolographicCard class="function-card" :border="true" :hover="true">
        <template #header>
          <div class="card-title">
            <span class="card-icon">🔍</span>
            <span>缺失数据检测</span>
          </div>
        </template>
        <div class="card-body">
          <div class="form-group">
            <label>彩种</label>
            <el-select
              v-model="checkParams.lottery"
              placeholder="选择彩种"
              filterable
              clearable
              size="large"
            >
              <el-option
                v-for="lottery in lotteries"
                :key="lottery.code"
                :label="lottery.name"
                :value="lottery.code"
              />
            </el-select>
          </div>
          <div class="form-group">
            <label>日期范围</label>
            <el-date-picker
              v-model="checkParams.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              size="large"
              style="width: 100%"
            />
          </div>
          <NeonButton
            type="primary"
            size="large"
            :loading="checking"
            @click="handleCheckMissing"
            style="width: 100%"
          >
            {{ checking ? '检测中...' : '开始检测' }}
          </NeonButton>

          <!-- 检测结果 -->
          <div v-if="missingData.length > 0" class="result-panel">
            <div class="result-header">
              检测到 <strong>{{ missingData.length }}</strong> 条缺失数据
            </div>
            <div class="missing-list">
              <div v-for="(item, idx) in missingData.slice(0, 5)" :key="idx" class="missing-item">
                <span class="missing-date">{{ item.date }}</span>
                <span class="missing-lottery">{{ item.lotteryName }}</span>
                <GlowingTag type="warning" :text="item.count + ' 期'" size="small" effect="dark" />
              </div>
              <div v-if="missingData.length > 5" class="more-text">
                还有 {{ missingData.length - 5 }} 条...
              </div>
            </div>
          </div>
        </div>
      </HolographicCard>

      <!-- 数据补填卡片 -->
      <HolographicCard class="function-card" :border="true" :hover="true">
        <template #header>
          <div class="card-title">
            <span class="card-icon">📥</span>
            <span>数据补填</span>
          </div>
        </template>
        <div class="card-body">
          <div class="form-group">
            <label>彩种</label>
            <el-select
              v-model="fillParams.lottery"
              placeholder="选择彩种"
              filterable
              clearable
              size="large"
            >
              <el-option
                v-for="lottery in lotteries"
                :key="lottery.code"
                :label="lottery.name"
                :value="lottery.code"
              />
            </el-select>
          </div>
          <div class="form-group">
            <label>补填日期</label>
            <el-date-picker
              v-model="fillParams.date"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              size="large"
              style="width: 100%"
            />
          </div>
          <NeonButton
            type="primary"
            size="large"
            :loading="filling"
            @click="handleFillMissing"
            style="width: 100%"
          >
            {{ filling ? '补填中...' : '开始补填' }}
          </NeonButton>

          <!-- 补填进度 -->
          <div v-if="fillProgress.total > 0" class="progress-panel">
            <div class="progress-info">
              <span>进度: {{ fillProgress.current }} / {{ fillProgress.total }}</span>
              <span>{{ fillProgress.percentage }}%</span>
            </div>
            <el-progress
              :percentage="fillProgress.percentage"
              :stroke-width="8"
              :show-text="false"
              status="success"
            />
          </div>
        </div>
      </HolographicCard>

      <!-- 数据导出卡片 -->
      <HolographicCard class="function-card" :border="true" :hover="true">
        <template #header>
          <div class="card-title">
            <span class="card-icon">📤</span>
            <span>数据导出</span>
          </div>
        </template>
        <div class="card-body">
          <div class="form-group">
            <label>彩种</label>
            <el-select
              v-model="exportParams.lottery"
              placeholder="全部彩种"
              filterable
              clearable
              size="large"
            >
              <el-option label="全部彩种" value="" />
              <el-option
                v-for="lottery in lotteries"
                :key="lottery.code"
                :label="lottery.name"
                :value="lottery.code"
              />
            </el-select>
          </div>
          <div class="form-group">
            <label>日期范围</label>
            <el-date-picker
              v-model="exportParams.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              size="large"
              style="width: 100%"
            />
          </div>
          <div class="form-group">
            <label>导出格式</label>
            <el-select v-model="exportParams.format" placeholder="选择格式" size="large">
              <el-option label="CSV" value="csv" />
              <el-option label="JSON" value="json" />
              <el-option label="Excel" value="excel" />
            </el-select>
          </div>
          <NeonButton
            type="primary"
            size="large"
            :loading="exporting"
            @click="handleExport"
            style="width: 100%"
          >
            {{ exporting ? '导出中...' : '导出数据' }}
          </NeonButton>
        </div>
      </HolographicCard>

      <!-- 数据统计卡片 -->
      <HolographicCard class="function-card" :border="true" :hover="true">
        <template #header>
          <div class="card-title">
            <span class="card-icon">📊</span>
            <span>数据统计</span>
          </div>
        </template>
        <div class="card-body">
          <div class="stats-grid">
            <div class="stat-item">
              <el-statistic :value="stats.totalRecords" title="总记录数" />
            </div>
            <div class="stat-item">
              <el-statistic :value="stats.todayRecords" title="今日新增" />
            </div>
            <div class="stat-item">
              <el-statistic :value="stats.lotteryCount" title="彩种数量" />
            </div>
            <div class="stat-item">
              <el-statistic :value="stats.completeness" suffix="%" title="数据完整度" />
            </div>
          </div>
          <NeonButton type="default" size="large" @click="loadStats" style="width: 100%">
            <template #icon>
              <span>🔄</span>
            </template>
            刷新统计
          </NeonButton>
        </div>
      </HolographicCard>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../services/api'
import { HolographicCard, NeonButton, GlowingTag } from '../components/tech'

// 彩种列表
const lotteries = ref([])

// 检测缺失数据
const checkParams = ref({
  lottery: '',
  dateRange: []
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
  dateRange: [],
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
      lotteries.value = response.data.lotteries || []
    }
  } catch (error) {
    ElMessage.error('加载彩种列表失败')
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
      ElMessage.success('统计数据已刷新')
    }
  } catch (error) {
    ElMessage.error('加载统计数据失败')
    console.error('加载统计数据失败:', error)
  }
}

// 检测缺失数据
const handleCheckMissing = async () => {
  if (!checkParams.value.lottery || !checkParams.value.dateRange || checkParams.value.dateRange.length !== 2) {
    ElMessage.warning('请选择彩种和日期范围')
    return
  }

  try {
    checking.value = true
    const response = await api.checkMissingData({
      lottery: checkParams.value.lottery,
      startDate: checkParams.value.dateRange[0],
      endDate: checkParams.value.dateRange[1]
    })

    if (response.success) {
      missingData.value = response.data || []
      const count = missingData.value.length
      if (count > 0) {
        ElMessage.success(`检测完成，发现 ${count} 条缺失数据`)
      } else {
        ElMessage.info('未发现缺失数据')
      }
    }
  } catch (error) {
    ElMessage.error('检测缺失数据失败')
    console.error('❌ 检测缺失数据失败:', error)
    missingData.value = []
  } finally {
    checking.value = false
  }
}

// 数据补填
const handleFillMissing = async () => {
  if (!fillParams.value.lottery || !fillParams.value.date) {
    ElMessage.warning('请选择彩种和补填日期')
    return
  }

  try {
    filling.value = true
    fillProgress.value = { current: 0, total: 100, percentage: 0 }

    const response = await api.fillMissingData(fillParams.value)

    if (response.success) {
      ElMessage.success('数据补填成功')
      fillProgress.value = { current: 100, total: 100, percentage: 100 }

      // 3秒后重置进度
      setTimeout(() => {
        fillProgress.value = { current: 0, total: 0, percentage: 0 }
      }, 3000)
    }
  } catch (error) {
    ElMessage.error('数据补填失败')
    console.error('❌ 数据补填失败:', error)
  } finally {
    filling.value = false
  }
}

// 数据导出
const handleExport = async () => {
  if (!exportParams.value.dateRange || exportParams.value.dateRange.length !== 2) {
    ElMessage.warning('请选择日期范围')
    return
  }

  try {
    exporting.value = true
    const response = await api.exportData({
      lottery: exportParams.value.lottery,
      startDate: exportParams.value.dateRange[0],
      endDate: exportParams.value.dateRange[1],
      format: exportParams.value.format
    })

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url
    link.download = `data_export_${new Date().getTime()}.${exportParams.value.format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    ElMessage.success('数据导出成功')
  } catch (error) {
    ElMessage.error('数据导出失败')
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

  checkParams.value.dateRange = [
    sevenDaysAgo.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  ]

  exportParams.value.dateRange = [
    sevenDaysAgo.toISOString().split('T')[0],
    today.toISOString().split('T')[0]
  ]

  fillParams.value.date = today.toISOString().split('T')[0]

  // 加载数据
  loadLotteries()
  loadStats()
})
</script>

<style scoped>
/* 页面布局 */
.data-management-page {
  padding: 20px;
  width: 100%;
  background: var(--bg-primary);
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
  color: var(--tech-text-secondary);
  font-size: 14px;
}

/* 卡片网格 */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
}

/* 玻璃卡片效果 */
.glass-card {
  background: var(--glass-bg) !important;
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

.glass-card :deep(.el-card__header) {
  background: rgba(102, 126, 234, 0.15);
  border-bottom: 1px solid var(--border-color);
  padding: 16px 20px;
}

.glass-card :deep(.el-card__body) {
  padding: 0;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.card-icon {
  font-size: 20px;
}

.card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 表单 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Element Plus 组件样式覆盖 */
:deep(.el-select),
:deep(.el-date-picker) {
  width: 100%;
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

:deep(.el-input__inner::placeholder) {
  color: var(--text-subtle);
}

:deep(.el-range-separator) {
  color: var(--text-tertiary);
}

/* 检测结果面板 */
.result-panel {
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.result-header {
  margin-bottom: 12px;
  color: var(--text-secondary);
  font-size: 13px;
}

.result-header strong {
  color: #f59e0b;
  font-weight: 600;
  font-size: 15px;
}

.missing-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.missing-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--glass-bg);
  border-radius: 8px;
  font-size: 13px;
}

.missing-date {
  color: var(--text-tertiary);
  font-size: 12px;
}

.missing-lottery {
  color: var(--text-primary);
  font-weight: 500;
  flex: 1;
  margin: 0 12px;
}

.more-text {
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
  padding: 8px 0;
}

/* 进度面板 */
.progress-panel {
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--text-secondary);
}

:deep(.el-progress__text) {
  color: rgba(255, 255, 255, 0.9) !important;
}

:deep(.el-progress-bar__outer) {
  background-color: rgba(255, 255, 255, 0.1);
}

:deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #667eea, #764ba2);
}

/* 统计网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  text-align: center;
}

:deep(.el-statistic__head) {
  color: var(--text-secondary);
  font-size: 12px;
  margin-bottom: 6px;
}

:deep(.el-statistic__content) {
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 700;
}

:deep(.el-statistic .el-statistic__number) {
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 响应式 */
@media (max-width: 1200px) {
  .cards-grid {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}

@media (max-width: 768px) {
  .data-management-page {
    padding: 12px;
  }

  .page-title {
    font-size: 22px;
  }

  .cards-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .card-body {
    padding: 16px;
    gap: 12px;
  }

  .stats-grid {
    gap: 10px;
  }

  .stat-item {
    padding: 12px;
  }

  :deep(.el-statistic__content) {
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .data-management-page {
    padding: 10px;
  }

  .page-title {
    font-size: 20px;
  }

  .cards-grid {
    gap: 12px;
  }

  .card-body {
    padding: 12px;
    gap: 10px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
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
