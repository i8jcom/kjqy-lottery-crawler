<template>
  <div class="data-table-wrapper">
    <!-- 加载状态骨架屏 -->
    <SkeletonTable v-if="loading" :columns="columns.length" :rows="5" />

    <!-- 空状态 -->
    <div v-else-if="!data || data.length === 0" class="table-empty">
      <div class="empty-icon">📭</div>
      <p>{{ emptyText || '暂无数据' }}</p>
    </div>

    <!-- 数据表格 -->
    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="{ sortable: column.sortable }"
              @click="column.sortable ? handleSort(column.key) : null"
            >
              <div class="th-content">
                <span>{{ column.label }}</span>
                <span v-if="column.sortable" class="sort-icon">
                  <span v-if="sortKey === column.key">
                    {{ sortOrder === 'asc' ? '↑' : '↓' }}
                  </span>
                  <span v-else class="sort-default">⇅</span>
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in sortedData" :key="index" @click="handleRowClick(row)">
            <td v-for="column in columns" :key="column.key">
              <!-- 自定义插槽 -->
              <slot
                v-if="$slots[`column-${column.key}`]"
                :name="`column-${column.key}`"
                :row="row"
                :value="row[column.key]"
              ></slot>
              <!-- 格式化函数 -->
              <span v-else-if="column.format">
                {{ column.format(row[column.key], row) }}
              </span>
              <!-- 默认显示 -->
              <span v-else>{{ row[column.key] }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SkeletonTable from './SkeletonTable.vue'

const props = defineProps({
  // 数据源
  data: {
    type: Array,
    default: () => []
  },
  // 列配置
  columns: {
    type: Array,
    required: true
    // 格式: [{ key: 'name', label: '名称', sortable: true, format: (val) => val }]
  },
  // 加载状态
  loading: {
    type: Boolean,
    default: false
  },
  // 空数据提示
  emptyText: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['row-click'])

// 排序状态
const sortKey = ref('')
const sortOrder = ref('asc') // 'asc' | 'desc'

// 处理排序
const handleSort = (key) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

// 排序后的数据
const sortedData = computed(() => {
  if (!sortKey.value) return props.data

  return [...props.data].sort((a, b) => {
    const aVal = a[sortKey.value]
    const bVal = b[sortKey.value]

    if (aVal === bVal) return 0

    const comparison = aVal > bVal ? 1 : -1
    return sortOrder.value === 'asc' ? comparison : -comparison
  })
})

// 行点击事件
const handleRowClick = (row) => {
  emit('row-click', row)
}
</script>

<style scoped>
.data-table-wrapper {
  width: 100%;
  min-height: 200px;
}

/* 加载状态 */
.table-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 空状态 */
.table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

/* 表格容器 */
.table-container {
  overflow-x: auto;
  border-radius: 12px;
  background: var(--glass-bg);
}

/* 数据表格 */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

/* 表头 */
.data-table thead {
  background: var(--glass-bg);
  border-bottom: 1px solid var(--border-color);
}

.data-table th {
  padding: 16px 20px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.data-table th.sortable:hover {
  background: var(--glass-bg-hover);
}

.th-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-icon {
  font-size: 12px;
  color: var(--text-secondary);
}

.sort-default {
  opacity: 0.3;
}

/* 表格主体 */
.data-table tbody tr {
  border-bottom: 1px solid var(--glass-bg);
  transition: background 0.2s;
}

.data-table tbody tr:hover {
  background: var(--glass-bg-hover);
  cursor: pointer;
}

.data-table td {
  padding: 14px 20px;
  color: var(--text-primary);
}

/* 响应式 */
@media (max-width: 768px) {
  .data-table {
    font-size: 12px;
  }

  .data-table th,
  .data-table td {
    padding: 12px 16px;
  }
}
</style>
