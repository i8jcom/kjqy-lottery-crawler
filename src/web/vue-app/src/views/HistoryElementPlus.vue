<template>
  <div class="history-luxury-page">
    <!-- 高级筛选控制面板 -->
    <HolographicCard class="luxury-filter-panel" :border="true" :hover="true">
      <template #header>
        <div class="panel-header">
          <div class="header-title">
            <span class="title-icon">🔍</span>
            <h3>高级筛选</h3>
          </div>
          <div class="header-actions">
            <GlowingTag type="info" :text="`${lotteries.length} 个彩种可选`" effect="dark" />
          </div>
        </div>
      </template>

      <div class="filter-content">
        <!-- 主筛选区 -->
        <div class="filter-main">
          <div class="filter-row">
            <div class="filter-item filter-item-large">
              <label class="filter-label">
                <span class="label-icon">🎯</span>
                彩种选择
              </label>
              <el-select
                v-model="searchParams.lottery"
                placeholder="请选择彩种进行查询"
                filterable
                clearable
                size="large"
                class="luxury-select"
              >
                <el-option
                  v-for="lottery in lotteries"
                  :key="lottery.lotCode"
                  :label="`${lottery.name} (${lottery.lotCode})`"
                  :value="lottery.lotCode"
                >
                  <div class="option-content">
                    <span class="option-name">{{ lottery.name }}</span>
                    <span class="option-code">{{ lottery.lotCode }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>

            <div class="filter-item">
              <label class="filter-label">
                <span class="label-icon">📅</span>
                {{ dateYearLabel }}
              </label>
              <!-- 日期选择器 -->
              <el-date-picker
                v-if="!isYearQueryLottery"
                v-model="searchParams.dateObj"
                type="date"
                placeholder="选择查询日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                size="large"
                class="luxury-date-picker"
                :shortcuts="dateShortcuts"
              />
              <!-- 年份选择器 -->
              <el-select
                v-else
                v-model="searchParams.year"
                placeholder="选择年份"
                size="large"
                class="luxury-select"
              >
                <el-option
                  v-for="year in yearOptions"
                  :key="year"
                  :label="`${year}年`"
                  :value="year"
                />
              </el-select>
            </div>

            <div class="filter-item">
              <label class="filter-label">
                <span class="label-icon">📊</span>
                每页条数
              </label>
              <el-select v-model="pageSize" size="large" class="luxury-select">
                <el-option label="20 条/页" :value="20" />
                <el-option label="50 条/页" :value="50" />
                <el-option label="100 条/页" :value="100" />
                <el-option label="200 条/页" :value="200" />
              </el-select>
            </div>

            <div class="filter-item filter-item-action">
              <NeonButton
                type="primary"
                size="large"
                @click="handleSearch"
                :loading="loading"
                class="luxury-btn-primary"
              >
                <template #icon>
                  <span class="btn-icon">🚀</span>
                </template>
                {{ loading ? '查询中...' : '开始查询' }}
              </NeonButton>
            </div>
          </div>
        </div>

        <!-- 快捷选项区 -->
        <div class="filter-shortcuts" v-if="!isYearQueryLottery">
          <div class="shortcuts-label">快捷时间：</div>
          <div class="shortcuts-buttons">
            <NeonButton
              v-for="shortcut in quickDateOptions"
              :key="shortcut.label"
              size="small"
              :type="searchParams.dateObj === shortcut.value ? 'primary' : 'default'"
              @click="handleQuickDate(shortcut.value)"
              class="shortcut-btn"
            >
              {{ shortcut.label }}
            </NeonButton>
          </div>
        </div>
      </div>
    </HolographicCard>

    <!-- 视图切换工具栏 -->
    <div class="view-toolbar" v-if="total > 0">
      <div class="toolbar-left">
        <GlowingTag type="success" :text="`✓ 找到 ${total} 条记录`" size="large" effect="dark" class="result-tag" />
        <GlowingTag
          v-if="!isDataComplete && expectedCount > 0"
          type="warning"
          :text="`⚠ 数据不完整（${total}/${expectedCount}）`"
          size="large"
          effect="dark"
          class="result-tag"
        />
      </div>
      <div class="toolbar-right">
        <el-radio-group v-model="viewMode" size="large" class="view-mode-toggle">
          <el-radio-button value="table">
            <span class="mode-icon">📋</span>
            列表视图
          </el-radio-button>
          <el-radio-button value="card">
            <span class="mode-icon">🎴</span>
            卡片视图
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 数据展示区 -->
    <div class="data-display-area" v-if="total > 0">
      <!-- 列表视图 -->
      <HolographicCard v-if="viewMode === 'table'" class="table-view-card" :border="true">
        <el-table
          :data="tableData"
          v-loading="loading"
          stripe
          border
          style="width: 100%"
          :empty-text="loading ? '加载中...' : '暂无历史数据'"
          @row-click="handleRowClick"
          class="luxury-table"
        >
          <el-table-column prop="lottery_code" label="彩种代码" width="100" sortable align="center" />
          <el-table-column prop="lottery_name" label="彩种名称" width="180" sortable show-overflow-tooltip />
          <el-table-column prop="issue_number" label="期号" width="180" sortable align="center" />
          <el-table-column label="开奖号码" min-width="400">
            <template #default="{ row }">
              <div class="draw-numbers-wrapper">
                <!-- K3骰子显示 -->
                <template v-if="isK3Lottery(parseDrawNumber(row.draw_number), row)">
                  <div class="draw-numbers k3-display">
                    <div
                      v-for="(num, idx) in parseDrawNumber(row.draw_number)"
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
                </template>

                <!-- 六合彩 SVG球显示 -->
                <template v-else-if="isMarkSixLottery(row)">
                  <div class="draw-numbers">
                    <template v-for="(num, idx) in parseMarkSixNumbers(parseDrawNumber(row.draw_number))" :key="idx">
                      <img
                        :src="`/assets/lottery-balls/marksix-${parseInt(num, 10)}.svg`"
                        :alt="`号码${num}`"
                        class="marksix-ball-svg"
                      />
                      <span v-if="idx === 5" class="number-separator">+</span>
                    </template>
                  </div>
                </template>

                <!-- 福彩双色球 -->
                <template v-else-if="isSSQLottery(row)">
                  <div class="draw-numbers">
                    <template v-for="(num, idx) in parseDrawNumber(row.draw_number)" :key="idx">
                      <span class="number-ball cwl-ball" :class="idx < 6 ? 'cwl-red' : 'cwl-blue'">
                        {{ num }}
                      </span>
                      <span v-if="idx === 5" class="number-separator">+</span>
                    </template>
                  </div>
                </template>

                <!-- 福彩七乐彩 -->
                <template v-else-if="isQLCLottery(row)">
                  <div class="draw-numbers">
                    <template v-for="(num, idx) in parseDrawNumber(row.draw_number)" :key="idx">
                      <span class="number-ball cwl-ball" :class="idx < 7 ? 'cwl-red' : 'cwl-orange'">
                        {{ num }}
                      </span>
                      <span v-if="idx === 6" class="number-separator">+</span>
                    </template>
                  </div>
                </template>

                <!-- 福彩3D -->
                <template v-else-if="isFC3DLottery(row)">
                  <div class="draw-numbers">
                    <span
                      v-for="(num, idx) in parseDrawNumber(row.draw_number)"
                      :key="idx"
                      class="number-ball cwl-ball cwl-3d"
                    >
                      {{ num }}
                    </span>
                  </div>
                </template>

                <!-- 快乐8/宾果宾果系列 -->
                <template v-else-if="parseDrawNumber(row.draw_number).length >= 20">
                  <div class="draw-numbers-multi-row">
                    <div class="kl8-row">
                      <span
                        v-for="(num, idx) in parseDrawNumber(row.draw_number).slice(0, 10)"
                        :key="`row1-${idx}`"
                        class="number-ball kl8-row-1"
                        :class="{ 'taiwan-bingo-gold': isTaiwanBingoSpecial(num, row) }"
                      >
                        {{ num }}
                      </span>
                    </div>
                    <div class="kl8-row">
                      <span
                        v-for="(num, idx) in parseDrawNumber(row.draw_number).slice(10)"
                        :key="`row2-${idx}`"
                        class="number-ball"
                        :class="[
                          parseDrawNumber(row.draw_number).length === 21 && idx === 10 ? 'kl8-special' : 'kl8-row-2',
                          { 'taiwan-bingo-gold': isTaiwanBingoSpecial(num, row) }
                        ]"
                      >
                        {{ num }}
                      </span>
                    </div>
                  </div>
                </template>

                <!-- 体彩超级大乐透（5红+2蓝，lotCode=80001） -->
                <template v-else-if="parseDrawNumber(row.draw_number).length === 7 && String(row.lottery_code) === '80001'">
                  <div class="draw-numbers">
                    <template v-for="(num, idx) in parseDrawNumber(row.draw_number)" :key="idx">
                      <span
                        class="number-ball sports-ball"
                        :class="idx < 5 ? 'sports-red' : 'sports-blue'"
                      >
                        {{ num }}
                      </span>
                      <span v-if="idx === 4" class="number-separator">+</span>
                    </template>
                  </div>
                </template>

                <!-- 体彩排列3（3个紫球，lotCode=80002） -->
                <template v-else-if="parseDrawNumber(row.draw_number).length === 3 && (String(row.lottery_code) === '80002' || row.lottery_name.includes('排列3'))">
                  <div class="draw-numbers">
                    <span
                      v-for="(num, idx) in parseDrawNumber(row.draw_number)"
                      :key="idx"
                      class="number-ball sports-ball sports-purple"
                    >
                      {{ num }}
                    </span>
                  </div>
                </template>

                <!-- 体彩排列5（5个紫球，lotCode=80003） -->
                <template v-else-if="parseDrawNumber(row.draw_number).length === 5 && (String(row.lottery_code) === '80003' || row.lottery_name.includes('排列5'))">
                  <div class="draw-numbers">
                    <span
                      v-for="(num, idx) in parseDrawNumber(row.draw_number)"
                      :key="idx"
                      class="number-ball sports-ball sports-purple"
                    >
                      {{ num }}
                    </span>
                  </div>
                </template>

                <!-- 体彩七星彩（6紫+1金，lotCode=80004） -->
                <template v-else-if="parseDrawNumber(row.draw_number).length === 7 && (String(row.lottery_code) === '80004' || row.lottery_name.includes('七星彩') || row.lottery_name.includes('7星彩'))">
                  <div class="draw-numbers">
                    <template v-for="(num, idx) in parseDrawNumber(row.draw_number)" :key="idx">
                      <span
                        class="number-ball sports-ball"
                        :class="idx < 6 ? 'sports-purple' : 'sports-gold'"
                      >
                        {{ num }}
                      </span>
                      <span v-if="idx === 5" class="number-separator">+</span>
                    </template>
                  </div>
                </template>

                <!-- 普通号码球 -->
                <template v-else>
                  <div class="draw-numbers">
                    <span
                      v-for="(num, idx) in parseDrawNumber(row.draw_number)"
                      :key="idx"
                      class="number-ball"
                      :class="getBallClass(num, parseDrawNumber(row.draw_number), idx, row)"
                    >
                      {{ num }}
                    </span>
                  </div>
                </template>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="draw_time" label="开奖时间" width="150" sortable align="center">
            <template #default="{ row }">
              <span class="time-text">{{ formatDateTime(row.draw_time) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="source" label="数据来源" width="120" align="center">
            <template #default="{ row }">
              <GlowingTag type="success" :text="row.source" size="small" effect="dark" />
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div v-if="total > 0" class="luxury-pagination">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[20, 50, 100, 200]"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="handlePageChange"
            @size-change="handleSizeChange"
            background
          />
        </div>
      </HolographicCard>

      <!-- 卡片视图 -->
      <div v-else class="card-view-grid">
        <div
          v-for="(record, idx) in tableData"
          :key="`card-${idx}`"
          class="record-card glass-card"
          @click="handleRowClick(record)"
        >
          <div class="record-header">
            <div class="record-lottery">
              <span class="lottery-emoji">🎯</span>
              <span class="lottery-name">{{ record.lottery_name }}</span>
            </div>
            <GlowingTag type="success" :text="record.source" size="small" effect="dark" />
          </div>

          <div class="record-issue">
            <span class="issue-label">期号</span>
            <span class="issue-number">{{ record.issue_number }}</span>
          </div>

          <div class="record-numbers">
            <!-- K3骰子显示 -->
            <template v-if="isK3Lottery(parseDrawNumber(record.draw_number), record)">
              <div class="draw-numbers k3-display">
                <div
                  v-for="(num, idx) in parseDrawNumber(record.draw_number)"
                  :key="`k3-${idx}`"
                  class="k3-dice-wrapper size-card"
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

            <!-- 六合彩球 -->
            <template v-else-if="isMarkSixLottery(record)">
              <div class="draw-numbers">
                <template v-for="(num, idx) in parseMarkSixNumbers(parseDrawNumber(record.draw_number))" :key="idx">
                  <img
                    :src="`/assets/lottery-balls/marksix-${parseInt(num, 10)}.svg`"
                    :alt="`号码${num}`"
                    class="marksix-ball-svg-card"
                  />
                  <span v-if="idx === 5" class="number-separator">+</span>
                </template>
              </div>
            </template>

            <!-- 福彩双色球 -->
            <template v-else-if="isSSQLottery(record)">
              <div class="draw-numbers">
                <template v-for="(num, idx) in parseDrawNumber(record.draw_number)" :key="idx">
                  <span class="number-ball number-ball-card cwl-ball" :class="idx < 6 ? 'cwl-red' : 'cwl-blue'">
                    {{ num }}
                  </span>
                  <span v-if="idx === 5" class="number-separator">+</span>
                </template>
              </div>
            </template>

            <!-- 福彩七乐彩 -->
            <template v-else-if="isQLCLottery(record)">
              <div class="draw-numbers">
                <template v-for="(num, idx) in parseDrawNumber(record.draw_number)" :key="idx">
                  <span class="number-ball number-ball-card cwl-ball" :class="idx < 7 ? 'cwl-red' : 'cwl-orange'">
                    {{ num }}
                  </span>
                  <span v-if="idx === 6" class="number-separator">+</span>
                </template>
              </div>
            </template>

            <!-- 福彩3D -->
            <template v-else-if="isFC3DLottery(record)">
              <div class="draw-numbers">
                <span
                  v-for="(num, idx) in parseDrawNumber(record.draw_number)"
                  :key="idx"
                  class="number-ball number-ball-card cwl-ball cwl-3d"
                >
                  {{ num }}
                </span>
              </div>
            </template>

            <!-- 体彩超级大乐透（5红+2蓝） -->
            <template v-else-if="parseDrawNumber(record.draw_number).length === 7 && String(record.lottery_code) === '80001'">
              <div class="draw-numbers">
                <template v-for="(num, idx) in parseDrawNumber(record.draw_number)" :key="idx">
                  <span
                    class="number-ball number-ball-card sports-ball"
                    :class="idx < 5 ? 'sports-red' : 'sports-blue'"
                  >
                    {{ num }}
                  </span>
                  <span v-if="idx === 4" class="number-separator">+</span>
                </template>
              </div>
            </template>

            <!-- 体彩排列3（3个紫球） -->
            <template v-else-if="parseDrawNumber(record.draw_number).length === 3 && (String(record.lottery_code) === '80002' || record.lottery_name.includes('排列3'))">
              <div class="draw-numbers">
                <span
                  v-for="(num, idx) in parseDrawNumber(record.draw_number)"
                  :key="idx"
                  class="number-ball number-ball-card sports-ball sports-purple"
                >
                  {{ num }}
                </span>
              </div>
            </template>

            <!-- 体彩排列5（5个紫球） -->
            <template v-else-if="parseDrawNumber(record.draw_number).length === 5 && (String(record.lottery_code) === '80003' || record.lottery_name.includes('排列5'))">
              <div class="draw-numbers">
                <span
                  v-for="(num, idx) in parseDrawNumber(record.draw_number)"
                  :key="idx"
                  class="number-ball number-ball-card sports-ball sports-purple"
                >
                  {{ num }}
                </span>
              </div>
            </template>

            <!-- 体彩七星彩（6紫+1金） -->
            <template v-else-if="parseDrawNumber(record.draw_number).length === 7 && (String(record.lottery_code) === '80004' || record.lottery_name.includes('七星彩') || record.lottery_name.includes('7星彩'))">
              <div class="draw-numbers">
                <template v-for="(num, idx) in parseDrawNumber(record.draw_number)" :key="idx">
                  <span
                    class="number-ball number-ball-card sports-ball"
                    :class="idx < 6 ? 'sports-purple' : 'sports-gold'"
                  >
                    {{ num }}
                  </span>
                  <span v-if="idx === 5" class="number-separator">+</span>
                </template>
              </div>
            </template>

            <!-- 普通号码球 -->
            <template v-else>
              <div class="draw-numbers">
                <span
                  v-for="(num, idx) in parseDrawNumber(record.draw_number)"
                  :key="idx"
                  class="number-ball number-ball-card"
                  :class="getBallClass(num, parseDrawNumber(record.draw_number), idx, record)"
                >
                  {{ num }}
                </span>
              </div>
            </template>
          </div>

          <div class="record-time">
            <span class="time-icon">⏰</span>
            <span class="time-text">{{ formatDateTime(record.draw_time) }}</span>
          </div>
        </div>
      </div>

      <!-- 卡片视图分页 -->
      <div v-if="viewMode === 'card' && total > 0" class="luxury-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100, 200]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
          background
        />
      </div>
    </div>

    <!-- 空状态 -->
    <HolographicCard v-else class="empty-state-card" :border="true">
      <el-empty description="请选择彩种和日期，点击查询按钮获取数据" :image-size="200">
        <template #image>
          <div class="empty-icon">🎲</div>
        </template>
        <template #description>
          <div class="empty-text">
            <p class="empty-title">暂无数据</p>
            <p class="empty-subtitle">请使用上方筛选条件查询历史开奖记录</p>
          </div>
        </template>
      </el-empty>
    </HolographicCard>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../services/api'
import { HolographicCard, NeonButton, GlowingTag } from '../components/tech'

// 视图模式
const viewMode = ref('table')

// 查询参数
const searchParams = ref({
  lottery: '',
  dateObj: null,
  year: new Date().getFullYear()
})

// 彩种列表
const lotteries = ref([])

// 日期快捷选项
const dateShortcuts = [
  {
    text: '今天',
    value: () => new Date()
  },
  {
    text: '昨天',
    value: () => {
      const date = new Date()
      date.setDate(date.getDate() - 1)
      return date
    }
  },
  {
    text: '一周前',
    value: () => {
      const date = new Date()
      date.setDate(date.getDate() - 7)
      return date
    }
  }
]

// 快捷日期选项
const quickDateOptions = computed(() => {
  // ✅ 使用本地时区日期，避免UTC时区问题
  const getDateOffset = (daysAgo) => {
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return [
    { label: '今天', value: getDateOffset(0) },
    { label: '昨天', value: getDateOffset(1) },
    { label: '7天前', value: getDateOffset(7) }
  ]
})

// 快速设置日期
const handleQuickDate = (date) => {
  searchParams.value.dateObj = date
}

// 判断是否是年份查询彩种
const isYearQueryLottery = computed(() => {
  const lotCode = searchParams.value.lottery
  if (lotCode === '100007') return false
  return lotCode === '60001' || (lotCode && (lotCode.startsWith('700') || lotCode.startsWith('800') || lotCode.startsWith('1000')))
})

// 日期/年份标签
const dateYearLabel = computed(() => {
  return isYearQueryLottery.value ? '选择年份' : '选择日期'
})

// 年份选项
const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let year = currentYear; year >= 2011; year--) {
    years.push(year)
  }
  return years
})

// 表格数据
const allRecords = ref([])
const tableData = ref([])
const loading = ref(false)

// 分页参数
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 数据完整性
const expectedCount = ref(0)
const isDataComplete = ref(true)

// 计算属性
const selectedLotteryName = computed(() => {
  const lottery = lotteries.value.find(l => l.lotCode === searchParams.value.lottery)
  return lottery ? lottery.name : ''
})

const queryTimeRange = computed(() => {
  if (isYearQueryLottery.value) {
    return `${searchParams.value.year}年`
  } else {
    return searchParams.value.dateObj || '未选择'
  }
})

const dataCompletePercent = computed(() => {
  if (expectedCount.value === 0) return 100
  return Math.min(100, Math.round((total.value / expectedCount.value) * 100))
})

const latestIssue = computed(() => {
  return tableData.value.length > 0 ? tableData.value[0].issue_number : '-'
})

const latestDrawTime = computed(() => {
  return tableData.value.length > 0 ? formatDateTime(tableData.value[0].draw_time) : '-'
})

const totalPages = computed(() => {
  return Math.ceil(total.value / pageSize.value)
})

// 更新当前页数据
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
    ElMessage.error('加载彩种列表失败')
    console.error('❌ 加载彩种列表失败:', error)
  }
}

// 加载历史数据
const loadHistoryData = async () => {
  if (!searchParams.value.lottery) {
    ElMessage.warning('请先选择彩种')
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

    if (isYearQueryLottery.value) {
      if (!searchParams.value.year) {
        ElMessage.warning('请选择年份')
        loading.value = false
        return
      }
      params.year = searchParams.value.year
    } else {
      if (searchParams.value.dateObj) {
        params.date = searchParams.value.dateObj
      }
    }

    const response = await api.getHistoryData(params)

    if (response.success) {
      let records = (response.data.records || []).map(record => ({
        lottery_code: response.data.lotCode,
        lottery_name: response.data.name,
        issue_number: record.issue || record.issue_number,
        draw_number: record.draw_code || record.drawCode || record.draw_number,
        special_numbers: record.specialNumbers ? record.specialNumbers.join(',') : (record.special_numbers || null),
        draw_time: record.draw_time || record.drawTime,
        source: record.source || 'database'
      }))

      allRecords.value = records
      total.value = records.length
      updatePageData()

      // 数据完整性检测
      if (!isYearQueryLottery.value && searchParams.value.dateObj && records.length > 0) {
        const today = getLocalDateString() // ✅ 使用本地时区日期
        const isToday = searchParams.value.dateObj === today

        if (isToday) {
          expectedCount.value = 0
          isDataComplete.value = true
        } else {
          const lotCode = response.data.lotCode
          let expected = 0

          if (lotCode.startsWith('10')) {
            if (lotCode === '10098') expected = 288
            else if (lotCode === '100007') expected = 203
            else expected = 1152
          } else if (lotCode.startsWith('20')) expected = 288
          else if (lotCode.startsWith('30')) expected = 288
          else if (lotCode === '40001') expected = 120
          else if (lotCode === '50001') expected = 180
          else if (lotCode.startsWith('90')) expected = 576

          expectedCount.value = expected
          // 🔧 95%阈值判断（与后端保持一致）：1099/1152 = 95.4% ✅
          isDataComplete.value = expected === 0 || records.length >= Math.floor(expected * 0.95)
        }
      } else {
        expectedCount.value = 0
        isDataComplete.value = true
      }

      if (records.length === 0) {
        const timeInfo = isYearQueryLottery.value
          ? `年份：${searchParams.value.year}年`
          : `日期：${searchParams.value.dateObj || '全部'}`
        ElMessage.warning(`未找到数据 - 彩种：${response.data.name}，${timeInfo}`)
      } else {
        ElMessage.success(`查询成功！找到 ${records.length} 条记录`)
      }
    } else {
      ElMessage.error(`查询失败：${response.error || '未知错误'}`)
      allRecords.value = []
      tableData.value = []
      total.value = 0
    }
  } catch (error) {
    ElMessage.error(`查询失败：${error.message || '网络错误'}`)
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
  currentPage.value = 1
  loadHistoryData()
}

// 分页变化
const handlePageChange = (page) => {
  currentPage.value = page
  updatePageData()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 每页条数变化
const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  updatePageData()
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

// 解析六合彩号码
const parseMarkSixNumbers = (numbers) => {
  if (!numbers || numbers.length === 0) return []
  if (numbers.length === 7) return numbers

  if (numbers.length === 6) {
    const lastNum = numbers[5]
    if (lastNum && (lastNum.includes('|') || lastNum.includes('+') || lastNum.includes('，') || lastNum.includes(','))) {
      const splitted = lastNum.split(/[\|+，,]/).filter(n => n.trim())
      if (splitted.length === 2) {
        return [...numbers.slice(0, 5), splitted[0].trim(), splitted[1].trim()]
      }
    }
  }

  return numbers
}

// 判断是否为K3彩种
const isK3Lottery = (numbers, row) => {
  const name = row?.lottery_name || ''
  const lotCode = String(row?.lottery_code || '')

  if (name.includes('排列') || name.includes('3D') || lotCode.startsWith('80')) return false
  if (!numbers || numbers.length !== 3) return false
  if (!name.includes('快3') && !name.includes('K3')) return false

  return numbers.every(num => {
    const n = parseInt(num, 10)
    return n >= 1 && n <= 6
  })
}

// 判断是否为六合彩
const isMarkSixLottery = (row) => {
  const lotCode = String(row.lottery_code)
  const name = row.lottery_name || ''
  return lotCode === '60001' || lotCode === '10098' || name.includes('六合彩') || name.includes('Mark Six')
}

// 判断是否为双色球
const isSSQLottery = (row) => {
  const lotCode = String(row.lottery_code)
  const name = row.lottery_name || ''
  const numbers = parseDrawNumber(row.draw_number)
  return numbers.length === 7 && (lotCode === '70001' || name.includes('双色球'))
}

// 判断是否为七乐彩
const isQLCLottery = (row) => {
  const lotCode = String(row.lottery_code)
  const name = row.lottery_name || ''
  const numbers = parseDrawNumber(row.draw_number)
  return numbers.length === 8 && (lotCode === '70003' || name.includes('七乐彩'))
}

// 判断是否为福彩3D
const isFC3DLottery = (row) => {
  const lotCode = String(row.lottery_code)
  const name = row.lottery_name || ''
  const numbers = parseDrawNumber(row.draw_number)
  return numbers.length === 3 && (lotCode === '70002' || name.includes('福彩3D'))
}

// 判断是否为台湾宾果宾果超级奖号
const isTaiwanBingoSpecial = (num, row) => {
  if (String(row.lottery_code) !== '100007' || !row.special_numbers) return false
  const specialNumbers = row.special_numbers.split(',').map(n => n.trim())
  return specialNumbers.includes(num)
}

// 获取号码球颜色样式类
const getBallClass = (num, numbers, index, row) => {
  const totalNumbers = numbers.length
  const ballNum = parseInt(num, 10)

  // 10个号码的彩种（极速赛车PK10系列）使用专用颜色
  if (totalNumbers === 10 && ballNum >= 1 && ballNum <= 10) {
    return `ball-${ballNum}`
  }

  // 5个号码的彩种（时时彩系列或11选5）
  if (totalNumbers === 5) {
    // 时时彩：号码0-9使用digit系列
    if (ballNum >= 0 && ballNum <= 9) return `digit-${ballNum}`
    // 11选5：号码10-11使用x5系列
    if (ballNum >= 10 && ballNum <= 11) return `x5-${ballNum}`
  }

  // 8个号码的彩种（快乐十分系列）使用happy系列颜色
  if (totalNumbers === 8 && ballNum >= 1 && ballNum <= 20) {
    return `happy-${ballNum}`
  }

  return ''
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
  currentPage.value = 1
  updatePageData()
})

// 获取本地日期（中国时区）
const getLocalDateString = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 初始化
onMounted(() => {
  searchParams.value.dateObj = getLocalDateString() // ✅ 使用本地时区日期
  loadLotteries()
})
</script>

<style scoped>
/* ==================== 主容器 ==================== */
.history-luxury-page {
  min-height: 100vh;
  padding: 24px;
  background: var(--tech-bg-primary);
  transition: background 0.3s ease;
}

/* ==================== 玻璃卡片（保留旧类名以防遗漏） ==================== */
.glass-card {
  background: var(--tech-bg-secondary) !important;
  backdrop-filter: blur(20px);
  border: 2px solid;
  border-image: var(--gradient-cyber-accent) 1;
  border-radius: 16px;
  box-shadow: var(--glow-cyan);
}

.glass-card:hover {
  box-shadow: var(--glow-cyan), 0 0 30px rgba(0, 255, 255, 0.3);
}

/* ==================== 豪华筛选面板 ==================== */
.luxury-filter-panel {
  margin-bottom: 24px;
  transition: all 0.3s ease;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  font-size: 24px;
  animation: iconPulse 2s ease-in-out infinite;
}

.header-title h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.filter-content {
  padding: 4px 0 0;
}

.filter-main {
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
}

.filter-item {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-item-large {
  flex: 2;
  min-width: 300px;
}

.filter-item-action {
  flex: 0 0 auto;
  min-width: auto;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.label-icon {
  font-size: 16px;
}

.luxury-select,
.luxury-date-picker {
  width: 100%;
}

.option-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.option-name {
  font-weight: 500;
  color: var(--text-primary);
}

.option-code {
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 4px;
}

.luxury-btn-primary {
  padding: 12px 32px;
  font-size: 15px;
  font-weight: 600;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.luxury-btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-icon {
  font-size: 18px;
  margin-right: 4px;
}

.filter-shortcuts {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--divider-color);
}

.shortcuts-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.shortcuts-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.shortcut-btn {
  transition: all 0.2s ease;
}

.shortcut-btn:hover {
  transform: translateY(-1px);
}

/* ==================== 视图工具栏 ==================== */
.view-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: var(--tech-bg-secondary);
  backdrop-filter: blur(20px);
  border: 2px solid;
  border-image: var(--gradient-cyber-accent) 1;
  border-radius: 12px;
  box-shadow: var(--glow-cyan);
}

.toolbar-left {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.result-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-weight: 600;
}

.tag-icon {
  font-size: 16px;
}

.view-mode-toggle {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 4px;
}

.mode-icon {
  margin-right: 4px;
  font-size: 16px;
}

/* ==================== 表格视图 ==================== */
.table-view-card {
  margin-bottom: 24px;
}

.luxury-table {
  border-radius: 12px;
  overflow: hidden;
}

.draw-numbers-wrapper {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.draw-numbers {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.draw-numbers-multi-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kl8-row {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.number-ball {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  transition: all 0.2s ease;
}

.number-ball:hover {
  transform: scale(1.1) rotate(5deg);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.number-separator {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-tertiary);
  margin: 0 4px;
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

.size-card .k3-dice-3d {
  width: 35px;
  height: 35px;
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
    inset 0 2px 4px rgba(255, 255, 255, 0.6),
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
  background: radial-gradient(circle at 30% 30%, #ef4444, #dc2626);
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

.size-card .face-1 {
  transform: rotateY(0deg) translateZ(17.5px);
}

.size-card .face-2 {
  transform: rotateY(90deg) translateZ(17.5px);
}

.size-card .face-3 {
  transform: rotateY(180deg) translateZ(17.5px);
}

.size-card .face-4 {
  transform: rotateY(-90deg) translateZ(17.5px);
}

.size-card .face-5 {
  transform: rotateX(90deg) translateZ(17.5px);
}

.size-card .face-6 {
  transform: rotateX(-90deg) translateZ(17.5px);
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

/* 六合彩球 SVG */
.marksix-ball-svg {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.marksix-ball-svg:hover {
  transform: scale(1.15) rotate(15deg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* 福彩球样式 */
.cwl-ball {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.cwl-red {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #ffffff;
}

.cwl-blue {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
}

.cwl-orange {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: #ffffff;
}

.cwl-3d {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: #ffffff;
}

/* 快乐8球样式（英国乐透20、福彩快乐8、澳洲幸运20、SG快乐20、极速快乐8）*/
.kl8-row-1 {
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%);
  box-shadow: 0 0 12px rgba(255, 65, 108, 0.3), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.kl8-row-2 {
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 0 12px rgba(102, 126, 234, 0.3), 0 2px 6px rgba(0, 0, 0, 0.3);
}

.kl8-special {
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4), transparent 60%),
    radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.3), transparent 40%),
    linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
  font-weight: bold;
  animation: specialPulse 1.5s ease-in-out infinite;
}

@keyframes specialPulse {
  0%, 100% {
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  }
  50% {
    box-shadow: 0 4px 16px rgba(245, 158, 11, 0.6);
  }
}

.taiwan-bingo-gold {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%) !important;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.6) !important;
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

/* ========== 体彩球样式 ========== */
.sports-ball {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25), inset 0 -2px 4px rgba(0, 0, 0, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

/* 体彩红球 - 大乐透前区 */
.sports-red {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.2), transparent 50%),
    radial-gradient(circle at 50% 50%, #E8383D, #C62828);
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 体彩蓝球 - 大乐透后区 */
.sports-blue {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.2), transparent 50%),
    radial-gradient(circle at 50% 50%, #1976D2, #0D47A1);
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 体彩紫球 - 排列3/排列5/七星彩前6位 */
.sports-purple {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.2), transparent 50%),
    radial-gradient(circle at 50% 50%, #7B5FA5, #5E3A8A);
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 体彩金球 - 七星彩特别号码 */
.sports-gold {
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.4), transparent 50%),
    linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
  color: white;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5), inset 0 -2px 4px rgba(0, 0, 0, 0.2), inset 0 2px 4px rgba(255, 255, 255, 0.4);
}

.time-text {
  color: var(--text-secondary);
  font-size: 13px;
}

/* ==================== 卡片视图 ==================== */
.card-view-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.record-card {
  background: var(--tech-bg-secondary);
  backdrop-filter: blur(20px);
  border: 2px solid;
  border-image: var(--gradient-cyber-accent) 1;
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: var(--glow-cyan);
}

.record-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 255, 255, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.record-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--glow-cyan), 0 0 30px rgba(0, 255, 255, 0.3);
}

.record-card:hover::before {
  opacity: 1;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--divider-color);
}

.record-lottery {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lottery-emoji {
  font-size: 20px;
}

.lottery-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.record-issue {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.issue-label {
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
}

.issue-number {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary-color);
  font-family: 'Courier New', monospace;
}

.record-numbers {
  margin-bottom: 16px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 12px;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.number-ball-card {
  width: 36px;
  height: 36px;
  font-size: 15px;
}

.marksix-ball-svg-card {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.size-card {
  width: 44px;
  height: 44px;
}

.record-time {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.time-icon {
  font-size: 14px;
}

/* ==================== 分页 ==================== */
.luxury-pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  padding: 20px;
  background: var(--tech-bg-secondary);
  backdrop-filter: blur(20px);
  border: 2px solid;
  border-image: var(--gradient-cyber-accent) 1;
  border-radius: 12px;
  box-shadow: var(--glow-cyan);
}

/* ==================== 空状态 ==================== */
.empty-state-card {
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
  animation: iconPulse 2s ease-in-out infinite;
}

.empty-text {
  margin-top: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-subtitle {
  font-size: 14px;
  color: var(--text-tertiary);
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 768px) {
  .history-luxury-page {
    padding: 16px;
  }

  .filter-row {
    flex-direction: column;
  }

  .filter-item,
  .filter-item-large {
    width: 100%;
    min-width: 100%;
  }

  .view-toolbar {
    flex-direction: column;
    gap: 12px;
  }

  .toolbar-left,
  .toolbar-right {
    width: 100%;
    justify-content: center;
  }

  .card-view-grid {
    grid-template-columns: 1fr;
  }
}

/* ==================== 动画 ==================== */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.luxury-filter-panel,
.view-toolbar,
.data-display-area {
  animation: fadeIn 0.5s ease-out;
}

/* 加载动画 */
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

/* ==================== 浅色主题覆盖 ==================== */
[data-theme="light"] .filter-shortcuts {
  border-top-color: rgba(0, 0, 0, 0.15);
}
</style>
