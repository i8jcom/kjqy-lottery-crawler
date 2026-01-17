<template>
  <div class="luxury-theme-showcase">
    <!-- 豪华头部横幅 -->
    <div class="luxury-banner">
      <div class="banner-content">
        <div class="banner-icon">🎨</div>
        <div class="banner-text">
          <h1 class="banner-title">Element Plus 豪华主题展示</h1>
          <p class="banner-subtitle">Glass Morphism Design System · 玻璃态设计系统</p>
        </div>
        <div class="banner-stats">
          <div class="stat-item">
            <div class="stat-value">22+</div>
            <div class="stat-label">组件覆盖</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-value">705</div>
            <div class="stat-label">样式行数</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <div class="stat-value">60+</div>
            <div class="stat-label">CSS变量</div>
          </div>
        </div>
      </div>
      <div class="banner-bg-circles">
        <div class="circle circle-1"></div>
        <div class="circle circle-2"></div>
        <div class="circle circle-3"></div>
      </div>
    </div>

    <!-- 快速导航 -->
    <div class="quick-nav">
      <el-button
        v-for="(section, index) in sections"
        :key="index"
        :type="activeSection === index ? 'primary' : ''"
        @click="scrollToSection(index)"
        class="nav-btn"
      >
        {{ section.icon }} {{ section.name }}
      </el-button>
    </div>

    <div class="showcase-container">
      <!-- 第一部分：按钮与交互 -->
      <div class="section-group" ref="section0">
        <div class="group-header">
          <div class="group-icon">🎯</div>
          <div class="group-title">
            <h2>交互组件</h2>
            <p>Buttons, Forms & Interactions</p>
          </div>
        </div>

        <!-- 按钮展示 - 网格布局 -->
        <el-row :gutter="15">
          <el-col :xs="24" :sm="12" :lg="8">
            <el-card class="luxury-card hover-lift">
              <template #header>
                <div class="card-header">
                  <span class="header-icon">🔘</span>
                  <span class="header-title">按钮类型</span>
                  <el-tag size="small" type="info">6种</el-tag>
                </div>
              </template>
              <el-space direction="vertical" style="width: 100%" :size="12">
                <el-button type="primary" style="width: 100%">主要按钮 Primary</el-button>
                <el-button type="success" style="width: 100%">成功按钮 Success</el-button>
                <el-button type="warning" style="width: 100%">警告按钮 Warning</el-button>
                <el-button type="danger" style="width: 100%">危险按钮 Danger</el-button>
                <el-button type="info" style="width: 100%">信息按钮 Info</el-button>
                <el-button style="width: 100%">默认按钮 Default</el-button>
              </el-space>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :lg="8">
            <el-card class="luxury-card hover-lift">
              <template #header>
                <div class="card-header">
                  <span class="header-icon">✨</span>
                  <span class="header-title">按钮样式</span>
                  <el-tag size="small" type="success">5种</el-tag>
                </div>
              </template>
              <el-space direction="vertical" style="width: 100%" :size="12">
                <el-button type="primary" plain style="width: 100%">朴素按钮 Plain</el-button>
                <el-button type="primary" round style="width: 100%">圆角按钮 Round</el-button>
                <el-button type="primary" :loading="true" style="width: 100%">加载中 Loading</el-button>
                <el-button type="primary" disabled style="width: 100%">禁用按钮 Disabled</el-button>
                <div style="text-align: center;">
                  <el-button-group>
                    <el-button type="primary" icon="ArrowLeft">上一页</el-button>
                    <el-button type="primary">下一页<el-icon class="el-icon--right"><ArrowRight /></el-icon></el-button>
                  </el-button-group>
                </div>
              </el-space>
            </el-card>
          </el-col>

          <el-col :xs="24" :sm="12" :lg="8">
            <el-card class="luxury-card hover-lift">
              <template #header>
                <div class="card-header">
                  <span class="header-icon">🎭</span>
                  <span class="header-title">按钮尺寸</span>
                  <el-tag size="small" type="warning">3种</el-tag>
                </div>
              </template>
              <el-space direction="vertical" style="width: 100%" :size="12">
                <el-button type="primary" size="large" style="width: 100%">大按钮 Large</el-button>
                <el-button type="primary" style="width: 100%">默认按钮 Default</el-button>
                <el-button type="primary" size="small" style="width: 100%">小按钮 Small</el-button>
                <div style="text-align: center;">
                  <el-button type="primary" circle icon="Search" />
                  <el-button type="success" circle icon="Check" />
                  <el-button type="warning" circle icon="Star" />
                  <el-button type="danger" circle icon="Delete" />
                </div>
              </el-space>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 第二部分：数据展示 -->
      <div class="section-group" ref="section1">
        <div class="group-header">
          <div class="group-icon">📊</div>
          <div class="group-title">
            <h2>数据展示</h2>
            <p>Cards, Tables & Statistics</p>
          </div>
        </div>

        <!-- 统计卡片 -->
        <el-row :gutter="15" class="stat-cards">
          <el-col :xs="12" :sm="6">
            <el-card class="luxury-card stat-card stat-primary">
              <div class="stat-icon">📈</div>
              <el-statistic title="今日开奖" :value="68">
                <template #suffix>期</template>
              </el-statistic>
              <div class="stat-trend">
                <el-icon color="#10b981"><TrendCharts /></el-icon>
                <span class="trend-text success">+12%</span>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-card class="luxury-card stat-card stat-success">
              <div class="stat-icon">✅</div>
              <el-statistic title="成功率" :value="98.5">
                <template #suffix>%</template>
              </el-statistic>
              <div class="stat-trend">
                <el-icon color="#10b981"><TrendCharts /></el-icon>
                <span class="trend-text success">+2.3%</span>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-card class="luxury-card stat-card stat-warning">
              <div class="stat-icon">⚡</div>
              <el-statistic title="平均响应" :value="156">
                <template #suffix>ms</template>
              </el-statistic>
              <div class="stat-trend">
                <el-icon color="#f59e0b"><Bottom /></el-icon>
                <span class="trend-text warning">-5ms</span>
              </div>
            </el-card>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-card class="luxury-card stat-card stat-info">
              <div class="stat-icon">🔄</div>
              <el-statistic title="运行天数" :value="127">
                <template #suffix>天</template>
              </el-statistic>
              <div class="stat-trend">
                <span class="trend-text info">稳定运行</span>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 表格展示 -->
        <el-card class="luxury-card hover-lift">
          <template #header>
            <div class="card-header">
              <span class="header-icon">📋</span>
              <span class="header-title">数据表格</span>
              <el-tag size="small">4条记录</el-tag>
            </div>
          </template>
          <el-table :data="tableData" style="width: 100%" stripe>
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="lottery" label="彩种" width="120">
              <template #default="{ row }">
                <el-tag effect="plain">{{ row.lottery }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="issue" label="期号" width="150" />
            <el-table-column prop="numbers" label="开奖号码" min-width="200">
              <template #default="{ row }">
                <div class="number-balls">
                  <span v-for="(num, idx) in row.numbers.split(' ').slice(0, 5)"
                        :key="idx"
                        class="number-ball">
                    {{ num }}
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === '已开奖' ? 'success' : 'info'" effect="dark">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default>
                <el-button size="small" type="primary" :icon="View">详情</el-button>
                <el-button size="small" type="danger" :icon="Delete">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination-container">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="100"
              background
              layout="total, sizes, prev, pager, next, jumper"
            />
          </div>
        </el-card>
      </div>

      <!-- 第三部分：表单输入 -->
      <div class="section-group" ref="section2">
        <div class="group-header">
          <div class="group-icon">📝</div>
          <div class="group-title">
            <h2>表单输入</h2>
            <p>Forms, Inputs & Selectors</p>
          </div>
        </div>

        <el-row :gutter="15">
          <el-col :xs="24" :lg="12">
            <el-card class="luxury-card hover-lift">
              <template #header>
                <div class="card-header">
                  <span class="header-icon">📥</span>
                  <span class="header-title">基础表单</span>
                </div>
              </template>
              <el-form :model="testForm" label-width="100px" label-position="right">
                <el-form-item label="用户名">
                  <el-input v-model="testForm.username" placeholder="请输入用户名" prefix-icon="User" clearable />
                </el-form-item>
                <el-form-item label="密码">
                  <el-input v-model="testForm.password" type="password" placeholder="请输入密码" prefix-icon="Lock" show-password />
                </el-form-item>
                <el-form-item label="彩种">
                  <el-select v-model="testForm.lottery" placeholder="请选择彩种" style="width: 100%">
                    <el-option label="🏎️ 极速赛车" value="10037" />
                    <el-option label="✈️ 极速飞艇" value="10038" />
                    <el-option label="⏰ 极速时时彩" value="10039" />
                    <el-option label="🎯 极速11选5" value="10040" />
                  </el-select>
                </el-form-item>
                <el-form-item label="日期">
                  <el-date-picker
                    v-model="testForm.date"
                    type="date"
                    placeholder="选择日期"
                    style="width: 100%"
                  />
                </el-form-item>
                <el-form-item label="备注">
                  <el-input v-model="testForm.remark" type="textarea" :rows="3" placeholder="请输入备注" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" style="width: 100%">提交表单</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>

          <el-col :xs="24" :lg="12">
            <el-card class="luxury-card hover-lift">
              <template #header>
                <div class="card-header">
                  <span class="header-icon">📊</span>
                  <span class="header-title">进度与状态</span>
                </div>
              </template>
              <el-space direction="vertical" style="width: 100%" :size="15">
                <div>
                  <div class="progress-label">数据同步进度</div>
                  <el-progress :percentage="50" :stroke-width="10">
                    <template #default="{ percentage }">
                      <span class="percentage-value">{{ percentage }}%</span>
                    </template>
                  </el-progress>
                </div>
                <div>
                  <div class="progress-label">任务完成度</div>
                  <el-progress :percentage="70" status="success" :stroke-width="10" />
                </div>
                <div>
                  <div class="progress-label">系统负载</div>
                  <el-progress :percentage="90" status="warning" :stroke-width="10" />
                </div>
                <div>
                  <div class="progress-label">错误率</div>
                  <el-progress :percentage="100" status="exception" :stroke-width="10" />
                </div>
              </el-space>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 第四部分：反馈组件 -->
      <div class="section-group" ref="section3">
        <div class="group-header">
          <div class="group-icon">💬</div>
          <div class="group-title">
            <h2>反馈组件</h2>
            <p>Messages, Alerts & Dialogs</p>
          </div>
        </div>

        <el-row :gutter="15">
          <el-col :xs="24" :lg="12">
            <el-card class="luxury-card hover-lift">
              <template #header>
                <div class="card-header">
                  <span class="header-icon">💌</span>
                  <span class="header-title">消息提示</span>
                </div>
              </template>
              <el-space wrap :size="15">
                <el-button type="success" @click="showMessage('success')" :icon="CircleCheck">成功消息</el-button>
                <el-button type="warning" @click="showMessage('warning')" :icon="Warning">警告消息</el-button>
                <el-button type="danger" @click="showMessage('error')" :icon="CircleClose">错误消息</el-button>
                <el-button type="info" @click="showMessage('info')" :icon="InfoFilled">信息消息</el-button>
              </el-space>
            </el-card>
          </el-col>

          <el-col :xs="24" :lg="12">
            <el-card class="luxury-card hover-lift">
              <template #header>
                <div class="card-header">
                  <span class="header-icon">🔔</span>
                  <span class="header-title">对话框</span>
                </div>
              </template>
              <el-space wrap :size="15">
                <el-button type="primary" @click="dialogVisible = true" :icon="Document">打开对话框</el-button>
                <el-button type="warning" @click="showConfirm" :icon="QuestionFilled">确认框</el-button>
                <el-button type="info" @click="showPrompt" :icon="Edit">输入框</el-button>
              </el-space>
            </el-card>
          </el-col>
        </el-row>

        <!-- 警告提示 -->
        <el-card class="luxury-card hover-lift">
          <template #header>
            <div class="card-header">
              <span class="header-icon">⚠️</span>
              <span class="header-title">警告提示</span>
            </div>
          </template>
          <el-space direction="vertical" style="width: 100%" :size="15">
            <el-alert title="成功提示：数据已保存" type="success" show-icon :closable="false" />
            <el-alert title="警告提示：请检查输入内容" type="warning" show-icon :closable="false" />
            <el-alert title="错误提示：操作失败，请重试" type="error" show-icon :closable="false" />
            <el-alert title="信息提示：系统将在5分钟后维护" type="info" show-icon :closable="false" />
          </el-space>
        </el-card>
      </div>

      <!-- 第五部分：导航与布局 -->
      <div class="section-group" ref="section4">
        <div class="group-header">
          <div class="group-icon">🧭</div>
          <div class="group-title">
            <h2>导航与布局</h2>
            <p>Tabs, Descriptions & More</p>
          </div>
        </div>

        <el-row :gutter="20">
          <el-col :xs="24" :lg="12">
            <el-card class="luxury-card hover-lift">
              <template #header>
                <div class="card-header">
                  <span class="header-icon">📑</span>
                  <span class="header-title">标签页</span>
                </div>
              </template>
              <el-tabs v-model="activeTab" type="card">
                <el-tab-pane label="⚡ 实时监控" name="realtime">
                  <div class="tab-content">
                    <el-empty description="实时监控功能开发中..." :image-size="100" />
                  </div>
                </el-tab-pane>
                <el-tab-pane label="📚 历史查询" name="history">
                  <div class="tab-content">
                    <el-empty description="历史查询功能开发中..." :image-size="100" />
                  </div>
                </el-tab-pane>
                <el-tab-pane label="📊 数据统计" name="stats">
                  <div class="tab-content">
                    <el-empty description="数据统计功能开发中..." :image-size="100" />
                  </div>
                </el-tab-pane>
              </el-tabs>
            </el-card>
          </el-col>

          <el-col :xs="24" :lg="12">
            <el-card class="luxury-card hover-lift">
              <template #header>
                <div class="card-header">
                  <span class="header-icon">📝</span>
                  <span class="header-title">描述列表</span>
                </div>
              </template>
              <el-descriptions title="彩种详情" :column="2" border>
                <el-descriptions-item label="彩种名称">
                  <el-tag type="primary">极速赛车</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="彩种代码">10037</el-descriptions-item>
                <el-descriptions-item label="开奖频率">5分钟/期</el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag type="success" effect="dark">运行中</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="数据源">官方API</el-descriptions-item>
                <el-descriptions-item label="最近更新">2026-01-06 15:30</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 返回顶部按钮 -->
      <el-backtop :right="40" :bottom="40">
        <div class="back-to-top">
          <el-icon><Top /></el-icon>
        </div>
      </el-backtop>
    </div>

    <!-- 玻璃态对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="🎨 玻璃态对话框演示"
      width="600px"
      align-center
    >
      <div class="dialog-content">
        <el-alert title="玻璃态效果说明" type="info" :closable="false" show-icon>
          <p>✨ backdrop-filter: blur(20px)</p>
          <p>🌈 半透明背景 rgba(30, 30, 40, 0.85)</p>
          <p>💫 边框发光 rgba(102, 126, 234, 0.3)</p>
        </el-alert>

        <el-divider />

        <el-form label-width="100px">
          <el-form-item label="测试输入">
            <el-input placeholder="请输入内容" prefix-icon="Edit" />
          </el-form-item>
          <el-form-item label="测试选择">
            <el-select placeholder="请选择" style="width: 100%">
              <el-option label="选项1" value="1" />
              <el-option label="选项2" value="2" />
              <el-option label="选项3" value="3" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="dialogVisible = false">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  View, Delete, User, Lock, CircleCheck, Warning, CircleClose,
  InfoFilled, Document, QuestionFilled, Edit, TrendCharts,
  Bottom, Top, ArrowRight
} from '@element-plus/icons-vue'

// 章节定义
const sections = ref([
  { name: '交互组件', icon: '🎯' },
  { name: '数据展示', icon: '📊' },
  { name: '表单输入', icon: '📝' },
  { name: '反馈组件', icon: '💬' },
  { name: '导航布局', icon: '🧭' }
])

const activeSection = ref(0)

// 表单数据
const testForm = ref({
  username: '',
  password: '',
  lottery: '',
  date: '',
  remark: ''
})

// 表格数据
const tableData = ref([
  { id: 1, lottery: '极速赛车', issue: '20260106-001', numbers: '01 02 03 04 05 06 07 08 09 10', status: '已开奖' },
  { id: 2, lottery: '极速飞艇', issue: '20260106-002', numbers: '02 04 06 08 10 12 14 16 18 20', status: '已开奖' },
  { id: 3, lottery: '极速时时彩', issue: '20260106-003', numbers: '03 06 09 12 15', status: '已开奖' },
  { id: 4, lottery: '极速11选5', issue: '20260106-004', numbers: '01 03 05 07 09 11 13 15 17 19 21', status: '开奖中' }
])

// 分页
const currentPage = ref(1)
const pageSize = ref(10)

// 标签页
const activeTab = ref('realtime')

// 对话框
const dialogVisible = ref(false)

// 滚动到指定章节
const scrollToSection = (index) => {
  activeSection.value = index
  const sectionRefs = [section0, section1, section2, section3, section4]
  if (sectionRefs[index]?.value) {
    sectionRefs[index].value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// 章节引用
const section0 = ref(null)
const section1 = ref(null)
const section2 = ref(null)
const section3 = ref(null)
const section4 = ref(null)

// 消息提示
const showMessage = (type) => {
  const messages = {
    success: '✅ 操作成功！数据已保存',
    warning: '⚠️ 警告：请检查输入内容',
    error: '❌ 错误：操作失败，请重试',
    info: 'ℹ️ 提示：这是一条信息'
  }

  ElMessage({
    message: messages[type],
    type,
    duration: 3000,
    showClose: true
  })
}

// 确认框
const showConfirm = () => {
  ElMessageBox.confirm(
    '确定要删除这条数据吗？此操作不可恢复',
    '⚠️ 确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    ElMessage.success('✅ 删除成功')
  }).catch(() => {
    ElMessage.info('ℹ️ 已取消删除')
  })
}

// 输入框
const showPrompt = () => {
  ElMessageBox.prompt('请输入彩种代码', '➕ 添加彩种', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /^\d+$/,
    inputErrorMessage: '请输入数字'
  }).then(({ value }) => {
    ElMessage.success(`✅ 添加彩种: ${value}`)
  }).catch(() => {
    ElMessage.info('ℹ️ 已取消')
  })
}

// 滚动监听
const handleScroll = () => {
  const sections = [section0, section1, section2, section3, section4]
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop

  sections.forEach((section, index) => {
    if (section.value) {
      const rect = section.value.getBoundingClientRect()
      if (rect.top <= 200 && rect.bottom >= 200) {
        activeSection.value = index
      }
    }
  })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.luxury-theme-showcase {
  min-height: 100vh;
  padding-bottom: 60px;
}

/* ==================== 豪华横幅 ==================== */
.luxury-banner {
  position: relative;
  background: linear-gradient(135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(118, 75, 162, 0.1) 100%);
  border-bottom: 1px solid rgba(102, 126, 234, 0.2);
  padding: 40px 40px;
  margin-bottom: 40px;
  overflow: hidden;
}

.banner-content {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto;
  gap: 40px;
  flex-wrap: wrap;
}

.banner-icon {
  font-size: 60px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.banner-text {
  flex: 1;
  min-width: 300px;
}

.banner-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 10px 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.banner-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  opacity: 0.8;
}

.banner-stats {
  display: flex;
  gap: 30px;
  align-items: center;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 5px;
  opacity: 0.7;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(102, 126, 234, 0.2);
}

/* 背景圆圈动画 */
.banner-bg-circles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 1;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(102, 126, 234, 0.1), transparent);
  animation: float-circle 20s infinite ease-in-out;
}

.circle-1 {
  width: 300px;
  height: 300px;
  top: -100px;
  left: 10%;
  animation-delay: 0s;
}

.circle-2 {
  width: 200px;
  height: 200px;
  top: 50%;
  right: 20%;
  animation-delay: 5s;
}

.circle-3 {
  width: 250px;
  height: 250px;
  bottom: -50px;
  left: 50%;
  animation-delay: 10s;
}

@keyframes float-circle {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.3;
  }
  50% {
    transform: translate(30px, -30px) scale(1.1);
    opacity: 0.6;
  }
}

/* ==================== 快速导航 ==================== */
.quick-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(30, 30, 40, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(102, 126, 234, 0.2);
  padding: 10px 40px;
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.nav-btn {
  white-space: nowrap;
  transition: all 0.3s ease;
}

.nav-btn:hover {
  transform: translateY(-2px);
}

/* ==================== 主容器 ==================== */
.showcase-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 40px;
}

/* ==================== 章节组 ==================== */
.section-group {
  margin-bottom: 40px;
  scroll-margin-top: 100px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid rgba(102, 126, 234, 0.2);
}

.group-icon {
  font-size: 40px;
  animation: float 3s ease-in-out infinite;
}

.group-title h2 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 5px 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.group-title p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  opacity: 0.7;
}

/* ==================== 豪华卡片 ==================== */
.luxury-card {
  height: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.luxury-card :deep(.el-card__body) {
  padding: 15px !important;
}

.luxury-card :deep(.el-card__header) {
  padding: 12px 15px !important;
}

.luxury-card :deep(.el-table) {
  margin-top: -10px;
}

.luxury-card :deep(.el-table td),
.luxury-card :deep(.el-table th) {
  padding: 8px 0 !important;
}

.luxury-card :deep(.el-form-item) {
  margin-bottom: 15px !important;
}

.luxury-card::before {
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

.luxury-card:hover::before {
  opacity: 1;
}

.hover-lift {
  cursor: pointer;
}

.hover-lift:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5) !important;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 20px;
}

.header-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
}

/* ==================== 统计卡片 ==================== */
.stat-cards {
  margin-bottom: 15px;
}

.stat-card {
  text-align: center;
  padding: 15px 10px !important;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  transition: all 0.3s ease;
}

.stat-primary::before {
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.stat-success::before {
  background: linear-gradient(90deg, #10b981, #43e97b);
}

.stat-warning::before {
  background: linear-gradient(90deg, #f59e0b, #f5a623);
}

.stat-info::before {
  background: linear-gradient(90deg, #3b82f6, #4fc3f7);
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 10px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.stat-trend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 10px;
  font-size: 12px;
}

.trend-text {
  font-weight: 600;
}

.trend-text.success {
  color: #10b981;
}

.trend-text.warning {
  color: #f59e0b;
}

.trend-text.info {
  color: #3b82f6;
}

/* ==================== 号码球 ==================== */
.number-balls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.number-ball {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  transition: all 0.2s ease;
}

.number-ball:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
}

/* ==================== 分页 ==================== */
.pagination-container {
  margin-top: 15px;
  display: flex;
  justify-content: center;
}

/* ==================== 进度条标签 ==================== */
.progress-label {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.percentage-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ==================== 标签页内容 ==================== */
.tab-content {
  padding: 20px 15px;
  min-height: 150px;
}

/* ==================== 对话框内容 ==================== */
.dialog-content {
  padding: 5px 0;
}

/* ==================== 返回顶部 ==================== */
.back-to-top {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 50%;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
  transition: all 0.3s ease;
}

.back-to-top:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.7);
}

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .luxury-banner {
    padding: 30px 20px;
  }

  .banner-title {
    font-size: 24px;
  }

  .banner-subtitle {
    font-size: 13px;
  }

  .banner-stats {
    width: 100%;
    justify-content: space-around;
  }

  .stat-value {
    font-size: 22px;
  }

  .quick-nav {
    padding: 8px 20px;
  }

  .showcase-container {
    padding: 0 20px;
  }

  .section-group {
    margin-bottom: 30px;
  }

  .group-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .group-icon {
    font-size: 32px;
  }

  .group-title h2 {
    font-size: 24px;
  }
}

/* ==================== 平滑滚动 ==================== */
html {
  scroll-behavior: smooth;
}
</style>
