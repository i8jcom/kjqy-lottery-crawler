<template>
  <div class="tanstack-table-container">
    <!-- 加载状态 -->
    <div v-if="loading" class="tanstack-table-loading">
      <div class="loading-spinner"></div>
      <p>{{ loadingText }}</p>
    </div>

    <!-- 表格内容 -->
    <div v-else class="tanstack-table-wrapper">
      <table class="tanstack-table">
        <thead class="tanstack-table__header">
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            class="tanstack-table__header-row"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :style="getHeaderStyle(header)"
              :class="[
                'tanstack-table__header-cell',
                { 'tanstack-table__header-cell--sortable': header.column.getCanSort() }
              ]"
              @click="header.column.getCanSort() ? header.column.getToggleSortingHandler()($event) : null"
            >
              <div class="tanstack-table__header-content">
                <component
                  :is="renderContent(header.column.columnDef.header, header.getContext())"
                  v-if="!header.isPlaceholder"
                />
                <span v-if="header.column.getCanSort()" class="tanstack-table__sort-icon">
                  {{ getSortIcon(header.column) }}
                </span>
              </div>
            </th>
          </tr>
        </thead>

        <tbody class="tanstack-table__body">
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :class="[
              'tanstack-table__row',
              { 'tanstack-table__row--selected': row.getIsSelected() }
            ]"
            @click="handleRowClick(row)"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              :style="getCellStyle(cell)"
              class="tanstack-table__cell"
            >
              <component :is="renderContent(cell.column.columnDef.cell, cell.getContext())" />
            </td>
          </tr>

          <!-- 空数据提示 -->
          <tr v-if="table.getRowModel().rows.length === 0" class="tanstack-table__empty">
            <td :colspan="table.getAllColumns().length" class="tanstack-table__empty-cell">
              <div class="tanstack-table__empty-content">
                <span class="tanstack-table__empty-icon">📭</span>
                <p class="tanstack-table__empty-text">{{ emptyText }}</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue'
import { useTanStackTable } from '../../composables/useTanStackTable'
import { useResponsiveColumns } from '../../composables/useResponsiveColumns'

// Helper function to render cell/header content
const renderContent = (content, context) => {
  if (typeof content === 'function') {
    return content(context)
  }
  return content
}

const props = defineProps({
  // 列配置
  columns: {
    type: Array,
    required: true
  },

  // 表格数据
  data: {
    type: Array,
    required: true
  },

  // 加载状态
  loading: {
    type: Boolean,
    default: false
  },

  // 加载文本
  loadingText: {
    type: String,
    default: '加载中...'
  },

  // 空数据文本
  emptyText: {
    type: String,
    default: '暂无数据'
  },

  // 是否启用排序
  enableSorting: {
    type: Boolean,
    default: true
  },

  // 是否启用过滤
  enableFiltering: {
    type: Boolean,
    default: false
  },

  // 是否启用分页
  enablePagination: {
    type: Boolean,
    default: false
  },

  // 是否启用行选择
  enableRowSelection: {
    type: Boolean,
    default: false
  },

  // 响应式配置
  responsiveConfig: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['rowClick', 'selectionChange'])

// 使用响应式列管理
const { visibleColumns, screenSize } = useResponsiveColumns(
  computed(() => props.columns),
  props.responsiveConfig
)

// 使用 TanStack Table
const { table } = useTanStackTable({
  columns: visibleColumns,
  data: computed(() => props.data),
  enableSorting: props.enableSorting,
  enableFiltering: props.enableFiltering,
  enablePagination: props.enablePagination,
  enableRowSelection: props.enableRowSelection
})

// 获取排序图标
const getSortIcon = (column) => {
  const sortDirection = column.getIsSorted()
  if (!sortDirection) return '⇅'
  return sortDirection === 'asc' ? '↑' : '↓'
}

// 获取表头样式
const getHeaderStyle = (header) => {
  const columnDef = header.column.columnDef
  return {
    width: columnDef.width ? `${columnDef.width}px` : undefined,
    minWidth: columnDef.minWidth ? `${columnDef.minWidth}px` : undefined,
    maxWidth: columnDef.maxWidth ? `${columnDef.maxWidth}px` : undefined
  }
}

// 获取单元格样式
const getCellStyle = (cell) => {
  const columnDef = cell.column.columnDef
  return {
    width: columnDef.width ? `${columnDef.width}px` : undefined,
    minWidth: columnDef.minWidth ? `${columnDef.minWidth}px` : undefined,
    maxWidth: columnDef.maxWidth ? `${columnDef.maxWidth}px` : undefined
  }
}

// 处理行点击
const handleRowClick = (row) => {
  emit('rowClick', row.original)
}
</script>

<style scoped>
/* ========================================
   表格容器
   ======================================== */

.tanstack-table-container {
  position: relative;
  width: 100%;
}

/* ========================================
   加载状态
   ======================================== */

.tanstack-table-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl);
  color: var(--tech-text-secondary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--tech-border-subtle);
  border-top-color: var(--tech-cyan);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  box-shadow: var(--glow-cyan);
  margin-bottom: var(--spacing-md);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ========================================
   表格包装器
   ======================================== */

.tanstack-table-wrapper {
  overflow-x: auto;
  border-radius: var(--radius-lg);
  background: var(--tech-bg-secondary);
  border: 2px solid;
  border-image: var(--gradient-cyber-accent) 1;
}

/* 滚动条样式 */
.tanstack-table-wrapper::-webkit-scrollbar {
  height: 8px;
}

.tanstack-table-wrapper::-webkit-scrollbar-track {
  background: var(--tech-bg-tertiary);
  border-radius: var(--radius-sm);
}

.tanstack-table-wrapper::-webkit-scrollbar-thumb {
  background: var(--gradient-cyber-primary);
  border-radius: var(--radius-sm);
  box-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
}

/* ========================================
   表格主体
   ======================================== */

.tanstack-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

/* ========================================
   表头
   ======================================== */

.tanstack-table__header {
  background: linear-gradient(
    135deg,
    rgba(0, 255, 255, 0.1) 0%,
    rgba(168, 85, 247, 0.1) 100%
  );
  border-bottom: 2px solid;
  border-image: var(--gradient-cyber-accent) 1;
}

.tanstack-table__header-row {
  /* Header row styles */
}

.tanstack-table__header-cell {
  padding: var(--spacing-md) var(--spacing-md);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--tech-text-primary);
  white-space: nowrap;
  user-select: none;
  position: relative;
}

.tanstack-table__header-cell--sortable {
  cursor: pointer;
  transition: all var(--transition-base);
}

.tanstack-table__header-cell--sortable:hover {
  background: rgba(0, 255, 255, 0.05);
  color: var(--tech-cyan);
}

.tanstack-table__header-content {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.tanstack-table__sort-icon {
  display: inline-flex;
  align-items: center;
  color: var(--tech-cyan);
  font-size: 12px;
  opacity: 0.6;
}

.tanstack-table__header-cell--sortable:hover .tanstack-table__sort-icon {
  opacity: 1;
}

/* ========================================
   表体
   ======================================== */

.tanstack-table__body {
  /* Body styles */
}

.tanstack-table__row {
  border-bottom: 1px solid var(--tech-border-subtle);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.tanstack-table__row:hover {
  background: linear-gradient(
    90deg,
    rgba(0, 255, 255, 0.05) 0%,
    rgba(168, 85, 247, 0.05) 100%
  );
}

.tanstack-table__row--selected {
  background: rgba(0, 255, 255, 0.1);
  border-left: 3px solid var(--tech-cyan);
}

.tanstack-table__cell {
  padding: var(--spacing-md) var(--spacing-md);
  color: var(--tech-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ========================================
   空数据状态
   ======================================== */

.tanstack-table__empty {
  /* Empty row */
}

.tanstack-table__empty-cell {
  padding: 0;
}

.tanstack-table__empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-3xl);
  color: var(--tech-text-tertiary);
}

.tanstack-table__empty-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
  opacity: 0.5;
}

.tanstack-table__empty-text {
  margin: 0;
  font-size: var(--font-size-base);
}

/* ========================================
   响应式调整
   ======================================== */

@media (max-width: 768px) {
  .tanstack-table {
    font-size: var(--font-size-xs);
  }

  .tanstack-table__header-cell,
  .tanstack-table__cell {
    padding: var(--spacing-sm) var(--spacing-sm);
  }
}

/* ========================================
   无障碍：禁用动画
   ======================================== */

@media (prefers-reduced-motion: reduce) {
  .loading-spinner {
    animation: none !important;
  }

  .tanstack-table__row,
  .tanstack-table__header-cell--sortable {
    transition: none !important;
  }
}
</style>
