<template>
  <div class="lottery-configs-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <span class="gradient-text">彩种配置</span>
      </h2>
      <p class="page-desc">管理彩种配置和爬取规则</p>
    </div>

    <!-- 彩种统计 -->
    <div class="overview-grid">
      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
          <span>🎯</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">总彩种数</div>
          <div class="stat-value">{{ lotteryStats.total || 0 }}</div>
        </div>
      </HolographicCard>

      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-icon" style="background: linear-gradient(135deg, var(--el-color-success), #38f9d7);">
          <span>✅</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">已启用</div>
          <div class="stat-value">{{ lotteryStats.enabled || 0 }}</div>
        </div>
      </HolographicCard>

      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a, #fee140);">
          <span>⏸️</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">已禁用</div>
          <div class="stat-value">{{ lotteryStats.disabled || 0 }}</div>
        </div>
      </HolographicCard>

      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-icon" style="background: linear-gradient(135deg, var(--el-color-info), #00f2fe);">
          <span>📈</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">今日爬取</div>
          <div class="stat-value">{{ lotteryStats.todayCrawls || 0 }}</div>
        </div>
      </HolographicCard>
    </div>

    <!-- 彩种列表 -->
    <HolographicCard class="lotteries-panel" :border="true">
      <template #header>
        <div class="panel-header">
          <h3 class="panel-title">彩种列表</h3>
          <NeonButton type="primary" :icon="Plus" @click="showAddModal = true">
            添加彩种
          </NeonButton>
        </div>
      </template>

      <div style="overflow-x: auto;">
        <el-table :data="lotteries" stripe style="width: 100%; min-width: 1100px;">
          <el-table-column prop="lotCode" label="彩种代码" width="120">
            <template #default="{ row }">
              <GlowingTag type="primary" :text="row.lotCode" size="small" effect="dark" />
            </template>
          </el-table-column>
          <el-table-column prop="name" label="彩种名称" min-width="150" />
          <el-table-column prop="drawRule" label="开奖规则" min-width="200" />
          <el-table-column label="数据源" min-width="150">
            <template #default="{ row }">
              {{ getSourceDisplayName(row.source || row.sourceId) }}
            </template>
          </el-table-column>
          <el-table-column label="爬取间隔" width="120">
            <template #default="{ row }">
              {{ formatInterval(row.interval) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-switch
                v-model="row.enabled"
                @change="toggleLottery(row.lotCode)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="280">
          <template #default="{ row }">
            <div class="action-buttons">
              <NeonButton size="small" :icon="View" @click="viewData(row.lotCode)">查看</NeonButton>
              <NeonButton size="small" :icon="Download" @click="crawlHistory(row.lotCode)">历史</NeonButton>
              <NeonButton size="small" :icon="Edit" @click="editLottery(row)">编辑</NeonButton>
              <NeonButton size="small" type="danger" :icon="Delete" @click="deleteLottery(row.lotCode)">删除</NeonButton>
            </div>
          </template>
        </el-table-column>
          <template #empty>
            <el-empty description="暂无彩种配置" />
          </template>
        </el-table>
      </div>
    </HolographicCard>

    <!-- 查看数据对话框 -->
    <CyberDialog
      v-model="showViewDataModal"
      :title="`${viewDataLottery.name} - 历史数据`"
      width="900px"
      :scanline="true"
    >
      <div class="data-stats" v-if="!loadingData && lotteryData.length > 0">
        <GlowingTag type="info" :text="`总记录数: ${dataTotalCount.toLocaleString()}`" size="small" effect="dark" />
        <GlowingTag type="info" :text="`第 ${dataCurrentPage} / ${dataTotalPages} 页`" size="small" effect="dark" />
        <GlowingTag type="info" :text="`每页 ${dataPageSize} 条`" size="small" effect="dark" />
      </div>

      <div class="data-toolbar">
        <el-select v-model="dataPageSize" @change="loadLotteryData" style="width: 120px">
          <el-option label="10条" :value="10" />
          <el-option label="20条" :value="20" />
          <el-option label="50条" :value="50" />
          <el-option label="100条" :value="100" />
        </el-select>
        <NeonButton :icon="Refresh" :loading="loadingData" @click="loadLotteryData">刷新数据</NeonButton>
      </div>

      <el-table v-loading="loadingData" :data="lotteryData" stripe max-height="400">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="issueNumber" label="期号" width="180" />
        <el-table-column label="开奖号码" min-width="400">
          <template #default="{ row }">
            <!-- 保留原始复杂的彩球显示逻辑 -->
            <div class="lottery-numbers-display" v-html="renderLotteryNumbers(row)"></div>
          </template>
        </el-table-column>
        <el-table-column label="开奖时间" width="180">
          <template #default="{ row }">
            {{ formatDrawTime(row.drawTime) }}
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
      </el-table>

      <el-pagination
        v-if="lotteryData.length > 0"
        v-model:current-page="dataCurrentPage"
        v-model:page-size="dataPageSize"
        :total="dataTotalCount"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadLotteryData"
        @size-change="loadLotteryData"
        style="margin-top: 16px; justify-content: center;"
      />

      <template #footer>
        <NeonButton @click="showViewDataModal = false">关闭</NeonButton>
      </template>
    </CyberDialog>

    <!-- 历史数据爬取对话框 -->
    <CyberDialog v-model="showHistoryModal" title="📥 爬取历史数据" width="500px" :scanline="true">
      <el-form :model="historyForm" label-width="100px">
        <el-form-item label="彩种">
          <el-text>{{ historyLottery.name }} ({{ historyLottery.lotCode }})</el-text>
        </el-form-item>
        <el-form-item label="开始日期" required>
          <el-date-picker v-model="historyForm.startDate" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束日期" required>
          <el-date-picker v-model="historyForm.endDate" type="date" style="width: 100%" />
        </el-form-item>
        <el-form-item label="覆盖数据">
          <el-checkbox v-model="historyForm.overwrite">覆盖已存在的数据</el-checkbox>
        </el-form-item>
        <el-alert type="warning" :closable="false" show-icon>
          爬取历史数据可能需要较长时间，请耐心等待
        </el-alert>
      </el-form>

      <template #footer>
        <NeonButton @click="closeHistoryModal">取消</NeonButton>
        <NeonButton type="primary" @click="submitHistoryCrawl">开始爬取</NeonButton>
      </template>
    </CyberDialog>

    <!-- 添加/编辑对话框 -->
    <CyberDialog
      v-model="showModal"
      :title="showEditModal ? '编辑彩种' : '添加新彩种'"
      width="600px"
      :scanline="true"
      :close-on-click-modal="false"
    >
      <el-form :model="formData" label-width="120px">
        <!-- 基本信息 -->
        <el-divider content-position="left">
          <el-text type="primary">基本信息</el-text>
        </el-divider>

        <el-form-item label="彩种代码" required>
          <el-input v-model="formData.lotCode" placeholder="例如: 10037" :disabled="showEditModal" />
        </el-form-item>

        <el-form-item label="彩种名称" required>
          <el-input v-model="formData.name" placeholder="例如: 极速赛车" />
        </el-form-item>

        <el-form-item label="开奖规则">
          <el-input v-model="formData.drawRule" placeholder="例如: 每周二、四、日 21:15" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="开奖间隔">
              <el-input-number v-model="formData.interval" :min="60" :max="86400" placeholder="300" style="width: 100%" />
              <el-text size="small" type="info">单位：秒</el-text>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级">
              <el-select v-model="formData.priority" style="width: 100%">
                <el-option label="高频" value="high" />
                <el-option label="中频" value="medium" />
                <el-option label="低频" value="low" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 数据源配置 -->
        <el-divider content-position="left">
          <el-text type="primary">数据源配置</el-text>
        </el-divider>

        <el-form-item label="数据源类型" required>
          <el-select v-model="formData.sourceId" @change="onSourceTypeChange" placeholder="请选择数据源" style="width: 100%">
            <el-option label="SpeedyLot88 (极速彩种)" value="speedylot88" />
            <el-option label="SG Lotteries (新加坡彩票)" value="sglotteries" />
            <el-option label="AU Lucky Lotteries (澳洲彩票)" value="auluckylotteries" />
            <el-option label="LuckySscai (幸运时时彩)" value="luckysscai" />
            <el-option label="LuckyLottoz (幸运飞艇)" value="luckylottoz" />
            <el-option label="UK Lottos (英国彩票)" value="uklottos" />
            <el-option label="HKJC (香港六合彩)" value="hkjc" />
            <el-option label="台湾彩票官方" value="taiwanlottery" />
            <el-option label="中国福彩" value="cwl" />
            <el-option label="中国体彩" value="sportslottery" />
            <el-option label="自定义API" value="custom_api" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="showScraperKeyField" label="Scraper Key" required>
          <el-input v-model="formData.scraperKey" :placeholder="scraperKeyPlaceholder" />
          <el-text size="small" type="info">{{ scraperKeyHint }}</el-text>
        </el-form-item>

        <el-form-item v-if="showApiEndpointFields" label="API Endpoint">
          <el-input v-model="formData.apiEndpoint" :placeholder="apiEndpointPlaceholder" />
        </el-form-item>

        <!-- 高级设置 -->
        <el-divider content-position="left">
          <el-text type="primary">高级设置</el-text>
        </el-divider>

        <el-form-item label="描述">
          <el-input v-model="formData.description" type="textarea" placeholder="例如: SpeedyLot88官方数据源" />
        </el-form-item>

        <el-form-item label="启用状态">
          <el-switch v-model="formData.enabled" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>

      <template #footer>
        <NeonButton @click="closeModal">取消</NeonButton>
        <NeonButton type="primary" @click="submitForm">
          {{ showEditModal ? '保存更改' : '添加彩种' }}
        </NeonButton>
      </template>
    </CyberDialog>

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      ref="deleteDialog"
      type="danger"
      title="🔒 删除彩种"
      :message="deleteDialogMessage"
      confirm-text="确认删除"
      cancel-text="取消"
      :require-confirm-code="true"
      :confirm-code="deleteConfirmCode"
      confirm-label="请输入彩种代码以确认删除："
      :confirm-placeholder="`输入 ${deleteConfirmCode}`"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Plus, View, Download, Edit, Delete, Refresh } from '@element-plus/icons-vue'
import { HolographicCard, NeonButton, GlowingTag, CyberDialog } from '../components/tech'
import api from '../services/api'
import { useToast } from '../composables/useToast'
import ConfirmDialog from '../components/modals/ConfirmDialog.vue'

const toast = useToast()

// 彩种统计
const lotteryStats = ref({
  total: 0,
  enabled: 0,
  disabled: 0,
  todayCrawls: 0
})

// 彩种列表
const lotteries = ref([])

// 模态框状态
const showAddModal = ref(false)
const showEditModal = ref(false)
const showHistoryModal = ref(false)
const showViewDataModal = ref(false)
const showModal = computed(() => showAddModal.value || showEditModal.value)

// 表单数据
const formData = ref({
  lotCode: '',
  name: '',
  drawRule: '',
  sourceId: '',
  interval: 300,
  priority: 'medium',
  description: '',
  scraperKey: '',
  apiEndpoint: '',
  historyEndpoint: '',
  customApiUrl: '',
  customApiKey: '',
  enabled: true
})

// 数据源配置动态显示
const showScraperKeyField = computed(() => {
  const source = formData.value.sourceId
  return source && source !== 'custom_api'
})

const showApiEndpointFields = computed(() => {
  const source = formData.value.sourceId
  return ['speedylot88', 'sglotteries', 'auluckylotteries', 'luckysscai', 'luckylottoz'].includes(source)
})

// 动态提示文本
const scraperKeyPlaceholder = computed(() => {
  const placeholders = {
    speedylot88: '输入 scraper key，例如: jspk10',
    sglotteries: '输入 scraper key，例如: sgairship',
    auluckylotteries: '输入 scraper key，例如: lucky5',
    luckysscai: '输入 scraper key，例如: xyssc',
    luckylottoz: '输入 scraper key，例如: luckyairship',
    uklottos: '输入 scraper key，例如: lotto5',
    hkjc: '输入 scraper key，例如: hklhc',
    taiwanlottery: '输入 scraper key，例如: lotto649',
    cwl: '输入 scraper key，例如: ssq',
    sportslottery: '输入 scraper key，例如: dlt'
  }
  return placeholders[formData.value.sourceId] || '输入 scraper key'
})

const scraperKeyHint = computed(() => {
  const hints = {
    speedylot88: 'SpeedyLot88彩种标识符',
    sglotteries: 'SG Lotteries彩种标识符',
    auluckylotteries: 'AU Lucky Lotteries彩种标识符',
    luckysscai: 'LuckySscai彩种标识符',
    luckylottoz: 'LuckyLottoz彩种标识符',
    uklottos: 'UK Lottos彩种标识符',
    hkjc: '香港赛马会彩种标识符',
    taiwanlottery: '台湾彩票官方彩种标识符',
    cwl: '中国福彩彩种标识符',
    sportslottery: '中国体彩彩种标识符'
  }
  return hints[formData.value.sourceId] || '彩种的唯一标识符，用于数据源识别'
})

const apiEndpointPlaceholder = computed(() => {
  const placeholders = {
    speedylot88: '例如: speedy10-result.php',
    sglotteries: '例如: /api/result/load-ft.php',
    auluckylotteries: '例如: /results/lucky-ball-5/',
    luckysscai: '例如: /index.php',
    luckylottoz: '例如: /api/latest/getLotteryPksInfo.do?lotCode=10057'
  }
  return placeholders[formData.value.sourceId] || '例如: /api/endpoint'
})

// 历史爬取表单
const historyForm = ref({
  startDate: '',
  endDate: '',
  overwrite: false
})

const historyLottery = ref({
  lotCode: '',
  name: ''
})

// 查看数据相关状态
const viewDataLottery = ref({
  lotCode: '',
  name: ''
})
const lotteryData = ref([])
const loadingData = ref(false)
const dataCurrentPage = ref(1)
const dataPageSize = ref(20)
const dataTotalPages = ref(1)
const dataTotalCount = ref(0)

// 计算统计数据
const updateStats = () => {
  if (!Array.isArray(lotteries.value)) {
    lotteries.value = []
  }

  const enabled = lotteries.value.filter(l => l.enabled).length
  const disabled = lotteries.value.filter(l => !l.enabled).length

  lotteryStats.value = {
    total: lotteries.value.length,
    enabled,
    disabled,
    todayCrawls: lotteryStats.value.todayCrawls || 0
  }
}

// 加载彩种列表
const loadLotteries = async () => {
  try {
    const response = await api.getLotteryConfigs()
    if (response.success) {
      lotteries.value = response.data.lotteries || []
    } else {
      lotteries.value = []
    }
  } catch (error) {
    toast.error('加载彩种配置失败')
    console.error('加载彩种配置失败:', error)
    lotteries.value = []
  } finally {
    updateStats()
  }
}

// 切换彩种状态
const toggleLottery = async (lotCode) => {
  try {
    const lottery = lotteries.value.find(l => l.lotCode === lotCode)
    if (lottery) {
      const newStatus = lottery.enabled
      const response = await api.updateLotteryConfig(lotCode, { enabled: newStatus })

      if (response.success) {
        toast.success(`彩种 ${lotCode} 已${newStatus ? '启用' : '禁用'}`)
        updateStats()
      } else {
        lottery.enabled = !newStatus // 回滚
        toast.error('状态更新失败: ' + (response.error || '未知错误'))
      }
    }
  } catch (error) {
    toast.error('状态更新失败: ' + (error.message || '网络错误'))
  }
}

// 查看数据
const viewData = async (lotCode) => {
  const lottery = lotteries.value.find(l => l.lotCode === lotCode)
  if (!lottery) return

  viewDataLottery.value = {
    lotCode: lottery.lotCode,
    name: lottery.name
  }

  dataCurrentPage.value = 1
  showViewDataModal.value = true

  await loadLotteryData()
}

// 加载彩种数据
const loadLotteryData = async () => {
  if (!viewDataLottery.value.lotCode) return

  loadingData.value = true
  try {
    const response = await fetch(
      `/api/history-data?lotCode=${viewDataLottery.value.lotCode}&pageNo=${dataCurrentPage.value}&pageSize=${dataPageSize.value}`
    )
    const result = await response.json()

    if (result.success && result.data) {
      const data = result.data

      lotteryData.value = data.records.map(record => ({
        lotCode: record.lot_code,
        issueNumber: record.issue,
        numbers: record.draw_code ? record.draw_code.split(',') : [],
        specialNumbers: record.special_numbers ? record.special_numbers.split(',') : null,
        drawTime: record.draw_time,
        source: data.name || '-'
      }))

      dataTotalCount.value = data.total
      dataCurrentPage.value = data.pageNo
      dataTotalPages.value = data.totalPages
    } else {
      lotteryData.value = []
      dataTotalCount.value = 0
      dataTotalPages.value = 1
    }
  } catch (error) {
    toast.error('加载彩种数据失败')
    lotteryData.value = []
    dataTotalCount.value = 0
    dataTotalPages.value = 1
  } finally {
    loadingData.value = false
  }
}

// 格式化开奖时间
const formatDrawTime = (timeStr) => {
  if (!timeStr) return '-'
  const date = new Date(timeStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 渲染彩票号码（简化版本，显示彩球）
const renderLotteryNumbers = (row) => {
  const numbers = row.numbers || []
  return numbers.map(num => `<span class="lottery-ball">${num}</span>`).join('')
}

// 爬取历史数据
const crawlHistory = (lotCode) => {
  const lottery = lotteries.value.find(l => l.lotCode === lotCode)
  if (!lottery) return

  historyLottery.value = {
    lotCode: lottery.lotCode,
    name: lottery.name
  }

  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  historyForm.value = {
    startDate: thirtyDaysAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
    overwrite: false
  }

  showHistoryModal.value = true
}

// 关闭历史爬取模态框
const closeHistoryModal = () => {
  showHistoryModal.value = false
  historyForm.value = {
    startDate: '',
    endDate: '',
    overwrite: false
  }
  historyLottery.value = {
    lotCode: '',
    name: ''
  }
}

// 提交历史爬取
const submitHistoryCrawl = async () => {
  if (!historyForm.value.startDate || !historyForm.value.endDate) {
    toast.warning('请选择开始和结束日期')
    return
  }

  const start = new Date(historyForm.value.startDate)
  const end = new Date(historyForm.value.endDate)

  if (start > end) {
    toast.warning('开始日期不能晚于结束日期')
    return
  }

  try {
    toast.success(`已启动 ${historyLottery.value.name} 的历史数据爬取任务`)
    closeHistoryModal()
  } catch (error) {
    toast.error('启动历史爬取失败: ' + error.message)
  }
}

// 编辑彩种
const editLottery = (lottery) => {
  formData.value = {
    lotCode: lottery.lotCode,
    name: lottery.name,
    drawRule: lottery.drawRule || '',
    sourceId: lottery.source || lottery.sourceId || '',
    interval: lottery.interval || 300,
    priority: lottery.priority || 'medium',
    description: lottery.description || '',
    scraperKey: lottery.scraperKey || '',
    apiEndpoint: lottery.apiEndpoint || '',
    historyEndpoint: lottery.historyEndpoint || '',
    customApiUrl: lottery.customApiUrl || '',
    customApiKey: lottery.customApiKey || '',
    enabled: lottery.enabled
  }
  showEditModal.value = true
}

// 删除确认对话框相关
const deleteDialog = ref(null)
const deletingLottery = ref(null)
const deleteDialogMessage = computed(() => {
  if (!deletingLottery.value) return ''
  return `⚠️ 危险操作警告\n\n您即将删除彩种：${deletingLottery.value.name}\n代码：${deletingLottery.value.lotCode}\n\n此操作将永久删除该彩种配置及所有相关数据，不可恢复！\n\n请在下方输入彩种代码以确认删除。`
})
const deleteConfirmCode = computed(() => {
  return deletingLottery.value?.lotCode || ''
})

// 删除彩种
const deleteLottery = (lotCode) => {
  const lottery = lotteries.value.find(l => l.lotCode === lotCode)
  if (!lottery) return

  deletingLottery.value = lottery
  deleteDialog.value?.show()
}

// 确认删除
const confirmDelete = async () => {
  if (!deletingLottery.value) return

  const lotCode = deletingLottery.value.lotCode

  try {
    const response = await api.deleteLotteryConfig(lotCode)

    if (response.success) {
      lotteries.value = lotteries.value.filter(l => l.lotCode !== lotCode)
      updateStats()
      toast.success(`彩种 ${deletingLottery.value.name} 已成功删除`)
      await loadLotteries()
    } else {
      toast.error('删除失败: ' + (response.error || '未知错误'))
    }
  } catch (error) {
    toast.error('删除失败: ' + (error.message || '网络错误'))
  } finally {
    deletingLottery.value = null
  }
}

// 取消删除
const cancelDelete = () => {
  deletingLottery.value = null
}

// 数据源类型变化处理
const onSourceTypeChange = () => {
  formData.value.scraperKey = ''
  formData.value.apiEndpoint = ''
  formData.value.historyEndpoint = ''
  formData.value.customApiUrl = ''
  formData.value.customApiKey = ''
}

// 关闭模态框
const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  formData.value = {
    lotCode: '',
    name: '',
    drawRule: '',
    sourceId: '',
    interval: 300,
    priority: 'medium',
    description: '',
    scraperKey: '',
    apiEndpoint: '',
    historyEndpoint: '',
    customApiUrl: '',
    customApiKey: '',
    enabled: true
  }
}

// 提交表单
const submitForm = async () => {
  if (!formData.value.lotCode || !formData.value.name) {
    toast.warning('请填写必填字段')
    return
  }

  try {
    if (showEditModal.value) {
      const response = await api.updateLotteryConfig(formData.value.lotCode, formData.value)

      if (response.success) {
        const index = lotteries.value.findIndex(l => l.lotCode === formData.value.lotCode)
        if (index !== -1) {
          lotteries.value[index] = { ...formData.value }
        }
        toast.success('彩种更新成功')
      } else {
        toast.error('更新失败: ' + (response.error || '未知错误'))
      }
    } else {
      const response = await api.addLotteryConfig(formData.value)

      if (response.success) {
        lotteries.value.push({ ...formData.value })
        toast.success('彩种添加成功')
      } else {
        toast.error('添加失败: ' + (response.error || '未知错误'))
      }
    }

    updateStats()
    closeModal()
    await loadLotteries()
  } catch (error) {
    toast.error('操作失败: ' + (error.message || '网络错误'))
  }
}

// 格式化数据源名称
const getSourceDisplayName = (sourceCode) => {
  const sourceNames = {
    'speedylot88': 'SpeedyLot88',
    'sglotteries': 'SG Lotteries',
    'auluckylotteries': 'AU Lucky Lotteries',
    'luckysscai': 'LuckySscai',
    'luckylottoz': 'LuckyLottoz',
    'cwl': '中国福彩',
    'sports_lottery': '中国体彩',
    'custom_api': '自定义API'
  }
  return sourceNames[sourceCode] || sourceCode || '-'
}

// 格式化开奖间隔
const formatInterval = (seconds) => {
  if (!seconds) return '-'
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`
  return `${Math.floor(seconds / 86400)}天`
}

// 初始化
onMounted(() => {
  loadLotteries()
})
</script>

<style scoped>
.lottery-configs-page {
  padding: 16px;
  width: 100%;
  max-width: none;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  margin: 0 0 6px 0;
  font-size: 24px;
}

.gradient-text {
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.page-desc {
  margin: 0;
  color: var(--tech-text-secondary);
  font-size: 13px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
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
  color: var(--tech-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--tech-text-primary);
}

.lotteries-panel {
  margin-bottom: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.data-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.data-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lottery-numbers-display {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.lottery-ball {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>

<style>
/* 全局样式 - 移除 el-overlay-dialog 层以实现正确居中 */

/* 移除导致居中失败的中间层 */
.el-overlay-dialog {
  display: contents !important;
}

/* 查看数据对话框 */
.data-view-dialog.el-dialog {
  max-width: 900px !important;
  width: 900px !important;
  margin-top: 5vh !important;
}

.el-dialog.data-view-dialog .el-dialog__body {
  max-height: 60vh;
  overflow-y: auto;
}

/* 添加/编辑对话框 */
.form-dialog.el-dialog {
  max-width: 600px !important;
  width: 600px !important;
  margin-top: 10vh !important;
}

.el-dialog.form-dialog .el-dialog__body {
  max-height: 70vh;
  overflow-y: auto;
}
</style>
