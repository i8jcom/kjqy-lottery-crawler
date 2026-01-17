<script setup>
const props = defineProps({
  currentTab: {
    type: String,
    default: 'dashboard'
  }
})

const emit = defineEmits(['switchTab'])

const tabs = [
  { name: 'dashboard', label: '📊 仪表盘', icon: '📊' },
  { name: 'scheduler', label: '⏰ 调度器状态', icon: '⏰' },
  { name: 'history', label: '📊 历史查询', icon: '📊' },
  { name: 'data-management', label: '🔧 数据管理', icon: '🔧' },
  { name: 'alerts', label: '📢 告警管理', icon: '📢' },
  { name: 'sources', label: '🔌 数据源', icon: '🔌' },
  { name: 'lottery-configs', label: '⚙️ 彩种配置', icon: '⚙️' },
  { name: 'logs', label: '📝 系统日志', icon: '📝' },
  { name: 'domain-management', label: '🌐 域名管理', icon: '🌐' }
]

const switchTab = (tabName) => {
  emit('switchTab', tabName)
}
</script>

<template>
  <div class="tabs">
    <button
      v-for="tab in tabs"
      :key="tab.name"
      class="tab"
      :class="{ active: currentTab === tab.name }"
      @click="switchTab(tab.name)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(102, 126, 234, 0.3) transparent;
}

.tabs::-webkit-scrollbar {
  height: 6px;
}

.tabs::-webkit-scrollbar-track {
  background: transparent;
}

.tabs::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 3px;
}

.tabs::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.5);
}

.tab {
  padding: 12px 24px;
  border: none;
  background: white;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.tab::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary-color), var(--primary-dark));
  transform: scaleX(0);
  transition: transform var(--transition-base);
}

.tab:hover {
  background: #f8f9fa;
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
}

.tab.active {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: white;
  box-shadow: var(--shadow-md);
}

.tab.active::before {
  transform: scaleX(1);
}

@media (max-width: 768px) {
  .tab {
    padding: 10px 16px;
    font-size: 13px;
  }
}
</style>
