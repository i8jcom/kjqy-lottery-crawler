# 开发者指南

**项目：** Vue 3 爬虫管理系统
**版本：** v2.0.0
**更新时间：** 2026-01-03

---

## 📚 目录

1. [快速开始](#快速开始)
2. [项目结构](#项目结构)
3. [核心概念](#核心概念)
4. [组件开发](#组件开发)
5. [API服务](#api服务)
6. [状态管理](#状态管理)
7. [路由配置](#路由配置)
8. [样式系统](#样式系统)
9. [代码规范](#代码规范)
10. [常见问题](#常见问题)

---

## 快速开始

### 环境要求

- Node.js >= 16.x
- npm >= 8.x
- 现代浏览器（Chrome 90+, Firefox 88+, Safari 14+）

### 安装依赖

```bash
# 进入Vue应用目录
cd src/web/vue-app

# 安装依赖
npm install
```

### 开发模式

```bash
# 启动开发服务器（带热重载）
npm run dev

# 访问 http://localhost:5173
```

### 生产构建

```bash
# 构建生产版本
npm run build

# 构建产物输出到 ../dist/
```

---

## 项目结构

```
crawler-service/
├── src/web/
│   ├── vue-app/                 # Vue 3 应用源代码
│   │   ├── public/              # 静态资源
│   │   │   └── favicon.ico
│   │   ├── src/
│   │   │   ├── assets/          # 资源文件
│   │   │   │   ├── styles/      # 全局样式
│   │   │   │   │   ├── variables.css    # CSS变量（设计令牌）
│   │   │   │   │   ├── global.css       # 全局样式
│   │   │   │   │   └── animations.css   # 动画效果
│   │   │   │   └── images/      # 图片资源
│   │   │   │
│   │   │   ├── components/      # 公共组件
│   │   │   │   ├── common/      # 通用组件
│   │   │   │   │   ├── GlassCard.vue         # 玻璃态卡片
│   │   │   │   │   ├── StatusBadge.vue       # 状态徽章
│   │   │   │   │   ├── LoadingSpinner.vue    # 加载动画
│   │   │   │   │   └── Modal.vue             # 模态框
│   │   │   │   ├── layout/      # 布局组件
│   │   │   │   │   ├── AppHeader.vue         # 顶部导航
│   │   │   │   │   ├── TabNavigation.vue     # 标签导航
│   │   │   │   │   └── MobileMenu.vue        # 移动端菜单
│   │   │   │   └── widgets/     # 业务组件
│   │   │   │       ├── StatCard.vue          # 统计卡片
│   │   │   │       ├── DataTable.vue         # 数据表格
│   │   │   │       └── LotteryCard.vue       # 彩种卡片
│   │   │   │
│   │   │   ├── views/           # 页面视图
│   │   │   │   ├── Dashboard.vue             # 仪表盘
│   │   │   │   ├── Realtime.vue              # 实时监控
│   │   │   │   ├── Scheduler.vue             # 调度器状态
│   │   │   │   ├── History.vue               # 历史查询
│   │   │   │   ├── DataManagement.vue        # 数据管理
│   │   │   │   ├── AlertsLuxury.vue          # 告警管理
│   │   │   │   ├── Sources.vue               # 数据源管理
│   │   │   │   ├── LotteryConfigs.vue        # 彩种配置
│   │   │   │   ├── LogsPro.vue               # 系统日志
│   │   │   │   └── DomainManagement.vue      # 域名管理
│   │   │   │
│   │   │   ├── composables/     # 组合式函数（可复用逻辑）
│   │   │   │   ├── useCountdown.js           # 倒计时逻辑
│   │   │   │   ├── useWebSocket.js           # WebSocket连接
│   │   │   │   ├── useApi.js                 # API调用封装
│   │   │   │   └── usePolling.js             # 轮询逻辑
│   │   │   │
│   │   │   ├── services/        # API服务层
│   │   │   │   ├── api.js                    # HTTP客户端（Axios封装）
│   │   │   │   └── websocket.js              # WebSocket服务
│   │   │   │
│   │   │   ├── utils/           # 工具函数
│   │   │   │   ├── format.js                 # 格式化工具
│   │   │   │   ├── date.js                   # 日期处理
│   │   │   │   └── storage.js                # 本地存储
│   │   │   │
│   │   │   ├── router/          # 路由配置
│   │   │   │   └── index.js                  # 路由定义
│   │   │   │
│   │   │   ├── App.vue          # 根组件
│   │   │   └── main.js          # 入口文件
│   │   │
│   │   ├── vite.config.js       # Vite配置
│   │   ├── package.json         # 依赖管理
│   │   └── index.html           # HTML模板
│   │
│   ├── dist/                    # 构建产物（生产版本）
│   └── WebServer.js             # Express后端服务器
│
├── PHASE-A-TEST-REPORT.md       # 测试报告
├── DEPLOYMENT-GUIDE.md          # 部署指南
└── DEVELOPER-GUIDE.md           # 开发者指南（本文档）
```

---

## 核心概念

### 1. Composition API

本项目使用Vue 3的Composition API（`<script setup>`语法）：

```vue
<script setup>
import { ref, onMounted } from 'vue';

// 响应式数据
const count = ref(0);

// 方法
const increment = () => {
  count.value++;
};

// 生命周期
onMounted(() => {
  console.log('组件已挂载');
});
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
```

### 2. 组合式函数（Composables）

可复用的逻辑封装在`composables/`目录：

```javascript
// composables/useCountdown.js
import { ref, onUnmounted } from 'vue';

export function useCountdown() {
  const countdowns = ref({});
  const timers = new Map();

  const startCountdown = (id, seconds) => {
    countdowns.value[id] = seconds;

    const timer = setInterval(() => {
      if (countdowns.value[id] > 0) {
        countdowns.value[id]--;
      } else {
        clearInterval(timer);
        timers.delete(id);
      }
    }, 1000);

    timers.set(id, timer);
  };

  onUnmounted(() => {
    timers.forEach(timer => clearInterval(timer));
  });

  return { countdowns, startCountdown };
}
```

使用方式：

```vue
<script setup>
import { useCountdown } from '@/composables/useCountdown';

const { countdowns, startCountdown } = useCountdown();

// 启动倒计时
startCountdown('task1', 60);
</script>

<template>
  <div>倒计时: {{ countdowns.task1 }}秒</div>
</template>
```

### 3. 响应式系统

Vue 3使用Proxy实现响应式：

```javascript
import { ref, reactive, computed } from 'vue';

// ref - 基础类型响应式
const count = ref(0);
console.log(count.value); // 访问需要.value

// reactive - 对象响应式
const state = reactive({
  user: { name: '张三' },
  items: []
});
console.log(state.user.name); // 直接访问

// computed - 计算属性
const double = computed(() => count.value * 2);
```

---

## 组件开发

### 组件文件结构

```vue
<script setup>
// 1. 导入依赖
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

// 2. 定义Props
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 0
  }
});

// 3. 定义Emits
const emit = defineEmits(['update', 'delete']);

// 4. 响应式数据
const isLoading = ref(false);

// 5. 计算属性
const displayTitle = computed(() => {
  return props.title.toUpperCase();
});

// 6. 方法
const handleClick = () => {
  emit('update', { id: 1 });
};

// 7. 生命周期
onMounted(() => {
  console.log('组件已挂载');
});
</script>

<template>
  <div class="my-component">
    <h2>{{ displayTitle }}</h2>
    <button @click="handleClick">点击</button>
  </div>
</template>

<style scoped>
.my-component {
  padding: 20px;
}
</style>
```

### 常用组件示例

#### GlassCard - 玻璃态卡片

```vue
<!-- 使用方式 -->
<GlassCard>
  <h3>标题</h3>
  <p>内容</p>
</GlassCard>
```

#### StatusBadge - 状态徽章

```vue
<StatusBadge
  :status="'success'"
  :text="'运行中'"
/>

<!-- status可选值: success, warning, error, info -->
```

#### DataTable - 数据表格

```vue
<DataTable
  :columns="columns"
  :data="tableData"
  :loading="isLoading"
  @row-click="handleRowClick"
/>
```

---

## API服务

### API客户端（services/api.js）

统一的API调用封装：

```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

// 请求拦截
api.interceptors.request.use(config => {
  // 添加loading状态
  return config;
});

// 响应拦截
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error);
    throw error;
  }
);

export default {
  // 仪表盘
  getLatestData: () => api.get('/latest-data'),

  // 历史查询
  getHistoryData: (params) => api.get('/history-data', { params }),

  // 数据源
  getSources: () => api.get('/sources'),

  // ... 其他API
};
```

### 在组件中使用

```vue
<script setup>
import { ref, onMounted } from 'vue';
import api from '@/services/api';

const data = ref([]);
const loading = ref(false);

const fetchData = async () => {
  loading.value = true;
  try {
    data.value = await api.getLatestData();
  } catch (error) {
    console.error('获取数据失败:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchData();
});
</script>
```

### API缓存

使用`useApi` composable实现缓存：

```javascript
// composables/useApi.js
import { ref } from 'vue';

const cache = new Map();

export function useApi(apiFunction, cacheKey, cacheTTL = 60000) {
  const data = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const execute = async (params) => {
    // 检查缓存
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      data.value = cached.data;
      return;
    }

    loading.value = true;
    try {
      const result = await apiFunction(params);
      data.value = result;

      // 更新缓存
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    } catch (err) {
      error.value = err;
    } finally {
      loading.value = false;
    }
  };

  return { data, loading, error, execute };
}
```

---

## 状态管理

### 为什么不使用Pinia？

本项目采用轻量级状态管理方案：
- 使用Composables共享状态
- 使用Props/Emits父子组件通信
- 使用Provide/Inject跨层级通信

适用于中小型应用，避免过度设计。

### 跨组件状态共享

```javascript
// composables/useGlobalState.js
import { reactive } from 'vue';

const state = reactive({
  user: null,
  config: {}
});

export function useGlobalState() {
  return state;
}
```

在多个组件中使用：

```vue
<script setup>
import { useGlobalState } from '@/composables/useGlobalState';

const state = useGlobalState();
console.log(state.user);
</script>
```

---

## 路由配置

### 路由定义（router/index.js）

```javascript
import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'), // 懒加载
    meta: { title: '仪表盘' }
  },
  // ... 其他路由
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
```

### 路由守卫

```javascript
// 全局前置守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title || '爬虫管理系统';
  next();
});
```

### 编程式导航

```vue
<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const goToPage = () => {
  router.push('/dashboard');
  // 或 router.push({ name: 'Dashboard' });
};
</script>
```

---

## 样式系统

### CSS变量（设计令牌）

在`assets/styles/variables.css`定义：

```css
:root {
  /* 主色调 */
  --primary-color: #667eea;
  --primary-dark: #764ba2;

  /* 功能色 */
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  --info-color: #3b82f6;

  /* 背景色 */
  --bg-primary: #f5f7fa;
  --bg-secondary: #ffffff;

  /* 文本色 */
  --text-primary: #1f2937;
  --text-secondary: #6b7280;

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  /* 阴影 */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 30px rgba(0,0,0,0.12);
}
```

### Glass Morphism效果

```css
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border-radius: var(--radius-lg);
}
```

### Scoped样式

使用`<style scoped>`确保样式隔离：

```vue
<style scoped>
.my-component {
  /* 只作用于当前组件 */
  color: var(--primary-color);
}
</style>
```

---

## 代码规范

### 命名规范

**组件命名：** PascalCase
```javascript
// ✅ 正确
import UserProfile from './UserProfile.vue';

// ❌ 错误
import userProfile from './user-profile.vue';
```

**文件命名：** PascalCase
```
Dashboard.vue
LotteryCard.vue
useCountdown.js
```

**变量/函数命名：** camelCase
```javascript
const userName = 'John';
const getUserData = () => {};
```

**常量命名：** UPPER_CASE
```javascript
const API_BASE_URL = '/api';
const MAX_RETRY = 3;
```

### 代码风格

**使用`<script setup>`语法**
```vue
<!-- ✅ 推荐 -->
<script setup>
const count = ref(0);
</script>

<!-- ❌ 避免 -->
<script>
export default {
  data() {
    return { count: 0 };
  }
};
</script>
```

**使用Composition API**
```javascript
// ✅ 推荐
import { ref, computed } from 'vue';

const count = ref(0);
const double = computed(() => count.value * 2);

// ❌ 避免 Options API
export default {
  data: () => ({ count: 0 }),
  computed: {
    double() { return this.count * 2; }
  }
};
```

---

## 常见问题

### Q1: 如何添加新页面？

1. 在`src/views/`创建组件文件：
```vue
<!-- src/views/NewPage.vue -->
<script setup>
import { ref } from 'vue';

const data = ref([]);
</script>

<template>
  <div class="new-page">
    <h1>新页面</h1>
  </div>
</template>

<style scoped>
.new-page {
  padding: 20px;
}
</style>
```

2. 在`router/index.js`添加路由：
```javascript
{
  path: '/new-page',
  name: 'NewPage',
  component: () => import('@/views/NewPage.vue'),
  meta: { title: '新页面' }
}
```

3. 在`TabNavigation.vue`添加导航标签（如果需要）

### Q2: 如何调用API？

使用`services/api.js`：

```javascript
// 1. 在api.js添加接口定义
export default {
  getNewData: () => api.get('/new-endpoint')
};

// 2. 在组件中使用
import api from '@/services/api';

const fetchData = async () => {
  const result = await api.getNewData();
};
```

### Q3: 如何创建可复用组件？

```vue
<!-- components/common/MyComponent.vue -->
<script setup>
defineProps({
  title: String,
  data: Array
});

defineEmits(['update']);
</script>

<template>
  <div class="my-component">
    {{ title }}
  </div>
</template>

<style scoped>
/* 组件样式 */
</style>
```

### Q4: 如何处理大数据列表？

使用虚拟滚动（vue-virtual-scroller）：

```vue
<script setup>
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

const items = ref([...]); // 大量数据
</script>

<template>
  <RecycleScroller
    :items="items"
    :item-size="50"
    key-field="id"
  >
    <template #default="{ item }">
      <div>{{ item.name }}</div>
    </template>
  </RecycleScroller>
</template>
```

---

## 性能优化建议

### 1. 使用懒加载

```javascript
// 路由懒加载
component: () => import('@/views/Dashboard.vue')

// 组件懒加载
const MyComponent = defineAsyncComponent(
  () => import('./components/MyComponent.vue')
);
```

### 2. 避免不必要的响应式

```javascript
// ❌ 不需要响应式的数据
const config = ref({ ... }); // 过度使用ref

// ✅ 使用普通变量
const CONFIG = { ... };
```

### 3. 使用`v-memo`优化列表

```vue
<template>
  <div v-for="item in list" :key="item.id" v-memo="[item.id]">
    {{ item.name }}
  </div>
</template>
```

---

## 调试技巧

### Vue DevTools

安装Chrome扩展：[Vue.js devtools](https://chrome.google.com/webstore/detail/vuejs-devtools/)

### 性能分析

```javascript
// main.js
if (import.meta.env.DEV) {
  app.config.performance = true;
}
```

在Chrome DevTools Performance面板查看Vue组件渲染时间。

---

## 下一步

- 查看 [API文档](API-DOCUMENTATION.md)（待编写）
- 查看 [架构设计](ARCHITECTURE.md)（待编写）
- 查看 [部署指南](DEPLOYMENT-GUIDE.md)

---

**文档版本：** v1.0
**最后更新：** 2026-01-03
**维护者：** 开发团队
