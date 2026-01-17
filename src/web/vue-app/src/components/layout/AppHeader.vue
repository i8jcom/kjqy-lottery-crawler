<script setup>
import { ref } from 'vue'

const autoCrawlEnabled = ref(true)
const wsConnected = ref(false)

const toggleAutoCrawl = (enabled) => {
  // TODO: 调用API切换自动爬取
  console.log('Auto crawl:', enabled)
}
</script>

<template>
  <header>
    <div class="header-left">
      <h1>
        <span class="header-icon">🎰</span>
        彩票爬虫管理系统
      </h1>
      <p class="header-subtitle">数据源智能管理 · 实时监控 · 高可用架构</p>
    </div>

    <div class="header-right">
      <!-- 自动爬取开关 -->
      <div class="toggle-container">
        <span class="toggle-label">自动爬取</span>
        <label class="toggle-switch">
          <input type="checkbox" v-model="autoCrawlEnabled" @change="toggleAutoCrawl(autoCrawlEnabled)">
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- WebSocket状态 -->
      <div class="ws-status" :class="{ 'ws-connected': wsConnected, 'ws-disconnected': !wsConnected }">
        <span class="ws-indicator"></span>
        <span class="ws-label">{{ wsConnected ? '实时推送' : '连接中...' }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
header {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: white;
  padding: 32px 40px;
  margin-bottom: 32px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.1) inset;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  overflow: hidden;
}

header::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at top right, rgba(255,255,255,0.15), transparent 60%);
  pointer-events: none;
}

.header-left {
  position: relative;
  z-index: 1;
}

.header-left h1 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 32px;
}

.header-subtitle {
  font-size: 14px;
  opacity: 0.9;
  font-weight: 400;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 24px;
  position: relative;
  z-index: 1;
}

/* 开关样式 */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-label {
  font-size: 14px;
  font-weight: 500;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--glass-border-strong);
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

input:checked + .toggle-slider {
  background-color: var(--success-color);
}

input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

/* WebSocket状态 */
.ws-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
}

.ws-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warning-color);
}

.ws-status.ws-connected .ws-indicator {
  background: var(--success-color);
  box-shadow: 0 0 10px var(--success-color);
  animation: pulse 2s infinite;
}

.ws-status.ws-disconnected .ws-indicator {
  background: var(--warning-color);
  animation: none;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

@media (max-width: 768px) {
  header {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }

  .header-right {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
