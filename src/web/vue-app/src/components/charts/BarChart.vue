<template>
  <div ref="chartRef" class="chart-container" :style="{ height: height }"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as echarts from 'echarts'
import { getChartTheme, commonChartOptions } from '../../config/chartThemes'
import { getCurrentTheme } from '../../config/theme'

const props = defineProps({
  // 图表数据
  data: {
    type: Object,
    required: true
    // 格式: { xAxis: [], series: [{ name: '', data: [] }] }
  },
  // 图表高度
  height: {
    type: String,
    default: '300px'
  },
  // 自定义配置
  options: {
    type: Object,
    default: () => ({})
  },
  // 是否水平显示
  horizontal: {
    type: Boolean,
    default: false
  },
  // 是否堆叠
  stack: {
    type: Boolean,
    default: false
  },
  // 柱状图宽度
  barWidth: {
    type: String,
    default: '60%'
  },
  // 是否显示数值标签
  showLabel: {
    type: Boolean,
    default: false
  }
})

const chartRef = ref(null)
let chartInstance = null
let resizeObserver = null

// 获取当前主题
const currentTheme = computed(() => getCurrentTheme())

// 创建图表配置
const getChartOptions = () => {
  const theme = getChartTheme(currentTheme.value)

  // 豪华渐变色配置
  const luxuryGradients = [
    new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: '#667eea' },
      { offset: 1, color: '#764ba2' }
    ]),
    new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: '#f093fb' },
      { offset: 1, color: '#f5576c' }
    ]),
    new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: '#4facfe' },
      { offset: 1, color: '#00f2fe' }
    ]),
    new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: '#43e97b' },
      { offset: 1, color: '#38f9d7' }
    ]),
    new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: '#fa709a' },
      { offset: 1, color: '#fee140' }
    ])
  ]

  const textColor = currentTheme.value === 'dark' ? '#f9fafb' : '#1a1d23'

  const baseConfig = {
    ...commonChartOptions,
    ...theme,
    ...props.options,
    tooltip: {
      ...commonChartOptions.tooltip,
      ...theme.tooltip,
      trigger: 'axis',
      padding: [12, 16],
      borderRadius: 12,
      backgroundColor: currentTheme.value === 'dark'
        ? 'rgba(17, 24, 39, 0.95)'
        : 'rgba(255, 255, 255, 0.95)',
      borderColor: currentTheme.value === 'dark'
        ? 'rgba(75, 85, 99, 0.5)'
        : 'rgba(0, 0, 0, 0.1)',
      textStyle: {
        color: textColor
      },
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(102, 126, 234, 0.1)'
        }
      },
      formatter: (params) => {
        let result = `<div style="font-weight: 700; font-size: 15px; margin-bottom: 10px; color: #667eea;">${params[0].axisValue}</div>`
        params.forEach(item => {
          result += `
            <div style="display: flex; align-items: center; margin: 6px 0;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: linear-gradient(135deg, #667eea, #764ba2); margin-right: 10px;"></span>
              <span style="flex: 1; opacity: 0.8;">${item.seriesName}</span>
              <span style="font-weight: 700; font-size: 16px; margin-left: 16px;">${item.value.toLocaleString()}</span>
            </div>
          `
        })
        return result
      }
    }
  }

  // 水平或垂直配置
  if (props.horizontal) {
    // 水平条形图
    return {
      ...baseConfig,
      xAxis: {
        type: 'value',
        axisLabel: {
          ...theme.valueAxis.axisLabel,
          formatter: (value) => {
            if (value >= 1000) return (value / 1000).toFixed(1) + 'k'
            return value
          }
        },
        ...theme.valueAxis
      },
      yAxis: {
        type: 'category',
        data: props.data.xAxis || [],
        axisLabel: {
          ...theme.categoryAxis.axisLabel,
          interval: 0
        },
        ...theme.categoryAxis
      },
      series: (props.data.series || []).map((item, index) => ({
        name: item.name,
        type: 'bar',
        data: item.data,
        stack: props.stack ? 'total' : undefined,
        barWidth: props.barWidth,
        label: {
          show: props.showLabel,
          position: 'right',
          color: textColor,
          fontSize: 12,
          fontWeight: 600
        },
        itemStyle: {
          color: luxuryGradients[index % luxuryGradients.length],
          borderRadius: [0, 8, 8, 0],
          shadowBlur: 8,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          shadowOffsetX: 3,
          shadowOffsetY: 2
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetX: 0,
            shadowOffsetY: 4,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }))
    }
  } else {
    // 垂直柱状图
    return {
      ...baseConfig,
      xAxis: {
        type: 'category',
        data: props.data.xAxis || [],
        axisLabel: {
          ...theme.categoryAxis.axisLabel,
          interval: 'auto',
          rotate: props.data.xAxis && props.data.xAxis.length > 7 ? 45 : 0
        },
        ...theme.categoryAxis
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          ...theme.valueAxis.axisLabel,
          formatter: (value) => {
            if (value >= 1000) return (value / 1000).toFixed(1) + 'k'
            return value
          }
        },
        ...theme.valueAxis
      },
      series: (props.data.series || []).map((item, index) => ({
        name: item.name,
        type: 'bar',
        data: item.data,
        stack: props.stack ? 'total' : undefined,
        barWidth: props.barWidth,
        label: {
          show: props.showLabel,
          position: 'top',
          color: textColor,
          fontSize: 12,
          fontWeight: 600
        },
        itemStyle: {
          color: luxuryGradients[index % luxuryGradients.length],
          borderRadius: [8, 8, 0, 0],
          shadowBlur: 8,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
          shadowOffsetY: 3,
          shadowOffsetX: 2
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: 20,
            shadowOffsetY: 4,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        animationDelay: (idx) => idx * 30
      }))
    }
  }
}

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return

  // 创建图表实例
  chartInstance = echarts.init(chartRef.value)

  // 设置配置
  chartInstance.setOption(getChartOptions())

  // 监听窗口大小变化
  resizeObserver = new ResizeObserver(() => {
    chartInstance?.resize()
  })
  resizeObserver.observe(chartRef.value)
}

// 更新图表
const updateChart = () => {
  if (chartInstance) {
    chartInstance.setOption(getChartOptions(), true)
  }
}

// 监听数据变化
watch(() => props.data, () => {
  updateChart()
}, { deep: true })

// 监听主题变化
watch(currentTheme, () => {
  updateChart()
})

// 组件挂载
onMounted(() => {
  initChart()
})

// 组件卸载
onUnmounted(() => {
  resizeObserver?.disconnect()
  chartInstance?.dispose()
})

// 暴露实例供父组件调用
defineExpose({
  chartInstance,
  updateChart
})
</script>

<style scoped>
.chart-container {
  width: 100%;
  min-height: 200px;
}
</style>
