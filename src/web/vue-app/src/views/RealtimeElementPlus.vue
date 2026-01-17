<template>
  <div class="realtime-element-plus">
    <!-- 页面头部 -->
    <div class="page-header glass-card">
      <div class="header-content">
        <div class="header-left">
          <h1 class="page-title">
            <el-icon class="title-icon"><Lightning /></el-icon>
            实时彩种监控
          </h1>
          <p class="page-subtitle">共 {{ filteredLotteries.length }} 个彩种正在监控</p>
        </div>

        <div class="header-right">
          <el-input
            v-model="searchQuery"
            placeholder="搜索彩种名称..."
            :prefix-icon="Search"
            clearable
            style="width: 300px"
          />
        </div>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="filter-section glass-card">
      <el-tabs v-model="currentCategory" @tab-change="handleCategoryChange">
        <el-tab-pane
          v-for="category in categories"
          :key="category.key"
          :label="category.label"
          :name="category.key"
        >
          <template #label>
            <span class="custom-tab-label">
              <span class="tab-icon">{{ category.icon }}</span>
              <span>{{ category.label }}</span>
              <el-badge v-if="category.count" :value="category.count" class="tab-badge" />
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 彩种卡片网格 -->
    <div class="lottery-grid">
      <HolographicCard
        v-for="lottery in filteredLotteries"
        :key="lottery.code"
        class="lottery-card"
        :class="{ 'card-updating': lottery.updating }"
        :border="true"
        :hover="true"
      >
        <!-- 卡片头部 -->
        <template #header>
          <div class="card-header-content">
            <div class="lottery-info">
              <span class="lottery-icon">{{ lottery.icon }}</span>
              <div class="lottery-name-wrap">
                <h3 class="lottery-name">{{ lottery.name }}</h3>
                <span class="lottery-code">{{ lottery.code }}</span>
              </div>
            </div>
            <GlowingTag
              :type="getStatusType(lottery)"
              :text="getStatusText(lottery)"
              size="small"
              effect="dark"
              :pulse="lottery.updating"
            />
          </div>
        </template>

        <!-- 卡片内容 -->
        <div class="card-content">
          <!-- 期号信息 -->
          <div class="period-section">
            <div class="period-info">
              <span class="period-label">期号</span>
              <span class="period-number" :title="lottery.data?.period || '---'">{{ formatPeriod(lottery.data?.period) }}</span>
            </div>
            <div class="countdown-info" :class="getCountdownClass(lottery)">
              <el-icon><Timer /></el-icon>
              <span>{{ formatCountdown(lottery) }}</span>
            </div>
          </div>

          <!-- 开奖号码 -->
          <div class="numbers-section">
            <div v-if="lottery.data?.numbers && lottery.data.numbers.length > 0" class="numbers-display">
              <!-- 六合彩 SVG球显示 - 一行显示 -->
              <template v-if="(lottery.data.numbers.length === 6 || lottery.data.numbers.length === 7) && (lottery.name.includes('六合彩') || lottery.name.includes('Mark Six'))">
                <div class="numbers-row-single marksix-row">
                  <template v-for="(num, idx) in parseMarkSixNumbers(lottery.data.numbers)" :key="idx">
                    <img
                      :src="`assets/lottery-balls/marksix-${parseInt(num, 10)}.svg`"
                      :alt="`号码${num}`"
                      class="marksix-ball-svg"
                    />
                    <span v-if="idx === 5" class="marksix-plus">+</span>
                  </template>
                </div>
              </template>

              <!-- K3骰子显示 -->
              <template v-else-if="isK3Lottery(lottery)">
                <div class="numbers-row-single">
                  <div
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="`k3-${idx}`"
                    class="k3-dice-wrapper size-mini"
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
              </template>

              <!-- 台湾宾果（20个粉红球，必须在多排布局之前判断） -->
              <template v-else-if="String(lottery.lotCode) === '100007' && lottery.data.numbers.length === 20">
                <div class="numbers-multi-row">
                  <div class="numbers-row">
                    <span
                      v-for="(num, idx) in lottery.data.numbers.slice(0, 10)"
                      :key="'row1-' + idx"
                      class="number-ball taiwan-ball"
                      :class="lottery.data.specialNumbers && lottery.data.specialNumbers.includes(num) ? 'taiwan-bingo-gold' : 'taiwan-bingo-pink'"
                    >
                      {{ num }}
                    </span>
                  </div>
                  <div class="numbers-row">
                    <span
                      v-for="(num, idx) in lottery.data.numbers.slice(10, 20)"
                      :key="'row2-' + idx"
                      class="number-ball taiwan-ball"
                      :class="lottery.data.specialNumbers && lottery.data.specialNumbers.includes(num) ? 'taiwan-bingo-gold' : 'taiwan-bingo-pink'"
                    >
                      {{ num }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- 福彩双色球（6红+1蓝） -->
              <template v-else-if="lottery.data.numbers.length === 7 && (String(lottery.lotCode) === '70001' || lottery.name.includes('双色球'))">
                <div class="numbers-row-single">
                  <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                    <span
                      class="number-ball cwl-ball"
                      :class="idx < 6 ? 'cwl-red' : 'cwl-blue'"
                    >
                      {{ num }}
                    </span>
                    <span v-if="idx === 5" class="cwl-separator">+</span>
                  </template>
                </div>
              </template>

              <!-- 福彩七乐彩（7红+1橙） -->
              <template v-else-if="lottery.data.numbers.length === 8 && (String(lottery.lotCode) === '70003' || lottery.name.includes('七乐彩'))">
                <div class="numbers-row-single">
                  <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                    <span
                      class="number-ball cwl-ball"
                      :class="idx < 7 ? 'cwl-red' : 'cwl-orange'"
                    >
                      {{ num }}
                    </span>
                    <span v-if="idx === 6" class="cwl-separator">+</span>
                  </template>
                </div>
              </template>

              <!-- 福彩3D（3个号码，金色球） -->
              <template v-else-if="lottery.data.numbers.length === 3 && (String(lottery.lotCode) === '70002' || lottery.name.includes('福彩3D'))">
                <div class="numbers-row-single">
                  <span
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="idx"
                    class="number-ball cwl-ball cwl-3d"
                  >
                    {{ num }}
                  </span>
                </div>
              </template>

              <!-- 威力彩（6红+1金） -->
              <template v-else-if="String(lottery.lotCode) === '100001' && lottery.data.numbers.length === 7">
                <div class="numbers-row-single">
                  <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                    <span
                      class="number-ball taiwan-ball"
                      :class="idx < 6 ? 'taiwan-lotto649-red' : 'taiwan-lotto649-gold'"
                    >
                      {{ num }}
                    </span>
                    <span v-if="idx === 5" class="taiwan-separator">+</span>
                  </template>
                </div>
              </template>

              <!-- 台湾大乐透（6蓝+1橙） -->
              <template v-else-if="String(lottery.lotCode) === '100002' && lottery.data.numbers.length === 7">
                <div class="numbers-row-single">
                  <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                    <span
                      class="number-ball taiwan-ball"
                      :class="idx < 6 ? 'taiwan-biglotto-blue' : 'taiwan-biglotto-orange'"
                    >
                      {{ num }}
                    </span>
                    <span v-if="idx === 5" class="taiwan-separator">+</span>
                  </template>
                </div>
              </template>

              <!-- 今彩539（5个紫球） -->
              <template v-else-if="String(lottery.lotCode) === '100003' && lottery.data.numbers.length === 5">
                <div class="numbers-row-single">
                  <span
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="idx"
                    class="number-ball taiwan-ball taiwan-539-purple"
                  >
                    {{ num }}
                  </span>
                </div>
              </template>

              <!-- 3D/三星彩（3个绿球） -->
              <template v-else-if="String(lottery.lotCode) === '100005' && lottery.data.numbers.length === 3">
                <div class="numbers-row-single">
                  <span
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="idx"
                    class="number-ball taiwan-ball taiwan-3d-green"
                  >
                    {{ num }}
                  </span>
                </div>
              </template>

              <!-- 4D/四星彩（4个橙球） -->
              <template v-else-if="String(lottery.lotCode) === '100006' && lottery.data.numbers.length === 4">
                <div class="numbers-row-single">
                  <span
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="idx"
                    class="number-ball taiwan-ball taiwan-4d-orange"
                  >
                    {{ num }}
                  </span>
                </div>
              </template>

              <!-- 39樂合彩/39选5（5个黄球） -->
              <template v-else-if="String(lottery.lotCode) === '100008' && lottery.data.numbers.length === 5">
                <div class="numbers-row-single">
                  <span
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="idx"
                    class="number-ball taiwan-ball taiwan-39m5-yellow"
                  >
                    {{ num }}
                  </span>
                </div>
              </template>

              <!-- 49樂合彩/49选6（6个黄球） -->
              <template v-else-if="String(lottery.lotCode) === '100009' && lottery.data.numbers.length === 6">
                <div class="numbers-row-single">
                  <span
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="idx"
                    class="number-ball taiwan-ball taiwan-49m6-yellow"
                  >
                    {{ num }}
                  </span>
                </div>
              </template>

              <!-- 体彩超级大乐透（5红+2蓝） -->
              <template v-else-if="lottery.data.numbers.length === 7 && String(lottery.lotCode) === '80001'">
                <div class="numbers-row-single">
                  <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                    <span
                      class="number-ball sports-ball"
                      :class="idx < 5 ? 'sports-red' : 'sports-blue'"
                    >
                      {{ num }}
                    </span>
                    <span v-if="idx === 4" class="sports-separator">+</span>
                  </template>
                </div>
              </template>

              <!-- 体彩排列3（3个紫球） -->
              <template v-else-if="lottery.data.numbers.length === 3 && (String(lottery.lotCode) === '80002' || lottery.name.includes('排列3'))">
                <div class="numbers-row-single">
                  <span
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="idx"
                    class="number-ball sports-ball sports-purple"
                  >
                    {{ num }}
                  </span>
                </div>
              </template>

              <!-- 体彩排列5（5个紫球） -->
              <template v-else-if="lottery.data.numbers.length === 5 && (String(lottery.lotCode) === '80003' || lottery.name.includes('排列5'))">
                <div class="numbers-row-single">
                  <span
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="idx"
                    class="number-ball sports-ball sports-purple"
                  >
                    {{ num }}
                  </span>
                </div>
              </template>

              <!-- 体彩七星彩（6紫+1金） -->
              <template v-else-if="lottery.data.numbers.length === 7 && (String(lottery.lotCode) === '80004' || lottery.name.includes('七星彩') || lottery.name.includes('7星彩'))">
                <div class="numbers-row-single">
                  <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                    <span
                      class="number-ball sports-ball"
                      :class="idx < 6 ? 'sports-purple' : 'sports-gold'"
                    >
                      {{ num }}
                    </span>
                    <span v-if="idx === 5" class="sports-separator">+</span>
                  </template>
                </div>
              </template>

              <!-- 普通号码显示 -->
              <template v-else>
                <!-- 简化的号码显示 -->
                <div v-if="lottery.data.numbers.length <= 10" class="numbers-row-single">
                  <span
                    v-for="(num, idx) in lottery.data.numbers"
                    :key="idx"
                    class="number-ball"
                    :class="getBallClass(lottery, idx)"
                  >
                    {{ num }}
                  </span>
                </div>

                <!-- 多行显示（>10个号码） -->
                <div v-else class="numbers-multi-row">
                  <div class="numbers-row">
                    <span
                      v-for="(num, idx) in lottery.data.numbers.slice(0, 10)"
                      :key="idx"
                      class="number-ball small"
                      :class="getBallClass(lottery, idx)"
                    >
                      {{ num }}
                    </span>
                  </div>
                  <div class="numbers-row">
                    <span
                      v-for="(num, idx) in lottery.data.numbers.slice(10)"
                      :key="idx + 10"
                      class="number-ball small"
                      :class="getBallClass(lottery, idx + 10)"
                    >
                      {{ num }}
                    </span>
                  </div>
                </div>
              </template>
            </div>
            <div v-else class="numbers-empty">
              <el-empty description="等待开奖" :image-size="60" />
            </div>
          </div>

          <!-- 开奖时间 -->
          <div v-if="lottery.data?.drawTime" class="draw-time">
            <el-icon><Clock /></el-icon>
            <span>{{ formatDrawTime(lottery.data.drawTime) }}</span>
          </div>
        </div>

        <!-- 卡片操作 -->
        <template #footer>
          <div class="card-actions">
            <NeonButton
              size="small"
              :icon="Refresh"
              :loading="lottery.updating"
              @click="refreshSingleLottery(lottery)"
            >
              刷新
            </NeonButton>
            <NeonButton
              size="small"
              :icon="View"
              @click="viewHistory(lottery)"
            >
              历史
            </NeonButton>
          </div>
        </template>
      </HolographicCard>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="filteredLotteries.length === 0"
      description="没有找到匹配的彩种"
      :image-size="200"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Lightning, Search, Timer, Clock, Refresh, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { HolographicCard, NeonButton, GlowingTag } from '../components/tech'
import api from '../services/api'
import { useWebSocket } from '../composables/useWebSocket'

const router = useRouter()

// WebSocket 实时推送
const { connected, subscribe, subscribeLotteries } = useWebSocket()

// 响应式数据
const lotteries = ref([])
const lotteryConfigs = ref([])
const currentCategory = ref('all')
const searchQuery = ref('')
const refreshQueue = new Set()

// 彩种图标映射
const iconMap = {
  'cqssc': '🎲',
  'tjssc': '🎰',
  'xjssc': '🎯',
  'pk10': '🏎️',
  'xyft': '✈️',
  'jnd28': '🎱',
  'k3': '🎲',
  'xglhc': '🀄',
  '11x5': '⭐',
  'kl10f': '🎊',
  'pcdd': '🎮'
}

// 分类配置
const categories = computed(() => {
  const all = lotteries.value.length
  const ssc = lotteries.value.filter(l => l.tags?.includes('时时彩')).length
  const pk10 = lotteries.value.filter(l => l.tags?.includes('赛车')).length
  const k3 = lotteries.value.filter(l => l.tags?.includes('快三')).length
  const x5 = lotteries.value.filter(l => l.tags?.includes('11选5')).length
  const kl10f = lotteries.value.filter(l => l.tags?.includes('快乐十分')).length
  const lhc = lotteries.value.filter(l => l.tags?.includes('六合彩')).length

  return [
    { key: 'all', label: '全部', icon: '🎯', count: all },
    { key: 'ssc', label: '时时彩', icon: '🎲', count: ssc },
    { key: 'pk10', label: '赛车', icon: '🏎️', count: pk10 },
    { key: 'k3', label: '快三', icon: '🎲', count: k3 },
    { key: 'x5', label: '11选5', icon: '⭐', count: x5 },
    { key: 'kl10f', label: '快乐十分', icon: '🎊', count: kl10f },
    { key: 'lhc', label: '六合彩', icon: '🀄', count: lhc }
  ]
})

// 筛选后的彩种列表
const filteredLotteries = computed(() => {
  let result = lotteries.value

  // 分类筛选
  if (currentCategory.value !== 'all') {
    const categoryTagMap = {
      'ssc': '时时彩',
      'pk10': '赛车',
      'k3': '快三',
      'x5': '11选5',
      'kl10f': '快乐十分',
      'lhc': '六合彩'
    }
    const tag = categoryTagMap[currentCategory.value]
    result = result.filter(l => l.tags?.includes(tag))
  }

  // 搜索筛选
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(l =>
      l.name.toLowerCase().includes(query) ||
      l.code.toLowerCase().includes(query)
    )
  }

  return result
})

// 🎯 开奖间隔配置(秒)
const drawIntervals = {
  // 极速系列(SpeedyLot88): 75秒
  '10035': 75,  // 极速飞艇
  '10036': 75,  // 极速时时彩
  '10037': 75,  // 极速赛车
  '10052': 75,  // 极速快3
  '10053': 75,  // 极速快乐十分
  '10054': 75,  // 极速快乐8
  '10055': 75,  // 极速11选5
  '10098': 300, // 极速六合彩: 5分钟

  // SG彩种: 5分钟
  '20001': 300, // SG飞艇
  '20002': 300, // SG时时彩
  '20003': 300, // SG快3
  '20004': 300, // SG快乐十分
  '20005': 300, // SG快乐8
  '20006': 300, // SG 11选5

  // AU彩种: 5分钟
  '30001': 300, // 澳洲幸运5
  '30002': 300, // 澳洲幸运8
  '30003': 300, // 澳洲幸运10
  '30004': 300, // 澳洲幸运20

  // UK彩种: 2.5分钟
  '90001': 150, // 英国乐透5
  '90002': 150, // 英国乐透8
  '90003': 150, // 英国乐透10
  '90004': 150, // 英国乐透20

  // 幸运系列: 5分钟
  '40001': 300, // 幸运飞艇
  '50001': 300, // 幸运时时彩

  // 香港六合彩: 按实际开奖周期
  '60001': 86400 * 3, // 香港六合彩: 每周二、四、六开奖

  // 福彩: 每日开奖
  '70001': 86400, // 福彩双色球
  '70002': 86400, // 福彩3D
  '70003': 86400, // 福彩七乐彩
  '70004': 86400, // 福彩快乐8

  // 体彩: 每日开奖
  '80001': 86400, // 超级大乐透
  '80002': 86400, // 排列3
  '80003': 86400, // 排列5
  '80004': 86400, // 七星彩

  // 台湾彩券: 每日开奖
  '100001': 86400, // 台湾威力彩
  '100002': 86400, // 台湾大乐透
  '100003': 86400, // 今彩539
  '100005': 86400, // 3D/三星彩
  '100006': 86400, // 4D/四星彩
  '100007': 300,   // 台湾宾果: 5分钟
  '100008': 86400, // 39樂合彩
  '100009': 86400  // 49樂合彩
}

// 获取彩种的开奖间隔
function getDrawInterval(lotCode) {
  const codeStr = String(lotCode)

  // 精确匹配
  if (drawIntervals[codeStr]) {
    return drawIntervals[codeStr]
  }

  // 降级: 根据lotCode前缀猜测
  if (codeStr.startsWith('100')) {
    // 100开头: 极速系列默认75秒
    return 75
  } else if (codeStr.startsWith('200') || codeStr.startsWith('300')) {
    // SG/AU彩种默认5分钟
    return 300
  } else if (codeStr.startsWith('900')) {
    // UK彩种默认2.5分钟
    return 150
  }

  // 默认5分钟
  return 300
}

// 🎯 核心修复: 本地计算倒计时(使用drawTime)
function calculateCountdownFromDrawTime(drawTime, interval) {
  if (!drawTime) return 0

  try {
    // 将 "2026-01-13 19:10:00" 转换为时间戳(GMT+8)
    const drawTimeMs = new Date(drawTime.replace(' ', 'T') + '+08:00').getTime()

    // 下次开奖时间 = 当前开奖时间 + 开奖间隔
    const nextDrawTimeMs = drawTimeMs + (interval * 1000)

    // 当前浏览器时间
    const nowMs = Date.now()

    // 计算倒计时(秒)
    const countdown = Math.max(0, Math.floor((nextDrawTimeMs - nowMs) / 1000))

    return countdown
  } catch (error) {
    console.error('计算倒计时失败:', error, 'drawTime:', drawTime)
    return 0
  }
}

// 初始化彩种数据
async function initLotteries() {
  try {
    // 加载彩种配置
    const configResponse = await api.getLotteryConfigs()
    if (configResponse.success && configResponse.data && configResponse.data.lotteries) {
      lotteryConfigs.value = configResponse.data.lotteries

      // 初始化彩种列表
      lotteries.value = configResponse.data.lotteries
        .filter(config => config.enabled && config.scraperKey)
        .map(config => ({
          code: config.scraperKey,
          lotCode: config.lotCode,
          name: config.name,
          icon: iconMap[config.scraperKey] || '🎲',
          tags: config.tags || [],
          interval: config.interval,
          scraperKey: config.scraperKey,
          data: null,
          countdown: 0,
          updating: false,
          zeroStartTime: null  // 🔧 修复：记录倒计时归零时间，用于检测长时间卡在0的情况
        }))

      console.log(`✅ 初始化 ${lotteries.value.length} 个彩种`)
    }
  } catch (error) {
    console.error('加载彩种配置失败:', error)
    ElMessage.error('加载彩种配置失败')
  }
}

// 加载所有彩种数据
async function loadAllLotteriesData() {
  try {
    const response = await api.getLatestData()

    if (response.success && response.data) {
      // 🔧 过滤掉null值，避免报错
      const latestDataList = response.data.filter(item => item !== null)

      lotteries.value.forEach(lottery => {
        const matchedData = latestDataList.find(item => item.lotCode === lottery.lotCode)
        if (matchedData) {
          updateLotteryData(lottery, matchedData, 'http')
        }
      })

      console.log(`✅ 已加载 ${latestDataList.length} 个彩种的最新数据`)
    }
  } catch (error) {
    console.error('加载彩种数据失败:', error)
    ElMessage.error('加载彩种数据失败')
  }
}

// 更新单个彩种数据
// source参数: 'http' = 页面加载HTTP API, 'websocket' = WebSocket推送, 'refresh' = 手动刷新
function updateLotteryData(lottery, data, source = 'websocket') {
  let numbers = data.drawCode
    ? data.drawCode.split(',').map(n => n.trim().padStart(2, '0'))
    : []

  // 🎯 六合彩特殊处理
  if (lottery.name.includes('六合彩') || lottery.name.includes('Mark Six')) {
    console.log(`[${lottery.name}] 原始drawCode:`, data.drawCode)
    console.log(`[${lottery.name}] 分割后numbers:`, numbers)
    console.log(`[${lottery.name}] extra字段:`, data.extra)

    // 如果有 extra 字段（特别号），添加到 numbers 数组
    if (data.extra) {
      numbers.push(data.extra.toString().padStart(2, '0'))
      console.log(`[${lottery.name}] 添加extra后:`, numbers)
    }
    // 🔧 修复：检查最后一个元素是否包含管道符（不限制数组长度）
    // 原因:香港六合彩drawCode可能是 "3,16,20,22,24,37,42|42" (7个元素)
    else if (numbers.length > 0 &&
             numbers[numbers.length - 1] &&
             (numbers[numbers.length - 1].includes('|') || numbers[numbers.length - 1].includes('+'))) {
      console.log(`[${lottery.name}] 检测到管道符，调用parseMarkSixNumbers`)
      numbers = parseMarkSixNumbers(numbers)
      console.log(`[${lottery.name}] 解析后numbers:`, numbers)
    }

    console.log(`[${lottery.name}] 最终numbers:`, numbers)
  }

  const lotCodeStr = String(data.lotCode)
  const isSGLottery = lotCodeStr.startsWith('200')

  // 正常更新数据
  lottery.data = {
    lotCode: data.lotCode,
    lotName: data.name,
    period: data.issue,
    numbers: numbers,
    specialNumbers: data.specialNumbers || null,
    drawTime: data.drawTime,
    source: data.source || 'official',
    officialCountdown: data.officialCountdown
  }

  // ✅ 修复：所有彩种统一使用后端计算的officialCountdown
  // 后端已经精确计算了倒计时（包括SG彩种），前端不需要再次计算
  // 之前的错误：误以为drawTime是上一期时间，导致多加了300秒
  lottery.countdown = data.officialCountdown || 0

  // 🔍 SG彩种监控日志（保留用于调试）
  if (isSGLottery && source === 'websocket') {
    console.log(`🎯 [${lottery.name}] WebSocket推送新期号`)
    console.log(`   - drawTime: ${data.drawTime}`)
    console.log(`   - 后端officialCountdown: ${data.officialCountdown}秒`)
    console.log(`   - 前端使用countdown: ${lottery.countdown}秒`)
  }
  const sourceLabel = source === 'websocket' ? 'WebSocket推送' : (source === 'refresh' ? '手动刷新' : 'HTTP加载')
  const typeLabel = isSGLottery ? 'SG彩种' : '其他彩种'

  // 🔧 修复：清除归零计时器标记（当接收到新数据时）
  if (lottery.countdown > 0 && lottery.zeroStartTime) {
    lottery.zeroStartTime = null
  }

  // 清除等待新期号标记
  lottery.waitingForNewPeriod = false
  lottery.pendingData = null
}

// 🚀 智能倒计时校准函数
function calibrateCountdown(lottery, data) {
  // 🔧 修复：直接使用后端返回的officialCountdown，不要在前端重新计算
  // 原因：后端已经通过官网实时倒计时API获取准确的倒计时(+13秒校正)
  // 前端重新计算容易出现时区、时间解析等问题，导致倒计时异常(如1分44秒)

  const countdown = data.officialCountdown || 0

  const isHighFrequency = lottery.interval && lottery.interval < 3600
  const typeLabel = isHighFrequency ? '高频彩' : '低频彩'

  console.log(`🕐 [${lottery.name}] ${typeLabel}使用后端倒计时: ${countdown}秒`)

  return countdown
}

// 刷新单个彩种
async function refreshSingleLottery(lottery) {
  if (refreshQueue.has(lottery.lotCode)) {
    return
  }

  refreshQueue.add(lottery.lotCode)
  lottery.updating = true

  try {
    const response = await api.getLatestData()

    if (response.success && response.data) {
      const matchedData = response.data.find(item => item.lotCode === lottery.lotCode)
      if (matchedData) {
        updateLotteryData(lottery, matchedData, 'refresh')
        ElMessage.success(`${lottery.name} 刷新成功`)
      }
    }
  } catch (error) {
    console.error(`刷新 ${lottery.name} 失败:`, error)
    ElMessage.error(`刷新 ${lottery.name} 失败`)
  } finally {
    lottery.updating = false
    refreshQueue.delete(lottery.lotCode)
  }
}

// 倒计时更新和自动校准
let countdownTimer = null
let calibrationTimer = null

function startCountdownTimer() {
  // 🎯 混合策略：前端本地递减 + WebSocket定期校准
  // 前端每秒递减保证流畅，WebSocket推送时同步校准消除累积误差
  countdownTimer = setInterval(() => {
    lotteries.value.forEach(lottery => {
      // ✅ 前端本地递减（保证流畅显示）
      // WebSocket推送时会自动校准，消除累积误差
      if (lottery.countdown > 0) {
        lottery.countdown--
      }

      // 🎯 倒计时归零时的处理
      if (lottery.countdown === 0) {
        if (!lottery.zeroStartTime) {
          // 🔧 第一次归零，记录时间
          lottery.zeroStartTime = Date.now()
          console.log(`⏰ ${lottery.name} 倒计时归零，开始计时`)
        }

        // 🎯 检查是否有待处理的新期号数据
        if (lottery.waitingForNewPeriod && lottery.pendingData) {
          console.log(`   → 检测到待处理的新期号，延迟1秒后更新`)
          setTimeout(() => {
            console.log(`🔄 [${lottery.name}] 应用新期号数据: ${lottery.pendingData.period}`)
            lottery.data = lottery.pendingData
            lottery.countdown = lottery.pendingData.officialCountdown || 0
            lottery.waitingForNewPeriod = false
            lottery.pendingData = null
            lottery.zeroStartTime = null
          }, 1000)
        } else {
          // 🔧 修复：如果倒计时持续为0超过10秒，强制刷新
          const zeroDuration = Date.now() - lottery.zeroStartTime
          if (zeroDuration > 10000) {
            console.log(`⚠️ ${lottery.name} 倒计时归零超过10秒，强制刷新`)
            lottery.zeroStartTime = null
            refreshSingleLottery(lottery)
          }
        }
      } else if (lottery.zeroStartTime) {
        // 倒计时恢复，清除归零标记
        lottery.zeroStartTime = null
      }
    })
  }, 1000)

  /* 🔧 已禁用：30秒HTTP校准倒计时（冗余机制）
   * 理由：WebSocket推送时已自动校准倒计时（handleLotteryUpdate:773-781行）
   *       每次收到新期号推送都会更新officialCountdown，无需额外HTTP请求
   *       优势：更实时（<100ms）、减少服务器负载、避免冗余请求
   */

  /* 原30秒HTTP校准代码（已禁用）
  calibrationTimer = setInterval(async () => {
    try {
      const response = await api.getLatestData()
      if (response.success && response.data) {
        const latestDataList = response.data

        lotteries.value.forEach(lottery => {
          const matchedData = latestDataList.find(item => item.lotCode === lottery.lotCode)
          if (matchedData && matchedData.officialCountdown !== undefined) {
            // 只在倒计时差异超过3秒时才校准，避免频繁跳动
            const diff = Math.abs(lottery.countdown - matchedData.officialCountdown)
            if (diff > 3) {
              console.log(`📊 校准 ${lottery.name} 倒计时: ${lottery.countdown}秒 → ${matchedData.officialCountdown}秒`)
              lottery.countdown = matchedData.officialCountdown
            }
          }
        })
      }
    } catch (error) {
      console.error('倒计时校准失败:', error)
    }
  }, 30000) // 每30秒校准一次
  */

  console.log('⏰ 倒计时定时器已启动（每秒更新，WebSocket推送时自动校准）')
}

function stopCountdownTimer() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  if (calibrationTimer) {
    clearInterval(calibrationTimer)
    calibrationTimer = null
  }
}

// 处理 WebSocket 推送的彩种更新
function handleLotteryUpdate(message) {
  console.log('📨 收到WebSocket消息:', message)

  // 🎯 处理批量倒计时更新（稀疏推送：用于校准前端本地倒计时）
  if (message.type === 'countdown_batch_update') {
    const { countdowns } = message.data || {}
    if (countdowns && Array.isArray(countdowns)) {
      let calibratedCount = 0
      countdowns.forEach(({ lotCode, countdown, period, drawTime }) => {
        const lottery = lotteries.value.find(l => String(l.lotCode) === String(lotCode))
        if (lottery) {
          // 🎯 智能校准：只在差异 > 2秒时才更新（避免频繁跳动）
          const diff = Math.abs(lottery.countdown - countdown)
          if (diff > 2) {
            lottery.countdown = countdown
            calibratedCount++
          }

          // 如果有新期号，也更新期号和开奖时间
          if (period && period !== lottery.data?.period) {
            console.log(`🔄 [${lottery.name}] 批量更新检测到新期号: ${period}`)
            if (lottery.data) {
              lottery.data.period = period
            }
          }
          if (drawTime && lottery.data) {
            lottery.data.drawTime = drawTime
          }
        }
      })

      // 批量校准完成（静默）
    }
    return
  }

  // 同时处理 lottery_update 和 lottery_data（订阅后立即推送的初始数据）
  if (message.type !== 'lottery_update' && message.type !== 'lottery_data') {
    console.log(`⏭️ 跳过非彩种消息: ${message.type}`)
    return
  }

  const { lotCode, period, numbers, opencode, officialCountdown, drawTime, specialNumbers } = message.data || message

  // 查找对应的彩种
  const lottery = lotteries.value.find(l => String(l.lotCode) === String(lotCode))
  if (!lottery) {
    console.warn(`⚠️ 未找到彩种 lotCode=${lotCode}`)
    return
  }

  console.log(`🚀 WebSocket推送: ${lottery.name} 新期号 ${period}`)
  console.log(`   - opencode:`, opencode)
  console.log(`   - numbers:`, numbers)
  console.log(`   - numbers类型:`, typeof numbers, Array.isArray(numbers) ? '(数组)' : '')

  // 构造标准数据格式，使用统一的 updateLotteryData 处理
  const standardData = {
    lotCode,
    name: lottery.name,
    issue: period,
    drawCode: opencode || (numbers ? (Array.isArray(numbers) ? numbers.join(',') : numbers) : ''),
    specialNumbers,
    drawTime,
    source: 'official',
    officialCountdown
  }

  console.log(`   - 构造的drawCode:`, standardData.drawCode)

  // 使用统一的数据处理函数，确保六合彩等特殊彩种被正确处理
  // WebSocket推送的数据不需要减12秒
  updateLotteryData(lottery, standardData, 'websocket')
}

// 格式化期号（长期号只显示后几位）
function formatPeriod(period) {
  if (!period) return '---'

  const periodStr = String(period)

  // 如果期号长度 > 8位，只显示后6位，前面加...
  if (periodStr.length > 8) {
    return `...${periodStr.slice(-6)}`
  }

  return periodStr
}

// 格式化倒计时
function formatCountdown(lottery) {
  if (!lottery.countdown) {
    return '开奖中'
  }

  const totalSeconds = lottery.countdown

  // 计算天、小时、分钟、秒
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  // 根据时长选择合适的显示格式
  if (days > 0) {
    // 超过1天：显示"X天X小时X分"
    if (hours > 0 && minutes > 0) {
      return `${days}天${hours}小时${minutes}分`
    } else if (hours > 0) {
      return `${days}天${hours}小时`
    }
    return `${days}天`
  } else if (hours > 0) {
    // 1小时到1天：显示"X小时X分"
    if (minutes > 0) {
      return `${hours}小时${minutes}分`
    }
    return `${hours}小时`
  } else if (minutes > 0) {
    // 1分钟到1小时：显示"X分X秒"或"MM:SS"
    if (minutes >= 10) {
      return `${minutes}分${seconds}秒`
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  } else {
    // 不到1分钟：显示"X秒"
    return `${seconds}秒`
  }
}

// 格式化开奖时间
function formatDrawTime(drawTime) {
  if (!drawTime) return ''
  const date = new Date(drawTime)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取状态文本
function getStatusText(lottery) {
  if (lottery.countdown === 0) {
    return '开奖中'
  } else if (lottery.countdown < 60) {
    return '即将开奖'
  } else {
    return '等待中'
  }
}

// 获取状态类型
function getStatusType(lottery) {
  if (lottery.countdown === 0) {
    return 'danger'
  } else if (lottery.countdown < 60) {
    return 'warning'
  } else {
    return 'success'
  }
}

// 获取倒计时样式
function getCountdownClass(lottery) {
  if (lottery.countdown === 0) {
    return 'countdown-drawing'
  } else if (lottery.countdown < 60) {
    return 'countdown-soon'
  } else {
    return 'countdown-waiting'
  }
}

// 判断是否为K3彩种（快3骰子）
function isK3Lottery(lottery) {
  // 先检查彩种名称，排除排列3等其他3位数彩种
  const name = lottery.name || ''
  const lotCode = String(lottery.lotCode || '')

  // 如果是排列3/排列5/福彩3D等，不是K3
  if (name.includes('排列') || name.includes('3D') || lotCode.startsWith('80')) {
    return false
  }

  const numbers = lottery.data?.numbers || []
  // K3彩种特征：3个号码，每个号码都在1-6之间，且名称包含"快3"或"K3"
  if (numbers.length !== 3) {
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

// 解析六合彩号码（处理6个或7个号码的情况）
function parseMarkSixNumbers(numbers) {
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
        // 返回前5个 + 分割后的2个（需要补0）
        return [...numbers.slice(0, 5), splitted[0].trim().padStart(2, '0'), splitted[1].trim().padStart(2, '0')]
      }
    }
  }

  // 其他情况直接返回原数组
  return numbers
}

// 获取号码球样式
function getBallClass(lottery, index) {
  const totalNumbers = lottery.data?.numbers?.length || 0
  const numbers = lottery.data?.numbers || []
  const lotCode = String(lottery.lotCode || '')
  const name = lottery.name || ''

  const num = numbers[index]
  if (!num) return ''

  // ========== 特殊彩种样式（福彩、体彩、台湾彩券） ==========

  // 福彩双色球（6红+1蓝）
  if (totalNumbers === 7 && (lotCode === '70001' || name.includes('双色球'))) {
    return index < 6 ? 'cwl-ball cwl-red' : 'cwl-ball cwl-blue'
  }

  // 福彩七乐彩（7红+1橙）
  if (totalNumbers === 8 && (lotCode === '70003' || name.includes('七乐彩'))) {
    return index < 7 ? 'cwl-ball cwl-red' : 'cwl-ball cwl-orange'
  }

  // 福彩3D（3个金球）
  if (totalNumbers === 3 && (lotCode === '70002' || name.includes('福彩3D'))) {
    return 'cwl-ball cwl-3d'
  }

  // 体彩超级大乐透（5红+2蓝）
  if (totalNumbers === 7 && lotCode === '80001') {
    return index < 5 ? 'sports-ball sports-red' : 'sports-ball sports-blue'
  }

  // 体彩排列3（3个紫球）
  if (totalNumbers === 3 && (lotCode === '80002' || name.includes('排列3'))) {
    return 'sports-ball sports-purple'
  }

  // 体彩排列5（5个紫球）
  if (totalNumbers === 5 && (lotCode === '80003' || name.includes('排列5'))) {
    return 'sports-ball sports-purple'
  }

  // 体彩七星彩（6紫+1金）
  if (totalNumbers === 7 && (lotCode === '80004' || name.includes('七星彩') || name.includes('7星彩'))) {
    return index < 6 ? 'sports-ball sports-purple' : 'sports-ball sports-gold'
  }

  // 台湾威力彩（6红+1金）
  if (lotCode === '100001' && totalNumbers === 7) {
    return index < 6 ? 'taiwan-ball taiwan-lotto649-red' : 'taiwan-ball taiwan-lotto649-gold'
  }

  // 台湾大乐透（6蓝+1橙）
  if (lotCode === '100002' && totalNumbers === 7) {
    return index < 6 ? 'taiwan-ball taiwan-biglotto-blue' : 'taiwan-ball taiwan-biglotto-orange'
  }

  // 今彩539（5个紫球）
  if (lotCode === '100003' && totalNumbers === 5) {
    return 'taiwan-ball taiwan-539-purple'
  }

  // 3D/三星彩（3个绿球）
  if (lotCode === '100005' && totalNumbers === 3) {
    return 'taiwan-ball taiwan-3d-green'
  }

  // 4D/四星彩（4个橙球）
  if (lotCode === '100006' && totalNumbers === 4) {
    return 'taiwan-ball taiwan-4d-orange'
  }

  // 39樂合彩（5个黄球）
  if (lotCode === '100008' && totalNumbers === 5) {
    return 'taiwan-ball taiwan-39m5-yellow'
  }

  // 49樂合彩（6个黄球）
  if (lotCode === '100009' && totalNumbers === 6) {
    return 'taiwan-ball taiwan-49m6-yellow'
  }

  // 台湾宾果（20个粉红球，超级奖号金色）
  if (lotCode === '100007' && totalNumbers === 20) {
    const specialNumbers = lottery.data?.specialNumbers || []
    return specialNumbers.includes(num) ? 'taiwan-ball taiwan-bingo-gold' : 'taiwan-ball taiwan-bingo-pink'
  }

  // ========== 通用彩种样式（PK10、时时彩、快乐十分等） ==========

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

  // 20或21个号码的彩种（快乐8系列）
  if (totalNumbers === 20 || totalNumbers === 21) {
    // 特码（第21个球）：金色
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

  // 其他默认：前三名特殊颜色
  if (index === 0) return 'champion'
  if (index === 1) return 'runner-up'
  if (index === 2) return 'third'

  return ''
}

// 查看历史
function viewHistory(lottery) {
  router.push({
    name: 'History',
    query: { lotCode: lottery.lotCode }
  })
}

// 分类切换
function handleCategoryChange(key) {
  currentCategory.value = key
}

// 生命周期
onMounted(async () => {
  await initLotteries()
  await loadAllLotteriesData()
  startCountdownTimer()

  // 监听 WebSocket 连接状态
  console.log('👀 开始监听WebSocket连接状态...')
  watch(connected, (isConnected) => {
    console.log(`📡 WebSocket连接状态变化: ${isConnected}`)

    if (isConnected && lotteries.value.length > 0) {
      // 连接成功后订阅所有彩种
      const lotCodes = lotteries.value.map(l => String(l.lotCode))
      subscribeLotteries(lotCodes)
      ElMessage.success(`已订阅 ${lotCodes.length} 个彩种的实时推送`)
      console.log(`🚀 已订阅 ${lotCodes.length} 个彩种的实时推送`)
    }
  }, { immediate: true })

  // 监听 WebSocket 消息
  subscribe(handleLotteryUpdate)
  console.log('📥 已设置WebSocket消息监听器')

  // 🔧 监听页面可见性变化，解决标签页失焦后倒计时暂停问题
  const handleVisibilityChange = async () => {
    if (!document.hidden) {
      // 页面重新可见时，强制刷新所有倒计时数据
      console.log('👁️ 页面重新可见，刷新所有倒计时数据...')
      await loadAllLotteriesData()
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  console.log('👁️ 已设置页面可见性监听器')

  // 保存监听器引用，用于清理
  window.__visibilityChangeHandler = handleVisibilityChange
})

onUnmounted(() => {
  stopCountdownTimer()

  // 清理页面可见性监听器
  if (window.__visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', window.__visibilityChangeHandler)
    window.__visibilityChangeHandler = null
    console.log('👁️ 已移除页面可见性监听器')
  }
})
</script>

<style scoped lang="scss">
.realtime-element-plus {
  padding: 20px;
  min-height: 100vh;
  background: var(--bg-primary);
  transition: background 0.3s ease;
}

// Glass Card 基础样式
.glass-card {
  position: relative;
  background: var(--glass-bg) !important;
  backdrop-filter: blur(20px);
  border-radius: 16px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 16px;
  padding: 2px;
  background: linear-gradient(135deg, var(--tech-cyan), var(--tech-purple));
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

.glass-card:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-2px);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15);
}

// 页面头部
.page-header {
  padding: 30px;
  margin-bottom: 20px;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 28px;
      font-weight: 700;
      color: var(--tech-cyan);
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      margin: 0 0 8px 0;

      .title-icon {
        font-size: 32px;
        color: var(--tech-cyan);
        filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.6));
      }
    }

    /* 亮度模式下使用柔和的阴影 */
    [data-theme="light"] & .page-title {
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

      .title-icon {
        filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.2));
      }
    }

    .page-subtitle {
      color: var(--tech-text-secondary);
      font-size: 14px;
      margin: 0;
    }
  }
}

// 筛选区域
.filter-section {
  padding: 20px;
  margin-bottom: 20px;

  :deep(.el-tabs__header) {
    margin: 0;
    border-bottom: none;
  }

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__item) {
    color: var(--text-secondary);
    font-weight: 500;

    &.is-active {
      color: var(--text-primary);
    }

    &:hover {
      color: var(--text-primary);
    }
  }

  :deep(.el-tabs__active-bar) {
    background-color: #ffd700;
  }

  .custom-tab-label {
    display: flex;
    align-items: center;
    gap: 8px;

    .tab-icon {
      font-size: 18px;
    }

    .tab-badge {
      margin-left: 4px;
    }
  }
}

// 彩种网格
.lottery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

// 彩种卡片
.lottery-card {
  :deep(.el-card__header) {
    padding: 20px;
    background: var(--glass-bg);
    border-bottom: 1px solid var(--border-color);
  }

  :deep(.el-card__body) {
    padding: 20px;
  }

  :deep(.el-card__footer) {
    padding: 15px 20px;
    background: var(--glass-bg);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  &.card-updating {
    opacity: 0.8;
  }
}

// 卡片头部
.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .lottery-info {
    display: flex;
    align-items: center;
    gap: 12px;

    .lottery-icon {
      font-size: 32px;
    }

    .lottery-name-wrap {
      .lottery-name {
        font-size: 18px;
        font-weight: 600;
        color: var(--tech-text-primary);
        margin: 0 0 4px 0;
      }

      .lottery-code {
        font-size: 12px;
        color: var(--tech-text-tertiary);
      }
    }
  }
}

// 卡片内容
.card-content {
  .period-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 12px;
    background: var(--glass-bg);
    border-radius: 8px;

    .period-info {
      display: flex;
      align-items: center;
      gap: 8px;

      .period-label {
        color: var(--text-secondary);
        font-size: 14px;
      }

      .period-number {
        font-size: 20px;
        font-weight: 700;
        color: #ffd700;
      }
    }

    .countdown-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 16px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 6px;

      &.countdown-drawing {
        color: #ff4d4f;
        background: rgba(255, 77, 79, 0.1);
        animation: pulse 1.5s ease-in-out infinite;
      }

      &.countdown-soon {
        color: #faad14;
        background: rgba(250, 173, 20, 0.1);
      }

      &.countdown-waiting {
        color: #52c41a;
        background: rgba(82, 196, 26, 0.1);
      }
    }
  }

  .numbers-section {
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 15px;

    .numbers-display {
      width: 100%;
    }

    .numbers-row-single {
      display: flex;
      flex-wrap: nowrap; // 不允许换行
      gap: 4px;
      justify-content: center;
      overflow: hidden; // 防止溢出
    }

    .numbers-row {
      display: flex;
      flex-wrap: nowrap; // 不允许换行
      gap: 4px;
      justify-content: center;
      overflow: hidden; // 防止溢出
    }

    .numbers-multi-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .number-ball {
      min-width: 18px; // 最小宽度
      max-width: 25px; // 最大宽度
      width: 25px;
      min-height: 18px; // 最小高度
      max-height: 25px; // 最大高度
      height: 25px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: clamp(8px, 1.5vw, 10px); // 字体大小自适应
      font-weight: 700;
      color: #ffffff !important;
      background: linear-gradient(135deg, #667eea, #764ba2);
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      transition: all 0.2s ease;
      flex-shrink: 1; // 允许缩小
      flex-grow: 0; // 不允许增长
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);

      &.small {
        width: 24px;
        height: 24px;
        font-size: 10px;
        box-shadow: 0 1px 6px rgba(102, 126, 234, 0.25);
      }

      &:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      /* ========== PK10系列专用颜色（10个号码彩种）========== */
      &.ball-1 {
        background: linear-gradient(135deg, #ffeb3b 0%, #fdd835 50%, #ffeb3b 100%);
        box-shadow: 0 2px 8px rgba(255, 235, 59, 0.5);
      }

      &.ball-2 {
        background: linear-gradient(135deg, #03a9f4 0%, #0288d1 50%, #03a9f4 100%);
        box-shadow: 0 2px 8px rgba(3, 169, 244, 0.5);
      }

      &.ball-3 {
        background: linear-gradient(135deg, #607d8b 0%, #455a64 50%, #607d8b 100%);
        box-shadow: 0 2px 8px rgba(96, 125, 139, 0.5);
      }

      &.ball-4 {
        background: linear-gradient(135deg, #ff9800 0%, #f57c00 50%, #ff9800 100%);
        box-shadow: 0 2px 8px rgba(255, 152, 0, 0.5);
      }

      &.ball-5 {
        background: linear-gradient(135deg, #00bcd4 0%, #0097a7 50%, #00bcd4 100%);
        box-shadow: 0 2px 8px rgba(0, 188, 212, 0.5);
      }

      &.ball-6 {
        background: linear-gradient(135deg, #673ab7 0%, #512da8 50%, #673ab7 100%);
        box-shadow: 0 2px 8px rgba(103, 58, 183, 0.5);
      }

      &.ball-7 {
        background: linear-gradient(135deg, #9e9e9e 0%, #757575 50%, #9e9e9e 100%);
        box-shadow: 0 2px 8px rgba(158, 158, 158, 0.5);
      }

      &.ball-8 {
        background: linear-gradient(135deg, #f44336 0%, #d32f2f 50%, #f44336 100%);
        box-shadow: 0 2px 8px rgba(244, 67, 54, 0.5);
      }

      &.ball-9 {
        background: linear-gradient(135deg, #795548 0%, #5d4037 50%, #795548 100%);
        box-shadow: 0 2px 8px rgba(121, 85, 72, 0.5);
      }

      &.ball-10 {
        background: linear-gradient(135deg, #4caf50 0%, #388e3c 50%, #4caf50 100%);
        box-shadow: 0 2px 8px rgba(76, 175, 80, 0.5);
      }

      /* ========== 时时彩专用颜色（0-9数字）========== */
      &.digit-0 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #ffd700;
        box-shadow: 0 0 12px rgba(255, 215, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      &.digit-1 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #2196f3;
        box-shadow: 0 0 12px rgba(33, 150, 243, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      &.digit-2 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #9c27b0;
        box-shadow: 0 0 12px rgba(156, 39, 176, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      &.digit-3 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #f44336;
        box-shadow: 0 0 12px rgba(244, 67, 54, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      &.digit-4 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #00bcd4;
        box-shadow: 0 0 12px rgba(0, 188, 212, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      &.digit-5 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #4caf50;
        box-shadow: 0 0 12px rgba(76, 175, 80, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      &.digit-6 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #ff9800;
        box-shadow: 0 0 12px rgba(255, 152, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      &.digit-7 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #673ab7;
        box-shadow: 0 0 12px rgba(103, 58, 183, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      &.digit-8 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #795548;
        box-shadow: 0 0 12px rgba(121, 85, 72, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      &.digit-9 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.3), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.15), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
          #607d8b;
        box-shadow: 0 0 12px rgba(96, 125, 139, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      /* ========== 快乐十分专用颜色（1-20号码）========== */
      &.happy-1 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #ff0000;
        box-shadow: 0 0 12px rgba(255, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-2 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #8b0000;
        box-shadow: 0 0 12px rgba(139, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-3 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #ff8c00;
        box-shadow: 0 0 12px rgba(255, 140, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-4 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #ff4500;
        box-shadow: 0 0 12px rgba(255, 69, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-5 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #ffd700;
        box-shadow: 0 0 12px rgba(255, 215, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-6 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #9acd32;
        box-shadow: 0 0 12px rgba(154, 205, 50, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-7 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #00ff00;
        box-shadow: 0 0 12px rgba(0, 255, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-8 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #006400;
        box-shadow: 0 0 12px rgba(0, 100, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-9 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #00fa9a;
        box-shadow: 0 0 12px rgba(0, 250, 154, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-10 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #00ced1;
        box-shadow: 0 0 12px rgba(0, 206, 209, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-11 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #40e0d0;
        box-shadow: 0 0 12px rgba(64, 224, 208, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-12 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #0000ff;
        box-shadow: 0 0 12px rgba(0, 0, 255, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-13 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #000080;
        box-shadow: 0 0 12px rgba(0, 0, 128, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-14 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #87ceeb;
        box-shadow: 0 0 12px rgba(135, 206, 235, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-15 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #8b008b;
        box-shadow: 0 0 12px rgba(139, 0, 139, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-16 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #9400d3;
        box-shadow: 0 0 12px rgba(148, 0, 211, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-17 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #ff69b4;
        box-shadow: 0 0 12px rgba(255, 105, 180, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-18 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #8b4513;
        box-shadow: 0 0 12px rgba(139, 69, 19, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-19 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #708090;
        box-shadow: 0 0 12px rgba(112, 128, 144, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      &.happy-20 {
        background:
          radial-gradient(ellipse 40% 30% at 30% 20%, rgba(255, 255, 255, 0.2), transparent 70%),
          radial-gradient(ellipse 50% 40% at 35% 35%, rgba(255, 255, 255, 0.1), transparent 60%),
          radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
          #2f4f4f;
        box-shadow: 0 0 12px rgba(47, 79, 79, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      /* ========== 快乐8系列颜色 ========== */
      &.kl8-row-1 {
        background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
        box-shadow: 0 2px 6px rgba(255, 107, 107, 0.3);
      }

      &.kl8-row-2 {
        background: linear-gradient(135deg, #667eea, #764ba2);
        box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
      }

      &.kl8-special {
        background: linear-gradient(135deg, #ffd700, #ffed4e);
        box-shadow: 0 0 12px rgba(255, 215, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3);
      }

      /* ========== 11选5专用颜色 ========== */
      &.x5-10 {
        background: linear-gradient(135deg, #8bc34a 0%, #689f38 50%, #8bc34a 100%);
        box-shadow: 0 2px 6px rgba(139, 195, 74, 0.3);
      }

      &.x5-11 {
        background: linear-gradient(135deg, #cddc39 0%, #afb42b 50%, #cddc39 100%);
        box-shadow: 0 2px 6px rgba(205, 220, 57, 0.3);
      }

      /* ========== 前三名特殊颜色 ========== */
      &.champion {
        background: linear-gradient(135deg, #ffd700, #ffed4e);
        box-shadow: 0 2px 8px rgba(255, 215, 0, 0.5);
      }

      &.runner-up {
        background: linear-gradient(135deg, #c0c0c0, #e8e8e8);
        box-shadow: 0 2px 8px rgba(192, 192, 192, 0.5);
      }

      &.third {
        background: linear-gradient(135deg, #cd7f32, #e59759);
        box-shadow: 0 2px 8px rgba(205, 127, 50, 0.5);
      }
    }

    .numbers-empty {
      width: 100%;
      padding: 20px;

      :deep(.el-empty__description) {
        color: var(--text-tertiary);
      }
    }
  }

  .draw-time {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--text-secondary);
    font-size: 13px;
  }
}

// 卡片操作
.card-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* ========== K3骰子样式 ========== */
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
  width: 30px;
  height: 30px;
  position: relative;
  transform-style: preserve-3d;
  cursor: pointer;
  will-change: transform;
}

.k3-dice-wrapper:not(:hover) .k3-dice-3d {
  transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.size-mini .k3-dice-3d {
  width: 25px;
  height: 25px;
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
    inset 0 1px 3px rgba(0, 0, 0, 0.1),
    0 2px 6px rgba(0, 0, 0, 0.15);
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  position: absolute;
}

.size-mini .dot {
  width: 4px;
  height: 4px;
}

.dot.red {
  background: radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a);
  box-shadow: 0 0 3px rgba(255, 107, 107, 0.8);
}

.dot.blue {
  background: radial-gradient(circle at 30% 30%, #4dabf7, #1971c2);
  box-shadow: 0 0 3px rgba(77, 171, 247, 0.8);
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

/* 骰子六个面的位置 */
.face-1 {
  transform: rotateY(0deg) translateZ(15px);
}

.face-2 {
  transform: rotateY(90deg) translateZ(15px);
}

.face-3 {
  transform: rotateY(180deg) translateZ(15px);
}

.face-4 {
  transform: rotateY(-90deg) translateZ(15px);
}

.face-5 {
  transform: rotateX(90deg) translateZ(15px);
}

.face-6 {
  transform: rotateX(-90deg) translateZ(15px);
}

.size-mini .face-1 {
  transform: rotateY(0deg) translateZ(12.5px);
}

.size-mini .face-2 {
  transform: rotateY(90deg) translateZ(12.5px);
}

.size-mini .face-3 {
  transform: rotateY(180deg) translateZ(12.5px);
}

.size-mini .face-4 {
  transform: rotateY(-90deg) translateZ(12.5px);
}

.size-mini .face-5 {
  transform: rotateX(90deg) translateZ(12.5px);
}

.size-mini .face-6 {
  transform: rotateX(-90deg) translateZ(12.5px);
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

/* ========================================
   六合彩 SVG球样式
   ======================================== */
.marksix-row {
  justify-content: center !important; // 居中对齐
}

.marksix-numbers-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.marksix-special-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.marksix-ball-svg {
  min-width: 18px;
  max-width: 26px;
  width: 26px;
  min-height: 18px;
  max-height: 26px;
  height: 26px;
  margin: 0 1px; // 缩小间距到1px
  display: inline-block;
  vertical-align: middle;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.15));
  transition: transform 0.2s ease;
  flex-shrink: 1; // 允许缩小
  flex-grow: 0; // 不允许增长
}

.marksix-ball-svg:hover {
  transform: scale(1.1);
}

.marksix-plus {
  display: inline-block;
  margin: 0 2px; // 缩小间距到2px
  font-size: clamp(14px, 2vw, 18px); // 稍微缩小字体
  font-weight: bold;
  color: var(--text-primary);
  vertical-align: middle;
  flex-shrink: 0; // 不允许缩小
}

/* ========================================
   福彩系列球样式
   ======================================== */
.cwl-ball {
  min-width: 18px;
  max-width: 25px;
  width: 25px;
  min-height: 18px;
  max-height: 25px;
  height: 25px;
  font-size: clamp(8px, 1.5vw, 10px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  margin: 0 2px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(0, 0, 0, 0.15), inset 0 1px 3px rgba(255, 255, 255, 0.3);
  transition: all 0.2s ease;
  flex-shrink: 1;
  flex-grow: 0;
}

.cwl-ball:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2), inset 0 2px 6px rgba(255, 255, 255, 0.4);
}

/* 福彩红球 - 双色球/七乐彩 */
.cwl-red {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #ef4444, #dc2626) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(255, 200, 200, 0.3) !important;
}

/* 福彩蓝球 - 双色球 */
.cwl-blue {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #3b82f6, #2563eb) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(200, 220, 255, 0.3) !important;
}

/* 福彩橙球 - 七乐彩特别号码 */
.cwl-orange {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.4), transparent 50%),
    radial-gradient(circle at 50% 50%, #f97316, #ea580c) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(255, 220, 200, 0.3) !important;
}

/* 福彩3D金球 */
.cwl-3d {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.4), transparent 50%),
    radial-gradient(circle at 50% 50%, #fbbf24, #f59e0b) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(251, 191, 36, 0.4) !important;
  box-shadow: 0 3px 10px rgba(217, 119, 6, 0.4), inset 0 -2px 4px rgba(146, 64, 14, 0.2), inset 0 2px 6px #fcd34d !important;
}

/* 福彩分隔符 */
.cwl-separator {
  display: inline-block;
  margin: 0 6px;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  vertical-align: middle;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* ========================================
   体彩系列球样式
   ======================================== */
.sports-ball {
  min-width: 18px;
  max-width: 25px;
  width: 25px;
  min-height: 18px;
  max-height: 25px;
  height: 25px;
  font-size: clamp(8px, 1.5vw, 10px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  margin: 0 2px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(0, 0, 0, 0.15), inset 0 1px 3px rgba(255, 255, 255, 0.3);
  transition: all 0.2s ease;
  flex-shrink: 1;
  flex-grow: 0;
}

.sports-ball:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2), inset 0 2px 6px rgba(255, 255, 255, 0.4);
}

/* 体彩红球 - 大乐透前区 */
.sports-red {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #ef4444, #dc2626) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(255, 200, 200, 0.3) !important;
}

/* 体彩蓝球 - 大乐透后区 */
.sports-blue {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #3b82f6, #2563eb) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(200, 220, 255, 0.3) !important;
}

/* 体彩紫球 - 排列3/排列5/七星彩前6位 */
.sports-purple {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #a855f7, #9333ea) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(220, 200, 255, 0.3) !important;
}

/* 体彩金球 - 七星彩特别号码 */
.sports-gold {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.4), transparent 50%),
    radial-gradient(circle at 50% 50%, #fbbf24, #f59e0b) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(251, 191, 36, 0.4) !important;
  box-shadow: 0 3px 10px rgba(217, 119, 6, 0.4), inset 0 -2px 4px rgba(146, 64, 14, 0.2), inset 0 2px 6px #fcd34d !important;
}

/* 体彩分隔符 */
.sports-separator {
  display: inline-block;
  margin: 0 6px;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  vertical-align: middle;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* ========================================
   台湾彩券系列球样式
   ======================================== */
.taiwan-ball {
  min-width: 18px;
  max-width: 25px;
  width: 25px;
  min-height: 18px;
  max-height: 25px;
  height: 25px;
  font-size: clamp(8px, 1.5vw, 10px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  margin: 0 2px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(0, 0, 0, 0.15), inset 0 1px 3px rgba(255, 255, 255, 0.3);
  transition: all 0.2s ease;
  flex-shrink: 1;
  flex-grow: 0;
}

.taiwan-ball:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.2), inset 0 2px 6px rgba(255, 255, 255, 0.4);
}

/* 威力彩红球（普通号码 1-38） */
.taiwan-lotto649-red {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #ef4444, #dc2626) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(255, 200, 200, 0.3) !important;
}

/* 威力彩金球（第二区号码 1-8） */
.taiwan-lotto649-gold {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.4), transparent 50%),
    linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%) !important;
  color: white !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 10px rgba(251, 191, 36, 0.5) !important;
  box-shadow: 0 6px 20px rgba(255, 165, 0, 0.5), inset 0 -2px 4px rgba(139, 69, 19, 0.25), inset 0 2px 8px rgba(255, 215, 0, 0.4) !important;
}

/* 大乐透蓝球（普通号码 1-49） */
.taiwan-biglotto-blue {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #3b82f6, #2563eb) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(200, 220, 255, 0.3) !important;
}

/* 大乐透橙球（特别号 1-49） */
.taiwan-biglotto-orange {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.4), transparent 50%),
    linear-gradient(135deg, #fb923c 0%, #f97316 50%, #ea580c 100%) !important;
  color: white !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 10px rgba(251, 146, 60, 0.5) !important;
  box-shadow: 0 6px 20px rgba(255, 140, 0, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.25), inset 0 2px 8px rgba(255, 200, 100, 0.4) !important;
}

/* 今彩539紫球（号码 1-39） */
.taiwan-539-purple {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #9333ea, #7e22ce) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(220, 200, 255, 0.3) !important;
}

/* 3D/三星彩绿球（数字 0-9） */
.taiwan-3d-green {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #10b981, #059669) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(200, 255, 220, 0.3) !important;
}

/* 4D/四星彩橙球（数字 0-9） */
.taiwan-4d-orange {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #f97316, #ea580c) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(255, 220, 200, 0.3) !important;
}

/* 39选5深金色球（号码 1-39） */
.taiwan-39m5-yellow {
  background:
    radial-gradient(circle at 35% 35%, #fcd34d, transparent 50%),
    linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
  color: white !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 10px rgba(251, 191, 36, 0.5) !important;
  box-shadow: 0 3px 10px rgba(217, 119, 6, 0.5), inset 0 -2px 4px rgba(146, 64, 14, 0.3), inset 0 2px 6px #fcd34d !important;
}

.taiwan-39m5-yellow:hover {
  box-shadow: 0 6px 20px rgba(217, 119, 6, 0.6), inset 0 -2px 4px rgba(146, 64, 14, 0.4), inset 0 2px 8px #fcd34d !important;
  transform: translateY(-1px);
}

/* 49选6深金色球（号码 1-49） */
.taiwan-49m6-yellow {
  background:
    radial-gradient(circle at 35% 35%, #fcd34d, transparent 50%),
    linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
  color: white !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 10px rgba(251, 191, 36, 0.5) !important;
  box-shadow: 0 3px 10px rgba(217, 119, 6, 0.5), inset 0 -2px 4px rgba(146, 64, 14, 0.3), inset 0 2px 6px #fcd34d !important;
}

.taiwan-49m6-yellow:hover {
  box-shadow: 0 6px 20px rgba(217, 119, 6, 0.6), inset 0 -2px 4px rgba(146, 64, 14, 0.4), inset 0 2px 8px #fcd34d !important;
  transform: translateY(-1px);
}

/* 宾果宾果粉红球（数字 01-80） */
.taiwan-bingo-pink {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #ec4899, #db2777) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(255, 200, 230, 0.3) !important;
}

/* 宾果宾果超级奖号金色球 */
.taiwan-bingo-gold {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.5), transparent 50%),
    radial-gradient(circle at 50% 50%, #fbbf24, #f59e0b) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px rgba(251, 191, 36, 0.5) !important;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.6) !important;
  animation: golden-pulse 2s ease-in-out infinite !important;
}

@keyframes golden-pulse {
  0%, 100% {
    box-shadow: 0 0 12px rgba(251, 191, 36, 0.6);
  }
  50% {
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.9);
  }
}

/* 台湾彩券号码分隔符 */
.taiwan-separator {
  display: inline-block;
  margin: 0 6px;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-primary);
  vertical-align: middle;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

// 动画
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

// 响应式
@media (max-width: 1400px) {
  .lottery-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

@media (max-width: 768px) {
  .realtime-element-plus {
    padding: 10px;
  }

  .lottery-grid {
    grid-template-columns: 1fr;
  }

  .page-header .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .header-right {
    width: 100%;

    :deep(.el-input) {
      width: 100% !important;
    }
  }
}
</style>
