# 多数据源架构 - 技术文档

## 架构概览

系统已完成多数据源架构重构，支持动态路由到不同的数据源，便于未来扩展。

```
用户请求
    ↓
LotteryConfigManager (读取彩种配置)
    ↓
根据 source 字段路由
    ↓
├─ speedylot88 → SpeedyLot88Scraper
├─ custom_api → CustomScraper (待实现)
└─ official_site → OfficialScraper (待实现)
    ↓
返回统一格式数据
```

## 核心组件

### 1. LotteryConfigManager (彩种配置管理)
**位置**: `src/managers/LotteryConfigManager.js`

**职责**:
- 管理所有彩种配置（存储在 `data/lottery-configs.json`）
- 提供 `source` 字段指定数据源类型
- 维护 `lotCodeToScraperKey` 映射（用于多代码系统）

**配置格式**:
```json
{
  "lotCode": "10037",
  "name": "极速赛车",
  "source": "speedylot88",
  "enabled": true,
  "interval": 75,
  "priority": "high"
}
```

### 2. MultiSourceDataManager (实时数据路由)
**位置**: `src/services/MultiSourceDataManager.js`

**重构内容**:
- ✅ 从硬编码配置改为动态读取 LotteryConfigManager
- ✅ 根据 `source` 字段路由到不同 Scraper
- ✅ 动态统计各数据源性能指标
- ✅ 支持 speedylot88、custom_api、official_site

**路由逻辑**:
```javascript
const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
const source = lotteryConfig.source; // speedylot88 | custom_api | official_site

if (source === 'speedylot88') {
  // SpeedyLot88官网爬取
  result = await this.fetchFromSpeedyLot88(scraperKey, 3000);

} else if (source === 'custom_api') {
  // 自定义API（动态导入）
  const customScraper = (await import('../scrapers/CustomScraper.js')).default;
  result = await customScraper.fetchLatestData(lotCode);

} else if (source === 'official_site') {
  // 官方网站爬取
  throw new Error('官方网站数据源暂未实现');
}
```

### 3. WebServer (历史数据路由)
**位置**: `src/web/WebServer.js`

**API**: `/api/history-data?lotCode=XXX&date=YYYY-MM-DD`

**路由逻辑**:
```javascript
const lotteryConfig = lotteryConfigManager.getLottery(lotCode);
const source = lotteryConfig.source;

if (source === 'speedylot88') {
  const speedyLot88Scraper = (await import('../scrapers/SpeedyLot88Scraper.js')).default;
  records = await speedyLot88Scraper.fetchHistoryData(scraperKey, date);

} else if (source === 'custom_api') {
  const customScraper = (await import('../scrapers/CustomScraper.js')).default;
  records = await customScraper.fetchHistoryData(lotCode, date);
}
```

### 4. SpeedyLot88Scraper (数据源实现示例)
**位置**: `src/scrapers/SpeedyLot88Scraper.js`

**实现的方法**:
- `fetchLatestData(lotCode)` - 获取实时数据
- `fetchHistoryData(lotCode, date)` - 获取历史数据
- `parseHTML(html, lotCode)` - 解析HTML
- `checkHealth()` - 健康检查

**返回格式**:
```javascript
{
  lotCode: '10037',
  period: '33849316',
  numbers: ['08', '04', '07', ...],
  opencode: '08,04,07,03,05,10,01,02,06,09',
  drawTime: 'Tue, Dec 24, 2025 12:23:45 am',
  timestamp: 1735012425000,
  source: 'speedylot88_html'
}
```

## 数据格式规范

### 实时数据
```javascript
{
  lotCode: string,      // 彩种代码
  period: string,       // 期号
  numbers: string[],    // 号码数组
  opencode: string,     // 号码字符串（逗号分隔）
  drawTime: string,     // 开奖时间
  timestamp: number,    // 时间戳
  source: string        // 数据源标识
}
```

### 历史数据
```javascript
{
  issue: string,        // 期号
  draw_code: string,    // 号码字符串（下划线格式，数据库字段）
  drawCode: string,     // 号码字符串（驼峰格式，兼容性）
  draw_time: string,    // 开奖时间（下划线格式）
  drawTime: string,     // 开奖时间（驼峰格式）
  source: string        // 数据源标识
}
```

⚠️ **重要**: 必须同时返回下划线和驼峰两种格式，确保前端兼容性！

## 扩展新数据源

详见: [添加新数据源指南](./ADD_NEW_DATASOURCE.md)

**步骤概览**:
1. 创建新的 Scraper 类 (实现 `fetchLatestData` 和 `fetchHistoryData`)
2. 在 `MultiSourceDataManager.js` 中添加路由分支
3. 在 `WebServer.js` 中添加路由分支
4. 在 `LotteryConfigManager.js` 中添加彩种配置（指定 `source` 字段）
5. 测试并验证

## 性能监控

系统自动统计各数据源的性能指标：

```javascript
// 查看统计信息
GET /api/stats

// 返回示例
{
  "sources": {
    "speedylot88": {
      "success": 1234,
      "failure": 5,
      "successRate": "99.60%",
      "avgResponseTime": "112ms"
    },
    "custom_api": {
      "success": 567,
      "failure": 2,
      "successRate": "99.65%",
      "avgResponseTime": "85ms"
    }
  },
  "totalRequests": 1808,
  "cacheHitRate": "23.45%"
}
```

## 当前状态

### ✅ 已实现
- speedylot88 数据源（7个极速彩种）
- 动态路由架构
- 性能统计
- 缓存机制
- 历史数据查询

### 🔄 待实现
- custom_api 数据源（自定义API接口）
- official_site 数据源（官方彩票网站）
- 数据源健康检查自动化
- 数据源故障自动切换

## 技术优势

1. **灵活扩展**: 添加新数据源无需修改核心逻辑
2. **统一接口**: 所有数据源返回统一格式
3. **性能监控**: 自动统计各数据源性能指标
4. **配置驱动**: 通过配置文件管理彩种和数据源
5. **动态导入**: 按需加载 Scraper，减少内存占用

## 测试命令

```bash
# 测试实时数据
curl "http://localhost:4000/api/realtime-data?lotCode=10037"

# 测试历史数据
curl "http://localhost:4000/api/history-data?lotCode=10037&date=2025-12-23&pageNo=1&pageSize=10"

# 查看系统统计
curl "http://localhost:4000/api/stats"

# 查看彩种配置
curl "http://localhost:4000/api/lottery-configs"
```

---

**更新日期**: 2025-12-24
**版本**: v2.0 - Multi-Source Architecture
