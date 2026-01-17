/**
 * ECharts 图表主题配置
 * 支持深色/亮色模式自动切换
 */

// 深色主题配置
export const darkTheme = {
  backgroundColor: 'transparent',
  textStyle: {
    color: '#e5e7eb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial'
  },
  title: {
    textStyle: {
      color: '#f9fafb',
      fontWeight: 600
    },
    subtextStyle: {
      color: '#9ca3af'
    }
  },
  legend: {
    textStyle: {
      color: '#e5e7eb'
    },
    pageTextStyle: {
      color: '#e5e7eb'
    }
  },
  tooltip: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderColor: 'rgba(75, 85, 99, 0.5)',
    textStyle: {
      color: '#f9fafb'
    }
  },
  grid: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
    containLabel: true,
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '15%'
  },
  categoryAxis: {
    axisLine: {
      lineStyle: {
        color: 'rgba(255, 255, 255, 0.2)'
      }
    },
    axisTick: {
      lineStyle: {
        color: 'rgba(255, 255, 255, 0.2)'
      }
    },
    axisLabel: {
      color: '#9ca3af'
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(255, 255, 255, 0.05)'
      }
    }
  },
  valueAxis: {
    axisLine: {
      lineStyle: {
        color: 'rgba(255, 255, 255, 0.2)'
      }
    },
    axisTick: {
      lineStyle: {
        color: 'rgba(255, 255, 255, 0.2)'
      }
    },
    axisLabel: {
      color: '#9ca3af'
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(255, 255, 255, 0.05)'
      }
    }
  },
  // 图表颜色方案 - 鲜艳且区分度高
  color: [
    '#667eea', // 主色调紫
    '#10b981', // 成功绿
    '#f59e0b', // 警告橙
    '#ef4444', // 错误红
    '#3b82f6', // 信息蓝
    '#8b5cf6', // 紫色
    '#ec4899', // 粉色
    '#14b8a6', // 青色
    '#f97316', // 深橙
    '#06b6d4'  // 天蓝
  ]
}

// 亮色主题配置
export const lightTheme = {
  backgroundColor: 'transparent',
  textStyle: {
    color: '#3d4451',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial'
  },
  title: {
    textStyle: {
      color: '#1a1d23',
      fontWeight: 600
    },
    subtextStyle: {
      color: '#5a6270'
    }
  },
  legend: {
    textStyle: {
      color: '#3d4451'
    },
    pageTextStyle: {
      color: '#3d4451'
    }
  },
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    textStyle: {
      color: '#1a1d23'
    }
  },
  grid: {
    borderColor: 'rgba(0, 0, 0, 0.1)',
    containLabel: true,
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '15%'
  },
  categoryAxis: {
    axisLine: {
      lineStyle: {
        color: 'rgba(0, 0, 0, 0.2)'
      }
    },
    axisTick: {
      lineStyle: {
        color: 'rgba(0, 0, 0, 0.2)'
      }
    },
    axisLabel: {
      color: '#5a6270'
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(0, 0, 0, 0.05)'
      }
    }
  },
  valueAxis: {
    axisLine: {
      lineStyle: {
        color: 'rgba(0, 0, 0, 0.2)'
      }
    },
    axisTick: {
      lineStyle: {
        color: 'rgba(0, 0, 0, 0.2)'
      }
    },
    axisLabel: {
      color: '#5a6270'
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(0, 0, 0, 0.05)'
      }
    }
  },
  // 图表颜色方案 - 与深色主题保持一致
  color: [
    '#667eea',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
    '#06b6d4'
  ]
}

/**
 * 获取当前主题配置
 * @param {string} theme - 'dark' 或 'light'
 * @returns {object} 主题配置对象
 */
export function getChartTheme(theme) {
  return theme === 'dark' ? darkTheme : lightTheme
}

/**
 * 通用图表配置
 */
export const commonChartOptions = {
  animation: true,
  animationDuration: 1000,
  animationEasing: 'cubicInOut',
  tooltip: {
    trigger: 'axis',
    confine: true,
    padding: [10, 15],
    borderRadius: 10,
    borderWidth: 1,
    textStyle: {
      fontSize: 13,
      lineHeight: 20
    },
    axisPointer: {
      type: 'cross',
      lineStyle: {
        type: 'dashed',
        width: 1
      }
    }
  },
  legend: {
    top: 5,
    left: 'center',
    padding: [5, 0, 15, 0],
    itemGap: 25,
    icon: 'roundRect',
    itemWidth: 14,
    itemHeight: 8,
    textStyle: {
      fontSize: 13,
      fontWeight: 500
    }
  },
  grid: {
    containLabel: true,
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '20%'
  }
}
