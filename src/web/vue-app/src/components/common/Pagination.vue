<template>
  <div class="pagination-wrapper" v-if="totalPages > 1">
    <div class="pagination-info">
      <span class="info-text">
        共 <strong>{{ total }}</strong> 条，每页 <strong>{{ pageSize }}</strong> 条
      </span>
    </div>

    <div class="pagination-controls">
      <!-- 上一页 -->
      <button
        class="page-btn"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        <span>←</span>
      </button>

      <!-- 页码列表 -->
      <template v-for="page in visiblePages" :key="page">
        <button
          v-if="page !== '...'"
          class="page-btn"
          :class="{ active: page === currentPage }"
          @click="goToPage(page)"
        >
          {{ page }}
        </button>
        <span v-else class="ellipsis">...</span>
      </template>

      <!-- 下一页 -->
      <button
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        <span>→</span>
      </button>
    </div>

    <div class="pagination-jump">
      <span>跳至</span>
      <input
        type="number"
        :min="1"
        :max="totalPages"
        v-model.number="jumpPage"
        @keyup.enter="handleJump"
      />
      <span>页</span>
      <button class="jump-btn" @click="handleJump">确定</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  // 当前页码
  currentPage: {
    type: Number,
    default: 1
  },
  // 每页条数
  pageSize: {
    type: Number,
    default: 20
  },
  // 总条数
  total: {
    type: Number,
    required: true
  },
  // 最多显示页码数
  maxVisible: {
    type: Number,
    default: 7
  }
})

const emit = defineEmits(['page-change'])

// 跳转页码输入
const jumpPage = ref(props.currentPage)

// 总页数
const totalPages = computed(() => {
  return Math.ceil(props.total / props.pageSize)
})

// 可见页码列表
const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = props.currentPage
  const max = props.maxVisible

  if (total <= max) {
    // 页数少于最大显示数，全部显示
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    // 页数多于最大显示数，使用省略号
    const half = Math.floor(max / 2)

    if (current <= half + 1) {
      // 靠近开头
      for (let i = 1; i <= max - 2; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    } else if (current >= total - half) {
      // 靠近末尾
      pages.push(1)
      pages.push('...')
      for (let i = total - (max - 3); i <= total; i++) {
        pages.push(i)
      }
    } else {
      // 在中间
      pages.push(1)
      pages.push('...')
      for (let i = current - half + 2; i <= current + half - 2; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(total)
    }
  }

  return pages
})

// 跳转到指定页
const goToPage = (page) => {
  if (page < 1 || page > totalPages.value || page === props.currentPage) {
    return
  }
  emit('page-change', page)
}

// 处理跳转
const handleJump = () => {
  const page = jumpPage.value
  if (page >= 1 && page <= totalPages.value) {
    goToPage(page)
  } else {
    jumpPage.value = props.currentPage
  }
}

// 监听当前页变化，同步跳转输入框
watch(() => props.currentPage, (val) => {
  jumpPage.value = val
})
</script>

<style scoped>
.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px;
  background: var(--glass-bg);
  border-radius: 12px;
  flex-wrap: wrap;
}

/* 信息区 */
.pagination-info {
  color: var(--text-secondary);
  font-size: 14px;
}

.info-text strong {
  color: var(--text-primary);
  font-weight: 600;
}

/* 控制按钮区 */
.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-color);
  background: var(--glass-bg);
  color: var(--text-primary);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: var(--border-color);
  border-color: var(--glass-border);
  transform: translateY(-1px);
}

.page-btn.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-color: transparent;
  color: white;
  font-weight: 600;
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ellipsis {
  color: var(--text-muted);
  padding: 0 4px;
  font-size: 14px;
}

/* 跳转区 */
.pagination-jump {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 14px;
}

.pagination-jump input {
  width: 60px;
  height: 36px;
  padding: 0 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  text-align: center;
  transition: all 0.2s;
}

.pagination-jump input:focus {
  outline: none;
  border-color: #667eea;
  background: var(--glass-bg);
}

/* 移除数字输入框的箭头 */
.pagination-jump input::-webkit-inner-spin-button,
.pagination-jump input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.pagination-jump input[type='number'] {
  -moz-appearance: textfield;
}

.jump-btn {
  height: 36px;
  padding: 0 16px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.jump-btn:hover {
  background: var(--border-color);
  border-color: var(--glass-border);
}

/* 响应式 */
@media (max-width: 768px) {
  .pagination-wrapper {
    flex-direction: column;
    gap: 16px;
  }

  .pagination-info {
    width: 100%;
    text-align: center;
  }

  .pagination-jump {
    width: 100%;
    justify-content: center;
  }
}
</style>
