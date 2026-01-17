/**
 * TanStack Table 组合式函数
 * TanStack Table Composable
 */

import { ref, computed } from 'vue'
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getExpandedRowModel
} from '@tanstack/vue-table'

/**
 * TanStack Table 配置助手
 * @param {Object} options - 表格配置选项
 * @returns {Object} - 表格实例和辅助方法
 */
export function useTanStackTable(options = {}) {
  const {
    columns = [],
    data = [],
    enableSorting = true,
    enableFiltering = true,
    enablePagination = false,
    enableRowSelection = false,
    enableExpanding = false,
    initialPageSize = 10,
    ...otherOptions
  } = options

  // 排序状态
  const sorting = ref([])

  // 过滤状态
  const columnFilters = ref([])
  const globalFilter = ref('')

  // 分页状态
  const pagination = ref({
    pageIndex: 0,
    pageSize: initialPageSize
  })

  // 行选择状态
  const rowSelection = ref({})

  // 展开状态
  const expanded = ref({})

  // 创建表格实例
  const table = useVueTable({
    get data() {
      return data.value || []
    },
    get columns() {
      return columns.value || columns
    },
    state: {
      get sorting() {
        return sorting.value
      },
      get columnFilters() {
        return columnFilters.value
      },
      get globalFilter() {
        return globalFilter.value
      },
      get pagination() {
        return pagination.value
      },
      get rowSelection() {
        return rowSelection.value
      },
      get expanded() {
        return expanded.value
      }
    },
    onSortingChange: updaterOrValue => {
      sorting.value =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(sorting.value)
          : updaterOrValue
    },
    onColumnFiltersChange: updaterOrValue => {
      columnFilters.value =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(columnFilters.value)
          : updaterOrValue
    },
    onGlobalFilterChange: updaterOrValue => {
      globalFilter.value =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(globalFilter.value)
          : updaterOrValue
    },
    onPaginationChange: updaterOrValue => {
      pagination.value =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(pagination.value)
          : updaterOrValue
    },
    onRowSelectionChange: updaterOrValue => {
      rowSelection.value =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(rowSelection.value)
          : updaterOrValue
    },
    onExpandedChange: updaterOrValue => {
      expanded.value =
        typeof updaterOrValue === 'function'
          ? updaterOrValue(expanded.value)
          : updaterOrValue
    },
    getCoreRowModel: getCoreRowModel(),
    ...(enableSorting && { getSortedRowModel: getSortedRowModel() }),
    ...(enableFiltering && { getFilteredRowModel: getFilteredRowModel() }),
    ...(enablePagination && { getPaginationRowModel: getPaginationRowModel() }),
    ...(enableExpanding && { getExpandedRowModel: getExpandedRowModel() }),
    enableRowSelection,
    ...otherOptions
  })

  // 辅助方法：重置排序
  const resetSorting = () => {
    sorting.value = []
  }

  // 辅助方法：重置过滤
  const resetFilters = () => {
    columnFilters.value = []
    globalFilter.value = ''
  }

  // 辅助方法：重置分页
  const resetPagination = () => {
    pagination.value = {
      pageIndex: 0,
      pageSize: initialPageSize
    }
  }

  // 辅助方法：重置行选择
  const resetRowSelection = () => {
    rowSelection.value = {}
  }

  // 辅助方法：重置所有状态
  const resetAll = () => {
    resetSorting()
    resetFilters()
    resetPagination()
    resetRowSelection()
  }

  // 辅助方法：获取选中的行
  const getSelectedRows = computed(() => {
    return table.getSelectedRowModel().rows.map(row => row.original)
  })

  // 辅助方法：获取选中行的数量
  const selectedRowCount = computed(() => {
    return Object.keys(rowSelection.value).length
  })

  // 辅助方法：全选/取消全选
  const toggleAllRowsSelected = () => {
    const allSelected = table.getIsAllRowsSelected()
    table.toggleAllRowsSelected(!allSelected)
  }

  // 辅助方法：导出数据（支持导出当前过滤/排序后的数据）
  const exportData = (type = 'all') => {
    let rows = []

    switch (type) {
      case 'selected':
        rows = getSelectedRows.value
        break
      case 'filtered':
        rows = table.getFilteredRowModel().rows.map(row => row.original)
        break
      case 'all':
      default:
        rows = table.getCoreRowModel().rows.map(row => row.original)
        break
    }

    return rows
  }

  // 辅助方法：转换为 CSV
  const exportToCSV = (type = 'all', filename = 'export.csv') => {
    const rows = exportData(type)
    if (rows.length === 0) return

    // 获取列标题
    const headers = table.getAllColumns()
      .filter(col => col.getIsVisible())
      .map(col => col.columnDef.header)

    // 获取数据行
    const csvRows = rows.map(row => {
      return table.getAllColumns()
        .filter(col => col.getIsVisible())
        .map(col => {
          const value = row[col.columnDef.accessorKey] || ''
          // 处理包含逗号和引号的值
          return `"${String(value).replace(/"/g, '""')}"`
        })
        .join(',')
    })

    // 组合 CSV 内容
    const csvContent = [
      headers.join(','),
      ...csvRows
    ].join('\n')

    // 下载文件
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  // 辅助方法：转换为 JSON
  const exportToJSON = (type = 'all', filename = 'export.json') => {
    const rows = exportData(type)
    const jsonContent = JSON.stringify(rows, null, 2)

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return {
    // 表格实例
    table,

    // 状态
    sorting,
    columnFilters,
    globalFilter,
    pagination,
    rowSelection,
    expanded,

    // 计算属性
    getSelectedRows,
    selectedRowCount,

    // 方法
    resetSorting,
    resetFilters,
    resetPagination,
    resetRowSelection,
    resetAll,
    toggleAllRowsSelected,
    exportData,
    exportToCSV,
    exportToJSON
  }
}

/**
 * 创建排序列配置
 */
export function createSortableColumn(accessorKey, header, options = {}) {
  return {
    accessorKey,
    header,
    enableSorting: true,
    ...options
  }
}

/**
 * 创建可过滤列配置
 */
export function createFilterableColumn(accessorKey, header, options = {}) {
  return {
    accessorKey,
    header,
    enableColumnFilter: true,
    ...options
  }
}

/**
 * 获取排序图标（用于 UI）
 */
export function getSortIcon(column) {
  const sortDirection = column.getIsSorted()

  if (!sortDirection) {
    return '⇅' // 未排序
  }

  return sortDirection === 'asc' ? '↑' : '↓'
}

/**
 * 获取分页信息文本
 */
export function getPaginationInfo(table) {
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const pageSize = table.getState().pagination.pageSize
  const totalRows = table.getFilteredRowModel().rows.length

  const startRow = (currentPage - 1) * pageSize + 1
  const endRow = Math.min(currentPage * pageSize, totalRows)

  return {
    currentPage,
    totalPages,
    pageSize,
    totalRows,
    startRow,
    endRow,
    text: `显示 ${startRow}-${endRow} 条，共 ${totalRows} 条`
  }
}

/**
 * 表格配置预设
 */
export const tablePresets = {
  // 基础表格
  basic: {
    enableSorting: false,
    enableFiltering: false,
    enablePagination: false,
    enableRowSelection: false
  },

  // 标准表格（排序 + 过滤）
  standard: {
    enableSorting: true,
    enableFiltering: true,
    enablePagination: false,
    enableRowSelection: false
  },

  // 高级表格（所有功能）
  advanced: {
    enableSorting: true,
    enableFiltering: true,
    enablePagination: true,
    enableRowSelection: true,
    initialPageSize: 10
  },

  // 数据管理表格（选择 + 分页）
  management: {
    enableSorting: true,
    enableFiltering: true,
    enablePagination: true,
    enableRowSelection: true,
    initialPageSize: 20
  }
}

/**
 * 列宽度预设
 */
export const columnWidthPresets = {
  xs: { minWidth: 60, maxWidth: 80 },
  sm: { minWidth: 80, maxWidth: 120 },
  md: { minWidth: 120, maxWidth: 200 },
  lg: { minWidth: 200, maxWidth: 300 },
  xl: { minWidth: 300, maxWidth: 500 },
  auto: { minWidth: 100 },
  fixed: (width) => ({ width, minWidth: width, maxWidth: width })
}
