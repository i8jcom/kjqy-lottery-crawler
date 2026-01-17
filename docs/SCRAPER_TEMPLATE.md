# 爬虫开发模板和规范

## 📋 快速检查清单

每次添加新彩种时，按此清单逐项检查：

### ✅ 第1步：创建爬虫类
- [ ] 继承自 BaseScraper（如果有）或遵循统一接口
- [ ] 实现 `fetchLatestData(lotCode)` 方法
- [ ] 实现 `fetchHistoryData(lotCode, date)` 方法
- [ ] 实现 `checkHealth()` 方法
- [ ] **关键：确保字段使用驼峰命名**

### ✅ 第2步：数据格式规范（必须遵守！）

**fetchLatestData() 返回格式：**
```javascript
{
  lotCode: '100009',           // 彩种代码
  period: '115000001',          // 期号（推荐）
  issue: '115000001',           // 期号（备用）
  numbers: [3, 7, 16, 19, 40, 42],  // 主号码数组
  mainNumbers: [3, 7, 16, 19, 40, 42],  // 主号码（可选）
  specialNumbers: [],           // 特别号码数组（如果有）
  opencode: '3,7,16,19,40,42', // 号码字符串（可选，会自动转为drawCode）
  drawCode: '3,7,16,19,40,42', // 号码字符串（驼峰命名！）✅
  drawTime: '2026-01-02 00:00:00',  // 开奖时间（驼峰命名！）✅
  unixtime: 1735776000,         // Unix时间戳（可选）
  source: 'taiwanlottery_49m6_api'  // 数据源标识
}
```

**fetchHistoryData() 返回格式：**
```javascript
[
  {
    issue: '115000001',              // 期号
    drawCode: '3,7,16,19,40,42',    // 驼峰命名！✅
    drawTime: '2026-01-02 00:00:00', // 驼峰命名！✅
    specialNumbers: [],              // 特别号码数组
    source: 'taiwanlottery_49m6_api'
  },
  // ...更多记录
]
```

**⚠️ 常见错误：**
```javascript
// ❌ 错误：使用下划线命名
{
  draw_code: '1,2,3',  // 错误！
  draw_time: '2026-01-01'  // 错误！
}

// ✅ 正确：使用驼峰命名
{
  drawCode: '1,2,3',   // 正确 ✅
  drawTime: '2026-01-01'  // 正确 ✅
}
```

### ✅ 第3步：配置文件更新
- [ ] 在 `data/lottery-configs.json` 添加彩种配置
- [ ] 设置正确的 `scraperKey`
- [ ] 添加到 `lotCodeToScraperKey` 映射
- [ ] 设置 `drawSchedule`（如果有固定时间）

### ✅ 第4步：集成到MultiSourceDataManager
- [ ] 导入爬虫类
- [ ] 添加路由逻辑（根据lotCode分发）
- [ ] 确保字段转换正确（如 opencode → drawCode）

### ✅ 第5步：WebServer历史数据支持
- [ ] 在 `WebServer.js` 添加历史数据爬取逻辑
- [ ] 更新 `expectedCounts` 配置
- [ ] 测试月份/年份查询

### ✅ 第6步：前端显示配置
- [ ] 在 `Realtime.vue` 添加号码球样式
- [ ] 在 `History.vue` 添加号码球样式
- [ ] 在 `LotteryConfigs.vue` 添加号码球样式
- [ ] 构建前端：`cd src/web/vue-app && npm run build`

### ✅ 第7步：测试验证
- [ ] 创建测试脚本 `test-<lottery-name>.js`
- [ ] 测试 fetchLatestData()
- [ ] 测试 fetchHistoryData()
- [ ] 测试 checkHealth()
- [ ] **验证数据库字段：确保 draw_code 和 draw_time 不为空**

### ✅ 第8步：触发数据爬取
- [ ] HTTP API触发：`/api/history-data?lotCode=XXX&year=2025`
- [ ] 或创建触发脚本 `trigger-<lottery-name>-crawl.sh`
- [ ] **验证数据保存成功**

### ✅ 第9步：前端验证
- [ ] 刷新 `/lottery-configs` 页面
- [ ] 检查总记录数是否正确
- [ ] **检查开奖号码是否显示**（关键！）
- [ ] 检查 `/history` 页面显示
- [ ] 检查 `/realtime` 页面显示

---

## 🚨 最容易出错的地方（重点关注！）

### 1. 字段命名不一致 ⭐⭐⭐⭐⭐
**问题：** 混用 `draw_code` 和 `drawCode`
**解决：** 始终使用驼峰命名 `drawCode`, `drawTime`

### 2. API返回数据不完整 ⭐⭐⭐⭐
**问题：** `/api/lotteries/configs` 没有查询数据库
**解决：** 已修复，自动补充 recordCount、numbers、issue 等字段

### 3. 前端没有适配新彩种 ⭐⭐⭐
**问题：** 忘记在3个Vue文件中添加样式
**解决：** 按检查清单第6步操作

### 4. 数据库验证不充分 ⭐⭐⭐
**问题：** 数据保存后没验证字段是否为空
**解决：** 始终查询数据库确认 `draw_code IS NOT NULL AND draw_code != ''`

---

## 📝 标准爬虫模板代码

```javascript
/**
 * 标准爬虫模板 - 复制此模板开始开发
 */
import axios from 'axios';
import logger from '../utils/Logger.js';

class StandardScraper {
  constructor() {
    this.apiBaseUrl = 'https://api.example.com';
    this.lotCode = '100XXX';
    this.lotteryName = '彩种名称';
  }

  /**
   * 获取最新一期数据
   * @returns {Object} 标准格式数据对象
   */
  async fetchLatestData(lotCode, retryCount = 0, maxRetries = 2) {
    try {
      logger.info(`[${this.lotteryName}] 开始获取最新数据 (lotCode=${lotCode})`);

      const apiUrl = `${this.apiBaseUrl}/latest`;
      const response = await axios.get(apiUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });

      if (!response.data) {
        throw new Error('API返回数据为空');
      }

      // 解析API数据
      const result = response.data;
      const numbers = result.numbers || [];  // 根据实际API调整

      // ✅ 返回标准格式（驼峰命名！）
      return {
        lotCode: this.lotCode,
        period: String(result.period),
        issue: String(result.period),
        numbers: numbers,
        mainNumbers: numbers,
        specialNumbers: result.special || [],
        opencode: numbers.join(','),
        drawCode: numbers.join(','),      // ✅ 驼峰命名
        drawTime: result.drawTime,         // ✅ 驼峰命名，格式：YYYY-MM-DD HH:mm:ss
        unixtime: result.timestamp || null,
        source: `${this.lotteryName.toLowerCase()}_api`
      };

    } catch (error) {
      logger.error(`[${this.lotteryName}] 获取最新数据失败:`, error.message);

      // 重试逻辑
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.fetchLatestData(lotCode, retryCount + 1, maxRetries);
      }

      throw error;
    }
  }

  /**
   * 获取历史数据
   * @param {string} lotCode - 彩种代码
   * @param {string} date - 查询日期（格式：YYYY-MM 或 YYYY-MM-DD）
   * @returns {Array} 历史数据数组
   */
  async fetchHistoryData(lotCode, date = null) {
    try {
      logger.info(`[${this.lotteryName}] 获取历史数据: ${date || '默认日期'}`);

      const apiUrl = `${this.apiBaseUrl}/history?date=${date}`;
      const response = await axios.get(apiUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });

      const results = response.data.records || [];

      // ✅ 返回标准格式数组（驼峰命名！）
      return results.map(item => ({
        issue: String(item.period),
        drawCode: item.numbers.join(','),  // ✅ 驼峰命名
        drawTime: item.drawTime,            // ✅ 驼峰命名
        specialNumbers: item.special || [],
        source: `${this.lotteryName.toLowerCase()}_api`
      }));

    } catch (error) {
      logger.error(`[${this.lotteryName}] 获取历史数据失败:`, error.message);
      return [];
    }
  }

  /**
   * 健康检查
   */
  async checkHealth() {
    try {
      const data = await this.fetchLatestData(this.lotCode);
      return {
        status: 'healthy',
        lastUpdate: data.drawTime,
        latestIssue: data.period
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

export default new StandardScraper();
```

---

## 🔧 快速测试脚本模板

```javascript
/**
 * 测试爬虫 - test-<lottery-name>.js
 */
import scraper from './src/scrapers/YourScraper.js';
import logger from './src/utils/Logger.js';

async function test() {
  try {
    // 1. 测试最新数据
    logger.info('📊 测试1: 获取最新数据');
    const latest = await scraper.fetchLatestData('100XXX');
    logger.info('✅ 最新数据:', JSON.stringify(latest, null, 2));

    // ⚠️ 验证字段命名
    if (!latest.drawCode) {
      logger.error('❌ 错误：缺少 drawCode 字段（驼峰命名）');
    }
    if (!latest.drawTime) {
      logger.error('❌ 错误：缺少 drawTime 字段（驼峰命名）');
    }

    // 2. 测试历史数据
    logger.info('\n📊 测试2: 获取历史数据');
    const history = await scraper.fetchHistoryData('100XXX', '2025-12');
    logger.info(`✅ 获取到 ${history.length} 条历史记录`);
    if (history.length > 0) {
      logger.info('样本:', JSON.stringify(history[0], null, 2));

      // ⚠️ 验证字段命名
      if (!history[0].drawCode) {
        logger.error('❌ 错误：缺少 drawCode 字段（驼峰命名）');
      }
    }

    // 3. 测试健康检查
    logger.info('\n📊 测试3: 健康检查');
    const health = await scraper.checkHealth();
    logger.info('✅ 健康状态:', JSON.stringify(health, null, 2));

    logger.info('\n🎉 测试完成！');
    process.exit(0);
  } catch (error) {
    logger.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

test();
```

---

## 📚 参考示例

**好的示例：**
- `Taiwan39M5Scraper.js` - 字段命名规范
- `TaiwanBingoScraper.js` - 完整实现

**Taiwan49M6遇到的问题：**
```javascript
// ❌ 原来的错误代码
return {
  issue: String(item.period),
  draw_code: numbers.join(','),  // 错误：下划线命名
  draw_time: drawTime,            // 错误：下划线命名
}

// ✅ 修复后的正确代码
return {
  issue: String(item.period),
  drawCode: numbers.join(','),   // 正确：驼峰命名
  drawTime: drawTime,             // 正确：驼峰命名
}
```

---

## 🎯 总结：避免问题的3个黄金法则

1. **始终使用驼峰命名** - `drawCode`, `drawTime`, `specialNumbers`
2. **参照现有爬虫** - 复制 Taiwan39M5Scraper 修改，不要从头写
3. **先测试后集成** - 运行测试脚本验证字段，确认数据保存成功后再继续

---

遵循此模板和检查清单，添加新彩种将变得简单可靠！ 🚀
