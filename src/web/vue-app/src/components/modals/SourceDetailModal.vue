<template>
  <div v-if="show" class="modal-overlay" @click.self="handleClose">
    <div class="modal-container">
      <!-- 模态框头部 -->
      <div class="modal-header">
        <h3 class="modal-title">{{ source ? '数据源详情' : '添加数据源' }}</h3>
        <button class="modal-close" @click="handleClose">✕</button>
      </div>

      <!-- 模态框内容 -->
      <div class="modal-body">
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>

        <div v-else-if="source" class="source-detail">
          <!-- 基本信息 -->
          <div class="info-section">
            <h4 class="section-title">基本信息</h4>

            <!-- ID（只读） -->
            <div class="form-group">
              <label class="form-label">📌 数据源ID</label>
              <div class="form-value">{{ source.id }}</div>
            </div>

            <!-- 名称 -->
            <div class="form-group">
              <label class="form-label">
                📝 数据源名称
                <span v-if="!editMode" class="editable-hint">✏️</span>
              </label>
              <div v-if="!editMode" class="form-value">{{ source.name }}</div>
              <input
                v-else
                v-model="editData.name"
                type="text"
                class="form-input"
                placeholder="请输入数据源名称"
              >
            </div>

            <!-- URL -->
            <div class="form-group">
              <label class="form-label">
                🌐 基础URL
                <span v-if="!editMode" class="editable-hint">✏️</span>
              </label>
              <div v-if="!editMode" class="form-value url-text">{{ source.baseUrl || source.url || '-' }}</div>
              <input
                v-else
                v-model="editData.url"
                type="url"
                class="form-input"
                placeholder="https://example.com"
              >
            </div>

            <!-- 类型和优先级 -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">🔧 数据源类型</label>
                <div class="form-value">
                  <span class="type-badge">{{ getTypeText(source.type) }}</span>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">
                  ⚡ 优先级
                  <span v-if="!editMode" class="editable-hint">✏️</span>
                </label>
                <div v-if="!editMode" class="form-value">{{ source.priority || 1 }}</div>
                <input
                  v-else
                  v-model.number="editData.priority"
                  type="number"
                  class="form-input"
                  min="1"
                  max="999"
                >
              </div>
            </div>

            <!-- 更新间隔 -->
            <div class="form-group">
              <label class="form-label">
                ⏱️ 更新间隔（秒）
                <span v-if="!editMode" class="editable-hint">✏️</span>
              </label>
              <div v-if="!editMode" class="form-value">{{ source.updateInterval || '-' }}</div>
              <input
                v-else
                v-model.number="editData.updateInterval"
                type="number"
                class="form-input"
                min="1"
                placeholder="例如: 60"
              >
            </div>

            <!-- 描述 -->
            <div class="form-group">
              <label class="form-label">
                💬 描述
                <span v-if="!editMode" class="editable-hint">✏️</span>
              </label>
              <div v-if="!editMode" class="form-value">{{ source.description || '暂无描述' }}</div>
              <textarea
                v-else
                v-model="editData.description"
                class="form-input"
                rows="3"
                placeholder="请输入数据源描述"
              ></textarea>
            </div>
          </div>

          <!-- 统计信息 -->
          <div class="info-section stats-section">
            <h4 class="section-title">📊 统计信息</h4>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-label">总请求数</div>
                <div class="stat-value">{{ (source.totalRequests || 0).toLocaleString() }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">成功请求数</div>
                <div class="stat-value">{{ (source.successRequests || 0).toLocaleString() }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">失败请求数</div>
                <div class="stat-value error">{{ (source.errors || 0).toLocaleString() }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">平均响应时间</div>
                <div class="stat-value">{{ source.responseTime || 0 }}ms</div>
              </div>
            </div>
            <div class="stats-footer">
              <div>最后检查: {{ formatTime(source.lastCheck) }}</div>
              <div>最后成功: {{ formatTime(source.lastSuccess) }}</div>
            </div>
          </div>

          <!-- 支持的彩种 -->
          <div v-if="source.lotteries && source.lotteries.length > 0" class="info-section">
            <h4 class="section-title">🎲 支持的彩种（{{ source.lotteries.length }}个）</h4>
            <div class="lotteries-list">
              <div
                v-for="(lottery, index) in source.lotteries"
                :key="lottery.lotCode"
                class="lottery-item"
              >
                <div class="lottery-index">{{ index + 1 }}</div>
                <div class="lottery-info">
                  <div class="lottery-name">{{ lottery.name || lottery.lotCode }}</div>
                  <div class="lottery-meta">
                    <span>彩种代码: {{ lottery.lotCode }}</span>
                    <span v-if="lottery.endpoint">接口路径: {{ lottery.endpoint }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 模态框底部操作 -->
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleClose">关闭</button>
        <button
          v-if="!editMode && source"
          class="btn btn-warning"
          @click="enterEditMode"
        >
          ✏️ 编辑
        </button>
        <template v-if="editMode">
          <button class="btn btn-secondary" @click="cancelEdit">取消</button>
          <button class="btn btn-primary" @click="saveChanges" :disabled="saving">
            {{ saving ? '保存中...' : '💾 保存' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import api from '../../services/api'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  sourceId: {
    type: [String, Number],
    default: null
  },
  sourceData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'updated'])

const loading = ref(false)
const source = ref(null)
const editMode = ref(false)
const editData = ref({})
const saving = ref(false)

// 监听显示状态
watch(() => props.show, async (newVal) => {
  if (newVal) {
    await loadSourceDetail()
  } else {
    // 重置状态
    source.value = null
    editMode.value = false
  }
})

// 加载数据源详情
const loadSourceDetail = async () => {
  try {
    loading.value = true

    // 优先使用传入的 sourceData
    if (props.sourceData) {
      source.value = props.sourceData
      initEditData()
      loading.value = false
      return
    }

    // 如果没有 sourceData，尝试从API获取
    if (props.sourceId) {
      const response = await api.getSourceDetail(props.sourceId)

      if (response.success) {
        source.value = response.data
        initEditData()
      }
    }
  } catch (error) {
    console.error('加载数据源详情失败:', error)
    // 如果API失败且有 sourceData，使用它
    if (props.sourceData) {
      source.value = props.sourceData
      initEditData()
    }
  } finally {
    loading.value = false
  }
}

// 初始化编辑数据
const initEditData = () => {
  if (!source.value) return

  editData.value = {
    name: source.value.name || '',
    url: source.value.baseUrl || source.value.url || '',
    priority: source.value.priority || 1,
    updateInterval: source.value.updateInterval || 15,
    description: source.value.description || ''
  }
}

// 进入编辑模式
const enterEditMode = () => {
  editMode.value = true
}

// 取消编辑
const cancelEdit = () => {
  editMode.value = false
  // 恢复原始数据
  editData.value = {
    name: source.value.name,
    url: source.value.baseUrl || source.value.url,
    priority: source.value.priority || 1,
    updateInterval: source.value.updateInterval || 15,
    description: source.value.description || ''
  }
}

// 保存更改
const saveChanges = async () => {
  try {
    saving.value = true
    const response = await api.updateSource(props.sourceId, {
      name: editData.value.name,
      baseUrl: editData.value.url,
      priority: editData.value.priority,
      updateInterval: editData.value.updateInterval,
      description: editData.value.description
    })

    if (response.success) {
      // 更新本地数据
      source.value = {
        ...source.value,
        name: editData.value.name,
        url: editData.value.url,
        baseUrl: editData.value.url,
        priority: editData.value.priority,
        updateInterval: editData.value.updateInterval,
        description: editData.value.description
      }

      editMode.value = false
      emit('updated')

      // 显示成功提示（可以添加toast组件）
      console.log('✅ 数据源更新成功')
    }
  } catch (error) {
    console.error('保存失败:', error)
  } finally {
    saving.value = false
  }
}

// 关闭模态框
const handleClose = () => {
  if (editMode.value) {
    if (confirm('确定要关闭吗？未保存的更改将丢失')) {
      emit('close')
    }
  } else {
    emit('close')
  }
}

// 获取类型文本
const getTypeText = (type) => {
  const typeMap = {
    'api': 'API接口',
    'web': '网页爬取',
    'database': '数据库',
    'file': '文件源'
  }
  return typeMap[type] || type
}

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return '-'
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-container {
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  max-width: 800px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--border-color);
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--glass-border);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.source-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
}

.section-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.editable-hint {
  color: var(--warning-color);
  font-size: 12px;
  margin-left: 4px;
}

.form-value {
  padding: 10px 12px;
  background: var(--glass-bg);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
}

.url-text {
  word-break: break-all;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--border-color);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  background: var(--glass-border-strong);
  border-color: #667eea;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.type-badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 8px;
  color: #667eea;
  font-size: 13px;
}

.stats-section {
  background: rgba(102, 126, 234, 0.05);
  border-left: 3px solid #667eea;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
}

.stat-value.error {
  color: var(--error-color);
}

.stats-footer {
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lotteries-list {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lottery-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--glass-bg);
  border-left: 3px solid #667eea;
  border-radius: 8px;
}

.lottery-index {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  font-weight: 600;
}

.lottery-info {
  flex: 1;
}

.lottery-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.lottery-meta {
  font-size: 12px;
  color: var(--text-tertiary);
  display: flex;
  gap: 16px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--border-color);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--glass-border-strong);
}

.btn-warning {
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: var(--warning-color);
}

.btn-warning:hover {
  background: rgba(245, 158, 11, 0.3);
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 响应式 */
@media (max-width: 768px) {
  .modal-container {
    width: 95%;
    max-height: 95vh;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
