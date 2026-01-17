<template>
  <div class="system-monitor-page">
    <!-- 紧凑型顶部状态栏 -->
    <div class="compact-header">
      <div class="header-left">
        <h1 class="compact-title">🖥️ 系统监控</h1>
        <span v-if="lastRefreshTime" class="refresh-time">
          最后刷新: {{ formatRelativeTime(lastRefreshTime) }}
        </span>
      </div>
      <div class="header-right">
        <div class="auto-refresh-toggle">
          <span class="toggle-label">自动刷新</span>
          <el-switch
            v-model="autoRefreshEnabled"
          />
        </div>
        <el-select
          v-model="refreshInterval"
          style="width: 100px"
          placeholder="间隔"
        >
          <el-option label="15秒" :value="15000" />
          <el-option label="30秒" :value="30000" />
          <el-option label="60秒" :value="60000" />
          <el-option label="5分钟" :value="300000" />
        </el-select>
        <NeonButton
          type="primary"
          @click="refreshData"
          :loading="loading"
        >
          <template #icon v-if="!loading">
            <span>🔄</span>
          </template>
          刷新
        </NeonButton>
      </div>
    </div>

    <!-- 系统状态栏 -->
    <HolographicCard class="status-bar">
      <div class="status-items">
        <!-- 调度器 -->
        <div class="status-item clickable" @click="viewSchedulerDetails">
          <div class="status-icon">⚙️</div>
          <div class="status-info">
            <div class="status-label">调度器</div>
            <div class="status-value">{{ schedulerStats.activeCrawlers }}/{{ schedulerStats.totalCrawlers }}</div>
            <el-tag
              :type="schedulerStats.activeCrawlers > 0 ? 'success' : 'info'"
              effect="dark"
              class="status-tag"
            >
              {{ schedulerStats.activeCrawlers > 0 ? '运行中' : '空闲' }}
            </el-tag>
          </div>
          <div class="status-action">👁️</div>
        </div>

        <!-- 倒计时管理器 -->
        <div class="status-item clickable" @click="viewCountdownDetails">
          <div class="status-icon">⏱️</div>
          <div class="status-info">
            <div class="status-label">倒计时</div>
            <div class="status-value">{{ systemOverview.countdown?.totalLotteries || 0 }} 彩种</div>
            <el-tag effect="dark"
              :type="systemOverview.countdown?.isRunning ? 'success' : 'danger'"
              class="status-tag"
            >
              {{ systemOverview.countdown?.isRunning ? '运行中' : '已停止' }}
            </el-tag>
          </div>
          <div class="status-action">👁️</div>
        </div>

        <!-- WebSocket -->
        <div class="status-item clickable" @click="viewWebSocketDetails">
          <div class="status-icon">🔌</div>
          <div class="status-info">
            <div class="status-label">WebSocket</div>
            <div class="status-value">{{ systemOverview.websocket?.totalConnections || 0 }} 连接</div>
            <el-tag effect="dark"
              :type="systemOverview.websocket?.totalConnections > 0 ? 'success' : 'info'"
              class="status-tag"
            >
              {{ systemOverview.websocket?.totalConnections > 0 ? '在线' : '离线' }}
            </el-tag>
          </div>
          <div class="status-action">👁️</div>
        </div>

        <!-- 数据库 -->
        <div class="status-item clickable" @click="viewDatabaseDetails">
          <div class="status-icon">💾</div>
          <div class="status-info">
            <div class="status-label">数据库</div>
            <div class="status-value">{{ systemOverview.database?.status === 'online' ? '在线' : '离线' }}</div>
            <el-tag effect="dark"
              :type="systemOverview.database?.connected ? 'success' : 'danger'"
              class="status-tag"
            >
              {{ systemOverview.database?.connected ? '正常' : '异常' }}
            </el-tag>
          </div>
          <div class="status-action">👁️</div>
        </div>
      </div>
    </HolographicCard>

    <!-- 中部双栏布局：性能趋势 + 错误日志 -->
    <div class="middle-section">
      <!-- 左侧：性能趋势 -->
      <HolographicCard class="performance-panel" v-if="performanceHistory.length > 0">
        <div class="panel-header">
          <span class="panel-title">📈 性能趋势</span>
          <span class="panel-subtitle">最近 {{ performanceHistory.length }} 个数据点</span>
        </div>
        <div class="performance-charts-compact">
          <!-- 活跃爬虫趋势 -->
          <div class="chart-item-compact">
            <div class="chart-header-compact">
              <span class="chart-label">⚙️ 活跃爬虫</span>
              <span class="chart-value">{{ schedulerStats.activeCrawlers }}</span>
            </div>
            <div class="mini-chart-compact">
              <div
                v-for="(point, index) in performanceHistory"
                :key="index"
                class="chart-bar"
                :style="{
                  height: `${(point.activeCrawlers / maxActiveCrawlers) * 100}%`
                }"
              ></div>
            </div>
          </div>

          <!-- WebSocket连接趋势 -->
          <div class="chart-item-compact">
            <div class="chart-header-compact">
              <span class="chart-label">🔌 WebSocket</span>
              <span class="chart-value">{{ systemOverview.websocket?.totalConnections || 0 }}</span>
            </div>
            <div class="mini-chart-compact">
              <div
                v-for="(point, index) in performanceHistory"
                :key="index"
                class="chart-bar"
                :style="{
                  height: `${(point.wsConnections / maxWsConnections) * 100}%`
                }"
              ></div>
            </div>
          </div>

          <!-- 错误统计趋势 -->
          <div class="chart-item-compact">
            <div class="chart-header-compact">
              <span class="chart-label">❌ 错误数</span>
              <span class="chart-value error-text">{{ lotteryList.reduce((sum, l) => sum + l.errorCount, 0) }}</span>
            </div>
            <div class="mini-chart-compact">
              <div
                v-for="(point, index) in performanceHistory"
                :key="index"
                class="chart-bar error-bar"
                :style="{
                  height: `${(point.totalErrors / maxTotalErrors) * 100}%`
                }"
              ></div>
            </div>
          </div>
        </div>
        <!-- 时间范围标签 -->
        <div v-if="performanceTimeRange" class="chart-time-range">
          <span class="time-icon">🕐</span>
          <span class="time-text">{{ performanceTimeRange }}</span>
        </div>
      </HolographicCard>

      <!-- 右侧：错误日志 -->
      <HolographicCard class="error-panel">
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-title">⚠️ 错误日志</span>
            <span class="panel-subtitle">前 10 条错误记录</span>
          </div>
          <el-button
            v-if="errorLotteries.length > 0"
            type="text"
            @click="allErrorsDialogVisible = true"
            class="view-all-btn"
          >
            查看全部
          </el-button>
        </div>
        <div v-if="errorLotteries.length > 0" class="error-list-compact">
          <div
            v-for="lottery in errorLotteries"
            :key="lottery.lotCode"
            class="error-item-compact clickable"
            @click="scrollToLottery(lottery.lotCode)"
          >
            <div class="error-main">
              <span class="error-code-compact">{{ lottery.lotCode }}</span>
              <span class="error-name-compact">{{ lottery.lotName }}</span>
              <el-tag type="danger" size="small" effect="dark">{{ lottery.errorCount }}</el-tag>
            </div>
            <div class="error-meta">
              <span class="error-time">{{ formatTime(lottery.lastFetchTime) }}</span>
              <el-tag
                :type="lottery.isActive ? 'success' : 'info'"
                size="small"
                effect="dark"
              >
                {{ lottery.isActive ? '运行中' : '未运行' }}
              </el-tag>
            </div>
            <div class="error-action">👁️</div>
          </div>
        </div>
        <el-empty
          v-else
          description="暂无错误"
          :image-size="40"
        >
          <template #image>
            <span style="font-size: 24px;">✅</span>
          </template>
        </el-empty>
      </HolographicCard>
    </div>

    <!-- 彩种监控列表 -->
    <section class="lottery-section">
      <div class="section-header">
        <h2 class="section-title">🎰 彩种监控列表</h2>
        <NeonButton
          type="primary"
          @click="refreshData"
          :loading="loading"
        >
          <template #icon v-if="!loading">
            <span>🔄</span>
          </template>
          刷新数据
        </NeonButton>
      </div>

      <!-- 筛选工具栏 -->
      <div class="filter-toolbar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索彩种代码或名称"
          clearable
          style="width: 300px"
          prefix-icon="Search"
        />
        <el-select
          v-model="statusFilter"
          placeholder="筛选状态"
          clearable
          style="width: 150px"
        >
          <el-option label="全部" value="" />
          <el-option label="运行中" value="active" />
          <el-option label="未运行" value="inactive" />
        </el-select>
        <NeonButton
          :type="errorOnlyFilter ? 'danger' : 'default'"
          @click="errorOnlyFilter = !errorOnlyFilter"
          class="error-filter-btn"
        >
          <span v-if="errorOnlyFilter">✓</span>
          只看有错误
        </NeonButton>

        <!-- 快捷筛选预设 -->
        <div class="filter-presets">
          <span class="presets-label">快捷筛选:</span>
          <div class="preset-buttons">
            <NeonButton
              @click="applyPreset('all')"
              :type="currentPreset === 'all' ? 'primary' : 'default'"
              size="small"
            >
              全部
            </NeonButton>
            <NeonButton
              @click="applyPreset('errors')"
              :type="currentPreset === 'errors' ? 'primary' : 'default'"
              size="small"
            >
              有错误
            </NeonButton>
            <NeonButton
              @click="applyPreset('active')"
              :type="currentPreset === 'active' ? 'primary' : 'default'"
              size="small"
            >
              运行中
            </NeonButton>
            <NeonButton
              @click="applyPreset('lowRate')"
              :type="currentPreset === 'lowRate' ? 'primary' : 'default'"
              size="small"
            >
              低成功率
            </NeonButton>
          </div>
        </div>

        <span class="filter-result">
          显示 {{ filteredLotteryList.length }} / {{ lotteryList.length }} 条
        </span>
      </div>

      <HolographicCard class="table-card">
        <el-table
          :data="filteredLotteryList"
          style="width: 100%"
          :loading="loading"
          stripe
          :default-sort="{ prop: 'errorCount', order: 'descending' }"
        >
          <el-table-column prop="lotCode" label="彩种代码" width="120" sortable />
          <el-table-column prop="lotName" label="彩种名称" min-width="150" sortable />
          <el-table-column label="爬虫状态" width="120">
            <template #default="scope">
              <el-tag effect="dark"
                :type="scope.row.isActive ? 'success' : 'info'"
              >
                {{ scope.row.isActive ? '运行中' : '未运行' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="interval" label="抓取间隔" width="120" sortable>
            <template #default="scope">
              {{ formatInterval(scope.row.interval) }}
            </template>
          </el-table-column>
          <el-table-column prop="lastFetchTime" label="最后抓取时间" min-width="180" sortable>
            <template #default="scope">
              {{ formatTime(scope.row.lastFetchTime) }}
            </template>
          </el-table-column>
          <el-table-column prop="successCount" label="成功次数" width="120" sortable />
          <el-table-column prop="errorCount" label="错误次数" width="120" sortable>
            <template #default="scope">
              <span :class="{ 'error-count': scope.row.errorCount > 0 }">
                {{ scope.row.errorCount }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="成功率" width="120" sortable :sort-method="(a, b) => calculateSuccessRate(a) - calculateSuccessRate(b)">
            <template #default="scope">
              <span :class="getSuccessRateClass(scope.row)">
                {{ formatSuccessRate(scope.row) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="倒计时状态" width="120">
            <template #default="scope">
              <el-tag effect="dark"
                v-if="scope.row.hasCountdown"
                type="success"
              >
                已启用
              </el-tag>
              <el-tag effect="dark"
                v-else
                type="info"
              >
                未启用
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="150" fixed="right">
            <template #default="scope">
              <NeonButton
                type="primary"
                size="small"
                @click="viewDetails(scope.row)"
              >
                查看详情
              </NeonButton>
            </template>
          </el-table-column>
        </el-table>
      </HolographicCard>
    </section>

    <!-- 彩种详情对话框 -->
    <CyberDialog
      v-model="dialogVisible"
      :title="`彩种详情 - ${selectedLottery?.lotName || ''}`"
      width="900px"
      :close-on-click-overlay="false"
    >
      <div v-if="selectedLottery" class="lottery-detail">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h3 class="detail-section-title">📋 基本信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">彩种代码:</span>
              <span class="detail-value">{{ selectedLottery.lotCode }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">彩种名称:</span>
              <span class="detail-value">{{ selectedLottery.lotName }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">爬虫状态:</span>
              <el-tag effect="dark"
                :type="selectedLottery.isActive ? 'success' : 'info'"
              >
                {{ selectedLottery.isActive ? '运行中' : '未运行' }}
              </el-tag>
            </div>
            <div class="detail-item">
              <span class="detail-label">倒计时:</span>
              <el-tag effect="dark"
                :type="selectedLottery.hasCountdown ? 'success' : 'info'"
              >
                {{ selectedLottery.hasCountdown ? '已启用' : '未启用' }}
              </el-tag>
            </div>
          </div>
        </div>

        <!-- 运行统计 -->
        <div class="detail-section">
          <h3 class="detail-section-title">📊 运行统计</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">成功次数:</span>
              <span class="detail-value success-text">{{ selectedLottery.successCount }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">错误次数:</span>
              <span class="detail-value" :class="{ 'error-text': selectedLottery.errorCount > 0 }">
                {{ selectedLottery.errorCount }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">抓取间隔:</span>
              <span class="detail-value">{{ formatInterval(selectedLottery.interval) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">最后抓取:</span>
              <span class="detail-value">{{ formatTime(selectedLottery.lastFetchTime) }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <NeonButton @click="dialogVisible = false">关闭</NeonButton>
      </template>
    </CyberDialog>

    <!-- 倒计时详情对话框 -->
    <CyberDialog
      v-model="countdownDialogVisible"
      title="⏱️ 倒计时管理器详情"
      width="900px"
      :close-on-click-overlay="false"
    >
      <div v-if="countdownStats" class="countdown-detail">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h3 class="detail-section-title">📋 基本信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">运行状态:</span>
              <el-tag effect="dark"
                :type="countdownStats.isRunning ? 'success' : 'danger'"
              >
                {{ countdownStats.isRunning ? '运行中' : '已停止' }}
              </el-tag>
            </div>
            <div class="detail-item">
              <span class="detail-label">管理彩种数:</span>
              <span class="detail-value">{{ countdownStats.totalLotteries }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">内存使用:</span>
              <span class="detail-value">{{ countdownStats.estimatedMemoryKB }} KB</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">更新时间:</span>
              <span class="detail-value">{{ formatTime(countdownStats.timestamp) }}</span>
            </div>
          </div>
        </div>

        <!-- 倒计时分布 -->
        <div class="detail-section">
          <h3 class="detail-section-title">📊 倒计时分布</h3>
          <div class="countdown-ranges">
            <div class="range-item">
              <div class="range-header">
                <span class="range-label">⏰ 0秒 (即将开奖)</span>
                <span class="range-count">{{ countdownStats.countdownRanges.zero }}</span>
              </div>
              <el-progress
                :percentage="(countdownStats.countdownRanges.zero / countdownStats.totalLotteries * 100)"
                :show-text="false"
                color="#f56c6c"
              />
            </div>
            <div class="range-item">
              <div class="range-header">
                <span class="range-label">🔥 1-9秒</span>
                <span class="range-count">{{ countdownStats.countdownRanges.under10 }}</span>
              </div>
              <el-progress
                :percentage="(countdownStats.countdownRanges.under10 / countdownStats.totalLotteries * 100)"
                :show-text="false"
                color="#e6a23c"
              />
            </div>
            <div class="range-item">
              <div class="range-header">
                <span class="range-label">⚡ 10-29秒</span>
                <span class="range-count">{{ countdownStats.countdownRanges.under30 }}</span>
              </div>
              <el-progress
                :percentage="(countdownStats.countdownRanges.under30 / countdownStats.totalLotteries * 100)"
                :show-text="false"
                color="#409eff"
              />
            </div>
            <div class="range-item">
              <div class="range-header">
                <span class="range-label">⏳ 30-59秒</span>
                <span class="range-count">{{ countdownStats.countdownRanges.under60 }}</span>
              </div>
              <el-progress
                :percentage="(countdownStats.countdownRanges.under60 / countdownStats.totalLotteries * 100)"
                :show-text="false"
                color="#67c23a"
              />
            </div>
            <div class="range-item">
              <div class="range-header">
                <span class="range-label">🕐 60秒以上</span>
                <span class="range-count">{{ countdownStats.countdownRanges.over60 }}</span>
              </div>
              <el-progress
                :percentage="(countdownStats.countdownRanges.over60 / countdownStats.totalLotteries * 100)"
                :show-text="false"
                color="#909399"
              />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <NeonButton @click="countdownDialogVisible = false">关闭</NeonButton>
      </template>
    </CyberDialog>

    <!-- WebSocket详情对话框 -->
    <CyberDialog
      v-model="websocketDialogVisible"
      title="🔌 WebSocket连接详情"
      width="900px"
      :close-on-click-overlay="false"
    >
      <div v-if="systemOverview.websocket" class="websocket-detail">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h3 class="detail-section-title">📋 连接信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">连接状态:</span>
              <el-tag effect="dark"
                :type="systemOverview.websocket.totalConnections > 0 ? 'success' : 'info'"
              >
                {{ systemOverview.websocket.totalConnections > 0 ? '在线' : '离线' }}
              </el-tag>
            </div>
            <div class="detail-item">
              <span class="detail-label">活跃连接数:</span>
              <span class="detail-value success-text">{{ systemOverview.websocket.totalConnections }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">总订阅数:</span>
              <span class="detail-value">{{ systemOverview.websocket.totalSubscriptions }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">平均订阅/连接:</span>
              <span class="detail-value">
                {{ systemOverview.websocket.totalConnections > 0
                  ? (systemOverview.websocket.totalSubscriptions / systemOverview.websocket.totalConnections).toFixed(1)
                  : '0' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 连接统计 -->
        <div class="detail-section">
          <h3 class="detail-section-title">📊 连接统计</h3>
          <div class="ws-stats">
            <div class="stat-card">
              <div class="stat-icon">👥</div>
              <div class="stat-content">
                <div class="stat-value">{{ systemOverview.websocket.totalConnections }}</div>
                <div class="stat-label">活跃客户端</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📡</div>
              <div class="stat-content">
                <div class="stat-value">{{ systemOverview.websocket.totalSubscriptions }}</div>
                <div class="stat-label">彩种订阅</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <NeonButton @click="websocketDialogVisible = false">关闭</NeonButton>
      </template>
    </CyberDialog>

    <!-- 调度器详情对话框 -->
    <CyberDialog
      v-model="schedulerDialogVisible"
      title="⚙️ 调度器详情"
      width="900px"
      :close-on-click-overlay="false"
    >
      <div v-if="systemOverview.scheduler" class="scheduler-detail">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h3 class="detail-section-title">📋 基本信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">运行状态:</span>
              <el-tag effect="dark"
                :type="schedulerStats.activeCrawlers > 0 ? 'success' : 'info'"
              >
                {{ schedulerStats.activeCrawlers > 0 ? '运行中' : '空闲' }}
              </el-tag>
            </div>
            <div class="detail-item">
              <span class="detail-label">总彩种数:</span>
              <span class="detail-value">{{ schedulerStats.totalCrawlers }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">活跃爬虫:</span>
              <span class="detail-value success-text">{{ schedulerStats.activeCrawlers }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">空闲爬虫:</span>
              <span class="detail-value">{{ schedulerStats.totalCrawlers - schedulerStats.activeCrawlers }}</span>
            </div>
          </div>
        </div>

        <!-- 彩种列表 -->
        <div class="detail-section" v-if="systemOverview.scheduler.lotteries">
          <h3 class="detail-section-title">🎰 彩种列表</h3>
          <el-table
            :data="systemOverview.scheduler.lotteries"
            style="width: 100%"
            max-height="400"
          >
            <el-table-column prop="lotCode" label="彩种代码" width="100" />
            <el-table-column prop="name" label="彩种名称" min-width="120" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag effect="dark"
                  :type="row.status === 'crawling' ? 'success' : 'info'"
                >
                  {{ row.status === 'crawling' ? '爬取中' : row.status === 'scheduled' ? '已调度' : '空闲' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最后轮询" min-width="150">
              <template #default="{ row }">
                {{ formatTime(row.lastPollTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="consecutiveErrors" label="连续错误" width="90" />
          </el-table>
        </div>
      </div>

      <template #footer>
        <NeonButton @click="schedulerDialogVisible = false">关闭</NeonButton>
      </template>
    </CyberDialog>

    <!-- 数据库详情对话框 -->
    <CyberDialog
      v-model="databaseDialogVisible"
      title="💾 数据库详情"
      width="900px"
      :close-on-click-overlay="false"
    >
      <div v-if="systemOverview.database" class="database-detail">
        <!-- 基本信息 -->
        <div class="detail-section">
          <h3 class="detail-section-title">📋 连接信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">连接状态:</span>
              <el-tag effect="dark"
                :type="systemOverview.database.connected ? 'success' : 'danger'"
              >
                {{ systemOverview.database.connected ? '已连接' : '未连接' }}
              </el-tag>
            </div>
            <div class="detail-item">
              <span class="detail-label">数据库状态:</span>
              <span class="detail-value">{{ systemOverview.database.status === 'online' ? '在线' : '离线' }}</span>
            </div>
            <div class="detail-item" v-if="databaseStats">
              <span class="detail-label">数据时间跨度:</span>
              <span class="detail-value">
                {{ databaseStats.basic?.days_span ? `${databaseStats.basic.days_span} 天` : '计算中' }}
              </span>
            </div>
            <div class="detail-item" v-if="databaseStats">
              <span class="detail-label">表行数:</span>
              <span class="detail-value">{{ formatNumber(databaseStats.table?.TABLE_ROWS) }}</span>
            </div>
          </div>
        </div>

        <!-- 数据统计 -->
        <div class="detail-section" v-loading="loadingDatabaseStats">
          <h3 class="detail-section-title">📊 数据统计</h3>
          <div v-if="databaseStats" class="db-stats">
            <div class="stat-card">
              <div class="stat-icon">🎰</div>
              <div class="stat-content">
                <div class="stat-value">{{ databaseStats.basic?.total_lotteries || 0 }}</div>
                <div class="stat-label">彩种数量</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📝</div>
              <div class="stat-content">
                <div class="stat-value">{{ formatNumber(databaseStats.basic?.total_records) }}</div>
                <div class="stat-label">历史记录</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📈</div>
              <div class="stat-content">
                <div class="stat-value">{{ formatNumber(databaseStats.growth?.records_24h) }}</div>
                <div class="stat-label">24小时新增</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">💾</div>
              <div class="stat-content">
                <div class="stat-value">{{ databaseStats.table?.size_mb || 0 }} MB</div>
                <div class="stat-label">数据库大小</div>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无统计数据" :image-size="60" />
        </div>
      </div>

      <template #footer>
        <NeonButton @click="databaseDialogVisible = false">关闭</NeonButton>
      </template>
    </CyberDialog>

    <!-- 全部错误对话框 -->
    <CyberDialog
      v-model="allErrorsDialogVisible"
      title="⚠️ 全部错误日志"
      width="900px"
      :close-on-click-overlay="false"
    >
      <div class="all-errors-detail">
        <div class="detail-section">
          <h3 class="detail-section-title">📊 错误统计</h3>
          <div class="error-summary">
            <span class="summary-text">共 {{ allErrorLotteries.length }} 个彩种存在错误</span>
            <span class="summary-text">总错误次数: {{ allErrorLotteries.reduce((sum, l) => sum + l.errorCount, 0) }}</span>
          </div>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">📋 错误列表</h3>
          <el-table
            :data="allErrorLotteries"
            style="width: 100%"
            max-height="500"
          >
            <el-table-column prop="lotCode" label="彩种代码" width="100" />
            <el-table-column prop="lotName" label="彩种名称" min-width="120" />
            <el-table-column prop="errorCount" label="错误次数" width="100" sortable>
              <template #default="{ row }">
                <el-tag effect="dark" type="danger" size="small">{{ row.errorCount }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag effect="dark"
                  :type="row.isActive ? 'success' : 'info'"
                >
                  {{ row.isActive ? '运行中' : '未运行' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最后抓取" min-width="150">
              <template #default="{ row }">
                {{ formatTime(row.lastFetchTime) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <NeonButton @click="allErrorsDialogVisible = false">关闭</NeonButton>
      </template>
    </CyberDialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import HolographicCard from '../components/tech/HolographicCard.vue'
import CyberDialog from '../components/tech/CyberDialog.vue'
import NeonButton from '../components/tech/NeonButton.vue'
import GlowingTag from '../components/tech/GlowingTag.vue'
import axios from 'axios'

// 响应式数据
const systemOverview = ref({
  scheduler: null,
  countdown: null,
  websocket: null,
  database: null,
  timestamp: null
})

const lotteryList = ref([])
const loading = ref(false)
const lastRefreshTime = ref(null)
let refreshTimer = null

// 自动刷新开关（从localStorage读取，默认开启）
const autoRefreshEnabled = ref(localStorage.getItem('autoRefreshEnabled') !== 'false')

// 刷新间隔（从localStorage读取，默认30秒）
const refreshInterval = ref(parseInt(localStorage.getItem('refreshInterval')) || 30000)

// 筛选相关
const searchKeyword = ref('')
const statusFilter = ref('')
const errorOnlyFilter = ref(false)
const lowSuccessRateFilter = ref(false) // 低成功率筛选
const currentPreset = ref('all') // 当前选中的预设

// 详情对话框相关
const dialogVisible = ref(false)
const selectedLottery = ref(null)

// 倒计时详情对话框相关
const countdownDialogVisible = ref(false)
const countdownStats = ref(null)

// WebSocket详情对话框相关
const websocketDialogVisible = ref(false)

// 调度器详情对话框相关
const schedulerDialogVisible = ref(false)

// 数据库详情对话框相关
const databaseDialogVisible = ref(false)
const databaseStats = ref(null)
const loadingDatabaseStats = ref(false)

// 全部错误对话框相关
const allErrorsDialogVisible = ref(false)

// 性能历史数据
const performanceHistory = ref([])
const maxHistoryPoints = 20 // 保存最近20个数据点

// 计算属性 - 从scheduler数据中提取统计信息
const schedulerStats = computed(() => {
  if (!systemOverview.value.scheduler?.lotteries) {
    return { activeCrawlers: 0, totalCrawlers: 0 }
  }
  const lotteries = systemOverview.value.scheduler.lotteries
  return {
    activeCrawlers: lotteries.filter(l => l.status === 'crawling').length,
    totalCrawlers: lotteries.length
  }
})

// 计算属性 - 过滤彩种列表
const filteredLotteryList = computed(() => {
  let filtered = lotteryList.value

  // 搜索关键词过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    filtered = filtered.filter(item =>
      item.lotCode.toLowerCase().includes(keyword) ||
      item.lotName.toLowerCase().includes(keyword)
    )
  }

  // 状态过滤
  if (statusFilter.value) {
    if (statusFilter.value === 'active') {
      filtered = filtered.filter(item => item.isActive)
    } else if (statusFilter.value === 'inactive') {
      filtered = filtered.filter(item => !item.isActive)
    }
  }

  // 错误过滤
  if (errorOnlyFilter.value) {
    filtered = filtered.filter(item => item.errorCount > 0)
  }

  // 低成功率过滤
  if (lowSuccessRateFilter.value) {
    filtered = filtered.filter(item => {
      const total = item.successCount + item.errorCount
      if (total === 0) return false
      const rate = (item.successCount / total) * 100
      return rate < 70
    })
  }

  return filtered
})

// 计算属性 - 获取有错误的彩种列表
const errorLotteries = computed(() => {
  return lotteryList.value
    .filter(lottery => lottery.errorCount > 0)
    .sort((a, b) => b.errorCount - a.errorCount) // 按错误次数降序排列
    .slice(0, 10) // 只显示前10个
})

// 计算属性 - 获取所有有错误的彩种列表
const allErrorLotteries = computed(() => {
  return lotteryList.value
    .filter(lottery => lottery.errorCount > 0)
    .sort((a, b) => b.errorCount - a.errorCount) // 按错误次数降序排列
})

// 计算属性 - 性能图表最大值（优化性能，避免重复计算）
const maxActiveCrawlers = computed(() => {
  if (performanceHistory.value.length === 0) return 1
  return Math.max(...performanceHistory.value.map(p => p.activeCrawlers), 1)
})

const maxWsConnections = computed(() => {
  if (performanceHistory.value.length === 0) return 1
  return Math.max(...performanceHistory.value.map(p => p.wsConnections), 1)
})

const maxTotalErrors = computed(() => {
  if (performanceHistory.value.length === 0) return 1
  return Math.max(...performanceHistory.value.map(p => p.totalErrors), 1)
})

// 计算属性 - 性能图表时间范围
const performanceTimeRange = computed(() => {
  if (performanceHistory.value.length === 0) return ''
  const first = performanceHistory.value[0].timestamp
  const last = performanceHistory.value[performanceHistory.value.length - 1].timestamp
  const formatTime = (ts) => {
    const date = new Date(ts)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return `${formatTime(first)} - ${formatTime(last)}`
})

// 监听自动刷新开关变化，保存到localStorage
watch(autoRefreshEnabled, (newValue) => {
  localStorage.setItem('autoRefreshEnabled', String(newValue))
  if (newValue) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

// 监听刷新间隔变化，保存到localStorage并重启定时器
watch(refreshInterval, (newValue) => {
  localStorage.setItem('refreshInterval', String(newValue))
  // 如果自动刷新已开启，重启定时器以应用新间隔
  if (autoRefreshEnabled.value && refreshTimer) {
    stopAutoRefresh()
    startAutoRefresh()
  }
})

// 启动自动刷新
const startAutoRefresh = () => {
  if (refreshTimer) return // 已经在运行
  refreshTimer = setInterval(() => {
    refreshData()
  }, refreshInterval.value)
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// 获取系统总览数据
const fetchSystemOverview = async () => {
  try {
    const response = await axios.get('/api/system/overview')
    if (response.data.success) {
      systemOverview.value = response.data.data
    }
  } catch (error) {
    console.error('获取系统总览失败:', error)
    ElMessage.error('获取系统总览数据失败')
  }
}

// 获取调度器统计数据
const fetchSchedulerStats = async () => {
  try {
    loading.value = true
    const response = await axios.get('/api/scheduler/stats')
    if (response.data.success) {
      const stats = response.data.data

      // 转换为彩种列表格式
      lotteryList.value = stats.lotteries.map(lottery => ({
        lotCode: lottery.lotCode,
        lotName: lottery.name || `彩种${lottery.lotCode}`,
        isActive: lottery.status === 'crawling' || lottery.status === 'scheduled',
        interval: lottery.baseInterval,
        lastFetchTime: lottery.lastPollTime,
        successCount: stats.global.newDataFound || 0,
        errorCount: lottery.consecutiveErrors,
        hasCountdown: lottery.countdown !== undefined
      }))
    }
  } catch (error) {
    console.error('获取调度器统计失败:', error)
    ElMessage.error('获取彩种监控数据失败')
  } finally {
    loading.value = false
  }
}

// 刷新所有数据
const refreshData = async () => {
  await Promise.all([
    fetchSystemOverview(),
    fetchSchedulerStats()
  ])
  // 采样性能数据
  samplePerformanceData()
  // 更新最后刷新时间
  lastRefreshTime.value = new Date()
}

// 格式化时间
// 格式化时间 - 只显示时分秒
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化间隔
const formatInterval = (interval) => {
  if (!interval) return '-'
  // 如果已经包含单位,直接返回
  if (interval.includes('秒') || interval.includes('分') || interval.includes('时')) {
    return interval
  }
  // 解析"3s"格式
  const match = interval.match(/^(\d+)([smh])$/)
  if (match) {
    const value = match[1]
    const unit = match[2]
    const unitMap = { s: '秒', m: '分', h: '时' }
    return `${value}${unitMap[unit]}`
  }
  return interval
}

// 格式化数字(添加千分位)
const formatNumber = (num) => {
  if (num === null || num === undefined) return '-'
  return num.toLocaleString('zh-CN')
}

// 格式化相对时间
const formatRelativeTime = (time) => {
  if (!time) return '从未刷新'
  const now = new Date()
  const diff = Math.floor((now - time) / 1000) // 秒

  if (diff < 10) return '刚刚'
  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}

// 计算成功率
const calculateSuccessRate = (row) => {
  const total = row.successCount + row.errorCount
  if (total === 0) return 0
  return (row.successCount / total) * 100
}

// 格式化成功率显示
const formatSuccessRate = (row) => {
  const rate = calculateSuccessRate(row)
  return `${rate.toFixed(1)}%`
}

// 根据成功率返回CSS类名
const getSuccessRateClass = (row) => {
  const rate = calculateSuccessRate(row)
  if (rate >= 90) return 'success-rate-high'
  if (rate >= 70) return 'success-rate-medium'
  return 'success-rate-low'
}

// 应用筛选预设
const applyPreset = (preset) => {
  currentPreset.value = preset

  switch (preset) {
    case 'all':
      // 清除所有筛选
      searchKeyword.value = ''
      statusFilter.value = ''
      errorOnlyFilter.value = false
      lowSuccessRateFilter.value = false
      break
    case 'errors':
      // 只显示有错误的彩种
      searchKeyword.value = ''
      statusFilter.value = ''
      errorOnlyFilter.value = true
      lowSuccessRateFilter.value = false
      break
    case 'active':
      // 只显示运行中的彩种
      searchKeyword.value = ''
      statusFilter.value = 'active'
      errorOnlyFilter.value = false
      lowSuccessRateFilter.value = false
      break
    case 'lowRate':
      // 只显示低成功率的彩种
      searchKeyword.value = ''
      statusFilter.value = ''
      errorOnlyFilter.value = false
      lowSuccessRateFilter.value = true
      break
  }
}

// 查看详情
const viewDetails = (lottery) => {
  selectedLottery.value = lottery
  dialogVisible.value = true
}

// 查看倒计时详情
const viewCountdownDetails = async () => {
  try {
    const response = await axios.get('/api/countdown/stats')
    if (response.data.success) {
      countdownStats.value = response.data.data
      countdownDialogVisible.value = true
    } else {
      ElMessage.error('获取倒计时统计失败')
    }
  } catch (error) {
    console.error('获取倒计时统计失败:', error)
    ElMessage.error('获取倒计时统计数据失败')
  }
}

// 查看WebSocket详情
const viewWebSocketDetails = () => {
  websocketDialogVisible.value = true
}

// 查看调度器详情
const viewSchedulerDetails = () => {
  schedulerDialogVisible.value = true
}

// 查看数据库详情
const viewDatabaseDetails = async () => {
  databaseDialogVisible.value = true

  // 加载数据库统计信息
  loadingDatabaseStats.value = true
  try {
    const response = await axios.get('/api/database/statistics')
    if (response.data.success) {
      databaseStats.value = response.data.data
    } else {
      ElMessage.error('获取数据库统计失败')
    }
  } catch (error) {
    console.error('获取数据库统计失败:', error)
    ElMessage.error('获取数据库统计数据失败')
  } finally {
    loadingDatabaseStats.value = false
  }
}

// 滚动到指定彩种
const scrollToLottery = (lotCode) => {
  // 等待DOM更新后再滚动
  nextTick(() => {
    // 查找表格中对应的行
    const tableRows = document.querySelectorAll('.el-table__row')
    let targetRow = null

    for (const row of tableRows) {
      const codeCell = row.querySelector('.el-table__cell:first-child')
      if (codeCell && codeCell.textContent.trim() === lotCode) {
        targetRow = row
        break
      }
    }

    if (targetRow) {
      // 滚动到目标行
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // 添加高亮效果
      targetRow.classList.add('highlight-row')

      // 2秒后移除高亮
      setTimeout(() => {
        targetRow.classList.remove('highlight-row')
      }, 2000)
    }
  })
}

// 采样性能数据
const samplePerformanceData = () => {
  const dataPoint = {
    timestamp: new Date().getTime(),
    activeCrawlers: schedulerStats.value.activeCrawlers,
    wsConnections: systemOverview.value.websocket?.totalConnections || 0,
    totalErrors: lotteryList.value.reduce((sum, lottery) => sum + lottery.errorCount, 0)
  }

  performanceHistory.value.push(dataPoint)

  // 保持最多maxHistoryPoints个数据点
  if (performanceHistory.value.length > maxHistoryPoints) {
    performanceHistory.value.shift()
  }
}

// 生命周期钩子
onMounted(() => {
  refreshData()

  // 如果自动刷新开关开启，启动定时器
  if (autoRefreshEnabled.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.system-monitor-page {
  padding: 16px;
  min-height: 100vh;
}

/* 紧凑型顶部标题栏 */
.compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.compact-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.refresh-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auto-refresh-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  white-space: nowrap;
}

/* 系统状态栏 */
.status-bar {
  padding: 8px;
  margin-bottom: 10px;
}

.status-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.3s ease;
  cursor: pointer;
}

.status-item:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-2px);
}

.status-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.status-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.status-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-tag {
  margin-top: 2px;
}

/* 强制覆盖 Element Plus 标签颜色 - 使用CSS变量方式 */
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

.status-item.clickable {
  cursor: pointer;
}

.status-item.clickable:hover {
  background: rgba(64, 158, 255, 0.1);
  border: 1px solid rgba(64, 158, 255, 0.3);
}

.status-action {
  font-size: 16px;
  opacity: 0.6;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.status-item.clickable:hover .status-action {
  opacity: 1;
  transform: scale(1.2);
}

/* 保留section-title用于表格部分 */
.section-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--el-text-color-primary);
}

.lottery-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.filter-result {
  margin-left: auto;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.error-filter-btn {
  transition: all 0.3s ease;
}

.error-filter-btn span {
  margin-right: 4px;
  font-weight: 600;
}

.filter-presets {
  display: flex;
  align-items: center;
  gap: 8px;
}

.presets-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.preset-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.table-card {
  padding: 14px;
}

.error-count {
  color: var(--el-color-danger);
  font-weight: 600;
}

/* 成功率样式 */
.success-rate-high {
  color: var(--el-color-success);
  font-weight: 600;
}

.success-rate-medium {
  color: var(--el-color-warning);
  font-weight: 600;
}

.success-rate-low {
  color: var(--el-color-danger);
  font-weight: 600;
}

/* 彩种详情对话框样式 */
.lottery-detail {
  padding: 4px 0;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 2px solid rgba(102, 126, 234, 0.3);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.detail-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.detail-value {
  font-size: 14px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.success-text {
  color: var(--el-color-success);
}

.error-text {
  color: var(--el-color-danger);
}

/* 倒计时详情对话框样式 */
.countdown-detail {
  padding: 4px 0;
}

.countdown-ranges {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.range-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.range-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.range-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.range-count {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: rgba(64, 158, 255, 0.1);
  padding: 2px 10px;
  border-radius: 10px;
}

/* WebSocket详情对话框样式 */
.websocket-detail {
  padding: 4px 0;
}

.ws-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

/* 数据库详情对话框样式 */
.database-detail {
  padding: 4px 0;
}

.db-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: rgba(64, 158, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(64, 158, 255, 0.2);
  transition: all 0.3s ease;
}

.stat-card:hover {
  background: rgba(64, 158, 255, 0.1);
  border-color: rgba(64, 158, 255, 0.4);
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 中部双栏布局 */
.middle-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

/* 面板通用样式 */
.performance-panel,
.error-panel {
  padding: 8px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.panel-subtitle {
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.panel-header-left {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.view-all-btn {
  font-size: 12px;
  padding: 4px 8px;
  transition: all 0.3s ease;
}

.view-all-btn:hover {
  color: var(--el-color-primary);
}

/* 错误统计样式 */
.error-summary {
  display: flex;
  gap: 20px;
  padding: 12px;
  background: rgba(245, 108, 108, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(245, 108, 108, 0.2);
}

.summary-text {
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

/* 性能趋势紧凑样式 */
.performance-charts-compact {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-item-compact {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chart-header-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.chart-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.mini-chart-compact {
  height: 35px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  padding: 4px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.chart-bar {
  flex: 1;
  min-height: 3px;
  background: linear-gradient(180deg, var(--el-color-primary), rgba(64, 158, 255, 0.5));
  border-radius: 2px;
  transition: all 0.3s ease;
}

.chart-bar:hover {
  opacity: 0.8;
  transform: scaleY(1.05);
}

.chart-bar.error-bar {
  background: linear-gradient(180deg, var(--el-color-danger), rgba(245, 108, 108, 0.5));
}

.error-text {
  color: var(--el-color-danger);
}

/* 时间范围标签 */
.chart-time-range {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 8px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.time-icon {
  font-size: 12px;
}

.time-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

/* 错误日志紧凑样式 */
.error-list-compact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.error-item-compact {
  padding: 6px;
  background: rgba(245, 108, 108, 0.05);
  border-left: 2px solid var(--el-color-danger);
  border-radius: 4px;
  transition: all 0.3s ease;
  position: relative;
}

.error-item-compact:hover {
  background: rgba(245, 108, 108, 0.1);
  transform: translateX(2px);
}

.error-item-compact.clickable {
  cursor: pointer;
}

.error-item-compact.clickable:hover {
  background: rgba(245, 108, 108, 0.15);
  border-left-color: var(--el-color-danger);
  border-left-width: 3px;
}

.error-main {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.error-code-compact {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-color-danger);
}

.error-name-compact {
  font-size: 11px;
  color: var(--el-text-color-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.error-time {
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.error-action {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  opacity: 0;
  transition: all 0.3s ease;
}

.error-item-compact.clickable:hover .error-action {
  opacity: 1;
  transform: translateY(-50%) scale(1.2);
}

/* 响应式布局 */
@media (max-width: 1200px) {
  .middle-section {
    grid-template-columns: 1fr;
  }
}

/* 深色主题适配 */
:deep(.el-table) {
  background-color: transparent;
}

:deep(.el-table tr) {
  background-color: transparent;
}

:deep(.el-table th.el-table__cell) {
  background-color: rgba(255, 255, 255, 0.05);
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell) {
  background-color: rgba(255, 255, 255, 0.02);
}

/* 表格行高亮效果 */
:deep(.el-table__row.highlight-row) {
  animation: highlight-pulse 2s ease-in-out;
}

@keyframes highlight-pulse {
  0%, 100% {
    background-color: transparent;
  }
  50% {
    background-color: rgba(64, 158, 255, 0.3);
  }
}

/* 响应式设计 - 平板 */
@media (max-width: 1024px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .filter-toolbar {
    flex-wrap: wrap;
  }
}

/* 响应式设计 - 移动端 */
@media (max-width: 768px) {
  .system-monitor-page {
    padding: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .page-subtitle {
    font-size: 14px;
  }

  .section-title {
    font-size: 20px;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .section-header .el-button {
    width: 100%;
  }

  .filter-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .filter-toolbar .el-input,
  .filter-toolbar .el-select {
    width: 100% !important;
  }

  .filter-result {
    margin-left: 0;
    text-align: center;
  }

  .table-card {
    padding: 12px;
    overflow-x: auto;
  }

  /* 表格横向滚动 */
  :deep(.el-table) {
    min-width: 800px;
  }

  /* 详情对话框响应式 */
  .detail-grid {
    grid-template-columns: 1fr;
  }

  :deep(.el-dialog) {
    width: 90% !important;
    margin: 20px auto;
  }

  /* 性能图表响应式 */
  .performance-charts {
    grid-template-columns: 1fr;
  }

  .ws-stats {
    grid-template-columns: 1fr;
  }
}

/* 响应式设计 - 小屏手机 */
@media (max-width: 480px) {
  .system-monitor-page {
    padding: 12px;
  }

  .page-header {
    margin-bottom: 24px;
  }

  .overview-section,
  .lottery-section {
    margin-bottom: 24px;
  }

  .metric-card {
    padding: 16px;
  }

  .table-card {
    padding: 8px;
  }
}
</style>
