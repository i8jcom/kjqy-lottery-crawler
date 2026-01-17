# 组件使用规范

本文档定义了项目中 UI 组件的使用标准，确保所有页面保持一致的视觉风格和用户体验。

## 🎨 核心设计原则

本项目采用**赛博朋克/科技风格**主题，所有组件都应遵循这一设计语言。

## 📦 推荐组件库

### 优先使用：Tech 组件库

位置：`src/components/tech/`

这些是项目自定义的科技风格组件，具有发光边框、全息效果等特色：

#### 1. **NeonButton** - 霓虹按钮
```vue
<NeonButton type="primary" @click="handleClick">
  <template #icon>
    <span>🔄</span>
  </template>
  按钮文字
</NeonButton>
```

**何时使用**：
- ✅ 所有主要操作按钮（提交、刷新、保存等）
- ✅ 对话框按钮（确认、取消等）
- ✅ 表格操作按钮
- ❌ 不要使用 `el-button`，除非是文本按钮（`type="text"`）

**支持的属性**：
- `type`: primary, success, warning, danger, info, default
- `size`: large, default, small
- `loading`: 加载状态
- `disabled`: 禁用状态
- `#icon` slot: 图标插槽

#### 2. **GlowingTag** - 发光标签
```vue
<GlowingTag
  type="success"
  text="运行中"
  effect="dark"
  :pulse="true"
/>
```

**何时使用**：
- ✅ 状态标签（运行中、已停止、成功、失败等）
- ✅ 分类标签
- ⚠️ 可以使用 `el-tag`，但推荐使用 GlowingTag 以获得更好的视觉效果

**支持的属性**：
- `type`: success, warning, danger, info, primary
- `text`: 标签文字
- `size`: large, default, small
- `effect`: dark, light, plain
- `pulse`: 是否脉冲动画

#### 3. **HolographicCard** - 全息卡片
```vue
<HolographicCard :border="true" :hover="true">
  <template #header>
    <h3>卡片标题</h3>
  </template>
  卡片内容
</HolographicCard>
```

**何时使用**：
- ✅ 所有需要卡片容器的场景
- ✅ 统计卡片
- ✅ 内容分组
- ❌ 不要使用 `el-card`

**支持的属性**：
- `border`: 是否显示边框
- `hover`: 是否有悬停效果
- `#header` slot: 头部插槽

#### 4. **CyberDialog** - 赛博对话框
```vue
<CyberDialog
  v-model="dialogVisible"
  title="对话框标题"
  width="600px"
  :scanline="true"
>
  对话框内容
  <template #footer>
    <NeonButton @click="dialogVisible = false">取消</NeonButton>
    <NeonButton type="primary" @click="handleConfirm">确认</NeonButton>
  </template>
</CyberDialog>
```

**何时使用**：
- ✅ 所有对话框场景
- ❌ 不要使用 `el-dialog`

**支持的属性**：
- `v-model`: 显示/隐藏状态
- `title`: 标题
- `width`: 宽度
- `scanline`: 是否显示扫描线效果
- `#footer` slot: 底部按钮区域

### 可以使用：Element Plus 组件

以下 Element Plus 组件可以直接使用，因为已经通过全局 CSS 进行了主题适配：

- ✅ `el-table` - 表格
- ✅ `el-input` - 输入框
- ✅ `el-select` - 下拉选择
- ✅ `el-date-picker` - 日期选择器
- ✅ `el-pagination` - 分页
- ✅ `el-form` - 表单
- ✅ `el-switch` - 开关
- ✅ `el-tag` - 标签（已全局配置颜色）
- ✅ `el-progress` - 进度条
- ✅ `el-statistic` - 统计数值

### ❌ 避免使用的组件

- ❌ `el-button` → 使用 `NeonButton` 替代
- ❌ `el-card` → 使用 `HolographicCard` 替代
- ❌ `el-dialog` → 使用 `CyberDialog` 替代

## 🎯 组件导入示例

### 单个导入
```vue
<script setup>
import NeonButton from '../components/tech/NeonButton.vue'
import HolographicCard from '../components/tech/HolographicCard.vue'
</script>
```

### 批量导入
```vue
<script setup>
import {
  HolographicCard,
  NeonButton,
  GlowingTag,
  CyberDialog
} from '../components/tech'
</script>
```

## 🎨 颜色主题

### el-tag 颜色已全局配置

所有 `el-tag` 组件会自动应用正确的颜色主题：

```vue
<!-- 这些标签会自动显示正确的颜色 -->
<el-tag type="success" effect="dark">成功</el-tag>
<el-tag type="danger" effect="dark">危险</el-tag>
<el-tag type="warning" effect="dark">警告</el-tag>
<el-tag type="info" effect="dark">信息</el-tag>
```

**颜色映射**：
- `success` → 绿色 (#67c23a)
- `danger` → 红色 (#f56c6c)
- `warning` → 橙色 (#e6a23c)
- `info` → 蓝色 (#909399)

### 主题变量

项目使用 CSS 变量进行主题管理，位于 `src/assets/styles/variables.css`：

```css
--primary-color: #667eea;
--success-color: #67c23a;
--warning-color: #e6a23c;
--danger-color: #f56c6c;
--info-color: #909399;
```

## 📝 页面开发检查清单

创建新页面时，请确保：

- [ ] 使用 `NeonButton` 而不是 `el-button`
- [ ] 使用 `HolographicCard` 而不是 `el-card`
- [ ] 使用 `CyberDialog` 而不是 `el-dialog`
- [ ] 如果使用 `el-tag`，确保设置了 `effect="dark"` 属性
- [ ] 导入了必要的 tech 组件
- [ ] 页面整体风格与其他页面保持一致

## 🔍 参考页面

以下页面是良好的实现示例：

1. **DomainManagementElementPlus.vue** - 域名管理
   - 完整使用 tech 组件
   - 按钮、卡片、对话框都使用自定义组件

2. **SourcesElementPlus.vue** - 数据源管理
   - 良好的 NeonButton 使用示例
   - GlowingTag 状态标签示例

3. **SystemMonitorElementPlus.vue** - 系统监控
   - 最新更新的页面
   - 展示了完整的组件使用规范

## 🚀 快速开始模板

```vue
<template>
  <div class="page-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">页面标题</h2>
      <p class="page-desc">页面描述</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <HolographicCard :border="true" :hover="true">
        <div class="stat-content">
          <div class="stat-icon">📊</div>
          <el-statistic :value="100" title="统计项" />
        </div>
      </HolographicCard>
    </div>

    <!-- 主要内容 -->
    <HolographicCard :border="true">
      <template #header>
        <div class="card-header">
          <h3>内容标题</h3>
          <div class="header-actions">
            <NeonButton type="primary" @click="handleAction">
              <template #icon>
                <span>✨</span>
              </template>
              操作按钮
            </NeonButton>
          </div>
        </div>
      </template>

      <!-- 表格或其他内容 -->
      <el-table :data="tableData">
        <el-table-column prop="name" label="名称" />
        <el-table-column label="状态">
          <template #default="{ row }">
            <GlowingTag
              :type="row.status === 'active' ? 'success' : 'info'"
              :text="row.status === 'active' ? '运行中' : '已停止'"
              effect="dark"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="{ row }">
            <NeonButton size="small" @click="handleEdit(row)">
              编辑
            </NeonButton>
          </template>
        </el-table-column>
      </el-table>
    </HolographicCard>

    <!-- 对话框 -->
    <CyberDialog v-model="dialogVisible" title="对话框标题">
      对话框内容
      <template #footer>
        <NeonButton @click="dialogVisible = false">取消</NeonButton>
        <NeonButton type="primary" @click="handleConfirm">确认</NeonButton>
      </template>
    </CyberDialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { HolographicCard, NeonButton, GlowingTag, CyberDialog } from '../components/tech'

const dialogVisible = ref(false)
const tableData = ref([])

const handleAction = () => {
  // 处理操作
}

const handleEdit = (row) => {
  // 处理编辑
}

const handleConfirm = () => {
  // 处理确认
  dialogVisible.value = false
}
</script>

<style scoped>
.page-container {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--tech-cyan);
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
  margin: 0 0 8px 0;
}

.page-desc {
  color: var(--text-tertiary);
  font-size: 14px;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  font-size: 32px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}
</style>
```

## 📚 更多资源

- **Tech 组件源码**：`src/components/tech/`
- **全局样式配置**：`src/assets/styles/element-plus-override.css`
- **主题变量**：`src/assets/styles/variables.css`
- **示例页面**：查看 `src/views/*ElementPlus.vue` 文件

---

**最后更新**：2026-01-16
**维护者**：开发团队

如有疑问或建议，请联系项目维护者。
