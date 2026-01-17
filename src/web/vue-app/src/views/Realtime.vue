<template>
  <div class="realtime-center">
    <!-- 页面头部 -->
    <div class="page-header-luxury">
      <div class="header-left">
        <div class="page-title-luxury">
          <span class="title-icon">⚡</span>
          <span>实时彩种</span>
        </div>
        <p class="page-subtitle">共 {{ filteredLotteries.length }} 个彩种正在监控</p>
      </div>

      <!-- 筛选器 -->
      <div class="header-filters">
        <div class="filter-tabs">
          <button
            v-for="category in categories"
            :key="category.key"
            :class="['filter-tab', { active: currentCategory === category.key }]"
            @click="currentCategory = category.key"
          >
            <span class="tab-icon">{{ category.icon }}</span>
            <span class="tab-label">{{ category.label }}</span>
            <span v-if="category.count" class="tab-count">{{ category.count }}</span>
          </button>
        </div>

        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索彩种名称..."
            class="search-input"
          />
        </div>
      </div>
    </div>

    <!-- 彩种卡片网格 -->
    <div class="lottery-grid">
      <div
        v-for="lottery in filteredLotteries"
        :key="lottery.code"
        class="lottery-card"
        :class="{ 'card-updating': lottery.updating }"
      >
        <!-- 卡片头部 -->
        <div class="card-header">
          <div class="lottery-info">
            <span class="lottery-icon">{{ lottery.icon }}</span>
            <div class="lottery-name-wrap">
              <h3 class="lottery-name">{{ lottery.name }}</h3>
              <span class="lottery-code">{{ lottery.code }}</span>
            </div>
          </div>
          <div class="card-status" :class="getStatusClass(lottery)">
            <span class="status-dot"></span>
            <span class="status-text">{{ getStatusText(lottery) }}</span>
          </div>
        </div>

        <!-- 期号和倒计时 -->
        <div class="card-period">
          <div class="period-info">
            <span class="period-label">第</span>
            <span class="period-number">{{ lottery.data?.period || '---' }}</span>
            <span class="period-label">期</span>
          </div>
          <div class="countdown" :class="getCountdownClass(lottery)">
            <span class="countdown-icon">{{ getCountdownIcon(lottery) }}</span>
            <span class="countdown-value">{{ formatCountdown(lottery) }}</span>
          </div>
        </div>

        <!-- 开奖号码 -->
        <div class="card-numbers">
          <div v-if="lottery.data?.numbers && lottery.data.numbers.length > 0" class="numbers-display" :class="getNumbersLayoutClass(lottery)">
            <!-- K3骰子显示 -->
            <template v-if="isK3Lottery(lottery)">
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
            </template>

            <!-- ========== 台湾宾果宾果（必须在多排布局之前判断！） ========== -->
            <!-- 宾果宾果（20个粉红球 + 超级奖号金色，两排显示） -->
            <template v-else-if="String(lottery.lotCode) === '100007' && lottery.data.numbers.length === 20">
              <div class="numbers-main-rows">
                <!-- 第一排（前10个） -->
                <div class="numbers-row">
                  <span
                    v-for="(num, idx) in lottery.data.numbers.slice(0, 10)"
                    :key="'row1-' + idx"
                    class="number-ball-mini taiwan-ball"
                    :class="lottery.data.specialNumbers && lottery.data.specialNumbers.includes(num) ? 'taiwan-bingo-gold' : 'taiwan-bingo-pink'"
                  >
                    {{ num }}
                  </span>
                </div>
                <!-- 第二排（后10个） -->
                <div class="numbers-row">
                  <span
                    v-for="(num, idx) in lottery.data.numbers.slice(10, 20)"
                    :key="'row2-' + idx"
                    class="number-ball-mini taiwan-ball"
                    :class="lottery.data.specialNumbers && lottery.data.specialNumbers.includes(num) ? 'taiwan-bingo-gold' : 'taiwan-bingo-pink'"
                  >
                    {{ num }}
                  </span>
                </div>
              </div>
            </template>

            <!-- 多排布局（>10个号码，但排除台湾宾果） -->
            <template v-else-if="lottery.data.numbers.length > 10">
              <div class="numbers-main-rows">
                <!-- 第一排（前10个） -->
                <div class="numbers-row">
                  <span
                    v-for="(num, idx) in lottery.data.numbers.slice(0, 10)"
                    :key="'row1-' + idx"
                    class="number-ball-mini"
                    :class="getBallMiniClass(lottery, idx)"
                  >
                    {{ num }}
                  </span>
                </div>

                <!-- 第二排（11-20） -->
                <div class="numbers-row">
                  <span
                    v-for="(num, idx) in lottery.data.numbers.slice(10, 20)"
                    :key="'row2-' + idx"
                    class="number-ball-mini"
                    :class="getBallMiniClass(lottery, 10 + idx)"
                  >
                    {{ num }}
                  </span>
                </div>
              </div>

              <!-- 特码（第21个，右侧居中显示） -->
              <div v-if="lottery.data.numbers.length === 21" class="special-code-wrapper">
                <span
                  class="number-ball-mini special-ball"
                  :class="getBallMiniClass(lottery, 20)"
                >
                  {{ lottery.data.numbers[20] }}
                </span>
              </div>
            </template>

            <!-- 六合彩（香港六合彩或极速六合彩）使用官方SVG -->
            <template v-else-if="(lottery.data.numbers.length === 6 || lottery.data.numbers.length === 7) && (lottery.name.includes('六合彩') || lottery.name.includes('Mark Six'))">
              <template v-for="(num, idx) in parseMarkSixNumbers(lottery.data.numbers)" :key="idx">
                <img
                  :src="`assets/lottery-balls/marksix-${parseInt(num, 10)}.svg`"
                  :alt="`号码${num}`"
                  class="marksix-ball-svg"
                />
                <span v-if="idx === 5" class="marksix-plus">+</span>
              </template>
            </template>

            <!-- 福彩双色球（6红+1蓝） -->
            <template v-else-if="lottery.data.numbers.length === 7 && (String(lottery.lotCode) === '70001' || lottery.name.includes('双色球'))">
              <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                <span
                  class="number-ball-mini cwl-ball"
                  :class="idx < 6 ? 'cwl-red' : 'cwl-blue'"
                >
                  {{ num }}
                </span>
                <span v-if="idx === 5" class="cwl-separator">+</span>
              </template>
            </template>

            <!-- 福彩七乐彩（7红+1橙） -->
            <template v-else-if="lottery.data.numbers.length === 8 && (String(lottery.lotCode) === '70003' || lottery.name.includes('七乐彩'))">
              <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                <span
                  class="number-ball-mini cwl-ball"
                  :class="idx < 7 ? 'cwl-red' : 'cwl-orange'"
                >
                  {{ num }}
                </span>
                <span v-if="idx === 6" class="cwl-separator">+</span>
              </template>
            </template>

            <!-- 福彩3D（3个号码，金色球） -->
            <template v-else-if="lottery.data.numbers.length === 3 && (String(lottery.lotCode) === '70002' || lottery.name.includes('福彩3D'))">
              <span
                v-for="(num, idx) in lottery.data.numbers"
                :key="idx"
                class="number-ball-mini cwl-ball cwl-3d"
              >
                {{ num }}
              </span>
            </template>

            <!-- ========== 台湾彩券系列 ========== -->

            <!-- 威力彩（6红+1金） -->
            <template v-else-if="String(lottery.lotCode) === '100001' && lottery.data.numbers.length === 7">
              <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                <span
                  class="number-ball-mini taiwan-ball"
                  :class="idx < 6 ? 'taiwan-lotto649-red' : 'taiwan-lotto649-gold'"
                >
                  {{ num }}
                </span>
                <span v-if="idx === 5" class="taiwan-separator">+</span>
              </template>
            </template>

            <!-- 台湾大乐透（6蓝+1橙） -->
            <template v-else-if="String(lottery.lotCode) === '100002' && lottery.data.numbers.length === 7">
              <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                <span
                  class="number-ball-mini taiwan-ball"
                  :class="idx < 6 ? 'taiwan-biglotto-blue' : 'taiwan-biglotto-orange'"
                >
                  {{ num }}
                </span>
                <span v-if="idx === 5" class="taiwan-separator">+</span>
              </template>
            </template>

            <!-- 今彩539（5个紫球） -->
            <template v-else-if="String(lottery.lotCode) === '100003' && lottery.data.numbers.length === 5">
              <span
                v-for="(num, idx) in lottery.data.numbers"
                :key="idx"
                class="number-ball-mini taiwan-ball taiwan-539-purple"
              >
                {{ num }}
              </span>
            </template>

            <!-- 3D/三星彩（3个绿球） -->
            <template v-else-if="String(lottery.lotCode) === '100005' && lottery.data.numbers.length === 3">
              <span
                v-for="(num, idx) in lottery.data.numbers"
                :key="idx"
                class="number-ball-mini taiwan-ball taiwan-3d-green"
              >
                {{ num }}
              </span>
            </template>

            <!-- 4D/四星彩（4个橙球） -->
            <template v-else-if="String(lottery.lotCode) === '100006' && lottery.data.numbers.length === 4">
              <span
                v-for="(num, idx) in lottery.data.numbers"
                :key="idx"
                class="number-ball-mini taiwan-ball taiwan-4d-orange"
              >
                {{ num }}
              </span>
            </template>

            <!-- 39选5（5个黄球） -->
            <template v-else-if="String(lottery.lotCode) === '100008' && lottery.data.numbers.length === 5">
              <span
                v-for="(num, idx) in lottery.data.numbers"
                :key="idx"
                class="number-ball-mini taiwan-ball taiwan-39m5-yellow"
              >
                {{ num }}
              </span>
            </template>

            <!-- 49选6（6个黄球） -->
            <template v-else-if="String(lottery.lotCode) === '100009' && lottery.data.numbers.length === 6">
              <span
                v-for="(num, idx) in lottery.data.numbers"
                :key="idx"
                class="number-ball-mini taiwan-ball taiwan-49m6-yellow"
              >
                {{ num }}
              </span>
            </template>

            <!-- 体彩超级大乐透（5红+2蓝） -->
            <template v-else-if="lottery.data.numbers.length === 7 && String(lottery.lotCode) === '80001'">
              <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                <span
                  class="number-ball-mini sports-ball"
                  :class="idx < 5 ? 'sports-red' : 'sports-blue'"
                >
                  {{ num }}
                </span>
                <span v-if="idx === 4" class="sports-separator">+</span>
              </template>
            </template>

            <!-- 体彩排列3（3个紫球） -->
            <template v-else-if="lottery.data.numbers.length === 3 && (String(lottery.lotCode) === '80002' || lottery.name.includes('排列3'))">
              <span
                v-for="(num, idx) in lottery.data.numbers"
                :key="idx"
                class="number-ball-mini sports-ball sports-purple"
              >
                {{ num }}
              </span>
            </template>

            <!-- 体彩排列5（5个紫球） -->
            <template v-else-if="lottery.data.numbers.length === 5 && (String(lottery.lotCode) === '80003' || lottery.name.includes('排列5'))">
              <span
                v-for="(num, idx) in lottery.data.numbers"
                :key="idx"
                class="number-ball-mini sports-ball sports-purple"
              >
                {{ num }}
              </span>
            </template>

            <!-- 体彩七星彩（6紫+1金） -->
            <template v-else-if="lottery.data.numbers.length === 7 && (String(lottery.lotCode) === '80004' || lottery.name.includes('七星彩') || lottery.name.includes('7星彩'))">
              <template v-for="(num, idx) in lottery.data.numbers" :key="idx">
                <span
                  class="number-ball-mini sports-ball"
                  :class="idx < 6 ? 'sports-purple' : 'sports-gold'"
                >
                  {{ num }}
                </span>
                <span v-if="idx === 5" class="sports-separator">+</span>
              </template>
            </template>

            <!-- 单排显示（≤10个号码，非K3，非六合彩，非福彩，非体彩） -->
            <template v-else-if="lottery.data.numbers.length <= 10">
              <span
                v-for="(num, idx) in lottery.data.numbers"
                :key="idx"
                class="number-ball-mini"
                :class="getBallMiniClass(lottery, idx)"
              >
                {{ num }}
              </span>
            </template>
          </div>
          <div v-else class="numbers-placeholder">
            <span class="placeholder-icon">⏳</span>
            <span class="placeholder-text">等待开奖...</span>
          </div>
        </div>

        <!-- 统计信息 -->
        <div v-if="lottery.data?.extras" class="card-stats">
          <div class="stat-item-mini" v-if="lottery.data.extras.sum">
            <span class="stat-mini-label">和值</span>
            <span class="stat-mini-value">{{ lottery.data.extras.sum }}</span>
          </div>
          <div class="stat-item-mini" v-if="lottery.data.extras.dragonTiger">
            <span class="stat-mini-label">龙虎</span>
            <span class="stat-mini-value">{{ lottery.data.extras.dragonTiger }}</span>
          </div>
          <div class="stat-item-mini" v-if="lottery.data.extras.champion">
            <span class="stat-mini-label">冠军</span>
            <span class="stat-mini-value">{{ lottery.data.extras.champion }}</span>
          </div>
        </div>

        <!-- 快捷操作 -->
        <div class="card-actions">
          <button class="action-btn" @click="viewDetails(lottery)">
            <span>详情</span>
          </button>
          <button class="action-btn" @click="viewHistory(lottery)">
            <span>历史</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredLotteries.length === 0" class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-text">未找到匹配的彩种</div>
      <button class="empty-action" @click="resetFilters">重置筛选</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { useWebSocket } from '../composables/useWebSocket'
import { useToast } from '../composables/useToast'

// ⚡ 测试日志 - 确认脚本已加载
console.log('✅ Realtime.vue 脚本已加载!')
console.log('当前时间:', new Date().toLocaleString())

const router = useRouter()
const toast = useToast()

// 🚀 WebSocket实时推送
const { connected, subscribe, subscribeLotteries } = useWebSocket()

// 筛选状态
const currentCategory = ref('all')
const searchQuery = ref('')

// 🚀 监听WebSocket连接状态变化
let wsUnsubscribe = null

// 彩种分类
const categories = computed(() => [
  { key: 'all', label: '全部', icon: '📋', count: 0 },
  { key: '极速彩', label: '极速彩', icon: '⚡', count: 0 },
  { key: '高频彩', label: '高频彩', icon: '🔥', count: 0 },
  { key: '赛车类', label: '赛车类', icon: '🏎️', count: 0 },
  { key: '其他', label: '其他', icon: '🎲', count: 0 }
])

// 彩种图标映射
const iconMap = {
  'jspk10': '🏎️',
  'jsft': '✈️',
  'jssc': '⏱️',
  'jsk3': '🎲',
  'jskl10': '🎯',
  'jskl8': '🎱',
  'js11x5': '🔢',
  'jslhc': '🌈',
  'sgairship': '🚁',
  'lucky5': '🦘',
  'lucky8': '🎰',
  'lucky10': '🎰',
  'lucky20': '🎰',
  'sg5d': '🎯',
  'sgquick3': '🎲',
  'sghappy8': '🎱',
  'sghappy20': '🎲',
  'sg11x5': '🔢',
  'xyssc': '⏰',
  'luckyairship': '✈️',
  'hklhc': '🇭🇰',
  'ssq': '🔴',
  'fc3d': '🎲',
  'qlc': '🎯',
  'kl8': '🎱'
}

// 彩种列表配置（从API加载）
const lotteryConfigs = ref([])

// 彩种数据
const lotteries = ref([])

// 定时器
let pollingTimer = null
let countdownTimer = null

// 刷新队列（避免同时大量请求）
const refreshQueue = new Set()
let isRefreshing = false

// 过滤后的彩种列表
const filteredLotteries = computed(() => {
  let result = lotteries.value

  // 按分类筛选
  if (currentCategory.value !== 'all') {
    result = result.filter(l => {
      if (!l.tags || l.tags.length === 0) return currentCategory.value === '其他'
      return l.tags.includes(currentCategory.value)
    })
  }

  // 按搜索关键词筛选
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(l =>
      l.name.toLowerCase().includes(query) ||
      l.code.toLowerCase().includes(query) ||
      l.scraperKey?.toLowerCase().includes(query)
    )
  }

  return result
})

// 更新分类计数
function updateCategoryCounts() {
  const counts = {
    all: lotteries.value.length,
    '极速彩': 0,
    '高频彩': 0,
    '赛车类': 0,
    '其他': 0
  }

  lotteries.value.forEach(l => {
    if (l.tags && l.tags.length > 0) {
      l.tags.forEach(tag => {
        if (counts.hasOwnProperty(tag)) {
          counts[tag]++
        }
      })
    } else {
      counts['其他']++
    }
  })

  categories.value.forEach(cat => {
    cat.count = counts[cat.key] || 0
  })
}

// 获取状态类名（基于倒计时）
function getStatusClass(lottery) {
  if (!lottery.data) return 'offline'
  const countdown = lottery.countdown || 0
  if (countdown === 0) return 'drawing'
  if (countdown <= 10) return 'preparing'
  return 'live'
}

// 获取状态文本（基于倒计时）
function getStatusText(lottery) {
  if (!lottery.data) return '离线'
  const countdown = lottery.countdown || 0
  if (countdown === 0) return '开奖中'
  if (countdown <= 10) return '即将开奖'
  return '运行中'
}

// 获取倒计时类名（基于倒计时）
function getCountdownClass(lottery) {
  const countdown = lottery.countdown || 0
  if (countdown === 0) return 'drawing'
  if (countdown <= 5) return 'preparing'
  return 'counting'
}

// 获取倒计时图标（基于倒计时）
function getCountdownIcon(lottery) {
  const countdown = lottery.countdown || 0
  if (countdown === 0) return '🎲'
  if (countdown <= 10) return '⏰'
  return '⏱️'
}

// 格式化倒计时
function formatCountdown(lottery) {
  const seconds = lottery.countdown || 0
  if (seconds <= 0) return '开奖中'

  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60

  if (minutes > 0) {
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }
  return `${secs}秒`
}

// 获取号码布局样式
function getNumbersLayoutClass(lottery) {
  const count = lottery.data?.numbers?.length || 0
  if (count > 10) return 'multi-row-layout'
  return 'single-row-layout'
}

// 解析六合彩号码（处理6个号码格式，最后一个包含两个数字的情况）
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
        // 返回前5个 + 分割后的2个
        return [...numbers.slice(0, 5), splitted[0].trim(), splitted[1].trim()]
      }
    }
  }

  // 其他情况直接返回原数组
  return numbers
}

// 获取小号码球样式
function getBallMiniClass(lottery, index) {
  const totalNumbers = lottery.data?.numbers?.length || 0
  const numbers = lottery.data?.numbers || []

  // 快乐20/8的第21个号码是特码
  if (totalNumbers === 21 && index === 20) {
    return 'special-code'
  }

  const num = numbers[index]
  if (!num) return ''

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

  // 20或21个号码的彩种（快乐8系列：英国乐透20、福彩快乐8、澳洲幸运20、SG快乐20、极速快乐8）
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

  // 7个号码的彩种（仅香港六合彩60001和极速六合彩10098使用官方波色，但会用SVG显示）
  // 其他7个号码的彩种（如体彩七乐彩等）不使用特殊颜色
  // 注意：六合彩实际上会用SVG球显示，这里的CSS类不会被使用

  // 其他默认：前三名特殊颜色
  if (index === 0) return 'champion'
  if (index === 1) return 'runner-up'
  if (index === 2) return 'third'

  return ''
}

// 获取六合彩号码波色（香港官方配色）
function getLhcBallColor(num) {
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

// 查看详情
function viewDetails(lottery) {
  // TODO: 跳转到详情页或打开模态框
  console.log('查看详情:', lottery.code)
}

// 查看历史
function viewHistory(lottery) {
  // 跳转到历史查询页面，带彩种过滤参数
  router.push({
    path: '/history',
    query: { lotCode: lottery.code }
  })
}

// 重置筛选
function resetFilters() {
  currentCategory.value = 'all'
  searchQuery.value = ''
}

// 加载彩种配置
async function loadLotteryConfigs() {
  try {
    const response = await api.getLotteryConfigs()
    if (response.success && response.data && response.data.lotteries) {
      lotteryConfigs.value = response.data.lotteries
      initLotteries()
    }
  } catch (error) {
    toast.error('加载彩种配置失败')
    console.error('加载彩种配置失败:', error)
  }
}

// 初始化彩种数据
function initLotteries() {
  lotteries.value = lotteryConfigs.value
    .filter(config => config.enabled && config.scraperKey)
    .map(config => ({
      code: config.scraperKey,  // 使用 scraperKey 作为调用实时API的标识
      lotCode: config.lotCode,   // 保留原始彩种编码
      name: config.name,
      icon: iconMap[config.scraperKey] || '🎲',
      tags: config.tags || [],
      interval: config.interval,
      scraperKey: config.scraperKey,
      data: null,
      countdown: 0,
      updating: false
    }))

  updateCategoryCounts()
}

// 加载单个彩种数据（从最新数据中查找）
function loadLotteryDataFromLatest(lottery, latestDataList) {
  const matchedData = latestDataList.find(item => item.lotCode === lottery.lotCode)

  if (matchedData) {
    // 🐛 调试：台湾彩票倒计时
    if (lottery.lotCode.startsWith('1000')) {
      console.log(`🔍 [台湾彩票] ${lottery.name} (${lottery.lotCode}): officialCountdown=${matchedData.officialCountdown}, issue=${matchedData.issue}`)
    }

    // 解析开奖号码
    const numbers = matchedData.drawCode
      ? matchedData.drawCode.split(',').map(n => n.trim().padStart(2, '0'))
      : []

    // 更新彩种数据
    lottery.data = {
      lotCode: matchedData.lotCode,
      lotName: matchedData.name,
      period: matchedData.issue,
      numbers: numbers,
      specialNumbers: matchedData.specialNumbers || null,  // 🎯 台湾宾果超级奖号
      drawTime: matchedData.drawTime,
      source: matchedData.source || 'official',
      officialCountdown: matchedData.officialCountdown,
      extras: {
        champion: numbers[0],
        runnerUp: numbers[1],
        topThree: numbers.slice(0, 3),
        sum: numbers.length >= 2 ? (parseInt(numbers[0]) + parseInt(numbers[1])) : 0,
        dragonTiger: numbers.length >= 10 ? (parseInt(numbers[0]) > parseInt(numbers[9]) ? '龙' : '虎') : null
      }
    }

    // 设置倒计时（使用官方倒计时）
    lottery.countdown = matchedData.officialCountdown || 0

    // 🐛 调试：确认倒计时已设置
    if (lottery.lotCode.startsWith('1000')) {
      console.log(`✅ [台湾彩票] ${lottery.name} countdown 已设置为: ${lottery.countdown}秒`)
    }
  } else {
    // 🐛 调试：未匹配到数据
    if (lottery.lotCode.startsWith('1000')) {
      console.warn(`⚠️ [台湾彩票] ${lottery.name} (${lottery.lotCode}) 未找到匹配数据`)
    }
  }
}

// 刷新单个彩种数据（独立无感刷新）
async function refreshSingleLottery(lottery) {
  // 防止重复刷新
  if (refreshQueue.has(lottery.lotCode)) {
    return
  }

  refreshQueue.add(lottery.lotCode)
  lottery.updating = true

  try {
    // 调用API获取最新数据
    const response = await api.getLatestData()

    if (response.success && response.data) {
      const latestDataList = response.data
      const matchedData = latestDataList.find(item => item.lotCode === lottery.lotCode)

      if (matchedData) {
        const oldPeriod = lottery.data?.period
        const newPeriod = matchedData.issue

        // 🎯 判断是否为低频彩
        const isLowFreq = lottery.lotCode.startsWith('1000') ||
                          lottery.lotCode.startsWith('7000') ||
                          lottery.lotCode.startsWith('8000')

        // 如果是低频彩且期号没变（还没开奖）
        if (isLowFreq && oldPeriod && oldPeriod === newPeriod && lottery.countdown === 0) {
          // 检查是否还在数据延迟期间内
          const now = Date.now()
          const drawStartTime = lottery.drawStartTime || now
          const elapsedSeconds = Math.floor((now - drawStartTime) / 1000)
          const dataDelayMinutes = lottery.drawSchedule?.dataDelayMinutes || 10
          const dataDelaySeconds = dataDelayMinutes * 60

          if (elapsedSeconds < dataDelaySeconds) {
            // 还在数据延迟期间内，保持倒计时为0，继续显示"开奖中"
            console.log(`⏱️  ${lottery.name} 期号未变 (${oldPeriod})，等待官网公布数据 (已等待${elapsedSeconds}秒/${dataDelaySeconds}秒)`)
            lottery.countdown = 0  // 保持为0，显示"开奖中"
          } else {
            // 超过数据延迟时间，期号仍未变，可能出现问题，重新计算倒计时
            console.log(`⚠️  ${lottery.name} 超过数据延迟时间(${dataDelaySeconds}秒)，期号仍未更新，重新计算倒计时`)
            loadLotteryDataFromLatest(lottery, latestDataList)
          }
        } else {
          // 期号变化了或高频彩，正常更新
          loadLotteryDataFromLatest(lottery, latestDataList)
          console.log(`🔄 ${lottery.name} 独立刷新完成 - 期号: ${lottery.data?.period}, 倒计时: ${lottery.countdown}秒`)
        }
      }
    }
  } catch (error) {
    toast.error(`刷新 ${lottery.name} 失败`)
    console.error(`刷新 ${lottery.name} 失败:`, error)
  } finally {
    lottery.updating = false
    refreshQueue.delete(lottery.lotCode)
  }
}

// 批量加载所有彩种数据
async function loadAllLotteriesData() {
  try {
    // 调用旧版API获取所有彩种的最新数据
    const response = await api.getLatestData()

    if (response.success && response.data) {
      const latestDataList = response.data

      // 为每个彩种匹配数据
      lotteries.value.forEach(lottery => {
        lottery.updating = true
        loadLotteryDataFromLatest(lottery, latestDataList)
        lottery.updating = false
      })

      console.log(`✅ 已加载 ${latestDataList.length} 个彩种的最新数据`)
    }
  } catch (error) {
    toast.error('加载彩种数据失败')
    console.error('加载彩种数据失败:', error)
  }
}

// 🎯 计算彩票的下一次倒计时（基于drawSchedule配置）
function calculateScheduledCountdown(lottery) {
  try {
    const config = lotteryConfigs.value.find(c => c.lotCode === lottery.lotCode)
    if (!config?.drawSchedule) {
      return null
    }

    const { mode } = config.drawSchedule

    // 🎯 模式1: interval模式（如台湾宾果，基于官方drawTime计算）
    if (mode === 'interval') {
      const intervalSeconds = config.drawSchedule.intervalSeconds || 300

      // 如果有官方drawTime，基于它计算下一期开奖时间
      if (lottery.data?.drawTime) {
        try {
          const lastDrawTime = new Date(lottery.data.drawTime)
          const now = new Date()
          const nextDrawTime = new Date(lastDrawTime.getTime() + intervalSeconds * 1000)

          // 🎯 计算倒计时（如果下期开奖时间已过，返回0，前端显示"开奖中"）
          const countdown = Math.max(0, Math.floor((nextDrawTime.getTime() - now.getTime()) / 1000))
          console.log(`🎯 ${lottery.name} interval模式倒计时: ${countdown}秒 (上期: ${lastDrawTime.toLocaleTimeString('zh-CN')}, 下期: ${nextDrawTime.toLocaleTimeString('zh-CN')})`)
          return countdown
        } catch (error) {
          console.error(`解析 ${lottery.name} drawTime失败:`, error)
          return intervalSeconds
        }
      }

      // 如果没有drawTime，返回固定间隔
      console.log(`🎯 ${lottery.name} interval模式倒计时: ${intervalSeconds}秒 (固定间隔)`)
      return intervalSeconds
    }

    // 🎯 模式2: scheduled模式（如台湾威力彩，每周固定时间）
    if (mode === 'scheduled') {
      const { drawDays, drawTime } = config.drawSchedule
      const now = new Date()
      const currentDayOfWeek = now.getDay()
      const [drawHour, drawMinute] = drawTime.split(':').map(Number)

      // 找到下一个开奖日
      let daysUntilNextDraw = null
      for (let i = 0; i <= 7; i++) {
        const checkDay = (currentDayOfWeek + i) % 7
        if (drawDays.includes(checkDay)) {
          if (i === 0) {
            const currentHours = now.getHours()
            const currentMinutes = now.getMinutes()
            const currentTotalMinutes = currentHours * 60 + currentMinutes
            const drawTotalMinutes = drawHour * 60 + drawMinute
            if (currentTotalMinutes >= drawTotalMinutes + 10) {
              continue // 今天的开奖已过（给10分钟缓冲）
            }
          }
          daysUntilNextDraw = i
          break
        }
      }

      if (daysUntilNextDraw !== null) {
        const nextDrawTime = new Date(now)
        nextDrawTime.setDate(nextDrawTime.getDate() + daysUntilNextDraw)
        nextDrawTime.setHours(drawHour)
        nextDrawTime.setMinutes(drawMinute)
        nextDrawTime.setSeconds(0)
        nextDrawTime.setMilliseconds(0)

        const countdown = Math.max(0, Math.floor((nextDrawTime.getTime() - now.getTime()) / 1000))
        console.log(`🎯 ${lottery.name} scheduled模式倒计时: ${countdown}秒 (下次开奖: ${nextDrawTime.toLocaleString('zh-CN')})`)
        return countdown
      }
    }

    return null
  } catch (error) {
    console.error(`计算 ${lottery.name} 倒计时失败:`, error)
    return null
  }
}

// 启动倒计时
function startCountdowns() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  countdownTimer = setInterval(() => {
    lotteries.value.forEach(lottery => {
      const previousCountdown = lottery.countdown

      if (lottery.countdown > 0) {
        lottery.countdown--
      }

      // 🎯 倒计时刚刚归零时，立即触发独立刷新
      if (previousCountdown === 1 && lottery.countdown === 0 && lottery.data) {
        console.log(`🎰 ${lottery.name} 倒计时结束，立即独立刷新`)

        // 🎯 判断是否为低频彩（台湾彩票、福彩、体彩）
        const isLowFrequencyLottery =
          lottery.lotCode.startsWith('1000') ||  // 台湾彩票（100001-100009）
          lottery.lotCode.startsWith('7000') ||  // 福彩（70001-70004）
          lottery.lotCode.startsWith('8000')     // 体彩（80001-80004）

        if (isLowFrequencyLottery) {
          // 🎯 低频彩倒计时归零：记录开奖开始时间，清空号码，显示"开奖中"
          console.log(`🎯 ${lottery.name} 倒计时归零，显示"开奖中"，等待新数据`)

          // 📝 记录开奖开始时间（用于判断数据延迟）
          lottery.drawStartTime = Date.now()

          // 清空旧期号的开奖号码（显示"开奖中"）
          if (lottery.data) {
            const oldPeriod = lottery.data.period
            lottery.data.numbers = []  // 清空号码
            console.log(`🧹 ${lottery.name} 清空旧期号 ${oldPeriod} 的开奖号码，等待新期号数据`)
          }

          // 获取数据延迟配置（分钟）
          const dataDelayMinutes = lottery.drawSchedule?.dataDelayMinutes || 10
          const dataDelayMs = dataDelayMinutes * 60 * 1000

          // 智能重试策略：根据数据延迟时间调整重试间隔
          const retryIntervals = []
          if (dataDelayMinutes >= 60) {
            // 长延迟（台湾彩票90分钟）：0s, 60s, 180s, 300s, 600s
            retryIntervals.push(0, 60000, 180000, 300000, 600000)
          } else {
            // 短延迟（福彩体彩10分钟）：0s, 5s, 15s, 30s, 60s
            retryIntervals.push(0, 5000, 15000, 30000, 60000)
          }

          console.log(`⏱️  ${lottery.name} 数据延迟配置: ${dataDelayMinutes}分钟，将在延迟期间内持续重试`)

          // 多次重试刷新
          retryIntervals.forEach((delay, index) => {
            setTimeout(() => {
              if (delay === 0) {
                console.log(`🔄 ${lottery.name} 立即刷新 (第${index + 1}次尝试)`)
              } else {
                console.log(`🔄 ${lottery.name} ${delay / 1000}秒后刷新 (第${index + 1}次尝试)`)
              }
              refreshSingleLottery(lottery)
            }, delay)
          })
        } else {
          // 🎯 其他彩种（高频彩）：延迟2秒刷新（原有逻辑）
          setTimeout(() => {
            refreshSingleLottery(lottery)
          }, 2000)
        }
      }

      // 开奖后5秒再次刷新（确保获取到开奖号码）- 仅非低频彩
      // 判断是否为低频彩
      const isLowFreq = lottery.lotCode.startsWith('1000') ||
                        lottery.lotCode.startsWith('7000') ||
                        lottery.lotCode.startsWith('8000')

      if (previousCountdown === 0 && lottery.countdown === -5 && !isLowFreq) {
        console.log(`🎲 ${lottery.name} 开奖后5秒，再次确认刷新`)
        refreshSingleLottery(lottery)
      }

      // 允许倒计时继续递减到负数（用于触发后续刷新）
      if (lottery.countdown === -10) {
        // 🎯 重置前再次尝试计算下一期倒计时
        const scheduledCountdown = calculateScheduledCountdown(lottery)
        if (scheduledCountdown !== null) {
          lottery.countdown = scheduledCountdown
        } else {
          lottery.countdown = 0
        }
      }
    })
  }, 1000)
}

// 校准倒计时（避免频繁跳跃）
function calibrateCountdowns(latestDataList) {
  lotteries.value.forEach(lottery => {
    const matchedData = latestDataList.find(item => item.lotCode === lottery.lotCode)

    if (matchedData && matchedData.officialCountdown !== null && matchedData.officialCountdown !== undefined) {
      const apiCountdown = matchedData.officialCountdown
      const localCountdown = lottery.countdown || 0
      const drift = apiCountdown - localCountdown

      // 只有偏差超过3秒才校准，避免频繁跳跃
      if (Math.abs(drift) >= 3) {
        console.log(`🔧 校准 ${lottery.name}: 本地${localCountdown}秒 → API${apiCountdown}秒 (偏差${drift}秒)`)
        lottery.countdown = apiCountdown

        // 同时更新数据（静默更新）
        lottery.updating = true
        loadLotteryDataFromLatest(lottery, latestDataList)
        lottery.updating = false
      } else if (apiCountdown === 0 && localCountdown > 0) {
        // API已开奖但本地还有倒计时，立即触发独立刷新
        console.log(`🔧 强制同步 ${lottery.name}: 本地${localCountdown}秒 → API已开奖，触发刷新`)
        lottery.countdown = 0

        // 触发独立刷新（获取最新开奖号码）
        setTimeout(() => {
          refreshSingleLottery(lottery)
        }, 1000)
      } else if (apiCountdown > 0 && localCountdown <= 0 && localCountdown > -10) {
        // 本地已开奖但API还在倒计时，校准回正确值
        console.log(`🔧 反向校准 ${lottery.name}: 本地${localCountdown}秒 → API${apiCountdown}秒`)
        lottery.countdown = apiCountdown
      }
    }
  })
}

// 启动轮询（仅用于校准倒计时，不全量刷新）
function startPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer)
  }

  // 每10秒轮询一次，仅校准倒计时（独立刷新由倒计时归零触发）
  pollingTimer = setInterval(async () => {
    try {
      const response = await api.getLatestData()

      if (response.success && response.data) {
        const latestDataList = response.data

        // 仅校准倒计时，不刷新数据
        calibrateCountdowns(latestDataList)

        console.log(`⏰ 倒计时校准完成 (${new Date().toLocaleTimeString()})`)
      }
    } catch (error) {
      toast.error('倒计时校准失败')
      console.error('轮询校准失败:', error)
    }
  }, 10000)
}

// 🚀 处理WebSocket推送的新期号数据
function handleLotteryUpdate(data) {
  console.log('📨 收到WebSocket消息:', data)

  // 🔧 同时处理 lottery_update 和 lottery_data（订阅后立即推送的初始数据）
  if (data.type !== 'lottery_update' && data.type !== 'lottery_data') {
    console.log(`⏭️ 跳过非彩种消息: ${data.type}`)
    return
  }

  const { lotCode, period, numbers, opencode, officialCountdown, drawTime } = data.data

  // 查找对应的彩种
  const lottery = lotteries.value.find(l => String(l.lotCode) === String(lotCode))
  if (!lottery) {
    toast.error(`未找到彩种 lotCode=${lotCode}`)
    console.warn(`⚠️ 未找到彩种 lotCode=${lotCode}`)
    return
  }

  // 🔧 区分初始数据和新期号推送
  if (data.type === 'lottery_data') {
    console.log(`📥 订阅初始数据: ${lottery.name} 期号 ${period}`)
  } else {
    console.log(`🚀 WebSocket推送: ${lottery.name} 新期号 ${period}`)
  }

  // 更新彩种数据
  lottery.data = {
    lotCode,
    lotName: lottery.name,
    period,
    numbers: numbers || (opencode ? opencode.split(',').map(n => n.trim().padStart(2, '0')) : []),
    specialNumbers: data.data.specialNumbers || null,  // 🎯 台湾宾果超级奖号（WebSocket）
    drawTime,
    source: 'official',
    officialCountdown,
    extras: {
      champion: numbers?.[0],
      runnerUp: numbers?.[1],
      topThree: numbers?.slice(0, 3),
      sum: numbers?.length >= 2 ? (parseInt(numbers[0]) + parseInt(numbers[1])) : 0,
      dragonTiger: numbers?.length >= 10 ? (parseInt(numbers[0]) > parseInt(numbers[9]) ? '龙' : '虎') : null
    }
  }

  // 重置倒计时
  lottery.countdown = officialCountdown || 0
}

// 初始化
onMounted(async () => {
  // 先加载彩种配置
  await loadLotteryConfigs()

  // 加载所有彩种实时数据
  if (lotteries.value.length > 0) {
    await loadAllLotteriesData()
    startCountdowns()
    startPolling()

    // 🚀 监听WebSocket连接状态
    console.log('👀 开始监听WebSocket连接状态...')
    watch(connected, (isConnected) => {
      console.log(`📡 WebSocket连接状态变化: ${isConnected}`)

      if (isConnected && lotteries.value.length > 0) {
        // 🚀 连接成功后订阅所有彩种
        const lotCodes = lotteries.value.map(l => String(l.lotCode))
        subscribeLotteries(lotCodes)
        toast.success(`已订阅 ${lotCodes.length} 个彩种的实时推送`)
        console.log(`🚀 已订阅 ${lotCodes.length} 个彩种的实时推送`)
      }
    }, { immediate: true })

    // 🚀 监听WebSocket消息
    wsUnsubscribe = subscribe(handleLotteryUpdate)
    console.log('📥 已设置WebSocket消息监听器')
  }
})

// 清理
onUnmounted(() => {
  if (pollingTimer) clearInterval(pollingTimer)
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<style scoped>
.realtime-center {
  padding: 20px;
  min-height: calc(100vh - 120px);
}

/* 页面头部 */
.page-header-luxury {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15));
  backdrop-filter: blur(20px);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.header-left {
  flex: 1;
  min-width: 200px;
}

.page-title-luxury {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.title-icon {
  font-size: 24px;
}

.page-subtitle {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0;
}

/* 筛选器 */
.header-filters {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  background: var(--glass-bg);
  padding: 6px;
  border-radius: 10px;
  border: 1px solid rgba(102, 126, 234, 0.3);
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.filter-tab:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--text-primary);
}

.filter-tab.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.tab-icon {
  font-size: 14px;
}

.tab-count {
  background: var(--text-subtle);
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.filter-tab.active .tab-count {
  background: var(--glass-border);
}

/* 搜索框 */
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--glass-bg);
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  min-width: 200px;
}

.search-icon {
  font-size: 14px;
  color: var(--text-tertiary);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* 彩种卡片网格 */
.lottery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

/* 彩种卡片 */
.lottery-card {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(102, 126, 234, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.lottery-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.lottery-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4);
  border-color: rgba(102, 126, 234, 0.5);
}

.lottery-card:hover::before {
  opacity: 1;
}

.lottery-card.card-updating {
  opacity: 0.9;
  position: relative;
}

.lottery-card.card-updating::after {
  content: '刷新中...';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(102, 126, 234, 0.95);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  animation: fadeInOut 0.6s ease-in-out;
  pointer-events: none;
  z-index: 10;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

/* 卡片头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(102, 126, 234, 0.2);
}

.lottery-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.lottery-icon {
  font-size: 28px;
  line-height: 1;
}

.lottery-name-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lottery-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.lottery-code {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
}

/* 卡片状态 */
.card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.card-status.live {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.card-status.preparing {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning-color);
}

.card-status.drawing {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.card-status.offline {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.card-status.live .status-dot,
.card-status.preparing .status-dot,
.card-status.drawing .status-dot {
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.3); }
}

/* 期号和倒计时 */
.card-period {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.period-info {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.period-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.period-number {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.5px;
}

/* 倒计时 */
.countdown {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
  transition: all 0.3s ease;
}

.countdown.preparing {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  animation: pulse-countdown 1s infinite;
}

.countdown.drawing {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  animation: pulse-countdown 0.5s infinite;
}

@keyframes pulse-countdown {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.countdown-icon {
  font-size: 14px;
}

.countdown-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  min-width: 50px;
  text-align: center;
}

/* 号码显示 */
.card-numbers {
  margin-bottom: 16px;
  min-height: 60px;
  display: flex;
  align-items: center;
}

/* 多排布局时增加高度 */
.card-numbers:has(.multi-row-layout) {
  min-height: 80px;
}

/* 单排布局（确保10个号码在一排显示） */
.numbers-display.single-row-layout {
  display: flex;
  flex-wrap: nowrap;
  gap: 3px;
  justify-content: center;
  overflow-x: auto;
}

/* 隐藏滚动条但保持可滚动（以防万一） */
.numbers-display.single-row-layout::-webkit-scrollbar {
  display: none;
}
.numbers-display.single-row-layout {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 多排布局（水平排列：左边两排 + 右边特码） */
.numbers-display.multi-row-layout {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  width: 100%;
}

/* 主号码区域（两排） */
.numbers-main-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

/* 每一排号码 */
.numbers-row {
  display: flex;
  gap: 4px;
  justify-content: center;
}

/* 特码包装器（右侧垂直居中） */
.special-code-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -2px;
}

/* 号码球 - 默认大小（单排布局） */
.number-ball-mini {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #ffffff !important;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  transition: all 0.2s ease;
  flex-shrink: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 多排布局时号码球变小 */
.multi-row-layout .number-ball-mini {
  width: 24px;
  height: 24px;
  font-size: 10px;
  box-shadow: 0 1px 6px rgba(102, 126, 234, 0.25);
}

.number-ball-mini:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* ========== PK10系列专用颜色（10个号码彩种）========== */
.number-ball-mini.ball-1 {
  background: linear-gradient(135deg, #ffeb3b 0%, #fdd835 50%, #ffeb3b 100%);
  box-shadow: 0 2px 8px rgba(255, 235, 59, 0.5);
}

.number-ball-mini.ball-2 {
  background: linear-gradient(135deg, #03a9f4 0%, #0288d1 50%, #03a9f4 100%);
  box-shadow: 0 2px 8px rgba(3, 169, 244, 0.5);
}

.number-ball-mini.ball-3 {
  background: linear-gradient(135deg, #607d8b 0%, #455a64 50%, #607d8b 100%);
  box-shadow: 0 2px 8px rgba(96, 125, 139, 0.5);
}

.number-ball-mini.ball-4 {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 50%, #ff9800 100%);
  box-shadow: 0 2px 8px rgba(255, 152, 0, 0.5);
}

.number-ball-mini.ball-5 {
  background: linear-gradient(135deg, #00bcd4 0%, #0097a7 50%, #00bcd4 100%);
  box-shadow: 0 2px 8px rgba(0, 188, 212, 0.5);
}

.number-ball-mini.ball-6 {
  background: linear-gradient(135deg, #673ab7 0%, #512da8 50%, #673ab7 100%);
  box-shadow: 0 2px 8px rgba(103, 58, 183, 0.5);
}

.number-ball-mini.ball-7 {
  background: linear-gradient(135deg, #9e9e9e 0%, #757575 50%, #9e9e9e 100%);
  box-shadow: 0 2px 8px rgba(158, 158, 158, 0.5);
}

.number-ball-mini.ball-8 {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 50%, #f44336 100%);
  box-shadow: 0 2px 8px rgba(244, 67, 54, 0.5);
}

.number-ball-mini.ball-9 {
  background: linear-gradient(135deg, #795548 0%, #5d4037 50%, #795548 100%);
  box-shadow: 0 2px 8px rgba(121, 85, 72, 0.5);
}

.number-ball-mini.ball-10 {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 50%, #4caf50 100%);
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.5);
}

/* ========== 时时彩专用颜色（0-9数字）========== */
.number-ball-mini.digit-0 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #ffd700;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.number-ball-mini.digit-1 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #2196f3;
  box-shadow: 0 0 12px rgba(33, 150, 243, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.number-ball-mini.digit-2 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #9c27b0;
  box-shadow: 0 0 12px rgba(156, 39, 176, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.number-ball-mini.digit-3 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #f44336;
  box-shadow: 0 0 12px rgba(244, 67, 54, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.number-ball-mini.digit-4 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #00bcd4;
  box-shadow: 0 0 12px rgba(0, 188, 212, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.number-ball-mini.digit-5 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #4caf50;
  box-shadow: 0 0 12px rgba(76, 175, 80, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.number-ball-mini.digit-6 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #ff9800;
  box-shadow: 0 0 12px rgba(255, 152, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.number-ball-mini.digit-7 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #673ab7;
  box-shadow: 0 0 12px rgba(103, 58, 183, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.number-ball-mini.digit-8 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #795548;
  box-shadow: 0 0 12px rgba(121, 85, 72, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

.number-ball-mini.digit-9 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-muted), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border-strong), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.2), transparent 50%),
    #607d8b;
  box-shadow: 0 0 12px rgba(96, 125, 139, 0.3), 0 2px 6px rgba(0, 0, 0, 0.25);
}

/* ========== 快乐十分专用颜色（1-20号码）========== */
.number-ball-mini.happy-1 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ff0000;
  box-shadow: 0 0 12px rgba(255, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-2 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #8b0000;
  box-shadow: 0 0 12px rgba(139, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-3 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ff8c00;
  box-shadow: 0 0 12px rgba(255, 140, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-4 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ff4500;
  box-shadow: 0 0 12px rgba(255, 69, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-5 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ffd700;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-6 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #9acd32;
  box-shadow: 0 0 12px rgba(154, 205, 50, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-7 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #00ff00;
  box-shadow: 0 0 12px rgba(0, 255, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-8 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #006400;
  box-shadow: 0 0 12px rgba(0, 100, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-9 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #00fa9a;
  box-shadow: 0 0 12px rgba(0, 250, 154, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-10 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #00ced1;
  box-shadow: 0 0 12px rgba(0, 206, 209, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-11 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #40e0d0;
  box-shadow: 0 0 12px rgba(64, 224, 208, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-12 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #0000ff;
  box-shadow: 0 0 12px rgba(0, 0, 255, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-13 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #000080;
  box-shadow: 0 0 12px rgba(0, 0, 128, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-14 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #87ceeb;
  box-shadow: 0 0 12px rgba(135, 206, 235, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-15 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #8b008b;
  box-shadow: 0 0 12px rgba(139, 0, 139, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-16 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #9400d3;
  box-shadow: 0 0 12px rgba(148, 0, 211, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-17 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #ff69b4;
  box-shadow: 0 0 12px rgba(255, 105, 180, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-18 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #8b4513;
  box-shadow: 0 0 12px rgba(139, 69, 19, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-19 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #708090;
  box-shadow: 0 0 12px rgba(112, 128, 144, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.happy-20 {
  background:
    radial-gradient(ellipse 40% 30% at 30% 20%, var(--text-secondary), transparent 70%),
    radial-gradient(ellipse 50% 40% at 35% 35%, var(--glass-border), transparent 60%),
    radial-gradient(ellipse 60% 50% at 70% 80%, rgba(0, 0, 0, 0.3), transparent 50%),
    #2f4f4f;
  box-shadow: 0 0 12px rgba(47, 79, 79, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
}

/* ========== 11选5专用颜色 ========== */

.number-ball-mini.x5-1 {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 50%, #f44336 100%);
  box-shadow: 0 2px 8px rgba(244, 67, 54, 0.5);
}

.number-ball-mini.x5-2 {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 50%, #ff9800 100%);
  box-shadow: 0 2px 8px rgba(255, 152, 0, 0.5);
}

.number-ball-mini.x5-3 {
  background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 50%, #9c27b0 100%);
  box-shadow: 0 2px 8px rgba(156, 39, 176, 0.5);
}

.number-ball-mini.x5-4 {
  background: linear-gradient(135deg, #3f51b5 0%, #303f9f 50%, #3f51b5 100%);
  box-shadow: 0 2px 8px rgba(63, 81, 181, 0.5);
}

.number-ball-mini.x5-5 {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 50%, #2196f3 100%);
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.5);
}

.number-ball-mini.x5-6 {
  background: linear-gradient(135deg, #03a9f4 0%, #0288d1 50%, #03a9f4 100%);
  box-shadow: 0 2px 8px rgba(3, 169, 244, 0.5);
}

.number-ball-mini.x5-7 {
  background: linear-gradient(135deg, #00bcd4 0%, #0097a7 50%, #00bcd4 100%);
  box-shadow: 0 2px 8px rgba(0, 188, 212, 0.5);
}

.number-ball-mini.x5-8 {
  background: linear-gradient(135deg, #009688 0%, #00796b 50%, #009688 100%);
  box-shadow: 0 2px 8px rgba(0, 150, 136, 0.5);
}

.number-ball-mini.x5-9 {
  background: linear-gradient(135deg, #4caf50 0%, #388e3c 50%, #4caf50 100%);
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.5);
}

.number-ball-mini.x5-10 {
  background: linear-gradient(135deg, #8bc34a 0%, #689f38 50%, #8bc34a 100%);
  box-shadow: 0 2px 8px rgba(139, 195, 74, 0.5);
}

.number-ball-mini.x5-11 {
  background: linear-gradient(135deg, #cddc39 0%, #afb42b 50%, #cddc39 100%);
  box-shadow: 0 2px 8px rgba(205, 220, 57, 0.5);
}

/* ========== 快乐8系列颜色（英国乐透20、福彩快乐8、澳洲幸运20、SG快乐20、极速快乐8）========== */
.number-ball-mini.kl8-row-1 {
  background:
    radial-gradient(circle at 30% 30%, var(--text-muted), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
  box-shadow: 0 0 12px rgba(255, 65, 108, 0.3), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.kl8-row-2 {
  background:
    radial-gradient(circle at 30% 30%, var(--text-muted), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 0 12px rgba(102, 126, 234, 0.3), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.number-ball-mini.kl8-special {
  background:
    radial-gradient(circle at 30% 30%, var(--text-secondary), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
  font-weight: bold;
}

/* ========== 六合彩波色样式（香港官方配色 - 基于 HKJC 官方 SVG）========== */
.number-ball-mini.lhc-red {
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

.number-ball-mini.lhc-blue {
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

.number-ball-mini.lhc-green {
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
  width: 28px;
  height: 28px;
  margin: 0 3px;
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
  margin: 0 6px;
  font-size: 20px;
  font-weight: bold;
  color: var(--text-primary);
  vertical-align: middle;
}

/* ========== 中国福彩官方配色 ========== */

/* 福彩号码球基础样式 */
.cwl-ball {
  width: 32px !important;
  height: 32px !important;
  line-height: 32px !important;
  font-size: 14px !important;
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
  margin: 0 8px;
  font-size: 20px;
  font-weight: bold;
  color: var(--text-primary);
  vertical-align: middle;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* ========== 中国体彩官方配色 ========== */

/* 体彩号码球基础样式 */
.sports-ball {
  width: 32px !important;
  height: 32px !important;
  line-height: 32px !important;
  font-size: 14px !important;
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
  margin: 0 8px;
  font-size: 20px;
  font-weight: bold;
  color: var(--text-primary);
  vertical-align: middle;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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

/* 宾果宾果粉红球（数字 01-80） */
.taiwan-bingo-pink {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #EC4899, #DB2777) !important;
  color: white !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 0 8px var(--text-subtle) !important;
}

/* 宾果宾果超级奖号金色球（正中靶心号 Bull's Eye） */
.taiwan-bingo-gold {
  background:
    radial-gradient(circle at 35% 35%, var(--text-tertiary), transparent 50%),
    radial-gradient(circle at 50% 50%, #FBBF24, #F59E0B) !important;
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
  margin: 0 8px;
  font-size: 20px;
  font-weight: bold;
  color: var(--text-primary);
  vertical-align: middle;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
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

.size-mini .face-1,
.size-mini .face-2,
.size-mini .face-3,
.size-mini .face-4,
.size-mini .face-5,
.size-mini .face-6 {
  transform-origin: center;
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

/* ========== 默认特殊号码颜色（其他彩种）========== */
.number-ball-mini.champion {
  background: linear-gradient(135deg, #fbbf24, var(--warning-color));
  box-shadow: 0 2px 8px rgba(251, 191, 36, 0.4);
}

.number-ball-mini.runner-up {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  box-shadow: 0 2px 8px rgba(148, 163, 184, 0.4);
}

.number-ball-mini.third {
  background: linear-gradient(135deg, #fb923c, #f97316);
  box-shadow: 0 2px 8px rgba(251, 146, 60, 0.4);
}

/* 特码（第21个号码）- 特殊样式 */
.number-ball-mini.special-code {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  box-shadow: 0 2px 10px rgba(239, 68, 68, 0.5);
  width: 28px;
  height: 28px;
  font-size: 11px;
  font-weight: 800;
  border: 2px solid var(--text-muted);
  animation: pulse-special 2s ease-in-out infinite;
}

.multi-row-layout .number-ball-mini.special-code {
  width: 28px;
  height: 28px;
  font-size: 11px;
}

@keyframes pulse-special {
  0%, 100% {
    box-shadow: 0 2px 10px rgba(239, 68, 68, 0.5);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.7);
    transform: scale(1.05);
  }
}

/* 号码占位符 */
.numbers-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
  padding: 12px;
  background: var(--glass-bg);
  border-radius: 8px;
  width: 100%;
  justify-content: center;
}

.placeholder-icon {
  font-size: 16px;
}

/* 统计信息 */
.card-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
  border-radius: 8px;
}

.stat-item-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.stat-mini-label {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-mini-value {
  font-size: 15px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* 卡片操作 */
.card-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid rgba(102, 126, 234, 0.4);
  background: rgba(102, 126, 234, 0.1);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #ffffff;
  border-color: transparent;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.empty-action {
  padding: 10px 24px;
  border: none;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.empty-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* 响应式 */
@media (max-width: 1400px) {
  .lottery-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

@media (max-width: 768px) {
  .page-header-luxury {
    flex-direction: column;
    align-items: stretch;
  }

  .header-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .search-box {
    width: 100%;
  }

  .lottery-grid {
    grid-template-columns: 1fr;
  }
}
</style>
