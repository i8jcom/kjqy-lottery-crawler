import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/',  // 部署到根路径（完全替代旧版HTML）
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',  // 允许外部访问（WSL访问）
    port: 4001,  // 新端口，避免与现有服务（4000）冲突
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../dist',  // 输出到web/dist
    sourcemap: false,  // 生产环境不生成sourcemap
    minify: 'terser',  // 使用terser压缩
    terserOptions: {
      compress: {
        drop_console: false,  // 🔧 保留console.log用于调试
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        // 手动分块策略 - 优化大文件分离
        manualChunks(id) {
          // Vue核心库
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router')) {
            return 'vue-vendor';
          }
          // ECharts图表库（最大的依赖，单独分离）
          if (id.includes('node_modules/echarts') || id.includes('node_modules/vue-echarts')) {
            return 'charts';
          }
          // 工具库
          if (id.includes('node_modules/axios') || id.includes('node_modules/nprogress')) {
            return 'utils';
          }
          // 虚拟滚动相关
          if (id.includes('node_modules/vue-virtual-scroller') || id.includes('node_modules/virtua')) {
            return 'virtual-scroller';
          }
          // 其他node_modules包
          if (id.includes('node_modules')) {
            return 'vendor-libs';
          }
        },
        // 更好的chunk命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // 分块大小警告阈值（提高到1000KB，因为echarts本身就很大）
    chunkSizeWarningLimit: 1000
  },
  // 性能优化
  optimizeDeps: {
    include: ['vue', 'vue-router', 'axios', 'echarts', 'vue-echarts', 'nprogress']
  }
})
