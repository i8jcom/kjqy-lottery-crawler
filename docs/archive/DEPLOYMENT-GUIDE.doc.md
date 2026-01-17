# Vue 3 爬虫管理系统 - 生产部署指南

**版本：** v2.0.0
**部署日期：** 2026-01-03
**状态：** ✅ 生产就绪

---

## 📋 部署前检查清单

### ✅ Phase A 测试验证

- [x] 快速验证测试：100% (14/14)
- [x] 自动化页面测试：100% (10/10)
- [x] LogsPro虚拟滚动：✅ 成功（33行，23.72MB）
- [x] Lighthouse性能：99/100
- [x] Lighthouse可访问性：95/100
- [x] Lighthouse最佳实践：100/100
- [x] Lighthouse SEO：83/100
- [x] 移动端触摸目标：100% (9/9)
- [x] 高优先级Bug：0个

**验收标准达成：7/7 (100%)**

### ✅ 构建验证

```bash
# 检查构建产物
ls -lh src/web/dist/

# 应该看到：
# - index.html (2.28 kB)
# - assets/css/* (多个CSS文件)
# - assets/js/* (多个JS文件)
# - vue-vendor-ch-9tCwc.js (100.99 kB - Vue核心)
```

---

## 🚀 部署方案

### 方案概述

**双版本并行部署策略：**
- **旧版（v1）：** 保留在 `/` 路径作为备份
- **新版（v2）：** 部署在 `/v2` 路径作为主版本
- **回滚时间：** < 30秒（仅需修改路由配置）

### 架构示意

```
http://localhost:4000/
├── /              → 旧版HTML单文件（备份）
└── /v2            → Vue 3新版（主版本）
    ├── /dashboard
    ├── /realtime
    ├── /scheduler
    ├── /history
    ├── /data-management
    ├── /alerts
    ├── /sources
    ├── /lottery-configs
    ├── /logs
    └── /domain-management
```

---

## 📦 部署步骤

### 步骤1: 验证构建产物

```bash
# 进入项目根目录
cd /home/i8/claude-demo/kjqy-deploy/crawler-service

# 检查dist目录
ls -la src/web/dist/

# 验证关键文件存在
# ✅ index.html
# ✅ assets/css/index-BtgsRVAN.css
# ✅ assets/js/vue-vendor-ch-9tCwc.js
# ✅ assets/js/index-Cts4_-e5.js
```

### 步骤2: 验证后端路由配置

当前 `src/web/WebServer.js` 应该已经包含：

```javascript
// 服务新版Vue应用（已配置）
this.app.use('/v2', express.static(path.join(__dirname, 'dist')));

// 保留旧版作为备份
this.app.use('/', express.static(path.join(__dirname, 'public')));
```

**验证方法：**

```bash
# 检查WebServer.js配置
grep -n "app.use('/v2'" src/web/WebServer.js
```

### 步骤3: 重启Web服务器

```bash
# 方法1: 使用PM2（如果使用）
pm2 restart crawler-web

# 方法2: 直接重启Node进程
# 先停止现有进程
pkill -f "node.*WebServer"

# 启动新进程（在项目根目录）
node src/web/WebServer.js &

# 方法3: 使用npm脚本（如果配置了）
npm run start:web
```

### 步骤4: 验证部署

#### 4.1 访问测试

打开浏览器访问：

```
旧版（备份）：http://localhost:4000/
新版（主版本）：http://localhost:4000/v2
```

#### 4.2 快速冒烟测试

在新版控制台（F12）运行：

```javascript
// 1. 验证Vue应用已挂载
console.log('Vue App:', document.querySelector('#app').__vue_app__);

// 2. 验证路由工作
console.log('Router:', window.location.hash);

// 3. 验证WebSocket（如果运行）
// 应该看到WebSocket连接日志
```

#### 4.3 功能测试清单

- [ ] 访问 `/v2/#/dashboard` - 仪表盘加载正常
- [ ] 访问 `/v2/#/realtime` - 实时监控显示倒计时
- [ ] 访问 `/v2/#/logs` - LogsPro虚拟滚动工作
- [ ] 刷新页面 - 路由保持不变
- [ ] 移动端测试 - 按钮尺寸≥44px

---

## 🔄 灰度发布策略（可选）

### 策略1: URL分流（推荐）

**用户分组：**
- **早期用户：** 提供 `/v2` 链接试用
- **常规用户：** 继续使用 `/`
- **观察期：** 1-2周

**优点：**
- 风险可控
- 可快速回滚
- 收集真实反馈

### 策略2: 时间分流

**分阶段切换：**
1. **第1周：** 仅内部用户使用 `/v2`
2. **第2周：** 50%用户切换到 `/v2`
3. **第3周：** 100%用户切换到 `/v2`

**实现方法：**

```javascript
// 在旧版HTML添加重定向脚本
<script>
  // 50%用户重定向到v2
  if (Math.random() < 0.5) {
    window.location.href = '/v2';
  }
</script>
```

---

## ⚙️ 配置优化（生产环境）

### 1. 启用Gzip压缩（如果未启用）

编辑 `src/web/WebServer.js`：

```javascript
const compression = require('compression');

// 在路由之前添加
this.app.use(compression());
```

安装依赖：

```bash
npm install compression
```

### 2. 设置缓存策略

```javascript
// 静态资源缓存（1年）
this.app.use('/v2/assets', express.static(
  path.join(__dirname, 'dist/assets'),
  { maxAge: '1y' }
));

// HTML不缓存（确保更新及时）
this.app.use('/v2', express.static(
  path.join(__dirname, 'dist'),
  { maxAge: 0 }
));
```

### 3. 生产环境变量

```bash
# 设置环境变量
export NODE_ENV=production
export WEB_PORT=4000
```

---

## 🔍 监控与日志

### 关键监控指标

#### 1. 性能监控

```javascript
// 在index.html添加性能监控
<script>
window.addEventListener('load', () => {
  const perfData = window.performance.timing;
  const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;

  console.log('📊 页面加载时间:', pageLoadTime + 'ms');

  // 发送到监控服务器（可选）
  if (pageLoadTime > 3000) {
    console.warn('⚠️ 页面加载超过3秒！');
  }
});
</script>
```

#### 2. 错误监控

```javascript
// 全局错误捕获
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);

  // 发送到日志服务器（可选）
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: event.error.message,
      stack: event.error.stack,
      timestamp: new Date().toISOString()
    })
  });
});
```

#### 3. WebSocket连接监控

检查 `src/web/vue-app/src/composables/useWebSocket.js`：

```javascript
// 应该已经包含重连逻辑
ws.value.onclose = () => {
  connected.value = false;
  console.warn('WebSocket断开，5秒后重连...');

  // 自动重连
  setTimeout(connect, 5000);
};
```

### 日志记录

```bash
# 查看Web服务器日志
tail -f logs/web-server.log

# 或使用PM2日志
pm2 logs crawler-web
```

---

## 🔙 回滚方案

### 场景1: 新版出现严重Bug

**快速回滚（< 30秒）：**

1. **通知用户切换到旧版：**
   ```
   访问 http://localhost:4000/ 而非 /v2
   ```

2. **或临时禁用v2路由：**
   ```javascript
   // 在WebServer.js中注释掉
   // this.app.use('/v2', express.static(...));

   // 重启服务器
   pm2 restart crawler-web
   ```

### 场景2: 性能问题

**检查清单：**

1. **虚拟滚动失效？**
   ```javascript
   // 在/logs页面控制台检查
   document.querySelectorAll('.log-line').length
   // 应该 < 50，如果 > 500 说明虚拟滚动失效
   ```

2. **API响应慢？**
   ```bash
   # 检查API缓存
   # 在浏览器Network标签查看
   # 相同请求应该从缓存读取（disk cache）
   ```

3. **WebSocket断连？**
   ```javascript
   // 查看控制台日志
   // 应该看到自动重连消息
   ```

---

## 📊 性能基准

### 预期性能指标

| 指标 | 目标 | 验证方法 |
|------|------|---------|
| 首屏加载 | < 2秒 | Lighthouse / Network面板 |
| 路由切换 | < 300ms | 手动测试 |
| API响应 | < 100ms | Network面板 |
| 虚拟滚动 | 渲染<50行 | `document.querySelectorAll('.log-line').length` |
| 内存占用 | < 50MB | Performance Monitor |

### Lighthouse评分基准

```bash
# 运行Lighthouse测试
# Chrome DevTools → Lighthouse → 生成报告

预期评分：
- Performance: ≥90 (已测试：99)
- Accessibility: ≥90 (已测试：95)
- Best Practices: ≥90 (已测试：100)
- SEO: ≥80 (已测试：83)
```

---

## 🐛 常见问题排查

### 问题1: 页面空白

**症状：** 访问 `/v2` 显示空白页

**排查：**

```bash
# 1. 检查控制台错误
F12 → Console

# 2. 检查dist文件是否存在
ls -la src/web/dist/index.html

# 3. 检查路由配置
grep -n "/v2" src/web/WebServer.js

# 4. 检查服务器是否启动
curl http://localhost:4000/v2
```

### 问题2: 路由404

**症状：** 直接访问 `/v2/#/dashboard` 报404

**原因：** SPA需要配置回退路由

**解决：**

```javascript
// 在WebServer.js添加
const history = require('connect-history-api-fallback');

this.app.use('/v2', history());
this.app.use('/v2', express.static(path.join(__dirname, 'dist')));
```

### 问题3: 虚拟滚动不工作

**症状：** LogsPro渲染所有日志行

**排查：**

```javascript
// 控制台运行
const lines = document.querySelectorAll('.log-line');
console.log('渲染行数:', lines.length);

// 如果 > 100，检查CSS版本
const css = document.querySelector('link[href*="LogsPro"]');
console.log('CSS文件:', css.href);
// 应该是 LogsPro-COOtvou8.css（最新版本）
```

**解决：** 清除浏览器缓存（Ctrl+Shift+R）

### 问题4: WebSocket连接失败

**症状：** 实时数据不更新

**排查：**

```javascript
// 控制台查看WebSocket状态
console.log('WebSocket连接状态:', /* 检查useWebSocket.js状态 */);

// 检查后端WebSocket服务器
// 确保端口4000的WebSocket服务正在运行
```

---

## 📈 成功指标

### 部署后第1周监控

**必须达标：**
- [ ] 页面访问量 > 0（有用户使用）
- [ ] 错误率 < 1%
- [ ] 平均加载时间 < 2秒
- [ ] WebSocket连接成功率 > 95%
- [ ] 用户反馈：无严重Bug报告

**加分项：**
- [ ] Lighthouse性能评分保持 ≥90
- [ ] 移动端访问量占比 > 20%
- [ ] 用户满意度正面反馈 > 80%

---

## 🎯 部署后清单

### 立即执行（部署后1小时内）

- [ ] 访问所有10个页面，确认加载正常
- [ ] 运行快速验证测试：`/quick-test.js`
- [ ] 检查控制台无错误
- [ ] 测试移动端访问
- [ ] 验证WebSocket连接

### 第1天监控

- [ ] 查看服务器日志，无异常错误
- [ ] Lighthouse测试，评分未下降
- [ ] 收集用户反馈
- [ ] 监控内存/CPU占用

### 第1周监控

- [ ] 编写用户使用报告
- [ ] 统计访问量对比（v1 vs v2）
- [ ] 收集功能增强需求
- [ ] 决定是否全量切换到v2

---

## 🔐 安全检查

### 生产环境安全清单

- [ ] 移除所有console.log（生产版本）
- [ ] 检查API没有暴露敏感信息
- [ ] 验证所有用户输入经过验证
- [ ] HTTPS部署（如果是公网）
- [ ] 设置CSP（Content Security Policy）头

### CSP配置示例

```javascript
// 在WebServer.js添加
this.app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  next();
});
```

---

## 📞 支持与反馈

### 问题上报

**遇到问题时，请收集以下信息：**

1. **浏览器信息：** Chrome版本、操作系统
2. **错误截图：** F12控制台错误信息
3. **复现步骤：** 详细描述操作步骤
4. **期望行为：** 应该发生什么
5. **实际行为：** 实际发生了什么

### 联系方式

- **技术文档：** `/PHASE-A-TEST-REPORT.md`
- **测试指南：** `/TESTING-GUIDE.md`
- **手动测试清单：** `/manual-test-checklist.md`

---

## 📚 相关文档

- [Phase A测试报告](PHASE-A-TEST-REPORT.md)
- [测试执行指南](TESTING-GUIDE.md)
- [手动测试清单](manual-test-checklist.md)
- [重构计划](~/.claude/plans/smooth-swinging-yeti.md)

---

## ✅ 部署确认

**部署执行人：** __________________
**部署时间：** __________________
**验证通过：** [ ] 是  [ ] 否
**备注：** __________________

---

**🚀 准备就绪，可以开始部署！**
