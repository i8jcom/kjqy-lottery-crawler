<template>
  <div class="data-completion-page" v-loading="loading">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <span class="gradient-text">数据自动补全</span>
      </h2>
      <p class="page-desc">智能检测并自动补全缺失的彩票数据</p>
    </div>

    <!-- WebSocket 状态指示器 -->
    <el-tag
      :type="store.wsConnected ? 'success' : 'info'"
      effect="dark"
      size="large"
      class="ws-status-indicator"
    >
      <span class="status-dot"></span>
      {{ store.wsConnected ? 'WebSocket已连接' : 'WebSocket未连接' }}
    </el-tag>

    <!-- 统计概览 -->
    <div class="overview-grid">
      <HolographicCard :border="true" :hover="true" class="stat-card" shadow="hover">
        <div class="stat-content-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
            <span>📊</span>
          </div>
          <div class="stat-content">
            <div class="stat-label">总执行次数</div>
            <div class="stat-value">{{ store.stats.totalChecks || 0 }}</div>
          </div>
        </div>
      </HolographicCard>

      <HolographicCard :border="true" :hover="true" class="stat-card" shadow="hover">
        <div class="stat-content-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, var(--success-color), #38f9d7);">
            <span>✅</span>
          </div>
          <div class="stat-content">
            <div class="stat-label">累计补全数据</div>
            <div class="stat-value">{{ store.stats.totalFilled || 0 }} <span class="unit">条</span></div>
          </div>
        </div>
      </HolographicCard>

      <HolographicCard :border="true" :hover="true" class="stat-card" shadow="hover">
        <div class="stat-content-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a, #fee140);">
            <span>🕒</span>
          </div>
          <div class="stat-content">
            <div class="stat-label">最后执行时间</div>
            <div class="stat-value time-value">{{ formatTime(store.stats.lastRunTime) }}</div>
          </div>
        </div>
      </HolographicCard>

      <HolographicCard :border="true" :hover="true" class="stat-card" shadow="hover">
        <div class="stat-content-wrapper">
          <div class="stat-icon" :style="{ background: store.isRunning ? 'linear-gradient(135deg, #ff6b6b, #ffa500)' : 'linear-gradient(135deg, var(--info-color), #00f2fe)' }">
            <span>{{ store.isRunning ? '⚡' : '💤' }}</span>
          </div>
          <div class="stat-content">
            <div class="stat-label">当前状态</div>
            <div class="stat-value">
              <el-tag :type="store.isRunning ? 'warning' : 'success'" effect="dark">
                {{ store.isRunning ? '运行中' : '空闲' }}
              </el-tag>
            </div>
          </div>
        </div>
      </HolographicCard>
    </div>

    <!-- 实时进度条 -->
    <HolographicCard :border="true" :hover="true" class="progress-panel" v-if="store.isRunning && store.currentProgress" shadow="never">
      <template #header>
        <h3 class="panel-title">
          <span class="pulse-icon">⚡</span>
          补全任务进行中
        </h3>
      </template>
      <div class="progress-content">
        <el-progress
          :percentage="store.progressPercent"
          :stroke-width="24"
          :color="progressColor"
          striped
          striped-flow
        >
          <span class="progress-text">
            {{ store.currentProgress.current }} / {{ store.currentProgress.total }}
          </span>
        </el-progress>
        <div class="progress-tag-wrapper">
          <el-tag :type="store.currentProgress.custom ? 'warning' : 'info'" size="large" effect="plain">
            {{ store.currentProgress.custom ? '🎯 自定义补全' : '🌐 全量补全' }}
          </el-tag>
        </div>
      </div>
    </HolographicCard>

    <!-- 操作区域 -->
    <HolographicCard :border="true" :hover="true" class="operations-panel" shadow="never">
      <template #header>
        <h3 class="panel-title">补全操作</h3>
      </template>

      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="全量补全" name="full">
          <template #label>
            <span>🌐 全量补全</span>
          </template>
          <el-alert
            title="全量补全说明"
            type="info"
            :closable="false"
            show-icon
          >
            将检查所有彩种的数据完整性，自动补全缺失的数据。预计耗时 20-30 秒。
          </el-alert>
          <div class="tab-actions">
            <NeonButton
              type="primary"
              size="large"
              :loading="store.isRunning"
              :icon="store.isRunning ? Loading : VideoPlay"
              @click="handleRunFull"
            >
              {{ store.isRunning ? '补全进行中...' : '立即执行全量补全' }}
            </NeonButton>
          </div>
        </el-tab-pane>

        <el-tab-pane label="自定义补全" name="custom">
          <template #label>
            <span>🎯 自定义补全</span>
          </template>
          <el-form class="custom-form" label-width="100px" label-position="left">
            <el-form-item label="选择彩种">
              <el-select
                v-model="customForm.lotCodes"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="不选择则补全所有彩种"
                style="width: 100%"
              >
                <el-option
                  v-for="lottery in lotteryOptions"
                  :key="lottery.code"
                  :label="lottery.name"
                  :value="lottery.code"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="指定年份">
              <el-input-number
                v-model="customForm.year"
                :min="2000"
                :max="2100"
                placeholder="不输入则补全当前年份"
                style="width: 100%"
              />
            </el-form-item>

            <el-form-item>
              <NeonButton
                type="primary"
                :icon="VideoPlay"
                :disabled="store.isRunning"
                @click="handleRunCustom"
              >
                执行自定义补全
              </NeonButton>
              <NeonButton :icon="RefreshLeft" @click="resetCustomForm">
                重置
              </NeonButton>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </HolographicCard>

    <!-- 补全历史 -->
    <HolographicCard :border="true" :hover="true" class="history-panel" shadow="never">
      <template #header>
        <div class="panel-header">
          <h3 class="panel-title">补全历史记录</h3>
          <NeonButton
            :icon="Refresh"
            :loading="loading"
            circle
            @click="loadHistory"
          />
        </div>
      </template>

      <el-table
        v-if="store.historyRecords && store.historyRecords.length > 0"
        :data="store.historyRecords"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="run_time" label="执行时间" width="180">
          <template #default="{ row }">
            <span class="time-cell">🕒 {{ row.run_time }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="duration" label="耗时" width="100">
          <template #default="{ row }">
            <span class="duration-cell">{{ row.duration }}s</span>
          </template>
        </el-table-column>

        <el-table-column prop="total_checked" label="检查数" width="100" align="center" />

        <el-table-column prop="total_filled" label="补全数" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.total_filled > 0 ? 'success' : 'info'" size="small">
              {{ row.total_filled }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="结果统计" min-width="200">
          <template #default="{ row }">
            <div class="stats-badges">
              <el-tag type="success" size="small">✅ {{ row.success_count }}</el-tag>
              <el-tag v-if="row.failed_count > 0" type="danger" size="small">❌ {{ row.failed_count }}</el-tag>
              <el-tag v-if="row.skipped_count > 0" type="info" size="small">⏭️ {{ row.skipped_count }}</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="type" label="类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.details?.custom ? 'warning' : 'info'" effect="plain" size="small">
              {{ row.details?.custom ? '🎯 自定义' : '🌐 全量' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <NeonButton link type="primary" :icon="View" @click="viewDetails(row)">
              详情
            </NeonButton>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else description="暂无补全历史记录" :image-size="80" />

      <div v-if="store.hasHistory" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          layout="prev, pager, next, total"
          @current-change="handlePageChange"
        />
      </div>
    </HolographicCard>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailsDialog.visible"
      title="📊 补全详情"
      width="900px"
      :close-on-click-modal="false"
    >
      <div v-if="detailsDialog.data">
        <!-- 基本信息 -->
        <div class="details-section">
          <h4 class="section-title">基本信息</h4>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="执行时间">{{ detailsDialog.data.run_time }}</el-descriptions-item>
            <el-descriptions-item label="耗时">{{ detailsDialog.data.duration }} 秒</el-descriptions-item>
            <el-descriptions-item label="检查数">{{ detailsDialog.data.total_checked }}</el-descriptions-item>
            <el-descriptions-item label="补全数">{{ detailsDialog.data.total_filled }}</el-descriptions-item>
            <el-descriptions-item label="成功">
              <span class="success-text">{{ detailsDialog.data.success_count }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="失败">
              <span class="danger-text">{{ detailsDialog.data.failed_count }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 详细结果 -->
        <div class="details-section">
          <h4 class="section-title">详细结果</h4>
          <el-tabs v-model="activeDetailTab" type="border-card">
            <el-tab-pane :label="`✅ 成功 (${detailsDialog.data.details?.success?.length || 0})`" name="success">
              <el-table :data="detailsDialog.data.details?.success || []" stripe max-height="400">
                <el-table-column prop="name" label="彩种" />
                <el-table-column prop="filled" label="补全数" width="100" align="center" />
                <el-table-column prop="message" label="消息" />
              </el-table>
            </el-tab-pane>

            <el-tab-pane
              v-if="detailsDialog.data.details?.failed?.length > 0"
              :label="`❌ 失败 (${detailsDialog.data.details?.failed?.length || 0})`"
              name="failed"
            >
              <el-table :data="detailsDialog.data.details?.failed || []" stripe max-height="400">
                <el-table-column prop="name" label="彩种" width="150" />
                <el-table-column prop="error" label="错误信息" class-name="error-cell" />
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <template #footer>
        <NeonButton @click="detailsDialog.visible = false">关闭</NeonButton>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { HolographicCard, NeonButton, GlowingTag } from '../components/tech'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Loading, VideoPlay, RefreshLeft, Refresh, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDataCompletionStore } from '../stores/dataCompletion'
import dayjs from 'dayjs'

const store = useDataCompletionStore()
const loading = ref(false)
const activeTab = ref('full')
const activeDetailTab = ref('success')

// 进度条颜色
const progressColor = computed(() => {
  return [
    { color: '#667eea', percentage: 40 },
    { color: '#764ba2', percentage: 70 },
    { color: '#667eea', percentage: 100 }
  ]
})

// 自定义补全表单
const customForm = ref({
  lotCodes: [],
  year: null
})

// 彩种选项
const lotteryOptions = ref([
  { code: '100008', name: '39樂合彩' },
  { code: '100009', name: '49樂合彩' },
  { code: '70001', name: '福彩双色球' },
  { code: '70002', name: '福彩3D' },
  { code: '80001', name: '超级大乐透' },
  { code: '80002', name: '排列3' },
  { code: '80003', name: '排列5' },
])

// 分页
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

// 详情对话框
const detailsDialog = ref({
  visible: false,
  data: null
})

// 格式化时间
function formatTime(time) {
  if (!time) return '暂无'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

// 刷新数据
async function refreshData() {
  loading.value = true
  try {
    await Promise.all([
      store.fetchStatus(),
      store.fetchHistory(pagination.value.pageSize, (pagination.value.page - 1) * pagination.value.pageSize)
    ])
    ElMessage.success('刷新成功')
  } catch (error) {
    ElMessage.error('刷新失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 执行全量补全
async function handleRunFull() {
  try {
    await ElMessageBox.confirm(
      '确认执行全量补全？这将检查所有彩种的数据完整性。',
      '确认操作',
      {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await store.runFullCompletion()
    ElMessage.success('补全任务已启动，请关注实时进度')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('启动失败: ' + error.message)
    }
  }
}

// 执行自定义补全
async function handleRunCustom() {
  try {
    const options = {
      lotCodes: customForm.value.lotCodes.length > 0 ? customForm.value.lotCodes : undefined,
      year: customForm.value.year ? parseInt(customForm.value.year) : undefined
    }

    await store.runCustomCompletion(options)
    ElMessage.success('自定义补全任务已启动')
  } catch (error) {
    ElMessage.error('启动失败: ' + error.message)
  }
}

// 重置自定义表单
function resetCustomForm() {
  customForm.value = {
    lotCodes: [],
    year: null
  }
}

// 加载历史记录
async function loadHistory() {
  loading.value = true
  try {
    await store.fetchHistory(pagination.value.pageSize, (pagination.value.page - 1) * pagination.value.pageSize)
  } catch (error) {
    ElMessage.error('加载历史失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 分页改变
function handlePageChange(page) {
  pagination.value.page = page
  loadHistory()
}

// 查看详情
function viewDetails(record) {
  detailsDialog.value.visible = true
  detailsDialog.value.data = record
  activeDetailTab.value = 'success'
}

// 组件挂载
onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([
      store.fetchStatus(),
      store.fetchHistory(pagination.value.pageSize, 0)
    ])
    store.connectWebSocket()
  } catch (error) {
    ElMessage.error('初始化失败: ' + error.message)
  } finally {
    loading.value = false
  }
})

// 组件卸载
onUnmounted(() => {
  store.disconnectWebSocket()
})
</script>

<style scoped>
/* ==================== 页面容器 ==================== */
.data-completion-page {
  padding: 24px;
  min-height: 100vh;
}

/* ==================== 页面标题 ==================== */
.page-header {
  margin-bottom: 32px;
  text-align: center;
}

.page-title {
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
}

.gradient-text {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-desc {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

/* ==================== WebSocket 状态 ==================== */
.ws-status-indicator {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(103, 194, 58, 0);
  }
}

/* ==================== 统计概览 ==================== */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(20px);
  border: 1px solid var(--el-border-color);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
}

.stat-content-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1;
}

.stat-value .unit {
  font-size: 14px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  margin-left: 4px;
}

.time-value {
  font-size: 14px;
  font-weight: 500;
}

/* ==================== 进度面板 ==================== */
.progress-panel {
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(20px);
  border: 1px solid var(--el-border-color);
  margin-bottom: 24px;
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-icon {
  animation: pulse-icon 1s ease-in-out infinite;
}

@keyframes pulse-icon {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.progress-content {
  padding: 20px 0;
}

.progress-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.progress-tag-wrapper {
  text-align: center;
  margin-top: 16px;
}

/* ==================== 操作面板 ==================== */
.operations-panel {
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(20px);
  border: 1px solid var(--el-border-color);
  margin-bottom: 24px;
}

.tab-actions {
  margin-top: 20px;
}

.custom-form {
  max-width: 600px;
  padding: 16px 0;
}

/* ==================== 历史面板 ==================== */
.history-panel {
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(20px);
  border: 1px solid var(--el-border-color);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.time-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.duration-cell {
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

.stats-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color);
}

/* ==================== 详情对话框 ==================== */
.details-section {
  margin-bottom: 32px;
}

.details-section:last-child {
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  padding-bottom: 8px;
  border-bottom: 2px solid var(--el-border-color);
}

.success-text {
  color: var(--el-color-success);
  font-weight: 600;
}

.danger-text {
  color: var(--el-color-danger);
  font-weight: 600;
}

:deep(.error-cell) {
  color: var(--el-color-danger);
  font-size: 12px;
}

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .data-completion-page {
    padding: 12px;
  }

  .page-title {
    font-size: 28px;
  }

  .overview-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .stat-value {
    font-size: 24px;
  }

  .custom-form {
    max-width: 100%;
  }
}
</style>
