<template>
  <div class="domain-management-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <span class="gradient-text">域名管理</span>
      </h2>
      <p class="page-desc">管理爬虫域名池和健康状态</p>
    </div>

    <!-- 域名统计 -->
    <div class="overview-grid">
      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
            <span>🌍</span>
          </div>
          <el-statistic :value="domainStats.total" title="总域名数" />
        </div>
      </HolographicCard>

      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, var(--success-color), #38f9d7);">
            <span>✅</span>
          </div>
          <el-statistic :value="domainStats.available" title="可用" />
        </div>
      </HolographicCard>

      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a, #fee140);">
            <span>❌</span>
          </div>
          <el-statistic :value="domainStats.unavailable" title="不可用" />
        </div>
      </HolographicCard>

      <HolographicCard class="stat-card" :border="true" :hover="true">
        <div class="stat-wrapper">
          <div class="stat-icon" style="background: linear-gradient(135deg, var(--info-color), #00f2fe);">
            <span>📊</span>
          </div>
          <div class="stat-content">
            <div class="stat-label">成功率</div>
            <div class="stat-value">{{ domainStats.successRate }}</div>
          </div>
        </div>
      </HolographicCard>
    </div>

    <!-- 域名列表 -->
    <HolographicCard class="domains-panel" :border="true">
      <template #header>
        <div class="panel-header">
          <h3 class="panel-title">域名列表</h3>
          <div class="panel-actions">
            <NeonButton
              type="primary"
              :loading="checkingAll"
              @click="checkAllDomains"
            >
              <template #icon>
                <span>🔍</span>
              </template>
              {{ checkingAll ? '检查中...' : '全部检查' }}
            </NeonButton>
            <NeonButton
              type="primary"
              @click="showAddDialog = true"
            >
              <template #icon>
                <span>➕</span>
              </template>
              添加域名
            </NeonButton>
          </div>
        </div>
      </template>

      <el-table
        :data="domains"
        stripe
        border
        style="width: 100%"
        :header-cell-style="{ background: 'var(--glass-bg)', color: 'var(--text-secondary)' }"
      >
        <el-table-column label="数据源" width="120">
          <template #default="{ row }">
            <GlowingTag
              :type="getSourceTagType(row.sourceType)"
              :text="getSourceName(row.sourceType)"
              size="small"
              effect="dark"
            />
          </template>
        </el-table-column>

        <el-table-column prop="url" label="域名" min-width="200">
          <template #default="{ row }">
            <span class="domain-url">{{ row.url }}</span>
          </template>
        </el-table-column>

        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <GlowingTag
              :type="row.type === 'HTTPS' ? 'success' : 'warning'"
              :text="row.type"
              size="small"
              effect="dark"
            />
          </template>
        </el-table-column>

        <el-table-column prop="usage" label="用途" width="100" />

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <GlowingTag
              :type="getStatusType(row.status)"
              :text="getStatusText(row.status)"
              size="small"
              effect="dark"
              :pulse="row.status === 'checking'"
            />
          </template>
        </el-table-column>

        <el-table-column prop="responseTime" label="响应时间" width="100" />

        <el-table-column label="成功率" width="100">
          <template #default="{ row }">
            <span :class="['success-rate', getSuccessRateClass(row.successRate)]">
              {{ row.successRate || '-' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="总请求数" width="110">
          <template #default="{ row }">
            <span class="total-requests">
              {{ formatNumber(row.totalRequests) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="连续失败" width="100">
          <template #default="{ row }">
            <GlowingTag
              :type="getFailureTagType(row.consecutiveFailures)"
              :text="String(row.consecutiveFailures || 0)"
              size="small"
              effect="dark"
            />
          </template>
        </el-table-column>

        <el-table-column label="最后检查" width="140">
          <template #default="{ row }">
            <span class="last-check">{{ formatTime(row.lastCheck) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <NeonButton
                size="small"
                @click="checkDomain(row.id)"
              >
                🔍
              </NeonButton>
              <NeonButton
                type="warning"
                size="small"
                @click="editDomain(row)"
              >
                ✏️
              </NeonButton>
              <NeonButton
                type="danger"
                size="small"
                @click="deleteDomain(row.id)"
              >
                🗑️
              </NeonButton>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <div class="empty-state">
            <span style="font-size: 48px;">🌐</span>
            <p>暂无域名配置</p>
          </div>
        </template>
      </el-table>
    </HolographicCard>

    <!-- 添加/编辑对话框 -->
    <CyberDialog
      v-model="showAddDialog"
      :title="editingDomain ? '编辑域名' : '添加域名'"
      width="600px"
      :scanline="true"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        label-width="100px"
        :rules="formRules"
      >
        <el-form-item label="数据源类型" prop="sourceType">
          <el-select
            v-model="formData.sourceType"
            placeholder="请选择数据源"
            style="width: 100%"
          >
            <el-option value="" label="请选择数据源" disabled />
            <el-option value="speedylot88" label="SpeedyLot88 (极速彩)" />
            <el-option value="sglotteries" label="SG Lotteries (SG彩)" />
            <el-option value="auluckylotteries" label="AU Lucky Lotteries (澳洲幸运彩)" />
            <el-option value="luckysscai" label="LuckySscai (幸运时时彩)" />
            <el-option value="luckylottoz" label="LuckyLottoz (幸运飞艇)" />
            <el-option value="cwl" label="中国福彩官网" />
            <el-option value="sportslottery" label="中国体彩官网" />
            <el-option value="hkjc" label="香港六合彩 (On.cc)" />
            <el-option value="uklottos" label="UK Lottos (英国乐透)" />
            <el-option value="taiwanlottery" label="台湾彩票官网 🇹🇼" />
          </el-select>
        </el-form-item>

        <el-form-item label="域名 URL" prop="url">
          <el-input
            v-model="formData.url"
            placeholder="https://example.com"
          />
        </el-form-item>

        <el-form-item label="域名用途" prop="usage">
          <el-select
            v-model="formData.usage"
            style="width: 100%"
          >
            <el-option value="主域名" label="主域名" />
            <el-option value="备用域名" label="备用域名" />
          </el-select>
        </el-form-item>

        <el-form-item label="优先级">
          <el-input-number
            v-model="formData.priority"
            :min="1"
            :max="9999"
            placeholder="数字越小优先级越高"
            style="width: 100%"
          />
          <div class="form-hint">主域名通常为1，备用域名为999</div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input
            v-model="formData.notes"
            type="textarea"
            :rows="3"
            placeholder="域名说明、来源等"
          />
        </el-form-item>

        <el-form-item label="启用状态">
          <el-checkbox v-model="formData.enabled">
            启用此域名
          </el-checkbox>
        </el-form-item>
      </el-form>

      <template #footer>
        <NeonButton @click="closeDialog">取消</NeonButton>
        <NeonButton type="primary" @click="submitForm">
          {{ editingDomain ? '保存' : '添加' }}
        </NeonButton>
      </template>
    </CyberDialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { HolographicCard, NeonButton, GlowingTag, CyberDialog } from '../components/tech'
import api from '../services/api'

// 域名统计
const domainStats = ref({
  total: 0,
  available: 0,
  unavailable: 0,
  successRate: '0%'
})

// 域名列表
const domains = ref([])
const checkingAll = ref(false)

// 对话框状态
const showAddDialog = ref(false)
const editingDomain = ref(null)

// 表单引用和数据
const formRef = ref(null)
const formData = ref({
  sourceType: '',
  url: '',
  usage: '主域名',
  priority: 1,
  notes: '',
  enabled: true
})

// 表单验证规则
const formRules = {
  sourceType: [
    { required: true, message: '请选择数据源类型', trigger: 'change' }
  ],
  url: [
    { required: true, message: '请填写域名 URL', trigger: 'blur' },
    { type: 'url', message: '请输入有效的 URL', trigger: 'blur' }
  ],
  usage: [
    { required: true, message: '请选择域名用途', trigger: 'change' }
  ]
}

// 计算统计数据
const updateStats = () => {
  const available = domains.value.filter(d => d.status === 'available').length
  const unavailable = domains.value.filter(d => d.status === 'unavailable').length

  // 计算总成功率
  const rates = domains.value
    .filter(d => d.successRate && d.successRate !== '-')
    .map(d => parseFloat(d.successRate))

  let successRate = '0%'
  if (rates.length > 0) {
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length
    successRate = `${avg.toFixed(1)}%`
  }

  domainStats.value = {
    total: domains.value.length,
    available,
    unavailable,
    successRate
  }
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'available': '可用',
    'unavailable': '不可用',
    'checking': '检查中',
    'warning': '警告',
    'error': '错误'
  }
  return statusMap[status] || status
}

// 获取状态标签类型
const getStatusType = (status) => {
  const typeMap = {
    'available': 'success',
    'unavailable': 'info',
    'checking': 'primary',
    'warning': 'warning',
    'error': 'danger'
  }
  return typeMap[status] || 'info'
}

// 获取数据源名称
const getSourceName = (sourceType) => {
  const sourceMap = {
    'cwl': '福彩',
    'speedylot88': 'SpeedyLot88',
    'sglotteries': 'SG彩票',
    'auluckylotteries': '澳洲幸运',
    'luckysscai': '幸运时时彩',
    'luckylottoz': '幸运飞艇',
    'hkjc': '香港六合彩',
    'sportslottery': '体彩',
    'uklottos': 'UK彩票',
    'taiwanlottery': '台湾彩票'
  }
  return sourceMap[sourceType] || sourceType
}

// 获取数据源标签类型
const getSourceTagType = (sourceType) => {
  const typeMap = {
    'cwl': 'danger',
    'speedylot88': 'success',
    'sglotteries': 'primary',
    'luckysscai': 'warning',
    'luckylottoz': '',
    'sportslottery': 'danger',
    'hkjc': 'warning',
    'uklottos': 'primary',
    'taiwanlottery': 'success'
  }
  return typeMap[sourceType] || ''
}

// 获取成功率样式类
const getSuccessRateClass = (rate) => {
  if (!rate || rate === '-') return ''
  const value = parseFloat(rate)
  if (value >= 95) return 'rate-high'
  if (value >= 80) return 'rate-medium'
  return 'rate-low'
}

// 获取连续失败标签类型
const getFailureTagType = (failures) => {
  if (!failures || failures === 0) return 'success'
  if (failures >= 10) return 'danger'
  if (failures >= 5) return 'danger'
  if (failures >= 3) return 'warning'
  return 'primary'
}

// 格式化数字（添加千位分隔符）
const formatNumber = (num) => {
  if (!num && num !== 0) return '-'
  return num.toLocaleString('en-US')
}

// 格式化时间
const formatTime = (dateStr) => {
  if (!dateStr) return '-'

  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date

    // 1分钟内
    if (diff < 60000) {
      return '刚刚'
    }

    // 1小时内
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes}分钟前`
    }

    // 24小时内
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}小时前`
    }

    // 显示日期
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${month}-${day} ${hours}:${minutes}`
  } catch (error) {
    return '-'
  }
}

// 加载域名列表
const loadDomains = async () => {
  try {
    const response = await api.getDomains()

    if (response.success) {
      // API 返回的数据结构：{ domains: [], currentDomain: {} }
      const apiDomains = response.data.domains || []

      // 转换为前端需要的格式
      domains.value = apiDomains.map(domain => ({
        id: domain.id,
        url: domain.domain_url,
        type: domain.domain_url.startsWith('https') ? 'HTTPS' : 'HTTP',
        usage: domain.domain_type === 'primary' ? '主域名' : domain.domain_type === 'backup' ? '备用域名' : '其他',
        status: domain.status === 'active' ? 'available' : 'unavailable',
        responseTime: `${domain.response_time_ms}ms`,
        successRate: `${domain.success_rate}%`,
        lastCheck: domain.last_check_at ? new Date(domain.last_check_at) : null,
        enabled: domain.enabled === 1,
        sourceType: domain.source_type,
        priority: domain.priority,
        notes: domain.notes,
        totalRequests: domain.total_requests,
        successRequests: domain.success_requests,
        failedRequests: domain.failed_requests,
        consecutiveFailures: domain.consecutive_failures,
        lastFailureReason: domain.failure_reason
      }))
    }
  } catch (error) {
    ElMessage.error('加载域名列表失败: ' + (error.message || '未知错误'))
    console.error('加载域名列表失败:', error)
    // 使用模拟数据
    domains.value = [
      {
        id: 1,
        url: 'https://lottery-api.example.com',
        type: 'HTTPS',
        usage: '主域名',
        status: 'available',
        responseTime: '85ms',
        successRate: '99.2%',
        lastCheck: new Date(Date.now() - 1000 * 60 * 5),
        enabled: true,
        sourceType: 'speedylot88',
        priority: 1,
        totalRequests: 15420,
        consecutiveFailures: 0
      },
      {
        id: 2,
        url: 'http://backup.lottery.com',
        type: 'HTTP',
        usage: '备用域名',
        status: 'available',
        responseTime: '120ms',
        successRate: '97.5%',
        lastCheck: new Date(Date.now() - 1000 * 60 * 10),
        enabled: true,
        sourceType: 'cwl',
        priority: 999,
        totalRequests: 8543,
        consecutiveFailures: 0
      },
      {
        id: 3,
        url: 'https://mirror1.lottery.cn',
        type: 'HTTPS',
        usage: '镜像站点',
        status: 'warning',
        responseTime: '450ms',
        successRate: '88.3%',
        lastCheck: new Date(Date.now() - 1000 * 60 * 15),
        enabled: true,
        sourceType: 'sglotteries',
        priority: 500,
        totalRequests: 4232,
        consecutiveFailures: 2
      },
      {
        id: 4,
        url: 'http://old.lottery.net',
        type: 'HTTP',
        usage: '旧版域名',
        status: 'unavailable',
        responseTime: '-',
        successRate: '0%',
        lastCheck: new Date(Date.now() - 1000 * 60 * 60 * 2),
        enabled: false,
        sourceType: 'luckysscai',
        priority: 999,
        totalRequests: 125,
        consecutiveFailures: 15
      },
      {
        id: 5,
        url: 'https://api-v2.lottery.org',
        type: 'HTTPS',
        usage: 'API域名',
        status: 'available',
        responseTime: '95ms',
        successRate: '98.8%',
        lastCheck: new Date(Date.now() - 1000 * 60 * 3),
        enabled: true,
        sourceType: 'luckylottoz',
        priority: 2,
        totalRequests: 25639,
        consecutiveFailures: 0
      }
    ]
  } finally {
    updateStats()
  }
}

// 检查单个域名
const checkDomain = async (id) => {
  try {
    console.log('检查域名:', id)

    // 立即更新状态为检查中
    const domain = domains.value.find(d => d.id === id)
    if (domain) {
      domain.status = 'checking'
    }

    ElMessage.info('正在检查域名健康状态...')

    // 调用API检查健康状态
    const response = await api.checkDomain(id)

    // 1秒后刷新数据（无感刷新）
    setTimeout(async () => {
      await loadDomains()
      ElMessage.success('域名健康检查完成')
    }, 1000)
  } catch (error) {
    ElMessage.error('检查域名失败: ' + (error.message || '未知错误'))
    console.error('检查域名失败:', error)
    // 恢复状态
    const domain = domains.value.find(d => d.id === id)
    if (domain) {
      domain.status = 'unavailable'
    }
  }
}

// 检查所有域名
const checkAllDomains = async () => {
  try {
    checkingAll.value = true
    console.log('检查所有域名')

    ElMessage.info(`正在检查所有域名 (共${domains.value.length}个)...`)

    // 批量调用健康检查API
    const checkPromises = domains.value.map(domain =>
      api.checkDomain(domain.id).catch(err => {
        console.error(`检查域名 ${domain.url} 失败:`, err)
      })
    )

    await Promise.all(checkPromises)

    // 1秒后刷新数据（无感刷新）
    setTimeout(async () => {
      await loadDomains()
      checkingAll.value = false
      ElMessage.success('所有域名健康检查完成')
    }, 1000)
  } catch (error) {
    ElMessage.error('批量检查失败: ' + (error.message || '未知错误'))
    console.error('批量检查失败:', error)
    checkingAll.value = false
  }
}

// 编辑域名
const editDomain = (domain) => {
  // 从后端数据映射到表单数据
  formData.value = {
    id: domain.id,
    sourceType: domain.sourceType || '',
    url: domain.url,
    usage: domain.usage,
    priority: domain.priority || 1,
    notes: domain.notes || '',
    enabled: domain.enabled
  }
  editingDomain.value = domain
  showAddDialog.value = true
}

// 删除域名
const deleteDomain = async (id) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个域名吗？',
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await api.deleteDomain(id)

    // 立即从列表中移除（无感刷新）
    domains.value = domains.value.filter(d => d.id !== id)
    updateStats()

    ElMessage.success('域名已删除')
    console.log('域名已删除:', id)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + (error.response?.data?.error || error.message))
      console.error('删除域名失败:', error)
    }
  }
}

// 关闭对话框
const closeDialog = () => {
  showAddDialog.value = false
  editingDomain.value = null
  formData.value = {
    sourceType: '',
    url: '',
    usage: '主域名',
    priority: 1,
    notes: '',
    enabled: true
  }
  formRef.value?.resetFields()
}

// 提交表单
const submitForm = async () => {
  try {
    // 验证表单
    await formRef.value.validate()

    if (editingDomain.value) {
      // 编辑 - 将前端数据格式转换为后端需要的格式
      const updateData = {
        source_type: formData.value.sourceType,
        domain_url: formData.value.url,
        domain_type: formData.value.usage === '主域名' ? 'primary' :
                     formData.value.usage === '备用域名' ? 'backup' : 'other',
        priority: formData.value.priority || (formData.value.usage === '主域名' ? 1 : 999),
        enabled: formData.value.enabled ? 1 : 0,
        notes: formData.value.notes || null
      }

      const response = await api.updateDomain(formData.value.id, updateData)

      if (response.success) {
        // 重新加载数据确保显示最新状态
        await loadDomains()
        ElMessage.success('域名已更新: ' + formData.value.url)
        console.log('域名已更新:', formData.value.url)
      } else {
        throw new Error(response.message || '更新失败')
      }
    } else {
      // 添加
      const addData = {
        source_type: formData.value.sourceType,
        domain_url: formData.value.url,
        domain_type: formData.value.usage === '主域名' ? 'primary' :
                     formData.value.usage === '备用域名' ? 'backup' : 'other',
        priority: formData.value.priority || (formData.value.usage === '主域名' ? 1 : 999),
        enabled: formData.value.enabled ? 1 : 0,
        notes: formData.value.notes || null
      }

      const response = await api.addDomain(addData)

      if (response.success) {
        // 重新加载列表
        await loadDomains()
      }

      ElMessage.success('域名已添加: ' + formData.value.url)
      console.log('域名已添加:', formData.value.url)
    }

    updateStats()
    closeDialog()
  } catch (error) {
    if (error !== 'cancel' && error.message) {
      ElMessage.error('操作失败: ' + (error.response?.data?.error || error.message))
      console.error('提交失败:', error)
    }
  }
}

// 初始化
onMounted(() => {
  loadDomains()
})
</script>

<style scoped>
/* 紧凑布局优化 */
.domain-management-page {
  padding: 16px;
  width: 100%;
  max-width: none;
}

/* 页面头部 - 紧凑优化 */
.page-header {
  margin-bottom: 16px;
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

/* 玻璃卡片 - 紧凑优化 */
.glass-card {
  background: var(--glass-bg) !important;
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-color) !important;
  border-radius: 12px;
  margin-bottom: 16px;
}

/* 概览网格 - 紧凑优化 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  padding: 14px !important;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.stat-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
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
  margin-bottom: 3px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--tech-text-primary);
}

/* 面板头部 - 紧凑优化 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

/* 域名 URL 样式 */
.domain-url {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: var(--tech-text-primary);
}

/* 成功率样式 */
.success-rate {
  font-size: 13px;
  font-weight: 500;
  font-family: 'Courier New', monospace;
}

.rate-high {
  color: var(--success-color);
}

.rate-medium {
  color: var(--warning-color);
}

.rate-low {
  color: var(--error-color);
}

/* 总请求数样式 */
.total-requests {
  font-family: 'Courier New', monospace;
  color: var(--text-secondary);
}

/* 最后检查时间 */
.last-check {
  font-size: 13px;
  color: var(--text-secondary);
  font-family: 'Courier New', monospace;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-tertiary);
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

/* 表单提示 */
.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

/* 响应式 - 3级断点 */

/* 平板 (≤ 1024px) */
@media (max-width: 1024px) {
  .domain-management-page {
    padding: 12px;
  }

  .glass-card {
    padding: 14px !important;
    margin-bottom: 12px;
  }

  .overview-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
  }

  .stat-card {
    padding: 12px !important;
  }
}

/* 手机横屏 (≤ 768px) */
@media (max-width: 768px) {
  .domain-management-page {
    padding: 10px;
  }

  .page-title {
    font-size: 20px;
  }

  .page-desc {
    font-size: 12px;
  }

  .glass-card {
    padding: 12px !important;
    margin-bottom: 10px;
  }

  .overview-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .stat-card {
    padding: 10px !important;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }

  .stat-value {
    font-size: 18px;
  }

  .panel-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .panel-title {
    font-size: 15px;
  }

  .panel-actions {
    width: 100%;
  }
}

/* 手机竖屏 (≤ 480px) */
@media (max-width: 480px) {
  .domain-management-page {
    padding: 8px;
  }

  .page-title {
    font-size: 18px;
  }

  .glass-card {
    padding: 10px !important;
    border-radius: 10px;
  }

  .overview-grid {
    gap: 6px;
  }

  .stat-card {
    padding: 8px !important;
    gap: 10px;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .stat-value {
    font-size: 16px;
  }

  .stat-label {
    font-size: 11px;
  }

  .panel-header {
    gap: 10px;
  }

  .panel-actions {
    gap: 6px;
  }
}
</style>
