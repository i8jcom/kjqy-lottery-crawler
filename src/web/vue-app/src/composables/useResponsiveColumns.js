/**
 * 响应式列管理组合式函数
 * Responsive Columns Management Composable
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'

/**
 * 响应式列管理
 * @param {Array} columns - 列配置数组
 * @param {Object} config - 响应式配置
 * @returns {Object} - 响应式列和屏幕尺寸
 */
export function useResponsiveColumns(columns, config = {}) {
  // 当前屏幕尺寸类型
  const screenSize = ref('desktop')

  // 是否显示列可见性控制器
  const showColumnVisibility = ref(false)

  // 用户手动隐藏的列（键为列的 accessorKey）
  const manuallyHiddenColumns = ref(new Set())

  // 断点配置（可通过 config 覆盖）
  const breakpoints = {
    mobile: config.mobileBreakpoint || 768,
    tablet: config.tabletBreakpoint || 1200,
    ...config.breakpoints
  }

  // 列优先级映射：定义每种屏幕尺寸下显示哪些优先级的列
  const priorityMap = {
    mobile: config.mobilePriorities || ['core'],
    tablet: config.tabletPriorities || ['core', 'secondary'],
    desktop: config.desktopPriorities || ['core', 'secondary', 'optional'],
    ...config.priorityMap
  }

  /**
   * 根据屏幕尺寸过滤可见列
   */
  const visibleColumns = computed(() => {
    // 获取当前屏幕尺寸允许的优先级
    const allowedPriorities = priorityMap[screenSize.value]

    return columns.filter(col => {
      // 如果列没有设置 priority，默认为 'core'
      const priority = col.priority || 'core'

      // 检查列是否在允许的优先级内
      const isInPriority = allowedPriorities.includes(priority)

      // 检查列是否被用户手动隐藏
      const isManuallyHidden = manuallyHiddenColumns.value.has(
        col.accessorKey || col.id
      )

      // 列必须在优先级内且未被手动隐藏
      return isInPriority && !isManuallyHidden
    })
  })

  /**
   * 所有可用列（用于列可见性控制）
   */
  const availableColumns = computed(() => {
    return columns.map(col => ({
      id: col.accessorKey || col.id,
      header: col.header,
      priority: col.priority || 'core',
      isVisible: visibleColumns.value.some(
        v => (v.accessorKey || v.id) === (col.accessorKey || col.id)
      )
    }))
  })

  /**
   * 更新屏幕尺寸
   */
  const updateScreenSize = () => {
    const width = window.innerWidth

    if (width < breakpoints.mobile) {
      screenSize.value = 'mobile'
    } else if (width < breakpoints.tablet) {
      screenSize.value = 'tablet'
    } else {
      screenSize.value = 'desktop'
    }
  }

  /**
   * 切换列的可见性（手动控制）
   */
  const toggleColumnVisibility = (columnId) => {
    if (manuallyHiddenColumns.value.has(columnId)) {
      manuallyHiddenColumns.value.delete(columnId)
    } else {
      manuallyHiddenColumns.value.add(columnId)
    }
    // 触发响应式更新
    manuallyHiddenColumns.value = new Set(manuallyHiddenColumns.value)
  }

  /**
   * 显示所有列
   */
  const showAllColumns = () => {
    manuallyHiddenColumns.value.clear()
    manuallyHiddenColumns.value = new Set()
  }

  /**
   * 隐藏所有可选列
   */
  const hideOptionalColumns = () => {
    columns.forEach(col => {
      if ((col.priority || 'core') === 'optional') {
        manuallyHiddenColumns.value.add(col.accessorKey || col.id)
      }
    })
    manuallyHiddenColumns.value = new Set(manuallyHiddenColumns.value)
  }

  /**
   * 重置为默认可见性（根据屏幕尺寸）
   */
  const resetColumnVisibility = () => {
    manuallyHiddenColumns.value.clear()
    manuallyHiddenColumns.value = new Set()
  }

  /**
   * 获取列优先级的显示名称
   */
  const getPriorityLabel = (priority) => {
    const labels = {
      core: '核心',
      secondary: '次要',
      optional: '可选'
    }
    return labels[priority] || priority
  }

  /**
   * 获取当前屏幕尺寸的显示名称
   */
  const getScreenSizeLabel = computed(() => {
    const labels = {
      mobile: '移动端',
      tablet: '平板端',
      desktop: '桌面端'
    }
    return labels[screenSize.value] || screenSize.value
  })

  /**
   * 防抖函数
   */
  let resizeTimer = null
  const debouncedUpdateScreenSize = () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
    resizeTimer = setTimeout(() => {
      updateScreenSize()
    }, 150) // 150ms 防抖
  }

  /**
   * 生命周期：挂载时添加监听器
   */
  onMounted(() => {
    updateScreenSize()
    window.addEventListener('resize', debouncedUpdateScreenSize)
  })

  /**
   * 生命周期：卸载时移除监听器
   */
  onUnmounted(() => {
    window.removeEventListener('resize', debouncedUpdateScreenSize)
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
  })

  /**
   * 返回响应式数据和方法
   */
  return {
    // 响应式数据
    screenSize,
    visibleColumns,
    availableColumns,
    showColumnVisibility,
    getScreenSizeLabel,

    // 方法
    toggleColumnVisibility,
    showAllColumns,
    hideOptionalColumns,
    resetColumnVisibility,
    getPriorityLabel,

    // 配置信息
    breakpoints,
    priorityMap
  }
}

/**
 * 生成响应式列配置助手函数
 * @param {string} accessorKey - 列的访问键
 * @param {string} header - 列标题
 * @param {string} priority - 列优先级: 'core' | 'secondary' | 'optional'
 * @param {Object} options - 其他选项
 * @returns {Object} - 列配置对象
 */
export function createColumn(accessorKey, header, priority = 'core', options = {}) {
  return {
    accessorKey,
    header,
    priority,
    ...options
  }
}

/**
 * 批量创建列配置
 * @param {Array} columnsConfig - 列配置数组
 * @returns {Array} - 列配置对象数组
 */
export function createColumns(columnsConfig) {
  return columnsConfig.map(config => {
    if (Array.isArray(config)) {
      // 数组格式: [accessorKey, header, priority, options]
      return createColumn(...config)
    } else {
      // 对象格式
      return createColumn(
        config.accessorKey,
        config.header,
        config.priority,
        config.options || {}
      )
    }
  })
}

/**
 * 预设的响应式配置
 */
export const presetConfigs = {
  // 默认配置：768px / 1200px 断点
  default: {
    mobileBreakpoint: 768,
    tabletBreakpoint: 1200,
    mobilePriorities: ['core'],
    tabletPriorities: ['core', 'secondary'],
    desktopPriorities: ['core', 'secondary', 'optional']
  },

  // 紧凑配置：更早隐藏次要列
  compact: {
    mobileBreakpoint: 640,
    tabletBreakpoint: 1024,
    mobilePriorities: ['core'],
    tabletPriorities: ['core'],
    desktopPriorities: ['core', 'secondary', 'optional']
  },

  // 宽松配置：保留更多列
  relaxed: {
    mobileBreakpoint: 768,
    tabletBreakpoint: 1440,
    mobilePriorities: ['core'],
    tabletPriorities: ['core', 'secondary'],
    desktopPriorities: ['core', 'secondary', 'optional']
  }
}
