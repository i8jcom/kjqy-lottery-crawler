# 添加新数据源指南

本指南说明如何为爬虫系统添加新的彩种数据源（如其他彩票网站）。

## 系统架构

当前系统支持多数据源架构：

```
彩种配置 (LotteryConfigManager)
    ↓
根据 source 字段路由
    ↓
├─ speedylot88 → SpeedyLot88Scraper
├─ custom_api → CustomScraper (待实现)
└─ official_site → OfficialScraper (待实现)
```

## 添加新数据源的步骤

### 1. 创建新的 Scraper 类

在 `src/scrapers/` 目录下创建新的爬虫类，例如 `CustomScraper.js`：

```javascript
import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/Logger.js';

/**
 * 自定义数据源爬虫
 */
class CustomScraper {
  constructor() {
    this.baseUrl = 'https://example.com';
  }

  /**
   * 获取实时数据
   * @param {string} lotCode - 彩种代码（如 'cqssc', 'pk10'）
   * @returns {Promise<Object>} - 返回格式：{ period, numbers, opencode, drawTime }
   */
  async fetchLatestData(lotCode) {
    try {
      const url = `${this.baseUrl}/api/latest?code=${lotCode}`;
      logger.info(`[CustomScraper] 🚀 请求: ${url}`);

      const response = await axios.get(url, { timeout: 5000 });

      // 解析响应数据
      const data = response.data;

      return {
        lotCode,
        period: data.issue,           // 期号
        numbers: data.numbers,         // 号码数组
        opencode: data.numbers.join(','), // 号码字符串
        drawTime: data.time,           // 开奖时间
        timestamp: Date.now(),
        source: 'custom_api'
      };

    } catch (error) {
      logger.error(`[CustomScraper] 获取数据失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取历史数据（按日期）
   * @param {string} lotCode - 彩种代码
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @returns {Promise<Array>} - 返回格式：[{ issue, draw_code, draw_time }]
   */
  async fetchHistoryData(lotCode, date) {
    try {
      const url = `${this.baseUrl}/api/history?code=${lotCode}&date=${date}`;
      logger.info(`[CustomScraper] 🔍 获取历史数据: ${url}`);

      const response = await axios.get(url, { timeout: 8000 });
      const records = response.data.records || [];

      // 转换为统一格式
      return records.map(record => ({
        issue: record.issue,
        draw_code: record.numbers.join(','),  // 下划线格式（数据库）
        drawCode: record.numbers.join(','),   // 驼峰格式（兼容）
        draw_time: record.time,               // 下划线格式
        drawTime: record.time,                // 驼峰格式
        source: 'custom_api'
      }));

    } catch (error) {
      logger.error(`[CustomScraper] 获取历史数据失败: ${error.message}`);
      throw error;
    }
  }
}

export default new CustomScraper();
```

### 2. 在 WebServer 中注册数据源

编辑 `src/web/WebServer.js`，在历史数据API中添加新数据源：

```javascript
// 根据数据源调用不同的scraper
if (source === 'speedylot88') {
  // SpeedyLot88官网数据源
  const speedyLot88Scraper = (await import('../scrapers/SpeedyLot88Scraper.js')).default;
  records = await speedyLot88Scraper.fetchHistoryData(scraperKey, date);
} else if (source === 'custom_api') {
  // 自定义API数据源 ⬅️ 取消注释并实现
  const customScraper = (await import('../scrapers/CustomScraper.js')).default;
  records = await customScraper.fetchHistoryData(lotCode, date);
} else if (source === 'official_site') {
  // 其他数据源...
}
```

### 3. 在 MultiSourceDataManager 中添加实时数据支持

编辑 `src/services/MultiSourceDataManager.js`：

```javascript
/**
 * 从指定数据源获取数据
 */
async fetchFromSource(lotCode, sourceType) {
  const startTime = Date.now();

  try {
    if (sourceType === 'speedylot88') {
      const scraperKey = lotteryConfigManager.getScraperKey(lotCode);
      const data = await speedyLot88Scraper.fetchLatestData(scraperKey);
      return { success: true, data, responseTime: Date.now() - startTime };

    } else if (sourceType === 'custom_api') {
      // 添加自定义API支持
      const customScraper = (await import('../scrapers/CustomScraper.js')).default;
      const data = await customScraper.fetchLatestData(lotCode);
      return { success: true, data, responseTime: Date.now() - startTime };

    } else {
      throw new Error(`不支持的数据源类型: ${sourceType}`);
    }
  } catch (error) {
    return { success: false, error: error.message, responseTime: Date.now() - startTime };
  }
}
```

### 4. 添加彩种配置

在 `src/managers/LotteryConfigManager.js` 的 `initDefaultConfigs()` 中添加新彩种：

```javascript
{
  lotCode: '20001',           // 新彩种代码
  name: '重庆时时彩',           // 彩种名称
  interval: 300,              // 开奖间隔（秒）
  priority: 'high',           // 优先级
  endpoint: 'custom_api',     // 端点标识
  apiEndpoint: '/api/latest', // API路径
  historyEndpoint: '/api/history', // 历史数据路径
  enabled: true,              // 是否启用
  source: 'custom_api',       // ⬅️ 数据源标识
  description: '自定义API数据源'
}
```

### 5. （可选）添加 lotCode 映射

如果新数据源需要特殊的彩种代码映射，在 `initDefaultConfigs()` 中添加：

```javascript
// lotCode到scraper key的映射
this.lotCodeToScraperKey = new Map([
  // SpeedyLot88
  ['10037', 'jspk10'],
  ['10035', 'jsft'],
  // 自定义API
  ['20001', 'cqssc'],  // ⬅️ 添加新映射
  ['20002', 'pk10']
]);
```

## 数据格式规范

### 实时数据返回格式

```javascript
{
  lotCode: '10037',
  period: '33849296',        // 期号（必需）
  numbers: ['10', '09', ...], // 号码数组（可选）
  opencode: '10,09,05,...',  // 号码字符串（必需）
  drawTime: 'Tue, Dec 23...', // 开奖时间（必需）
  timestamp: 1703348415000,   // 时间戳
  source: 'custom_api'        // 数据源标识
}
```

### 历史数据返回格式

```javascript
[
  {
    issue: '33849296',                    // 期号（必需）
    draw_code: '10,09,05,02,08,07,...',  // 下划线格式（必需）
    drawCode: '10,09,05,02,08,07,...',   // 驼峰格式（兼容）
    draw_time: 'Tue, Dec 23, 2025...',   // 下划线格式（必需）
    drawTime: 'Tue, Dec 23, 2025...',    // 驼峰格式（兼容）
    source: 'custom_api'
  }
]
```

⚠️ **重要**：必须同时返回 `draw_code` 和 `draw_time`（下划线格式），前端依赖这些字段！

## 示例：添加福彩官网数据源

```javascript
// 1. 创建 src/scrapers/FucaiScraper.js
class FucaiScraper {
  async fetchHistoryData(lotCode, date) {
    const url = `https://www.cwl.gov.cn/fcpz/result.php?code=${lotCode}&date=${date}`;
    // 爬取并解析HTML
    const records = this.parseHTML(html);
    return records;
  }
}

// 2. 在 WebServer.js 中添加
} else if (source === 'fucai_official') {
  const fucaiScraper = (await import('../scrapers/FucaiScraper.js')).default;
  records = await fucaiScraper.fetchHistoryData(lotCode, date);
}

// 3. 添加彩种配置
{
  lotCode: '30001',
  name: '双色球',
  source: 'fucai_official',  // ⬅️ 新数据源
  enabled: true
}
```

## 测试新数据源

```bash
# 测试实时数据
curl "http://localhost:4000/api/realtime-data?lotCode=20001"

# 测试历史数据
curl "http://localhost:4000/api/history-data?lotCode=20001&date=2025-12-23&pageNo=1&pageSize=10"
```

## 常见问题

### Q: 新数据源的彩种在前端显示不出来？
A: 检查 `enabled: true` 是否设置，并确保配置文件已保存（删除 `data/lottery-configs.json` 重新生成）

### Q: 返回数据但前端显示 undefined？
A: 确保返回数据包含 `draw_code` 和 `draw_time` 字段（下划线格式）

### Q: 如何支持不同的时间格式？
A: 在 WebServer 中统一转换为 MySQL 格式后保存数据库

## 目录结构

```
src/
├── scrapers/
│   ├── SpeedyLot88Scraper.js    # 现有：SpeedyLot88
│   ├── CustomScraper.js         # 新增：自定义API
│   └── FucaiScraper.js          # 新增：福彩官网
├── services/
│   └── MultiSourceDataManager.js # 多数据源管理
├── managers/
│   └── LotteryConfigManager.js   # 彩种配置管理
└── web/
    └── WebServer.js              # API路由
```

---

**扩展原则**：
1. 每个数据源一个独立的 Scraper 类
2. 返回统一的数据格式（包含下划线和驼峰两种格式）
3. 在配置中指定 `source` 字段
4. WebServer 根据 `source` 路由到对应的 Scraper

有问题请参考 `SpeedyLot88Scraper.js` 的实现！
