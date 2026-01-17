<template>
  <div class="scheduler-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <span class="gradient-text">调度器状态</span>
      </h2>
      <p class="page-desc">实时监控任务调度和执行情况</p>
    </div>

    <!-- 调度器概览 -->
    <div class="overview-grid">
      <HolographicCard :border="true" :hover="true" class="stat-card" shadow="hover">
        <div class="stat-content-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
            <span>⚙️</span>
          </div>
          <div class="stat-content">
            <div class="stat-label">调度器状态</div>
            <div class="stat-value">
              <GlowingTag
                :type="schedulerStatus.running ? 'success' : 'danger'"
                :text="schedulerStatus.running ? '运行中' : '已停止'"
                effect="plain"
                size="default"
              />
            </div>
          </div>
        </div>
      </HolographicCard>

      <HolographicCard :border="true" :hover="true" class="stat-card" shadow="hover">
        <div class="stat-content-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
            <span>📋</span>
          </div>
          <div class="stat-content">
            <div class="stat-label">活跃任务数</div>
            <div class="stat-value">{{ schedulerStatus.activeTasks || 0 }}</div>
          </div>
        </div>
      </HolographicCard>

      <HolographicCard :border="true" :hover="true" class="stat-card" shadow="hover">
        <div class="stat-content-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, var(--info-color), #00f2fe);">
            <span>✅</span>
          </div>
          <div class="stat-content">
            <div class="stat-label">今日成功</div>
            <div class="stat-value">{{ schedulerStatus.todaySuccess || 0 }}</div>
          </div>
        </div>
      </HolographicCard>

      <HolographicCard :border="true" :hover="true" class="stat-card" shadow="hover">
        <div class="stat-content-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a, #fee140);">
            <span>❌</span>
          </div>
          <div class="stat-content">
            <div class="stat-label">今日失败</div>
            <div class="stat-value">{{ schedulerStatus.todayFailed || 0 }}</div>
          </div>
        </div>
      </HolographicCard>
    </div>

    <!-- 任务列表 -->
    <HolographicCard :border="true" :hover="true" class="tasks-panel" shadow="never">
      <template #header>
        <div class="panel-header">
          <h3 class="panel-title">任务列表</h3>
          <div class="panel-actions">
            <div class="auto-refresh-control">
              <NeonButton
                :type="autoRefreshEnabled ? 'primary' : 'default'"
                size="default"
                @click="toggleAutoRefresh"
              >
                <el-icon><component :is="autoRefreshEnabled ? 'VideoPause' : 'VideoPlay'" /></el-icon>
                <span>{{ autoRefreshEnabled ? '暂停刷新' : '启用刷新' }}</span>
              </NeonButton>
              <span v-if="autoRefreshEnabled" class="refresh-countdown">
                {{ refreshCountdown }}秒后自动刷新
              </span>
            </div>
            <NeonButton
              size="default"
              :loading="loading"
              @click="loadTasks"
              :icon="Refresh"
            >
              手动刷新
            </NeonButton>
          </div>
        </div>
      </template>

      <div v-loading="loading" class="tasks-grid">
        <el-empty
          v-if="!loading && tasks.length === 0"
          description="暂无任务"
          :image-size="80"
        />

        <TaskCard
          v-else
          v-for="task in tasks"
          :key="task.lotCode"
          :task="task"
          @trigger="triggerTask"
        />
      </div>
    </HolographicCard>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Refresh, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import api from '../services/api'
import TaskCard from '../components/widgets/TaskCard.vue'
import { useWebSocket } from '../composables/useWebSocket'
import { useToast } from '../composables/useToast'
import { HolographicCard, NeonButton, GlowingTag } from '../components/tech'

const toast = useToast()

// ⚡ 测试日志 - 确认脚本已加载
console.log('✅ SchedulerElementPlus.vue 脚本已加载!')
console.log('当前时间:', new Date().toLocaleString())

// 🚀 WebSocket实时推送
const { connected, subscribe, subscribeLotteries } = useWebSocket()

// WebSocket取消订阅函数
let wsUnsubscribe = null

// 🔧 防抖定时器（避免短时间内重复加载）
let debounceTimer = null

// 调度器状态
const schedulerStatus = ref({
  running: false,
  activeTasks: 0,
  todaySuccess: 0,
  todayFailed: 0
})

// 任务列表
const tasks = ref([])
const loading = ref(false)

// 自动刷新控制
const autoRefreshEnabled = ref(true)
const refreshCountdown = ref(10)
const REFRESH_INTERVAL = 10 // 秒

// 定时器
let refreshTimer = null
let countdownTimer = null

// 加载调度器状态
const loadSchedulerStatus = async () => {
  try {
    const response = await api.getSchedulerStatus()
    if (response.success) {
      schedulerStatus.value = {
        running: response.data.running || false,
        activeTasks: response.data.activeTasks || 0,
        todaySuccess: response.data.todaySuccess || 0,
        todayFailed: response.data.todayFailed || 0
      }
    }
  } catch (error) {
    toast.error('加载调度器状态失败')
    console.error('加载调度器状态失败:', error)
  }
}

// 加载任务列表
const loadTasks = async (silentUpdate = false) => {
  try {
    if (!silentUpdate) {
      loading.value = true
    }

    const response = await api.getTasks()

    if (response.success) {
      const data = response.data

      // 获取新的任务数据
      const newTasks = data.lotteries || []

      // 同时更新调度器状态
      schedulerStatus.value = {
        running: data.isRunning || false,
        activeTasks: data.activeLotteries || 0,
        todaySuccess: data.successfulCrawls || 0,
        todayFailed: data.failedCrawls || 0
      }

      // 如果是静默更新（自动刷新），逐个更新卡片
      if (silentUpdate && tasks.value.length > 0) {
        updateTasksGradually(newTasks)
      } else {
        // 首次加载或手动刷新，直接替换
        tasks.value = newTasks
      }

      console.log('✅ 任务列表加载成功:', newTasks.length, '个任务')
      console.log('📋 任务数据:', newTasks.map(t => ({ lotCode: t.lotCode, name: t.name })))
    }
  } catch (error) {
    if (!silentUpdate) {
      toast.error('加载任务列表失败')
    }
    console.error('❌ 加载任务列表失败:', error)
    if (!silentUpdate) {
      tasks.value = []
    }
  } finally {
    if (!silentUpdate) {
      loading.value = false
    }
  }
}

// 逐个更新任务（带随机延迟，模拟独立刷新）
const updateTasksGradually = (newTasks) => {
  newTasks.forEach((newTask, index) => {
    // 为每个卡片生成随机延迟 (0-2000ms)
    const randomDelay = Math.random() * 2000

    setTimeout(() => {
      // 找到对应的旧任务并更新
      const taskIndex = tasks.value.findIndex(t => t.lotCode === newTask.lotCode)
      if (taskIndex !== -1) {
        // 更新现有任务
        tasks.value[taskIndex] = newTask
      } else {
        // 新任务，添加到列表
        tasks.value.push(newTask)
      }
    }, randomDelay)
  })
}

// 🎯 独立刷新单个任务（WebSocket推送时调用）
const refreshSingleTask = async (lotCode) => {
  try {
    // 方案1: 简化版 - 直接调用完整API，但只更新变化的任务
    const response = await api.getTasks()

    if (response.success && response.data) {
      const newTasks = response.data.lotteries || []

      // 只查找并更新这一个任务
      const newTaskData = newTasks.find(t => String(t.lotCode) === String(lotCode))
      if (!newTaskData) {
        console.warn(`⚠️ API返回数据中未找到 lotCode=${lotCode}`)
        return
      }

      // 查找并更新对应的任务
      const taskIndex = tasks.value.findIndex(t => String(t.lotCode) === String(lotCode))
      if (taskIndex !== -1) {
        // Vue 3响应式更新：只更新这一个对象
        tasks.value[taskIndex] = newTaskData
        console.log(`✅ [${newTaskData.name}] 独立更新成功 - 期号: ${newTaskData.lastPeriod}`)
      }
    }
  } catch (error) {
    console.error(`❌ 独立刷新任务失败 [${lotCode}]:`, error.message)
  }
}

// 触发手动爬取
const triggerTask = async (lotCode) => {
  try {
    const response = await api.triggerCrawl(lotCode)

    if (response.success) {
      toast.success('触发爬取成功')
      console.log('✅ 触发爬取成功:', lotCode)
      // 刷新任务列表（不刷新整个状态，只更新任务数据）
      setTimeout(() => {
        loadTasks()
      }, 1000)
    } else {
      toast.error(`触发爬取失败: ${response.message}`)
      console.error('❌ 触发爬取失败:', response.message)
    }
  } catch (error) {
    toast.error('触发爬取失败')
    console.error('❌ 触发爬取失败:', error)
  }
}

// 启动倒计时
const startCountdown = () => {
  // 清除旧倒计时
  if (countdownTimer) {
    clearInterval(countdownTimer)
  }

  refreshCountdown.value = REFRESH_INTERVAL

  countdownTimer = setInterval(() => {
    if (refreshCountdown.value > 0) {
      refreshCountdown.value--
    } else {
      refreshCountdown.value = REFRESH_INTERVAL
    }
  }, 1000)
}

// 停止倒计时
const stopCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

// 启动自动刷新
const startAutoRefresh = () => {
  // 清除旧定时器
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }

  // 启动刷新定时器
  refreshTimer = setInterval(() => {
    loadSchedulerStatus()
    loadTasks(true) // 静默更新，逐个刷新卡片
  }, REFRESH_INTERVAL * 1000)

  // 启动倒计时
  startCountdown()
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  stopCountdown()
}

// 切换自动刷新
const toggleAutoRefresh = () => {
  autoRefreshEnabled.value = !autoRefreshEnabled.value

  if (autoRefreshEnabled.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

// 🚀 处理WebSocket推送的新期号数据（独立无感刷新）
function handleLotteryUpdate(data) {
  console.log('📨 Scheduler收到WebSocket消息:', data)

  // 🔧 同时处理 lottery_update 和 lottery_data（订阅后立即推送的初始数据）
  if (data.type !== 'lottery_update' && data.type !== 'lottery_data') {
    console.log(`⏭️ 跳过非彩种消息: ${data.type}`)
    return
  }

  const { lotCode, period } = data.data

  // 查找对应的任务
  const task = tasks.value.find(t => String(t.lotCode) === String(lotCode))
  if (!task) {
    toast.warning(`未找到任务 lotCode=${lotCode}`)
    console.warn(`⚠️ 未找到任务 lotCode=${lotCode}`)
    return
  }

  // 🔧 区分初始数据和新期号推送
  if (data.type === 'lottery_data') {
    console.log(`📥 订阅初始数据: ${task.name} 期号 ${period}`)
    // 初始数据不需要刷新，已经在初始化时加载过了
    return
  }

  // 🎯 独立刷新：只更新这一个任务，不影响其他40个任务
  console.log(`🚀 WebSocket推送: ${task.name} 新期号 ${period} - 独立更新`)
  refreshSingleTask(lotCode)
}

// 初始化
onMounted(async () => {
  loadSchedulerStatus()
  await loadTasks()
  startAutoRefresh()

  // 🚀 监听WebSocket连接状态
  console.log('👀 Scheduler开始监听WebSocket连接状态...')
  watch(connected, (isConnected) => {
    console.log(`📡 Scheduler WebSocket连接状态变化: ${isConnected}`)

    if (isConnected) {
      // 🚀 WebSocket连接成功：停止自动刷新（改用实时推送）
      console.log('🛑 WebSocket已连接，停止自动刷新定时器')
      stopAutoRefresh()

      if (tasks.value.length > 0) {
        // 订阅所有彩种
        const lotCodes = tasks.value.map(t => String(t.lotCode))
        subscribeLotteries(lotCodes)
        console.log(`🚀 Scheduler已订阅 ${lotCodes.length} 个彩种的实时推送`)
      }
    } else {
      // 🔄 WebSocket断开：重启自动刷新（回退到轮询模式）
      console.log('🔄 WebSocket已断开，启动自动刷新定时器')
      startAutoRefresh()
    }
  }, { immediate: true })

  // 🚀 监听WebSocket消息
  wsUnsubscribe = subscribe(handleLotteryUpdate)
  console.log('📥 Scheduler已设置WebSocket消息监听器')
})

// 清理
onUnmounted(() => {
  stopAutoRefresh()
  if (wsUnsubscribe) {
    wsUnsubscribe()
  }
})
</script>

<style scoped>
.scheduler-page {
  padding: 20px;
  width: 100%;
  max-width: none;
}

/* 页面头部 */
.page-header {
  margin-bottom: 20px;
}

.page-title {
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
}

.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-desc {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

/* 概览网格 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

/* 统计卡片 */
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
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 任务面板 */
.tasks-panel {
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(20px);
  border: 1px solid var(--el-border-color);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.auto-refresh-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-countdown {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-family: 'Courier New', monospace;
  min-width: 90px;
}

/* 任务网格 */
.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
  min-height: 200px;
}

/* 响应式 - 平板 */
@media (max-width: 1024px) {
  .scheduler-page {
    padding: 16px;
  }

  .overview-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .tasks-grid {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 14px;
  }
}

/* 响应式 - 手机横屏 */
@media (max-width: 768px) {
  .scheduler-page {
    padding: 12px;
  }

  .page-header {
    margin-bottom: 16px;
  }

  .page-title {
    font-size: 22px;
  }

  .page-desc {
    font-size: 13px;
  }

  .overview-grid {
    gap: 10px;
    margin-bottom: 16px;
  }

  .stat-content-wrapper {
    gap: 12px;
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    font-size: 20px;
  }

  .stat-label {
    font-size: 12px;
  }

  .stat-value {
    font-size: 20px;
  }

  .tasks-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .panel-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .panel-title {
    font-size: 16px;
  }

  .panel-actions {
    width: 100%;
    flex-direction: column;
    gap: 10px;
  }

  .auto-refresh-control {
    width: 100%;
    justify-content: space-between;
  }
}

/* 响应式 - 手机竖屏 */
@media (max-width: 480px) {
  .scheduler-page {
    padding: 10px;
  }

  .page-title {
    font-size: 20px;
  }

  .overview-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stat-content-wrapper {
    gap: 10px;
  }

  .stat-icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
  }

  .refresh-countdown {
    min-width: 70px;
    font-size: 12px;
  }
}
</style>
