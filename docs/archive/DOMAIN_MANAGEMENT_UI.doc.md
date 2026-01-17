# 🌐 域名管理前端界面使用说明

## 访问方式

**URL**: http://localhost:4000

进入管理面板后，点击导航栏的 **🌐 域名管理** 标签

---

## 📊 功能概览

### 1. 域名统计卡片

页面顶部显示实时统计信息：

- ✅ **正常域名**: status = 'active' 的域名数量
- ⚠️ **降级域名**: status = 'degraded' 的域名数量
- ❌ **故障域名**: status = 'failed' 的域名数量
- 🔢 **总域名数**: 所有域名的总数（当前18个）

### 2. 数据源筛选

支持按数据源类型筛选域名：

- **全部**: 显示所有数据源的域名
- **SpeedyLot88**: 7个彩种的域名（3个备用）
- **SGLotteries**: 6个彩种的域名（3个备用）
- **AULucky**: 4个彩种的域名（3个备用）
- **LuckySscai**: 1个彩种的域名（3个备用）
- **LuckyLottoz**: 1个彩种的域名（3个备用）
- **CWL**: 3个彩种的域名（3个备用）

### 3. 域名列表

完整的域名信息表格，包含以下字段：

| 字段 | 说明 |
|------|------|
| ID | 域名唯一标识 |
| 数据源 | 所属数据源类型 |
| 域名URL | 完整的域名地址（可点击访问） |
| 类型 | 🔵 主域名 / 🟢 备用域名 |
| 优先级 | 数字越小优先级越高 |
| 状态 | ✅ 正常 / ⚠️ 降级 / ❌ 故障 / 🔒 禁用 |
| 成功率 | 请求成功率百分比（颜色标识：绿色≥95%, 黄色≥80%, 红色<80%） |
| 响应时间 | 平均响应时间（毫秒） |
| 连续失败 | 连续失败次数（≥3次触发自动故障转移） |
| 总请求数 | 累计请求次数 |
| 最后检查 | 最后健康检查时间 |
| 操作 | 快捷操作按钮 |

**操作按钮**：
- 👁️ **查看详情**: 打开域名详情弹窗
- 🔒 **禁用** / ✅ **启用**: 切换域名启用状态
- 🗑️ **删除**: 删除域名（需确认）

---

## 🔧 主要功能

### ➕ 添加新域名

点击页面右上角的 **➕ 添加域名** 按钮，填写以下信息：

1. **数据源类型** *（必填）
   - 选择: speedylot88 / sglotteries / auluckylotteries / luckysscai / luckylottoz / cwl

2. **域名URL** *（必填）
   - 格式: https://example.com
   - 确保 URL 包含协议（http:// 或 https://）

3. **域名类型** *（必填）
   - **主域名**: priority = 1，优先使用
   - **备用域名**: priority ≥ 2，主域名故障时使用

4. **优先级** *（必填）
   - 默认值: 100
   - 数字越小优先级越高
   - 主域名通常设为 1

5. **备注**（可选）
   - 域名来源、用途、有效期等说明

点击 **添加** 后，系统会：
- 验证域名格式
- 保存到数据库（cwl_api_domains 表）
- 自动设置为 enabled=TRUE, status='active'
- 刷新域名列表

### 👁️ 查看域名详情

点击任意域名的 **👁️** 按钮，查看详细信息：

**基本信息**：
- 数据源、域名类型、URL
- 优先级、状态、启用状态

**📊 性能统计**（紫色渐变卡片）：
- 成功率（百分比）
- 平均响应时间（毫秒）
- 总请求数
- 连续失败次数

**请求统计**：
- ✅ 成功请求数（绿色背景）
- ❌ 失败请求数（红色背景）
- 🕐 最后检查时间

**失败原因**：
- 显示最近一次失败的错误信息
- 红色背景，等宽字体

**可用操作**：
- **🔍 测试域名**: 立即发起健康检查请求，返回响应时间
- **🔄 切换到此域名**: 手动切换当前数据源使用此域名
- **关闭**: 关闭详情窗口

### 🔒 启用/禁用域名

在域名列表中：
- **🔒 图标**: 当前已启用，点击禁用
- **✅ 图标**: 当前已禁用，点击启用

禁用后的域名：
- `enabled = FALSE`
- 不会被 `getBestDomain()` 选中
- 不会参与自动故障转移
- 仍保留统计数据

### 🔍 测试域名可用性

在域名详情弹窗中点击 **🔍 测试域名**：

系统会：
1. 向域名发起 HTTP GET 请求
2. 测试基础端点（如 /speedy10-result.php）
3. 测量响应时间
4. 显示测试结果：
   - 成功: `测试成功！响应时间: XXXms`
   - 失败: `测试失败: [错误信息]`

适用场景：
- 添加新域名后验证可用性
- 故障域名修复后测试
- 定期人工验证

### 🔄 手动切换域名

在域名详情弹窗中点击 **🔄 切换到此域名**：

系统会：
1. 确认操作（弹出确认框）
2. 调用 `/api/cwl/domains/switch` API
3. 记录切换历史（操作人: admin, 原因: manual）
4. 更新当前数据源的活跃域名
5. 刷新域名列表和历史记录

**注意事项**：
- 只能切换到 `enabled=TRUE` 的域名
- 切换会立即生效
- 建议先测试域名可用性再切换

### 🗑️ 删除域名

在域名列表中点击 **🗑️** 按钮：

系统会：
1. 确认操作（弹出确认框，提示不可恢复）
2. 调用 `DELETE /api/cwl/domains/:id` API
3. 从数据库永久删除
4. 刷新域名列表

**警告**：
- ⚠️ 删除操作不可恢复
- ⚠️ 不要删除正在使用的主域名
- ⚠️ 建议先禁用，观察一段时间后再删除

### 📜 域名切换历史

页面下方显示最近50条域名切换记录：

| 字段 | 说明 |
|------|------|
| 时间 | 切换发生的时间戳 |
| 数据源 | 受影响的数据源 |
| 从域名 | 切换前的域名 |
| 到域名 | 切换后的域名 |
| 切换原因 | 🔧 手动切换 / 🚨 自动故障转移 / 🏥 健康检查 |
| 操作人 | 操作者（手动切换时） / system（自动切换时） |

点击 **🔄 刷新历史** 重新加载最新记录。

---

## 🎨 UI 特性

### 颜色编码

**状态颜色**：
- ✅ **正常**（active）: 绿色 (#10b981)
- ⚠️ **降级**（degraded）: 橙色 (#f59e0b)
- ❌ **故障**（failed）: 红色 (#ef4444)
- 🔒 **禁用**（disabled）: 灰色 (#6b7280)

**成功率颜色**：
- ≥ 95%: 绿色（良好）
- 80-94%: 橙色（警告）
- < 80%: 红色（危险）

### 实时更新

- 切换到域名管理标签时自动加载数据
- 每次操作后自动刷新列表
- 支持手动刷新按钮（🔄 刷新）

### 响应式设计

- 支持桌面和平板设备
- 表格横向滚动（移动端）
- 卡片式布局自适应

---

## 🔌 API 端点

前端调用的后端 API：

| API | 方法 | 说明 |
|-----|------|------|
| `/api/cwl/domains` | GET | 获取所有域名列表 |
| `/api/cwl/domains` | POST | 添加新域名 |
| `/api/cwl/domains/:id` | PUT | 更新域名配置 |
| `/api/cwl/domains/:id` | DELETE | 删除域名 |
| `/api/cwl/domains/test` | POST | 测试域名可用性 |
| `/api/cwl/domains/switch` | POST | 手动切换域名 |
| `/api/cwl/domains/history` | GET | 获取切换历史 |
| `/api/cwl/domains/:id/health` | GET | 获取域名健康统计 |

详细 API 文档参见 `src/web/WebServer.js` 第 2523-2713 行。

---

## 📈 使用场景

### 场景1: 添加新的备用域名

1. 点击 **➕ 添加域名**
2. 选择数据源类型（如 speedylot88）
3. 输入新域名 URL（如 https://speedylot88.org）
4. 选择 **备用域名**，优先级设为 3
5. 点击 **添加**
6. 在列表中找到新域名，点击 **👁️** 查看详情
7. 点击 **🔍 测试域名** 验证可用性

### 场景2: 主域名故障，手动切换

1. 在域名列表中发现主域名状态为 **❌ 故障**
2. 点击某个备用域名的 **👁️** 按钮
3. 查看成功率和响应时间，确认可用
4. 点击 **🔍 测试域名** 再次验证
5. 测试通过后，点击 **🔄 切换到此域名**
6. 确认操作
7. 查看 **域名切换历史** 确认记录已生成

### 场景3: 定期维护，禁用不稳定域名

1. 在域名列表中按 **成功率** 列排序
2. 找到成功率 < 80% 的域名
3. 点击 **🔒** 按钮禁用该域名
4. 查看详情中的 **失败原因** 分析问题
5. 联系相关人员修复域名
6. 修复后点击 **✅** 按钮重新启用
7. 点击 **🔍 测试域名** 验证修复效果

### 场景4: 监控域名健康状态

1. 每天打开 **🌐 域名管理** 页面
2. 查看顶部统计卡片：
   - 正常域名数是否符合预期
   - 故障域名数是否增加
3. 使用数据源筛选功能逐个检查
4. 关注 **连续失败** 列，≥3 次需注意
5. 查看 **域名切换历史**，了解自动故障转移情况
6. 对频繁故障的数据源，准备更多备用域名

---

## 🔧 技术实现

### 前端技术栈

- **纯 JavaScript**: 无框架依赖
- **Fetch API**: 异步请求
- **CSS Grid/Flexbox**: 响应式布局
- **CSS 变量**: 统一主题配色

### 关键 JavaScript 函数

```javascript
// 主要函数列表
refreshDomains()          // 刷新域名列表
renderDomains()           // 渲染域名表格
updateDomainStats()       // 更新统计卡片
filterDomainsBySource()   // 数据源筛选
showDomainDetails()       // 显示详情弹窗
toggleDomainEnabled()     // 启用/禁用域名
testDomain()              // 测试域名
switchToDomain()          // 手动切换
deleteDomain()            // 删除域名
refreshDomainHistory()    // 刷新历史
renderDomainHistory()     // 渲染历史表格
```

### 状态管理

```javascript
let currentDomainFilter = 'all';  // 当前筛选器
let allDomainsData = [];          // 域名数据缓存
```

### 自动加载

切换到域名管理标签时自动触发：
```javascript
window.switchTab = function(tabName) {
  originalSwitchTab(tabName);
  if (tabName === 'domain-management') {
    refreshDomains();
    refreshDomainHistory();
  }
};
```

---

## 📊 数据库表结构

域名管理使用 `cwl_api_domains` 表，关键字段：

```sql
CREATE TABLE cwl_api_domains (
  id INT PRIMARY KEY AUTO_INCREMENT,
  source_type VARCHAR(50) NOT NULL,       -- 数据源类型
  domain_url VARCHAR(255) NOT NULL,       -- 域名URL
  domain_type ENUM('primary', 'backup'),  -- 域名类型
  priority INT DEFAULT 100,               -- 优先级
  status ENUM('active', 'degraded', 'failed', 'disabled'),
  enabled BOOLEAN DEFAULT TRUE,           -- 是否启用
  response_time_ms INT DEFAULT 0,         -- 响应时间
  success_rate DECIMAL(5,2) DEFAULT 100,  -- 成功率
  consecutive_failures INT DEFAULT 0,     -- 连续失败
  total_requests BIGINT DEFAULT 0,
  success_requests BIGINT DEFAULT 0,
  failed_requests BIGINT DEFAULT 0,
  last_check_at DATETIME,
  last_success_at DATETIME,
  last_failure_at DATETIME,
  failure_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_source_domain (source_type, domain_url)
);
```

---

## ✅ 测试验证

运行测试脚本验证功能：

```bash
bash /home/i8/claude-demo/kjqy-deploy/crawler-service/test_domain_management_ui.sh
```

测试内容：
1. ✅ 前端页面包含域名管理导航
2. ✅ 域名列表 API 正常返回
3. ✅ 域名历史 API 正常返回
4. ✅ 按数据源分组统计
5. ✅ 各数据源状态监控
6. ✅ 所有 JavaScript 函数存在

---

## 🎯 后续优化建议

### 功能增强

1. **批量操作**
   - 批量启用/禁用域名
   - 批量删除域名
   - 批量测试域名

2. **高级筛选**
   - 按状态筛选（正常/故障/禁用）
   - 按成功率范围筛选
   - 按响应时间范围筛选

3. **图表可视化**
   - 域名响应时间趋势图（Chart.js）
   - 成功率变化折线图
   - 数据源健康状态饼图

4. **实时监控**
   - WebSocket 实时推送域名状态变化
   - 浏览器通知（故障告警）
   - 自动刷新列表（可配置间隔）

5. **导出功能**
   - 导出域名配置为 JSON
   - 导出切换历史为 CSV
   - 生成健康报告 PDF

### UI 改进

1. **表格排序**
   - 点击表头按字段排序
   - 支持升序/降序切换

2. **分页功能**
   - 域名列表分页显示
   - 每页显示数量可配置

3. **搜索功能**
   - 按域名 URL 搜索
   - 按备注内容搜索

4. **暗色模式**
   - 支持深色主题切换
   - 跟随系统主题

---

## 🎉 总结

域名管理前端已完整实现，提供了直观、易用的可视化界面来管理 6 个数据源的 18 个域名。

**核心价值**：
- 🚀 **零停机运维**: 可视化监控和快速切换
- 📊 **数据驱动**: 实时统计和历史追溯
- 🛡️ **风险控制**: 禁用/测试/删除的安全操作
- 🎯 **操作简便**: 所有功能一键触达

**配合后端功能**：
- ✅ 自动健康检查（每5分钟）
- ✅ 自动故障转移（连续3次失败）
- ✅ 性能统计和记录
- ✅ 完整的审计日志

**系统已生产就绪！** 🎊
