<template>
  <div class="history-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <span class="gradient-text">历史查询</span>
      </h2>
      <p class="page-desc">查询和分析历史开奖数据</p>
    </div>

    <!-- 查询条件 -->
    <div class="search-panel glass-card">
      <div class="search-form">
        <!-- 彩种选择 -->
        <div class="form-item">
          <label>彩种</label>
          <select v-model="searchParams.lottery" class="form-select">
            <option value="">请选择彩种</option>
            <option v-for="lottery in lotteries" :key="lottery.lotCode" :value="lottery.lotCode">
              {{ lottery.name }}
            </option>
          </select>
        </div>

        <!-- 选择日期/年份 -->
        <div class="form-item">
          <label>{{ dateYearLabel }}</label>
          <!-- 日期选择器（默认显示） -->
          <div v-if="!isYearQueryLottery" class="date-selector">
            <input
              type="date"
              v-model="searchParams.date"
              class="form-input"
              style="flex: 1;"
            />
            <button class="btn-quick" @click="selectToday">今天</button>
            <button class="btn-quick" @click="selectYesterday">昨天</button>
          </div>
          <!-- 年份选择器（HKJC/CWL/体彩时显示） -->
          <select v-else v-model="searchParams.year" class="form-select">
            <option v-for="year in yearOptions" :key="year" :value="year">
              {{ year }}年
            </option>
          </select>
        </div>

        <!-- 每页条数 -->
        <div class="form-item">
          <label>每页条数</label>
          <select v-model="pageSize" class="form-select">
            <option :value="20">20条/页</option>
            <option :value="50">50条/页</option>
            <option :value="100">100条/页</option>
            <option :value="200">200条/页</option>
          </select>
        </div>

        <!-- 查询按钮 -->
        <div class="form-item" style="display: flex; align-items: flex-end;">
          <button class="btn-primary" @click="handleSearch" style="width: 100%;">
            <span>🔍</span>
            <span>查询</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 查询结果统计 -->
    <div v-if="total > 0" class="stats-panel glass-card">
      <div class="stats-content">
        <div class="stat-item">
          <span class="stat-label">彩种：</span>
          <span class="stat-value">{{ tableData[0]?.lottery_name || '-' }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">{{ isYearQueryLottery ? '年份：' : '日期：' }}</span>
          <span class="stat-value">{{ isYearQueryLottery ? (searchParams.year + '年') : (searchParams.date || '全部') }}</span>
        </div>
        <div class="stat-item" :class="{ highlight: isDataComplete, warning: !isDataComplete }">
          <span class="stat-label">数据量：</span>
          <span class="stat-value">
            {{ total }} 条
            <span v-if="expectedCount > 0">/ {{ expectedCount }} 条</span>
            <span v-if="!isDataComplete && expectedCount > 0" class="incomplete-badge">不完整</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-panel glass-card">
      <DataTable
        :data="tableData"
        :columns="columns"
        :loading="loading"
        empty-text="暂无历史数据"
        @row-click="handleRowClick"
      >
        <!-- 自定义列：开奖号码 -->
        <template #column-draw_number="{ value, row }">
          <!-- K3骰子显示 -->
          <div v-if="isK3Lottery(parseDrawNumber(value), row)" class="draw-numbers k3-display">
            <div
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="`k3-${idx}`"
              class="k3-dice-wrapper size-history"
            >
              <div class="k3-dice-3d" :class="`show-${parseInt(num, 10)}`">
                <!-- 前面 - 1点（红色） -->
                <div class="dice-face face-1">
                  <span class="dot center red"></span>
                </div>
                <!-- 右面 - 2点（蓝色） -->
                <div class="dice-face face-2">
                  <span class="dot top-left blue"></span>
                  <span class="dot bottom-right blue"></span>
                </div>
                <!-- 后面 - 3点（红色） -->
                <div class="dice-face face-3">
                  <span class="dot top-left red"></span>
                  <span class="dot center red"></span>
                  <span class="dot bottom-right red"></span>
                </div>
                <!-- 左面 - 4点（蓝色） -->
                <div class="dice-face face-4">
                  <span class="dot top-left blue"></span>
                  <span class="dot top-right blue"></span>
                  <span class="dot bottom-left blue"></span>
                  <span class="dot bottom-right blue"></span>
                </div>
                <!-- 顶面 - 5点（红色） -->
                <div class="dice-face face-5">
                  <span class="dot top-left red"></span>
                  <span class="dot top-right red"></span>
                  <span class="dot center red"></span>
                  <span class="dot bottom-left red"></span>
                  <span class="dot bottom-right red"></span>
                </div>
                <!-- 底面 - 6点（蓝色） -->
                <div class="dice-face face-6">
                  <span class="dot top-left blue"></span>
                  <span class="dot top-right blue"></span>
                  <span class="dot middle-left blue"></span>
                  <span class="dot middle-right blue"></span>
                  <span class="dot bottom-left blue"></span>
                  <span class="dot bottom-right blue"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 六合彩（香港六合彩或极速六合彩）使用官方SVG -->
          <div v-else-if="(parseDrawNumber(value).length === 6 || parseDrawNumber(value).length === 7) && (String(row.lottery_code) === '60001' || String(row.lottery_code) === '10098' || (row.lottery_name && (row.lottery_name.includes('六合彩') || row.lottery_name.includes('Mark Six'))))" class="draw-numbers">
            <template v-for="(num, idx) in parseMarkSixNumbers(parseDrawNumber(value))" :key="idx">
              <img
                :src="`assets/lottery-balls/marksix-${parseInt(num, 10)}.svg`"
                :alt="`号码${num}`"
                class="marksix-ball-svg"
              />
              <span v-if="idx === 5" class="marksix-plus">+</span>
            </template>
          </div>

          <!-- 福彩双色球（6红+1蓝） -->
          <div v-else-if="parseDrawNumber(value).length === 7 && (String(row.lottery_code) === '70001' || (row.lottery_name && row.lottery_name.includes('双色球')))" class="draw-numbers">
            <template v-for="(num, idx) in parseDrawNumber(value)" :key="idx">
              <span
                class="number-ball cwl-ball"
                :class="idx < 6 ? 'cwl-red' : 'cwl-blue'"
              >
                {{ num }}
              </span>
              <span v-if="idx === 5" class="cwl-separator">+</span>
            </template>
          </div>

          <!-- 福彩七乐彩（7红+1橙） -->
          <div v-else-if="parseDrawNumber(value).length === 8 && (String(row.lottery_code) === '70003' || (row.lottery_name && row.lottery_name.includes('七乐彩')))" class="draw-numbers">
            <template v-for="(num, idx) in parseDrawNumber(value)" :key="idx">
              <span
                class="number-ball cwl-ball"
                :class="idx < 7 ? 'cwl-red' : 'cwl-orange'"
              >
                {{ num }}
              </span>
              <span v-if="idx === 6" class="cwl-separator">+</span>
            </template>
          </div>

          <!-- 福彩3D（3个号码，金色球） -->
          <div v-else-if="parseDrawNumber(value).length === 3 && (String(row.lottery_code) === '70002' || (row.lottery_name && row.lottery_name.includes('福彩3D')))" class="draw-numbers">
            <span
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="idx"
              class="number-ball cwl-ball cwl-3d"
            >
              {{ num }}
            </span>
          </div>

          <!-- ========== 台湾彩券系列 ========== -->

          <!-- 威力彩（6红+1金） -->
          <div v-else-if="String(row.lottery_code) === '100001' && parseDrawNumber(value).length === 7" class="draw-numbers">
            <template v-for="(num, idx) in parseDrawNumber(value)" :key="idx">
              <span
                class="number-ball taiwan-ball"
                :class="idx < 6 ? 'taiwan-lotto649-red' : 'taiwan-lotto649-gold'"
              >
                {{ num }}
              </span>
              <span v-if="idx === 5" class="taiwan-separator">+</span>
            </template>
          </div>

          <!-- 台湾大乐透（6蓝+1橙） -->
          <div v-else-if="String(row.lottery_code) === '100002' && parseDrawNumber(value).length === 7" class="draw-numbers">
            <template v-for="(num, idx) in parseDrawNumber(value)" :key="idx">
              <span
                class="number-ball taiwan-ball"
                :class="idx < 6 ? 'taiwan-biglotto-blue' : 'taiwan-biglotto-orange'"
              >
                {{ num }}
              </span>
              <span v-if="idx === 5" class="taiwan-separator">+</span>
            </template>
          </div>

          <!-- 今彩539（5个紫球） -->
          <div v-else-if="String(row.lottery_code) === '100003' && parseDrawNumber(value).length === 5" class="draw-numbers">
            <span
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="idx"
              class="number-ball taiwan-ball taiwan-539-purple"
            >
              {{ num }}
            </span>
          </div>

          <!-- 3D/三星彩（3个绿球） -->
          <div v-else-if="String(row.lottery_code) === '100005' && parseDrawNumber(value).length === 3" class="draw-numbers">
            <span
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="idx"
              class="number-ball taiwan-ball taiwan-3d-green"
            >
              {{ num }}
            </span>
          </div>

          <!-- 4D/四星彩（4个橙球） -->
          <div v-else-if="String(row.lottery_code) === '100006' && parseDrawNumber(value).length === 4" class="draw-numbers">
            <span
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="idx"
              class="number-ball taiwan-ball taiwan-4d-orange"
            >
              {{ num }}
            </span>
          </div>

          <!-- 39选5（5个黄球） -->
          <div v-else-if="String(row.lottery_code) === '100008' && parseDrawNumber(value).length === 5" class="draw-numbers">
            <span
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="idx"
              class="number-ball taiwan-ball taiwan-39m5-yellow"
            >
              {{ num }}
            </span>
          </div>

          <!-- 49选6（6个黄球） -->
          <div v-else-if="String(row.lottery_code) === '100009' && parseDrawNumber(value).length === 6" class="draw-numbers">
            <span
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="idx"
              class="number-ball taiwan-ball taiwan-49m6-yellow"
            >
              {{ num }}
            </span>
          </div>

          <!-- 体彩超级大乐透（5红+2蓝） -->
          <div v-else-if="parseDrawNumber(value).length === 7 && String(row.lottery_code) === '80001'" class="draw-numbers">
            <template v-for="(num, idx) in parseDrawNumber(value)" :key="idx">
              <span
                class="number-ball sports-ball"
                :class="idx < 5 ? 'sports-red' : 'sports-blue'"
              >
                {{ num }}
              </span>
              <span v-if="idx === 4" class="sports-separator">+</span>
            </template>
          </div>

          <!-- 体彩排列3（3个紫球） -->
          <div v-else-if="parseDrawNumber(value).length === 3 && (String(row.lottery_code) === '80002' || (row.lottery_name && row.lottery_name.includes('排列3')))" class="draw-numbers">
            <span
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="idx"
              class="number-ball sports-ball sports-purple"
            >
              {{ num }}
            </span>
          </div>

          <!-- 体彩排列5（5个紫球） -->
          <div v-else-if="parseDrawNumber(value).length === 5 && (String(row.lottery_code) === '80003' || (row.lottery_name && row.lottery_name.includes('排列5')))" class="draw-numbers">
            <span
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="idx"
              class="number-ball sports-ball sports-purple"
            >
              {{ num }}
            </span>
          </div>

          <!-- 体彩七星彩（6紫+1金） -->
          <div v-else-if="parseDrawNumber(value).length === 7 && (String(row.lottery_code) === '80004' || (row.lottery_name && (row.lottery_name.includes('七星彩') || row.lottery_name.includes('7星彩'))))" class="draw-numbers">
            <template v-for="(num, idx) in parseDrawNumber(value)" :key="idx">
              <span
                class="number-ball sports-ball"
                :class="idx < 6 ? 'sports-purple' : 'sports-gold'"
              >
                {{ num }}
              </span>
              <span v-if="idx === 5" class="sports-separator">+</span>
            </template>
          </div>

          <!-- 台湾宾果宾果：20个号码分两排显示（必须在快乐8之前判断！） -->
          <div v-else-if="String(row.lottery_code) === '100007' && parseDrawNumber(value).length === 20" class="draw-numbers-multi-row">
            <!-- 第一排：前10个号码 -->
            <div class="kl8-row">
              <span
                v-for="(num, idx) in parseDrawNumber(value).slice(0, 10)"
                :key="`row1-${idx}`"
                class="number-ball"
                :class="getBallClass(num, parseDrawNumber(value), idx, row)"
              >
                {{ num }}
              </span>
            </div>

            <!-- 第二排：后10个号码 -->
            <div class="kl8-row">
              <span
                v-for="(num, idx) in parseDrawNumber(value).slice(10)"
                :key="`row2-${idx}`"
                class="number-ball"
                :class="getBallClass(num, parseDrawNumber(value), idx + 10, row)"
              >
                {{ num }}
              </span>
            </div>
          </div>

          <!-- 快乐8系列：20/21个号码分两排显示（但排除台湾宾果） -->
          <div v-else-if="parseDrawNumber(value).length === 20 || parseDrawNumber(value).length === 21" class="draw-numbers-multi-row">
            <!-- 第一排：前10个号码 -->
            <div class="kl8-row">
              <span
                v-for="(num, idx) in parseDrawNumber(value).slice(0, 10)"
                :key="`row1-${idx}`"
                class="number-ball"
                :class="getBallClass(num, parseDrawNumber(value), idx, row)"
              >
                {{ num }}
              </span>
            </div>

            <!-- 第二排：后10-11个号码 -->
            <div class="kl8-row">
              <span
                v-for="(num, idx) in parseDrawNumber(value).slice(10)"
                :key="`row2-${idx}`"
                class="number-ball"
                :class="getBallClass(num, parseDrawNumber(value), idx + 10, row)"
              >
                {{ num }}
              </span>
            </div>
          </div>

          <!-- 普通号码球显示 -->
          <div v-else class="draw-numbers">
            <span
              v-for="(num, idx) in parseDrawNumber(value)"
              :key="idx"
              class="number-ball"
              :class="getBallClass(num, parseDrawNumber(value), idx, row)"
            >
              {{ num }}
            </span>
          </div>
        </template>

        <!-- 自定义列：开奖时间 -->
        <template #column-draw_time="{ value }">
          <span class="time-text">{{ formatDateTime(value) }}</span>
        </template>

        <!-- 自定义列：来源 -->
        <template #column-source="{ value }">
          <span class="source-badge">{{ value }}</span>
        </template>
      </DataTable>

      <!-- 分页 -->
      <Pagination
        v-if="total > 0"
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import DataTable from '../components/common/DataTable.vue'
import Pagination from '../components/common/Pagination.vue'
import api from '../services/api'
import { useToast } from '../composables/useToast'

const toast = useToast()

// 查询参数
const searchParams = ref({
  lottery: '',
  date: '',
  year: new Date().getFullYear()  // 默认当前年份
})

// 彩种列表
const lotteries = ref([])

// 🎯 判断是否是年份查询彩种（香港六合彩、福彩、体彩、台湾低频彩票）
// 注意：台湾宾果宾果(100007)每天202期，按天查询，不按年查询
const isYearQueryLottery = computed(() => {
  const lotCode = searchParams.value.lottery
  // 宾果宾果(100007)按天查询，其他台湾彩票按年查询
  if (lotCode === '100007') return false
  return lotCode === '60001' || (lotCode && lotCode.startsWith('700')) || (lotCode && lotCode.startsWith('800')) || (lotCode && lotCode.startsWith('1000'))
})

// 🎯 日期/年份标签动态切换
const dateYearLabel = computed(() => {
  return isYearQueryLottery.value ? '选择年份' : '选择日期'
})

// 🎯 年份选项（2011-当前年份）
const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let year = currentYear; year >= 2011; year--) {
    years.push(year)
  }
  return years
})

// 表格数据
const allRecords = ref([])  // 所有筛选后的记录
const tableData = ref([])   // 当前页显示的记录
const loading = ref(false)

// 分页参数
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 数据完整性
const expectedCount = ref(0)
const isDataComplete = ref(true)

// 表格列配置
const columns = [
  { key: 'lottery_code', label: '彩种代码', sortable: true },
  { key: 'lottery_name', label: '彩种名称', sortable: true },
  { key: 'issue_number', label: '期号', sortable: true },
  { key: 'draw_number', label: '开奖号码' },
  { key: 'draw_time', label: '开奖时间', sortable: true },
  { key: 'source', label: '数据来源' }
]

// 更新当前页显示的数据（前端分页）
const updatePageData = () => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  tableData.value = allRecords.value.slice(start, end)
}

// 加载彩种列表
const loadLotteries = async () => {
  try {
    const response = await api.getLotteryConfigs()
    if (response.success) {
      lotteries.value = response.data.lotteries || []
      console.log('✅ 彩种列表加载成功:', lotteries.value.length, '个彩种')
    }
  } catch (error) {
    toast.error('加载彩种列表失败')
    console.error('❌ 加载彩种列表失败:', error)
  }
}

// 加载历史数据
const loadHistoryData = async () => {
  // 必须选择彩种
  if (!searchParams.value.lottery) {
    toast.warning('请先选择彩种')
    allRecords.value = []
    tableData.value = []
    total.value = 0
    return
  }

  try {
    loading.value = true
    console.log('🔍 开始查询历史数据:', searchParams.value)

    const params = {
      lotCode: searchParams.value.lottery,
      pageNo: 1,
      pageSize: 2000
    }

    // 🎯 根据彩种类型选择日期或年份参数
    if (isYearQueryLottery.value) {
      // HKJC (60001)、CWL福彩 (70001-70004) 和 体彩 (80001-80004) 使用年份查询
      if (!searchParams.value.year) {
        toast.warning('请选择年份')
        loading.value = false
        return
      }
      params.year = searchParams.value.year
      console.log('📅 查询指定年份:', params.year)
    } else {
      // 其他彩种使用日期查询
      if (searchParams.value.date) {
        params.date = searchParams.value.date
        console.log('📅 查询指定日期:', params.date)
      }
    }

    console.log('📤 API请求参数:', params)
    const response = await api.getHistoryData(params)
    console.log('📥 API响应:', response)

    if (response.success) {
      // 转换后端数据格式
      let records = (response.data.records || []).map(record => ({
        lottery_code: response.data.lotCode,
        lottery_name: response.data.name,
        issue_number: record.issue || record.issue_number,
        draw_number: record.draw_code || record.drawCode || record.draw_number,
        // 🎯 台湾宾果宾果超级奖号：API返回的是specialNumbers数组，需要转为字符串
        special_numbers: record.specialNumbers ? record.specialNumbers.join(',') : (record.special_numbers || null),
        draw_time: record.draw_time || record.drawTime,
        source: record.source || 'database'
      }))

      // 后端已经按日期过滤并自动补全数据，直接使用返回的记录
      console.log(`✅ 后端返回 ${records.length} 条记录`)

      // 保存所有记录
      allRecords.value = records
      total.value = records.length

      // 更新当前页显示的数据
      updatePageData()

      // 🎯 数据完整性检测（仅当选择了日期且不是年份查询彩种时检测）
      if (!isYearQueryLottery.value && searchParams.value.date && records.length > 0) {
        // 检查是否是今天的数据（今天的数据还在增长中，不应判断为不完整）
        const today = new Date().toISOString().split('T')[0]
        const isToday = searchParams.value.date === today

        if (isToday) {
          // 今天的数据不显示预期值和完整性判断
          expectedCount.value = 0
          isDataComplete.value = true
        } else {
          // 只对历史数据（非今天）进行完整性检测
          const lotCode = response.data.lotCode
          let expected = 0

          // 根据彩种判断预期数据量
          if (lotCode.startsWith('10')) {
            // SpeedyLot88 极速系列
            if (lotCode === '10098') {
              expected = 288  // 极速六合彩：每5分钟一期
            } else if (lotCode === '100007') {
              expected = 203  // 台湾宾果宾果：实际每天203期（官方开奖频率）
            } else {
              expected = 1152  // 其他极速系列：每75秒一期
            }
          } else if (lotCode.startsWith('20')) {
            // SG Lotteries
            expected = 288  // 每5分钟一期
          } else if (lotCode.startsWith('30')) {
            // AU Lucky Lotteries
            expected = 288  // 每5分钟一期
          } else if (lotCode === '40001') {
            // 幸运时时彩
            expected = 120  // 每天120期
          } else if (lotCode === '50001') {
            // 幸运飞艇
            expected = 180  // 每5分钟一期，销售日13:09~次日04:04
          } else if (lotCode.startsWith('90')) {
            // UK Lottos
            expected = 576  // 每2.5分钟一期
          }

          expectedCount.value = expected
          // 允许误差范围：-15条到+5条
          // 理由：数据源可能暂停、维护，或者期号不连续，但多出来的不应超过5条
          isDataComplete.value = expected === 0 || (records.length >= expected - 15 && records.length <= expected + 5)
        }
      } else {
        // 未选择日期或无数据时，不显示预期值
        expectedCount.value = 0
        isDataComplete.value = true
      }

      if (records.length === 0) {
        const timeInfo = isYearQueryLottery.value
          ? `年份：${searchParams.value.year}年`
          : `日期：${searchParams.value.date || '全部'}`
        toast.warning(`未找到数据 - 彩种：${response.data.name}，${timeInfo}`)
        console.log('📊 查询完成：未找到数据', { name: response.data.name, timeInfo })
      } else {
        // 查询成功不显示toast（避免过于频繁）
        console.log('✅ 历史数据加载成功', {
          lotCode: response.data.lotCode,
          name: response.data.name,
          total: total.value,
          records: records.length,
          dateFilter: searchParams.value.date || '无',
          expected: expectedCount.value,
          complete: isDataComplete.value
        })
      }
    } else {
      toast.error(`查询失败：${response.error || '未知错误'}`)
      console.error('❌ 查询失败:', response.error)
      allRecords.value = []
      tableData.value = []
      total.value = 0
    }
  } catch (error) {
    toast.error(`查询失败：${error.message || '网络错误，请检查后端服务'}`)
    console.error('❌ 加载历史数据失败:', error)
    allRecords.value = []
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  currentPage.value = 1  // 重置到第一页
  loadHistoryData()
}

// 选择今天
const selectToday = () => {
  const today = new Date()
  searchParams.value.date = today.toISOString().split('T')[0]
}

// 选择昨天
const selectYesterday = () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  searchParams.value.date = yesterday.toISOString().split('T')[0]
}

// 分页变化
const handlePageChange = (page) => {
  currentPage.value = page
  updatePageData()  // 前端分页，只需要更新显示数据
}

// 行点击
const handleRowClick = (row) => {
  console.log('点击行:', row)
}

// 解析开奖号码
const parseDrawNumber = (numStr) => {
  if (!numStr) return []
  return numStr.toString().split(/[,，\s+]/).filter(n => n)
}

// 解析六合彩号码（处理6个号码格式，最后一个包含两个数字的情况）
const parseMarkSixNumbers = (numbers) => {
  if (!numbers || numbers.length === 0) return []

  // 如果已经是7个号码，直接返回
  if (numbers.length === 7) {
    return numbers
  }

  // 如果是6个号码，检查最后一个是否包含分隔符（| + 或 ,）
  if (numbers.length === 6) {
    const lastNum = numbers[5]
    // 检查最后一个号码是否包含分隔符
    if (lastNum && (lastNum.includes('|') || lastNum.includes('+') || lastNum.includes('，') || lastNum.includes(','))) {
      // 分割最后一个号码（支持 | + 或 , 分隔符）
      const splitted = lastNum.split(/[\|+，,]/).filter(n => n.trim())
      if (splitted.length === 2) {
        // 返回前5个 + 分割后的2个
        return [...numbers.slice(0, 5), splitted[0].trim(), splitted[1].trim()]
      }
    }
  }

  // 其他情况直接返回原数组
  return numbers
}

// 获取号码球颜色样式类
const getBallClass = (num, numbers, index, row) => {
  const totalNumbers = numbers.length

  // 10个号码的彩种（极速赛车PK10系列）使用专用颜色
  if (totalNumbers === 10) {
    const ballNum = parseInt(num, 10)
    if (ballNum >= 1 && ballNum <= 10) {
      return `ball-${ballNum}`
    }
  }

  // 5个号码的彩种（时时彩系列或11选5）
  if (totalNumbers === 5) {
    const ballNum = parseInt(num, 10)

    // 时时彩：号码0-9使用digit系列
    if (ballNum >= 0 && ballNum <= 9) {
      return `digit-${ballNum}`
    }

    // 11选5：号码10-11使用x5系列
    if (ballNum >= 10 && ballNum <= 11) {
      return `x5-${ballNum}`
    }
  }

  // 8个号码的彩种（快乐十分系列）使用happy系列颜色
  if (totalNumbers === 8) {
    const ballNum = parseInt(num, 10)
    if (ballNum >= 1 && ballNum <= 20) {
      return `happy-${ballNum}`
    }
  }

  // 20或21个号码的彩种（快乐8系列：英国乐透20、福彩快乐8、澳洲幸运20、SG快乐20、极速快乐8、台湾宾果宾果）
  if (totalNumbers === 20 || totalNumbers === 21) {
    // 🎯 台湾宾果宾果超级奖号（正中靶心号 Bull's Eye）：金色
    if (row && String(row.lottery_code) === '100007' && row.special_numbers) {
      const specialNumbers = row.special_numbers.split(',').map(n => n.trim())
      if (specialNumbers.includes(num)) {
        return 'taiwan-bingo-gold'
      }
    }

    // 特码（第21个球，快乐8系列）：金色
    if (totalNumbers === 21 && index === 20) {
      return 'kl8-special'
    }
    // 第一排（前10个）：红色渐变
    if (index >= 0 && index <= 9) {
      return 'kl8-row-1'
    }
    // 第二排（后10个）：蓝紫色渐变
    if (index >= 10 && index <= 19) {
      return 'kl8-row-2'
    }
  }

  // 7个号码的彩种（仅非六合彩的其他7号码彩种使用CSS颜色）
  // 注意：六合彩会用SVG球显示，这里的CSS类不会被使用
  // 其他7个号码的彩种（如体彩七乐彩等）不使用特殊颜色
  // if (totalNumbers === 7) {
  //   const ballNum = parseInt(num, 10)
  //   return getLhcBallColor(ballNum)
  // }

  // 其他默认颜色
  return ''
}

// 获取六合彩号码波色（香港官方配色）
const getLhcBallColor = (num) => {
  const ballNum = parseInt(num, 10)

  // 红波：01, 02, 07, 08, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46
  const redBalls = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46]

  // 蓝波：03, 04, 09, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48
  const blueBalls = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48]

  // 绿波：05, 06, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49
  const greenBalls = [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49]

  if (redBalls.includes(ballNum)) {
    return 'lhc-red'
  } else if (blueBalls.includes(ballNum)) {
    return 'lhc-blue'
  } else if (greenBalls.includes(ballNum)) {
    return 'lhc-green'
  }

  return ''
}

// 判断是否为K3彩种（快3骰子）
const isK3Lottery = (numbers, row) => {
  // 先检查彩种名称，排除排列3等其他3位数彩种
  const name = row?.lottery_name || ''
  const lotCode = String(row?.lottery_code || '')

  // 如果是排列3/排列5/福彩3D等，不是K3
  if (name.includes('排列') || name.includes('3D') || lotCode.startsWith('80')) {
    return false
  }

  // K3彩种特征：3个号码，每个号码都在1-6之间
  if (!numbers || numbers.length !== 3) {
    return false
  }

  // 必须名称包含"快3"或"K3"
  if (!name.includes('快3') && !name.includes('K3')) {
    return false
  }

  return numbers.every(num => {
    const n = parseInt(num, 10)
    return n >= 1 && n <= 6
  })
}

// 格式化日期时间
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

// 监听每页条数变化
watch(pageSize, () => {
  currentPage.value = 1  // 重置到第一页
  updatePageData()       // 更新显示
})

// 初始化
onMounted(() => {
  // 设置默认日期为今天
  const today = new Date()
  searchParams.value.date = today.toISOString().split('T')[0]

  // 只加载彩种列表，不自动加载历史数据
  loadLotteries()
  // 用户需要先选择彩种和日期，然后点击"查询"按钮
})
</script>

<style scoped>
/* 紧凑布局优化 */
.history-page {
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

/* 玻璃卡片 - 紧凑优化 */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

/* 查询面板 - 紧凑优化 */
.search-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  align-items: end;
}

/* 统计面板 - 紧凑优化 */
.stats-panel {
  padding: 12px 16px;
  margin-bottom: 16px;
}

.stats-content {
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}

/* 图表区域 */
.charts-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.chart-card {
  padding: 16px;
}

.chart-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

@media (max-width: 1400px) {
  .charts-section {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1401px) and (max-width: 1800px) {
  .charts-section {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-section .chart-card:last-child {
    grid-column: 1 / -1;
  }
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
}

.stat-item.highlight .stat-label {
  color: rgba(102, 126, 234, 0.8);
}

.stat-item.highlight .stat-value {
  font-size: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 警告样式（数据不完整） */
.stat-item.warning .stat-label {
  color: rgba(245, 158, 11, 0.8);
}

.stat-item.warning .stat-value {
  font-size: 16px;
  background: linear-gradient(135deg, var(--warning-color), #ef4444);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.incomplete-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  color: #ef4444;
  -webkit-background-clip: unset;
  -webkit-text-fill-color: unset;
}

/* 表单 - 紧凑优化 */
.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
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

.date-selector {
  display: flex;
  gap: 6px;
}

.btn-quick {
  height: 36px;
  padding: 0 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-quick:hover {
  background: var(--border-color);
  border-color: var(--glass-border);
}

.form-actions {
  display: flex;
  gap: 10px;
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
  gap: 6px;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: var(--glass-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--border-color);
}

/* 表格面板 */
.table-panel {
  min-height: 400px;
}

/* 开奖号码 - 紧凑优化 */
.draw-numbers {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

/* 快乐8系列多排显示容器 */
.draw-numbers-multi-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 快乐8每一排的容器 */
.kl8-row {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
}

.number-ball {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 6px;
  color: white !important;
  font-size: 11px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* ========== PK10系列专用颜色（10个号码彩种）========== */
.number-ball.ball-1 {
  background: linear-gradient(135deg, #ffeb3b 0%, #fdd835 50%, #ffeb3b 100%);
}

.number-ball.ball-2 {
  background: linear-gradient(135deg, #03a9f4 0%, #0288d1 50%, #03a9f4 100%);
}

.number-ball.ball-3 {
  background: linear-gradient(135deg, #607d8b 0%, #455a64 50%, #607d8b 100%);
}

.number-ball.ball-4 {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 50%, #ff9800 100%);
}

.number-ball.ball-5 {
  background: linear-gradient(135deg, #00bcd4 0%, #0097a7 50%, #00bcd4 100%);
}

.number-ball.ball-6 {
  background: linear-gradient(135deg, #673ab7 0%, #512da8 50%, #673ab7 100%);
}

.number-ball.ball-7 {
  background: linear-gradient(135deg, #9e9e9e 0%, #757575 50%, #9e9e9e 100%);
}

.number-ball.ball-8 {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 50%, #f44336 100%);
}

.number-ball.ball-9 {
  background: linear-gradient(135deg, #795548 0%, #5d4037 50%, #795548 100%);
}

.number-ball.ball-10 {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 50%, #4caf50 100%);
}

/* ========== 时时彩专用颜色（0-9数字）========== */
.number-ball.digit-0 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #ffd700;
}

.number-ball.digit-1 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #2196f3;
}

.number-ball.digit-2 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #9c27b0;
}

.number-ball.digit-3 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #f44336;
}

.number-ball.digit-4 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #00bcd4;
}

.number-ball.digit-5 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #4caf50;
}

.number-ball.digit-6 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #ff9800;
}

.number-ball.digit-7 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #673ab7;
}

.number-ball.digit-8 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #795548;
}

.number-ball.digit-9 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #607d8b;
}

/* ========== 快乐十分专用颜色（1-20号码）========== */
.number-ball.happy-1 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ff0000;
}

.number-ball.happy-2 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #8b0000;
}

.number-ball.happy-3 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ff8c00;
}

.number-ball.happy-4 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ff4500;
}

.number-ball.happy-5 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ffd700;
}

.number-ball.happy-6 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #9acd32;
}

.number-ball.happy-7 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #00ff00;
}

.number-ball.happy-8 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #006400;
}

.number-ball.happy-9 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #00fa9a;
}

.number-ball.happy-10 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #00ced1;
}

.number-ball.happy-11 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #40e0d0;
}

.number-ball.happy-12 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #0000ff;
}

.number-ball.happy-13 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #000080;
}

.number-ball.happy-14 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #87ceeb;
}

.number-ball.happy-15 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #8b008b;
}

.number-ball.happy-16 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #9400d3;
}

.number-ball.happy-17 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ff69b4;
}

.number-ball.happy-18 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #8b4513;
}

.number-ball.happy-19 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #708090;
}

.number-ball.happy-20 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #2f4f4f;
}

/* ========== 11选5专用颜色 ========== */
.number-ball.x5-10 {
  background: linear-gradient(135deg, #8bc34a 0%, #689f38 50%, #8bc34a 100%);
}

.number-ball.x5-11 {
  background: linear-gradient(135deg, #cddc39 0%, #afb42b 50%, #cddc39 100%);
}

/* ========== 快乐8系列颜色（英国乐透20、福彩快乐8、澳洲幸运20、SG快乐20、极速快乐8）========== */
.number-ball.kl8-row-1 {
  background:
    radial-gradient(circle at 30% 30%, var(--text-muted), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
}

.number-ball.kl8-row-2 {
  background:
    radial-gradient(circle at 30% 30%, var(--text-muted), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.number-ball.kl8-special {
  background:
    radial-gradient(circle at 30% 30%, var(--text-secondary), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  font-weight: bold;
}

/* ========== 台湾宾果宾果超级奖号金色球 ========== */
.number-ball.taiwan-bingo-gold {
  background:
    radial-gradient(circle at 30% 30%, var(--text-secondary), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%);
  font-weight: bold;
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
  animation: golden-pulse-history 2s ease-in-out infinite;
}

@keyframes golden-pulse-history {
  0%, 100% {
    box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
  }
  50% {
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.8);
  }
}

/* ========== 六合彩波色样式（香港官方配色 - 基于 HKJC 官方 SVG）========== */
.number-ball.lhc-red {
  background:
    radial-gradient(ellipse 60% 50% at 35% 30%, var(--text-secondary), transparent 60%),
    linear-gradient(135deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.42) 100%),
    linear-gradient(135deg, #E04242 0%, #96261C 100%);
  color: #000000 !important;
  border: 2px solid #FFFFFF;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 -1px 3px rgba(0, 0, 0, 0.2);
  font-weight: bold;
  text-shadow: 0 0.5px 1px var(--text-subtle);
}

.number-ball.lhc-blue {
  background:
    radial-gradient(ellipse 60% 50% at 35% 30%, var(--text-secondary), transparent 60%),
    linear-gradient(135deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.42) 100%),
    linear-gradient(135deg, #3894D6 0%, #00397B 100%);
  color: #000000 !important;
  border: 2px solid #FFFFFF;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 -1px 3px rgba(0, 0, 0, 0.2);
  font-weight: bold;
  text-shadow: 0 0.5px 1px var(--text-subtle);
}

.number-ball.lhc-green {
  background:
    radial-gradient(ellipse 60% 50% at 35% 30%, var(--text-secondary), transparent 60%),
    linear-gradient(135deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.42) 100%),
    linear-gradient(135deg, #78AB53 0%, #356015 100%);
  color: #000000 !important;
  border: 2px solid #FFFFFF;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 -1px 3px rgba(0, 0, 0, 0.2);
  font-weight: bold;
  text-shadow: 0 0.5px 1px var(--text-subtle);
}

/* ========== 六合彩官方SVG球样式 ========== */
.marksix-ball-svg {
  width: 32px;
  height: 32px;
  margin: 0 4px;
  display: inline-block;
  vertical-align: middle;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.15));
  transition: transform 0.2s ease;
}

.marksix-ball-svg:hover {
  transform: scale(1.1);
}

.marksix-plus {
  display: inline-block;
  margin: 0 8px;
  font-size: 22px;
  font-weight: bold;
  color: #666;
  vertical-align: middle;
}

/* ========== 中国福彩官方配色 ========== */

/* 福彩号码球基础样式 */
.cwl-ball {
  width: 36px !important;
  height: 36px !important;
  line-height: 36px !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  border: none !important;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25), inset 0 -2px 4px rgba(0, 0, 0, 0.15), inset 0 2px 4px var(--text-muted) !important;
  transition: all 0.3s ease !important;
}

.cwl-ball:hover {
  transform: translateY(-3px) scale(1.08) !important;
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2), inset 0 2px 6px var(--text-tertiary) !important;
}

/* 福彩红球 - 双色球/七乐彩 */
.cwl-red {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #E63946, #C21E2A) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 福彩蓝球 - 双色球 */
.cwl-blue {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #1E88E5, #0D47A1) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 福彩橙球 - 七乐彩特别号码 */
.cwl-orange {
  background:
    radial-gradient(circle at 35% 35%, var(--text-secondary), transparent 50%),
    radial-gradient(circle at 50% 50%, #FF6B35, #E8530A) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 福彩3D金球 */
.cwl-3d {
  background:
    radial-gradient(circle at 35% 35%, var(--text-secondary), transparent 50%),
    linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%) !important;
  color: #5D2A00 !important;
  text-shadow: 0 1px 2px var(--text-tertiary), 0 0 10px rgba(255, 215, 0, 0.6) !important;
  box-shadow: 0 3px 10px rgba(255, 165, 0, 0.4), inset 0 -2px 4px rgba(139, 69, 19, 0.2), inset 0 2px 6px var(--text-secondary) !important;
}

.cwl-3d:hover {
  box-shadow: 0 6px 20px rgba(255, 165, 0, 0.5), inset 0 -2px 4px rgba(139, 69, 19, 0.25), inset 0 2px 8px var(--text-secondary) !important;
}

/* 福彩号码分隔符 */
.cwl-separator {
  display: inline-block;
  margin: 0 10px;
  font-size: 24px;
  font-weight: bold;
  color: #666;
  vertical-align: middle;
}

/* ========== 中国体彩官方配色 ========== */

/* 体彩号码球基础样式 */
.sports-ball {
  width: 36px !important;
  height: 36px !important;
  line-height: 36px !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  border: none !important;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25), inset 0 -2px 4px rgba(0, 0, 0, 0.15), inset 0 2px 4px var(--text-muted) !important;
  transition: all 0.3s ease !important;
}

.sports-ball:hover {
  transform: translateY(-3px) scale(1.08) !important;
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2), inset 0 2px 6px var(--text-tertiary) !important;
}

/* 体彩红球 - 大乐透前区 */
.sports-red {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #E8383D, #C62828) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 体彩蓝球 - 大乐透后区 */
.sports-blue {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #1976D2, #0D47A1) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 体彩紫球 - 排列3/排列5/七星彩前6位 */
.sports-purple {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #7B5FA5, #5E3A8A) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 体彩金球 - 七星彩特别号码 */
.sports-gold {
  background:
    radial-gradient(circle at 35% 35%, var(--text-secondary), transparent 50%),
    linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%) !important;
  color: #5D2A00 !important;
  text-shadow: 0 1px 2px var(--text-tertiary), 0 0 10px rgba(255, 215, 0, 0.6) !important;
  box-shadow: 0 3px 10px rgba(255, 165, 0, 0.4), inset 0 -2px 4px rgba(139, 69, 19, 0.2), inset 0 2px 6px var(--text-secondary) !important;
}

.sports-gold:hover {
  box-shadow: 0 6px 20px rgba(255, 165, 0, 0.5), inset 0 -2px 4px rgba(139, 69, 19, 0.25), inset 0 2px 8px var(--text-secondary) !important;
}

/* 体彩号码分隔符 */
.sports-separator {
  display: inline-block;
  margin: 0 10px;
  font-size: 24px;
  font-weight: bold;
  color: #666;
  vertical-align: middle;
}

/* ========== 台湾彩券官方配色 ========== */

/* 台湾彩券号码球基础样式 */
.taiwan-ball {
  width: 32px !important;
  height: 32px !important;
  line-height: 32px !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  border: none !important;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25), inset 0 -2px 4px rgba(0, 0, 0, 0.15), inset 0 2px 4px var(--text-muted) !important;
  transition: all 0.3s ease !important;
}

.taiwan-ball:hover {
  transform: translateY(-3px) scale(1.08) !important;
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2), inset 0 2px 6px var(--text-tertiary) !important;
}

/* 威力彩红球（普通号码 1-38） */
.taiwan-lotto649-red {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #E53E3E, #C53030) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 威力彩金球（第二区号码 1-8） */
.taiwan-lotto649-gold {
  background:
    radial-gradient(circle at 35% 35%, var(--text-secondary), transparent 50%),
    linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%) !important;
  color: #5D2A00 !important;
  text-shadow: 0 1px 2px var(--text-tertiary), 0 0 10px rgba(255, 215, 0, 0.6) !important;
  box-shadow: 0 3px 10px rgba(255, 165, 0, 0.4), inset 0 -2px 4px rgba(139, 69, 19, 0.2), inset 0 2px 6px var(--text-secondary) !important;
}

.taiwan-lotto649-gold:hover {
  box-shadow: 0 6px 20px rgba(255, 165, 0, 0.5), inset 0 -2px 4px rgba(139, 69, 19, 0.25), inset 0 2px 8px var(--text-secondary) !important;
}

/* 大乐透蓝球（普通号码 1-49） */
.taiwan-biglotto-blue {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #3182CE, #2C5282) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 大乐透橙球（特别号 1-49） */
.taiwan-biglotto-orange {
  background:
    radial-gradient(circle at 35% 35%, var(--text-secondary), transparent 50%),
    radial-gradient(circle at 50% 50%, #FF8C00, #E67700) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
  box-shadow: 0 3px 10px rgba(255, 140, 0, 0.4), inset 0 -2px 4px rgba(0, 0, 0, 0.2), inset 0 2px 6px var(--text-secondary) !important;
}

.taiwan-biglotto-orange:hover {
  box-shadow: 0 6px 20px rgba(255, 140, 0, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.25), inset 0 2px 8px var(--text-secondary) !important;
}

/* 今彩539紫球（号码 1-39） */
.taiwan-539-purple {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #9333EA, #7E22CE) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 3D/三星彩绿球（数字 0-9） */
.taiwan-3d-green {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #10B981, #059669) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 4D/四星彩橙球（数字 0-9） */
.taiwan-4d-orange {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #F97316, #EA580C) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 39选5深金色球（号码 1-39） - 深金色配色 */
.taiwan-39m5-yellow {
  background:
    radial-gradient(circle at 35% 35%, #FCD34D, transparent 50%),
    linear-gradient(135deg, #F59E0B 0%, #D97706 100%) !important;
  color: white !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 10px rgba(251, 191, 36, 0.5) !important;
  box-shadow: 0 3px 10px rgba(217, 119, 6, 0.5), inset 0 -2px 4px rgba(146, 64, 14, 0.3), inset 0 2px 6px #FCD34D !important;
}

.taiwan-39m5-yellow:hover {
  box-shadow: 0 6px 20px rgba(217, 119, 6, 0.6), inset 0 -2px 4px rgba(146, 64, 14, 0.4), inset 0 2px 8px #FCD34D !important;
  transform: translateY(-1px);
}

/* 49选6深金色球（号码 1-49） - 深金色配色 */
.taiwan-49m6-yellow {
  background:
    radial-gradient(circle at 35% 35%, #FCD34D, transparent 50%),
    linear-gradient(135deg, #F59E0B 0%, #D97706 100%) !important;
  color: white !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 10px rgba(251, 191, 36, 0.5) !important;
  box-shadow: 0 3px 10px rgba(217, 119, 6, 0.5), inset 0 -2px 4px rgba(146, 64, 14, 0.3), inset 0 2px 6px #FCD34D !important;
}

.taiwan-49m6-yellow:hover {
  box-shadow: 0 6px 20px rgba(217, 119, 6, 0.6), inset 0 -2px 4px rgba(146, 64, 14, 0.4), inset 0 2px 8px #FCD34D !important;
  transform: translateY(-1px);
}

/* 台湾彩券号码分隔符 */
.taiwan-separator {
  display: inline-block;
  margin: 0 10px;
  font-size: 24px;
  font-weight: bold;
  color: #666;
  vertical-align: middle;
}

/* ========== K3骰子样式 ========== */
.k3-display {
  gap: 8px !important;
}

.k3-dice-wrapper {
  display: inline-block;
  perspective: 1000px;
  margin: 0 4px;
  position: relative;
}

.k3-dice-wrapper::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 4px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, transparent 70%);
  border-radius: 50%;
  transition: all 0.3s ease;
}

.k3-dice-wrapper:hover::after {
  width: 100%;
  height: 6px;
  bottom: -4px;
  background: radial-gradient(ellipse at center, rgba(102,126,234,0.3) 0%, transparent 70%);
}

.k3-dice-3d {
  width: 40px;
  height: 40px;
  position: relative;
  transform-style: preserve-3d;
  cursor: pointer;
  will-change: transform;
}

.k3-dice-wrapper:not(:hover) .k3-dice-3d {
  transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.size-history .k3-dice-3d {
  width: 30px;
  height: 30px;
}

.dice-face {
  position: absolute;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 3px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  padding: 3px;
  box-shadow:
    inset 0 2px 4px var(--text-secondary),
    0 2px 6px rgba(0, 0, 0, 0.2);
}

.dot {
  position: absolute;
  width: 20%;
  height: 20%;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.dot.red {
  background: radial-gradient(circle at 30% 30%, var(--error-color), #ee5a6f);
}

.dot.blue {
  background: radial-gradient(circle at 30% 30%, #4dabf7, #339af0);
}

.dot.center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.dot.top-left {
  top: 15%;
  left: 15%;
}

.dot.top-right {
  top: 15%;
  right: 15%;
}

.dot.middle-left {
  top: 50%;
  left: 15%;
  transform: translateY(-50%);
}

.dot.middle-right {
  top: 50%;
  right: 15%;
  transform: translateY(-50%);
}

.dot.bottom-left {
  bottom: 15%;
  left: 15%;
}

.dot.bottom-right {
  bottom: 15%;
  right: 15%;
}

/* 六个面的位置 */
.face-1 {
  transform: rotateY(0deg) translateZ(20px);
}

.face-2 {
  transform: rotateY(90deg) translateZ(20px);
}

.face-3 {
  transform: rotateY(180deg) translateZ(20px);
}

.face-4 {
  transform: rotateY(-90deg) translateZ(20px);
}

.face-5 {
  transform: rotateX(90deg) translateZ(20px);
}

.face-6 {
  transform: rotateX(-90deg) translateZ(20px);
}

.size-history .face-1 {
  transform: rotateY(0deg) translateZ(15px);
}

.size-history .face-2 {
  transform: rotateY(90deg) translateZ(15px);
}

.size-history .face-3 {
  transform: rotateY(180deg) translateZ(15px);
}

.size-history .face-4 {
  transform: rotateY(-90deg) translateZ(15px);
}

.size-history .face-5 {
  transform: rotateX(90deg) translateZ(15px);
}

.size-history .face-6 {
  transform: rotateX(-90deg) translateZ(15px);
}

/* 显示对应的面 */
.k3-dice-3d.show-1 {
  transform: rotateX(0deg) rotateY(0deg);
}

.k3-dice-3d.show-2 {
  transform: rotateX(0deg) rotateY(-90deg);
}

.k3-dice-3d.show-3 {
  transform: rotateX(0deg) rotateY(-180deg);
}

.k3-dice-3d.show-4 {
  transform: rotateX(0deg) rotateY(90deg);
}

.k3-dice-3d.show-5 {
  transform: rotateX(-90deg) rotateY(0deg);
}

.k3-dice-3d.show-6 {
  transform: rotateX(90deg) rotateY(0deg);
}

/* 悬停旋转效果 */
.k3-dice-wrapper {
  transition: transform 0.3s ease;
}

.k3-dice-wrapper:hover {
  transform: scale(1.1);
}

.k3-dice-wrapper:hover .k3-dice-3d.show-1 {
  animation: dice-rotate-1 2s linear infinite !important;
}

.k3-dice-wrapper:hover .k3-dice-3d.show-2 {
  animation: dice-rotate-2 2s linear infinite !important;
}

.k3-dice-wrapper:hover .k3-dice-3d.show-3 {
  animation: dice-rotate-3 2s linear infinite !important;
}

.k3-dice-wrapper:hover .k3-dice-3d.show-4 {
  animation: dice-rotate-4 2s linear infinite !important;
}

.k3-dice-wrapper:hover .k3-dice-3d.show-5 {
  animation: dice-rotate-5 2s linear infinite !important;
}

.k3-dice-wrapper:hover .k3-dice-3d.show-6 {
  animation: dice-rotate-6 2s linear infinite !important;
}

/* 旋转动画 */
@keyframes dice-rotate-1 {
  0% { transform: rotateX(0deg) rotateY(0deg); }
  100% { transform: rotateX(360deg) rotateY(360deg); }
}

@keyframes dice-rotate-2 {
  0% { transform: rotateX(0deg) rotateY(-90deg); }
  100% { transform: rotateX(360deg) rotateY(270deg); }
}

@keyframes dice-rotate-3 {
  0% { transform: rotateX(0deg) rotateY(-180deg); }
  100% { transform: rotateX(360deg) rotateY(180deg); }
}

@keyframes dice-rotate-4 {
  0% { transform: rotateX(0deg) rotateY(90deg); }
  100% { transform: rotateX(360deg) rotateY(450deg); }
}

@keyframes dice-rotate-5 {
  0% { transform: rotateX(-90deg) rotateY(0deg); }
  100% { transform: rotateX(270deg) rotateY(360deg); }
}

@keyframes dice-rotate-6 {
  0% { transform: rotateX(90deg) rotateY(0deg); }
  100% { transform: rotateX(450deg) rotateY(360deg); }
}

.k3-dice-wrapper:hover .dice-face {
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.1),
    0 0 20px rgba(102, 126, 234, 0.4);
}

/* 时间文本 */
.time-text {
  font-family: 'Courier New', monospace;
  color: var(--text-secondary);
  font-size: 12px;
}

/* 来源徽章 */
.source-badge {
  display: inline-block;
  padding: 3px 10px;
  background: rgba(67, 233, 123, 0.1);
  border: 1px solid rgba(67, 233, 123, 0.3);
  border-radius: 12px;
  color: var(--success-color);
  font-size: 11px;
  font-weight: 500;
}

/* 响应式 - 3级断点 */

/* 平板 (≤ 1024px) */
@media (max-width: 1024px) {
  .history-page {
    padding: 12px;
  }

  .glass-card {
    padding: 14px;
    margin-bottom: 12px;
  }

  .search-form {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
  }

  .stats-panel {
    padding: 10px 14px;
  }

  .stats-content {
    gap: 20px;
  }
}

/* 手机横屏 (≤ 768px) */
@media (max-width: 768px) {
  .history-page {
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

  .search-form {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stats-panel {
    padding: 10px 12px;
  }

  .stats-content {
    gap: 16px;
  }

  .stat-label {
    font-size: 12px;
  }

  .stat-value {
    font-size: 13px;
  }

  .form-item label {
    font-size: 11px;
  }

  .form-select,
  .form-input {
    height: 34px;
    font-size: 12px;
  }

  .btn-quick {
    height: 34px;
    padding: 0 10px;
    font-size: 12px;
  }

  .btn-primary,
  .btn-secondary {
    height: 34px;
    padding: 0 14px;
    font-size: 12px;
  }

  .form-actions {
    flex-direction: column;
    gap: 8px;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    justify-content: center;
  }

  .number-ball {
    min-width: 24px;
    height: 24px;
    padding: 0 5px;
    font-size: 10px;
  }
}

/* 手机竖屏 (≤ 480px) */
@media (max-width: 480px) {
  .history-page {
    padding: 8px;
  }

  .page-title {
    font-size: 18px;
  }

  .glass-card {
    padding: 10px;
    border-radius: 10px;
  }

  .search-form {
    gap: 6px;
  }

  .stats-panel {
    padding: 8px 10px;
  }

  .stats-content {
    gap: 12px;
    flex-direction: column;
    align-items: flex-start;
  }

  .stat-item {
    width: 100%;
  }

  .form-select,
  .form-input {
    height: 32px;
    padding: 0 8px;
  }

  .btn-quick {
    height: 32px;
    padding: 0 8px;
    font-size: 11px;
  }

  .btn-primary,
  .btn-secondary {
    height: 32px;
    padding: 0 12px;
  }

  .date-selector {
    flex-direction: column;
    gap: 6px;
  }

  .number-ball {
    min-width: 22px;
    height: 22px;
    padding: 0 4px;
    font-size: 10px;
  }

  .source-badge {
    padding: 2px 8px;
    font-size: 10px;
  }
}
</style>
