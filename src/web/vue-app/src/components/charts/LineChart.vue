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
  // 是否显示面积
  showArea: {
    type: Boolean,
    default: false
  },
  // 是否平滑曲线
  smooth: {
    type: Boolean,
    default: true
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
  const textColor = currentTheme.value === 'dark' ? '#f9fafb' : '#1a1d23'

  return {
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
      formatter: (params) => {
        let result = `<div style="font-weight: 700; font-size: 15px; margin-bottom: 10px; color: #667eea;">${params[0].axisValue}</div>`
        params.forEach(item => {
          const value = typeof item.value === 'number' ? item.value.toLocaleString() : item.value
          result += `
            <div style="display: flex; align-items: center; margin: 6px 0;">
              <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${item.color}; margin-right: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></span>
              <span style="flex: 1; opacity: 0.8;">${item.seriesName}</span>
              <span style="font-weight: 700; font-size: 16px; margin-left: 16px;">${value}</span>
            </div>
          `
        })
        return result
      }
    },
    xAxis: {
      type: 'category',
      data: props.data.xAxis || [],
      boundaryGap: false,
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
      type: 'line',
      data: item.data,
      smooth: props.smooth,
      symbol: 'circle',
      symbolSize: 8,
      showSymbol: true,
      lineStyle: {
        width: 3.5,
        shadowColor: 'rgba(0, 0, 0, 0.4)',
        shadowBlur: 12,
        shadowOffsetY: 6
      },
      itemStyle: {
        borderWidth: 2.5,
        borderColor: currentTheme.value === 'dark' ? '#1f2937' : '#fff',
        shadowBlur: 6,
        shadowColor: 'rgba(0, 0, 0, 0.3)'
      },
      areaStyle: props.showArea ? {
        opacity: 0.25,
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0,
            color: theme.color[index % theme.color.length]
          }, {
            offset: 0.5,
            color: theme.color[index % theme.color.length].replace('1)', '0.3)')
          }, {
            offset: 1,
            color: 'rgba(255, 255, 255, 0.01)'
          }]
        }
      } : undefined,
      emphasis: {
        focus: 'series',
        scale: true,
        scaleSize: 12,
        itemStyle: {
          borderWidth: 3,
          borderColor: currentTheme.value === 'dark' ? '#1f2937' : '#fff',
          shadowBlur: 15,
          shadowColor: 'rgba(0, 0, 0, 0.6)'
        },
        lineStyle: {
          width: 5
        }
      },
      animationDelay: (idx) => idx * 20
    }))
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
