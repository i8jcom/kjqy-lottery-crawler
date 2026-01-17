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
      <div class="stat-card glass-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
          <span>🌍</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">总域名数</div>
          <div class="stat-value">{{ domainStats.total || 0 }}</div>
        </div>
      </div>

      <div class="stat-card glass-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, var(--success-color), #38f9d7);">
          <span>✅</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">可用</div>
          <div class="stat-value">{{ domainStats.available || 0 }}</div>
        </div>
      </div>

      <div class="stat-card glass-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, #fa709a, #fee140);">
          <span>❌</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">不可用</div>
          <div class="stat-value">{{ domainStats.unavailable || 0 }}</div>
        </div>
      </div>

      <div class="stat-card glass-card">
        <div class="stat-icon" style="background: linear-gradient(135deg, var(--info-color), #00f2fe);">
          <span>📊</span>
        </div>
        <div class="stat-content">
          <div class="stat-label">成功率</div>
          <div class="stat-value">{{ domainStats.successRate || '0%' }}</div>
        </div>
      </div>
    </div>

    <!-- 域名列表 -->
    <div class="domains-panel glass-card">
      <div class="panel-header">
        <h3 class="panel-title">域名列表</h3>
        <div class="panel-actions">
          <button class="btn-check-all" @click="checkAllDomains" :disabled="checkingAll">
            <span :class="{ 'rotating': checkingAll }">🔍</span>
            <span>{{ checkingAll ? '检查中...' : '全部检查' }}</span>
          </button>
          <button class="btn-add" @click="showAddModal = true">
            <span>➕</span>
            <span>添加域名</span>
          </button>
        </div>
      </div>

      <div class="domains-table">
        <table>
          <thead>
            <tr>
              <th>数据源</th>
              <th>域名</th>
              <th>类型</th>
              <th>用途</th>
              <th>状态</th>
              <th>响应时间</th>
              <th>成功率</th>
              <th>总请求数</th>
              <th>连续失败</th>
              <th>最后检查</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="domains.length === 0">
              <td colspan="11" class="empty-row">暂无域名配置</td>
            </tr>
            <tr v-for="domain in domains" :key="domain.id">
              <td>
                <span :class="['source-badge', `source-${domain.sourceType}`]">
                  {{ getSourceName(domain.sourceType) }}
                </span>
              </td>
              <td>
                <span class="domain-url">{{ domain.url }}</span>
              </td>
              <td>
                <span :class="['type-badge', `type-${domain.type.toLowerCase()}`]">
                  {{ domain.type }}
                </span>
              </td>
              <td>
                <span class="usage">{{ domain.usage }}</span>
              </td>
              <td>
                <span :class="['status-badge', `status-${domain.status}`]">
                  {{ getStatusText(domain.status) }}
                </span>
              </td>
              <td>
                <span class="response-time">{{ domain.responseTime || '-' }}</span>
              </td>
              <td>
                <span :class="['success-rate', getSuccessRateClass(domain.successRate)]">
                  {{ domain.successRate || '-' }}
                </span>
              </td>
              <td>
                <span class="total-requests">
                  {{ formatNumber(domain.totalRequests) }}
                </span>
              </td>
              <td>
                <span :class="['consecutive-failures', getFailureClass(domain.consecutiveFailures)]">
                  {{ domain.consecutiveFailures || 0 }}
                </span>
              </td>
              <td>
                <span class="last-check">{{ formatTime(domain.lastCheck) }}</span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn-action btn-check" @click="checkDomain(domain.id)">
                    <span>🔍</span>
                  </button>
                  <button class="btn-action btn-edit" @click="editDomain(domain)">
                    <span>✏️</span>
                  </button>
                  <button class="btn-action btn-delete" @click="deleteDomain(domain.id)">
                    <span>🗑️</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 添加/编辑模态框 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ showEditModal ? '编辑域名' : '添加域名' }}</h3>
          <button class="btn-close" @click="closeModal">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>数据源类型 *</label>
            <select v-model="formData.sourceType" class="form-select">
              <option value="">请选择数据源</option>
              <option value="speedylot88">SpeedyLot88 (极速彩)</option>
              <option value="sglotteries">SG Lotteries (SG彩)</option>
              <option value="auluckylotteries">AU Lucky Lotteries (澳洲幸运彩)</option>
              <option value="luckysscai">LuckySscai (幸运时时彩)</option>
              <option value="luckylottoz">LuckyLottoz (幸运飞艇)</option>
              <option value="cwl">中国福彩官网</option>
              <option value="sportslottery">中国体彩官网</option>
              <option value="hkjc">香港六合彩 (On.cc)</option>
              <option value="uklottos">UK Lottos (英国乐透)</option>
              <option value="taiwanlottery">台湾彩票官网 🇹🇼</option>
            </select>
          </div>

          <div class="form-group">
            <label>域名 URL *</label>
            <input
              v-model="formData.url"
              type="text"
              class="form-input"
              placeholder="https://example.com"
            />
          </div>

          <div class="form-group">
            <label>域名用途 *</label>
            <select v-model="formData.usage" class="form-select">
              <option value="主域名">主域名</option>
              <option value="备用域名">备用域名</option>
            </select>
          </div>

          <div class="form-group">
            <label>优先级</label>
            <input
              v-model.number="formData.priority"
              type="number"
              class="form-input"
              placeholder="数字越小优先级越高，如: 1"
            />
            <small class="form-hint">主域名通常为1，备用域名为999</small>
          </div>

          <div class="form-group">
            <label>备注</label>
            <textarea
              v-model="formData.notes"
              class="form-textarea"
              rows="3"
              placeholder="域名说明、来源等"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input v-model="formData.enabled" type="checkbox" />
              <span>启用此域名</span>
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="closeModal">取消</button>
          <button class="btn-submit" @click="submitForm">
            {{ showEditModal ? '保存' : '添加' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../services/api'
import { useToast } from '../composables/useToast'

const toast = useToast()

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

// 模态框状态
const showAddModal = ref(false)
const showEditModal = ref(false)

// 表单数据
const formData = ref({
  sourceType: '',
  url: '',
  usage: '主域名',
  priority: 1,
  notes: '',
  enabled: true
})

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

// 获取成功率样式类
const getSuccessRateClass = (rate) => {
  if (!rate || rate === '-') return ''
  const value = parseFloat(rate)
  if (value >= 95) return 'rate-high'
  if (value >= 80) return 'rate-medium'
  return 'rate-low'
}

// 格式化数字（添加千位分隔符）
const formatNumber = (num) => {
  if (!num && num !== 0) return '-'
  return num.toLocaleString('en-US')
}

// 获取连续失败次数样式类
const getFailureClass = (failures) => {
  if (!failures || failures === 0) return 'failure-none'
  if (failures >= 10) return 'failure-critical'
  if (failures >= 5) return 'failure-high'
  if (failures >= 3) return 'failure-medium'
  return 'failure-low'
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
    toast.error('加载域名列表失败: ' + (error.message || '未知错误'))
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
        enabled: true
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
        enabled: true
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
        enabled: true
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
        enabled: false
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
        enabled: true
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

    toast.info('正在检查域名健康状态...')

    // 调用API检查健康状态
    const response = await api.checkDomain(id)

    // 1秒后刷新数据（无感刷新）
    setTimeout(async () => {
      await loadDomains()
      toast.success('域名健康检查完成')
    }, 1000)
  } catch (error) {
    toast.error('检查域名失败: ' + (error.message || '未知错误'))
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

    toast.info(`正在检查所有域名 (共${domains.value.length}个)...`)

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
      toast.success('所有域名健康检查完成')
    }, 1000)
  } catch (error) {
    toast.error('批量检查失败: ' + (error.message || '未知错误'))
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
  showEditModal.value = true
}

// 删除域名
const deleteDomain = async (id) => {
  if (!confirm('确定要删除这个域名吗？')) {
    return
  }

  try {
    await api.deleteDomain(id)

    // 立即从列表中移除（无感刷新）
    domains.value = domains.value.filter(d => d.id !== id)
    updateStats()

    toast.success('域名已删除')
    console.log('域名已删除:', id)
  } catch (error) {
    toast.error('删除失败: ' + (error.response?.data?.error || error.message))
    console.error('删除域名失败:', error)
  }
}

// 关闭模态框
const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  formData.value = {
    sourceType: '',
    url: '',
    usage: '主域名',
    priority: 1,
    notes: '',
    enabled: true
  }
}

// 提交表单
const submitForm = async () => {
  // 验证必填字段
  if (!formData.value.sourceType) {
    toast.warning('请选择数据源类型')
    return
  }
  if (!formData.value.url) {
    toast.warning('请填写域名 URL')
    return
  }
  if (!formData.value.usage) {
    toast.warning('请选择域名用途')
    return
  }

  try {
    if (showEditModal.value) {
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
        toast.success('域名已更新: ' + formData.value.url)
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

      toast.success('域名已添加: ' + formData.value.url)
      console.log('域名已添加:', formData.value.url)
    }

    updateStats()
    closeModal()
  } catch (error) {
    toast.error('操作失败: ' + (error.response?.data?.error || error.message))
    console.error('提交失败:', error)
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

/* 概览网格 - 紧凑优化 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px !important;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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
  color: var(--text-secondary);
  margin-bottom: 3px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 面板头部 - 紧凑优化 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.panel-actions {
  display: flex;
  gap: 8px;
}

/* 按钮 - 紧凑优化 */
.btn-check-all,
.btn-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-check-all {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.btn-check-all:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
  transform: translateY(-2px);
}

.btn-check-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-add {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-add:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 域名表格 - 紧凑优化 */
.domains-table {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead tr {
  border-bottom: 1px solid var(--border-color);
}

th {
  text-align: left;
  padding: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

td {
  padding: 12px 10px;
  font-size: 13px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--glass-bg);
}

.empty-row {
  text-align: center;
  color: var(--text-tertiary);
  padding: 30px;
}

.domain-url {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: var(--text-primary);
}

/* 数据源徽章 */
.source-badge {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(102, 126, 234, 0.15);
  border: 1px solid rgba(102, 126, 234, 0.3);
  color: #667eea;
}

/* 不同数据源的颜色区分 */
.source-cwl {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.source-speedylot88 {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.source-sglotteries {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.source-luckysscai {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
  color: var(--warning-color);
}

.source-luckylottoz {
  background: rgba(168, 85, 247, 0.15);
  border-color: rgba(168, 85, 247, 0.3);
  color: #a855f7;
}

.type-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.type-https {
  background: rgba(67, 233, 123, 0.1);
  border: 1px solid rgba(67, 233, 123, 0.3);
  color: var(--success-color);
}

.type-http {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--warning-color);
}

.usage {
  font-size: 13px;
  color: var(--text-secondary);
}

.status-badge {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.status-available {
  background: rgba(67, 233, 123, 0.1);
  border: 1px solid rgba(67, 233, 123, 0.3);
  color: var(--success-color);
}

.status-unavailable {
  background: rgba(156, 163, 175, 0.1);
  border: 1px solid rgba(156, 163, 175, 0.3);
  color: #9ca3af;
}

.status-checking {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.status-warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--warning-color);
}

.status-error {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: var(--error-color);
}

.response-time,
.last-check {
  font-size: 13px;
  color: var(--text-secondary);
  font-family: 'Courier New', monospace;
}

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

/* 连续失败次数样式 */
.consecutive-failures {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
}

.failure-none {
  color: var(--success-color);
  background: rgba(67, 233, 123, 0.1);
}

.failure-low {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.failure-medium {
  color: var(--warning-color);
  background: rgba(245, 158, 11, 0.1);
}

.failure-high {
  color: var(--error-color);
  background: rgba(255, 107, 107, 0.1);
}

.failure-critical {
  color: #ff3333;
  background: rgba(255, 51, 51, 0.2);
  animation: pulse-failure 2s ease-in-out infinite;
}

@keyframes pulse-failure {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-action {
  padding: 6px 10px;
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action:hover {
  background: var(--border-color);
}

.btn-check:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}

.btn-edit:hover {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.btn-delete:hover {
  background: rgba(255, 107, 107, 0.1);
  border-color: rgba(255, 107, 107, 0.3);
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: rgba(30, 30, 40, 0.95);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 0;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 模态框 - 紧凑优化 */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
}

.btn-close {
  width: 28px;
  height: 28px;
  border: none;
  background: var(--glass-bg);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close:hover {
  background: rgba(255, 107, 107, 0.1);
  color: var(--error-color);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 8px 10px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.2s;
  font-family: inherit;
}

/* 下拉选项样式 */
.form-select option {
  background: #2d3748;
  color: var(--text-primary);
  padding: 8px 12px;
}

.form-select option:hover,
.form-select option:checked {
  background: #4a5568;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: rgba(102, 126, 234, 0.5);
  background: var(--glass-bg);
}

.form-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.btn-cancel,
.btn-submit {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.btn-cancel:hover {
  background: var(--border-color);
}

.btn-submit {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 响应式 - 3级断点 */

/* 平板 (≤ 1024px) */
@media (max-width: 1024px) {
  .domain-management-page {
    padding: 12px;
  }

  .glass-card {
    padding: 14px;
    margin-bottom: 12px;
  }

  .overview-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
  }

  .stat-card {
    padding: 12px !important;
  }

  .panel-header {
    margin-bottom: 14px;
  }

  .domains-table {
    font-size: 12px;
  }

  th {
    padding: 8px;
  }

  td {
    padding: 10px 8px;
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
    padding: 12px;
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

  .btn-check-all,
  .btn-add {
    flex: 1;
    font-size: 12px;
  }

  .domains-table {
    font-size: 11px;
  }

  th {
    padding: 8px 6px;
    font-size: 11px;
  }

  td {
    padding: 10px 6px;
    font-size: 12px;
  }

  .action-buttons {
    gap: 6px;
  }

  .btn-action {
    padding: 5px 8px;
    font-size: 13px;
  }

  .modal-content {
    width: 95%;
  }

  .modal-header {
    padding: 14px 16px;
  }

  .modal-header h3 {
    font-size: 15px;
  }

  .modal-body {
    padding: 16px;
  }

  .modal-footer {
    padding: 14px 16px;
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
    padding: 10px;
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

  .btn-check-all,
  .btn-add {
    padding: 5px 10px;
    font-size: 11px;
  }

  .domains-table {
    font-size: 10px;
  }

  th {
    padding: 6px 4px;
    font-size: 10px;
  }

  td {
    padding: 8px 4px;
    font-size: 11px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 4px;
  }

  .btn-action {
    padding: 4px 6px;
    width: 100%;
  }

  .modal-content {
    width: 98%;
  }

  .modal-header {
    padding: 12px;
  }

  .modal-body {
    padding: 12px;
  }

  .form-group {
    margin-bottom: 12px;
  }

  .modal-footer {
    padding: 12px;
  }
}
</style>
