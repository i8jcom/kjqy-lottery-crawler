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
    type: Array,
    required: true
    // 格式: [{ name: '类别1', value: 100 }, { name: '类别2', value: 200 }]
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
  // 是否显示为环形图
  isDonut: {
    type: Boolean,
    default: false
  },
  // 内环半径（仅环形图有效）
  innerRadius: {
    type: String,
    default: '50%'
  },
  // 外环半径
  outerRadius: {
    type: String,
    default: '70%'
  },
  // 是否显示标签
  showLabel: {
    type: Boolean,
    default: true
  },
  // 是否显示为玫瑰图（南丁格尔图）
  roseType: {
    type: [String, Boolean],
    default: false // 可选: 'radius', 'area', false
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

  // 计算总数（用于中心文字）
  const total = (props.data || []).reduce((sum, item) => sum + (item.value || 0), 0)

  // 豪华渐变色配置
  const luxuryColors = [
    { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
      { offset: 0, color: '#667eea' },
      { offset: 1, color: '#764ba2' }
    ]},
    { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
      { offset: 0, color: '#f093fb' },
      { offset: 1, color: '#f5576c' }
    ]},
    { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
      { offset: 0, color: '#4facfe' },
      { offset: 1, color: '#00f2fe' }
    ]},
    { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
      { offset: 0, color: '#43e97b' },
      { offset: 1, color: '#38f9d7' }
    ]},
    { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
      { offset: 0, color: '#fa709a' },
      { offset: 1, color: '#fee140' }
    ]},
    { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
      { offset: 0, color: '#30cfd0' },
      { offset: 1, color: '#330867' }
    ]},
    { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
      { offset: 0, color: '#a8edea' },
      { offset: 1, color: '#fed6e3' }
    ]},
    { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
      { offset: 0, color: '#ff9a9e' },
      { offset: 1, color: '#fecfef' }
    ]}
  ]

  // 为每个数据项添加渐变色
  const dataWithColors = (props.data || []).map((item, index) => ({
    ...item,
    itemStyle: {
      color: luxuryColors[index % luxuryColors.length],
      borderRadius: 8,
      borderColor: 'rgba(255, 255, 255, 0.3)',
      borderWidth: 2,
      shadowBlur: 12,
      shadowColor: 'rgba(0, 0, 0, 0.3)',
      shadowOffsetY: 4
    }
  }))

  return {
    ...commonChartOptions,
    ...theme,
    ...props.options,
    tooltip: {
      ...commonChartOptions.tooltip,
      ...theme.tooltip,
      trigger: 'item',
      padding: [12, 16],
      borderRadius: 12,
      backgroundColor: currentTheme.value === 'dark'
        ? 'rgba(17, 24, 39, 0.95)'
        : 'rgba(255, 255, 255, 0.95)',
      borderColor: currentTheme.value === 'dark'
        ? 'rgba(75, 85, 99, 0.5)'
        : 'rgba(0, 0, 0, 0.1)',
      textStyle: {
        color: currentTheme.value === 'dark' ? '#f9fafb' : '#1a1d23'
      },
      formatter: (params) => {
        const percent = params.percent ? params.percent.toFixed(1) : '0.0'
        const textColor = currentTheme.value === 'dark' ? '#f9fafb' : '#1a1d23'
        const accentColor = '#667eea'
        return `
          <div style="padding: 4px; color: ${textColor};">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 10px; color: ${accentColor};">${params.name}</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="opacity: 0.8;">数量</span>
                <span style="font-weight: 700; font-size: 16px; margin-left: 20px;">${params.value.toLocaleString()}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="opacity: 0.8;">占比</span>
                <span style="font-weight: 700; font-size: 16px; color: ${accentColor}; margin-left: 20px;">${percent}%</span>
              </div>
            </div>
          </div>
        `
      }
    },
    legend: {
      ...commonChartOptions.legend,
      orient: 'horizontal',
      bottom: '2%',
      left: 'center',
      itemWidth: 16,
      itemHeight: 10,
      itemGap: 20,
      textStyle: {
        fontSize: 13,
        fontWeight: 500,
        color: theme.textStyle.color
      }
    },
    graphic: props.isDonut ? [{
      type: 'text',
      left: 'center',
      top: '42%',
      style: {
        text: '总计',
        textAlign: 'center',
        fill: theme.textStyle.color,
        fontSize: 14,
        fontWeight: 500,
        opacity: 0.7
      }
    }, {
      type: 'text',
      left: 'center',
      top: '50%',
      style: {
        text: total.toLocaleString(),
        textAlign: 'center',
        fill: theme.textStyle.color,
        fontSize: 24,
        fontWeight: 700
      }
    }] : [],
    series: [{
      type: 'pie',
      data: dataWithColors,
      radius: props.isDonut
        ? [props.innerRadius, props.outerRadius]
        : props.outerRadius,
      center: ['50%', '45%'],
      roseType: props.roseType || false,
      label: {
        show: props.showLabel && !props.isDonut,
        formatter: '{b}\n{d}%',
        fontSize: 12,
        fontWeight: 600,
        color: currentTheme.value === 'dark' ? '#f9fafb' : '#1a1d23',
        lineHeight: 18,
        padding: [4, 8],
        borderRadius: 4,
        backgroundColor: currentTheme.value === 'dark'
          ? 'rgba(31, 41, 55, 0.9)'
          : 'rgba(255, 255, 255, 0.9)',
        borderColor: 'rgba(102, 126, 234, 0.3)',
        borderWidth: 1
      },
      labelLine: {
        show: props.showLabel && !props.isDonut,
        length: 20,
        length2: 15,
        lineStyle: {
          color: currentTheme.value === 'dark' ? '#e5e7eb' : '#3d4451',
          opacity: 0.5,
          width: 2
        }
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 25,
          shadowOffsetX: 0,
          shadowOffsetY: 5,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        },
        label: {
          show: true,
          fontSize: props.isDonut ? 0 : 14,
          fontWeight: 'bold'
        },
        scaleSize: 15
      },
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDelay: (idx) => idx * 50
    }]
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
