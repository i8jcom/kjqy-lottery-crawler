# 香港六合彩双数据源架构说明

## 🎯 架构设计

本系统采用 **双数据源架构**，结合两个数据源的优势：

| 数据源 | 用途 | 特点 | 爬虫类 |
|--------|------|------|--------|
| **On.cc API** | 实时数据 | 快速(~420ms)、稳定、最新 | `HKJCScraper.js` |
| **cpzhan.com** | 历史数据 | 完整(1976-2025)、准确 | `CPZhanHistoryScraper.js` |

---

## ✅ 已验证特性

### 1. 数据准确性 ✅
两个数据源的数据**完全一致**：
- 期号匹配: ✅
- 号码匹配: ✅（排序后比对）
- 开奖时间匹配: ✅

验证脚本：`node verify-cpzhan-accuracy.js`

### 2. 性能对比

| 指标 | On.cc API | cpzhan.com |
|------|-----------|------------|
| 响应时间 | ~860ms | ~1674ms |
| 速度优势 | **1.95x 更快** | - |
| 数据范围 | 最近 154 期 | **1976-2025 (50年)** |
| 更新频率 | 实时更新 | 每期更新 |
| 用途 | ⭐ 实时轮询 | ⭐ 历史补充 |

### 3. 系统稳定性

**On.cc API:**
- 连续10次请求成功率: 100%
- 无反爬虫限制
- 香港知名新闻门户，运营稳定

**cpzhan.com:**
- 运营历史: 16年 (2009-2025)
- 数据覆盖: 近50年完整记录
- 第三方网站，存在关闭风险（建议一次性导入历史数据）

---

## 📋 使用指南

### 🔄 实时数据（日常运行）

系统已自动配置，使用 On.cc API 获取实时数据：

```bash
# 查看实时数据
curl "http://localhost:4000/api/realtime-data?lotCode=60001"

# 响应示例
{
  "success": true,
  "data": {
    "lotCode": "60001",
    "issue": "25133",
    "drawCode": "1,2,4,30,41,43",
    "extra": "13",
    "drawTime": "2025-12-25 21:30:00",
    "countdown": 86198,
    "source": "hkjc"
  }
}
```

**自动运行**: 爬虫服务会每5秒轮询一次 On.cc API

### 📚 历史数据（一次性导入）

#### 方法1: 批量导入脚本（推荐）

```bash
# 进入容器
docker exec -it lottery-crawler-compose bash

# 导入 2011-2025 年历史数据
node scripts/importHKJCHistory.js 2011 2025

# 或者指定特定年份
node scripts/importHKJCHistory.js 2024 2024  # 仅导入2024年
```

**导入时间估算**:
- 每年 ~2秒
- 2011-2025 (15年) 约 30秒
- 显示实时进度条

**示例输出**:
```
═══════════════════════════════════════════════════════════════════
  香港六合彩历史数据导入工具
═══════════════════════════════════════════════════════════════════

数据源:     cpzhan.com
年份范围:   2011 - 2025
彩种代码:   60001

[1/15] 2011年: 143期 [██████████████████████████████] 100%
[2/15] 2012年: 140期 [██████████████████████████████] 100%
...

═══════════════════════════════════════════════════════════════════
  导入完成报告
═══════════════════════════════════════════════════════════════════

总记录数:   2100
新增记录:   2100
更新记录:   0
错误数量:   0

✅ 导入成功，无错误！
```

#### 方法2: 手动测试导入

```bash
# 测试双数据源架构
node test-dual-source.js

# 测试小样本导入（需在容器内运行）
docker exec -it lottery-crawler-compose node test-import-sample.js
```

---

## 🔧 技术实现

### 文件结构

```
crawler-service/
├── src/
│   └── scrapers/
│       ├── HKJCScraper.js          # On.cc API 实时数据爬虫
│       └── CPZhanHistoryScraper.js # cpzhan.com 历史数据爬虫
├── scripts/
│   └── importHKJCHistory.js        # 批量导入脚本
├── test-dual-source.js             # 双数据源测试
├── test-import-sample.js           # 小样本导入测试
└── verify-cpzhan-accuracy.js       # 数据准确性验证
```

### HKJCScraper.js (实时数据)

```javascript
import HKJCScraper from './src/scrapers/HKJCScraper.js';

const scraper = new HKJCScraper();

// 获取最新数据
const data = await scraper.fetchLatestData();
// {
//   period: "25133",
//   opencode: "1,2,4,30,41,43",
//   extra: "13",
//   opentime: "2025-12-25 21:30:00",
//   countdown: 26400
// }

// 健康检查
const health = await scraper.healthCheck();
// { healthy: true, dataCount: 154, ... }
```

### CPZhanHistoryScraper.js (历史数据)

```javascript
import CPZhanHistoryScraper from './src/scrapers/CPZhanHistoryScraper.js';

const scraper = new CPZhanHistoryScraper();

// 获取单年数据
const records = await scraper.fetchYearData(2024);
// [ { period: "24140", opencode: "...", ... }, ... ]

// 批量获取多年数据
const result = await scraper.fetchMultipleYears(2020, 2025, (year, total, current) => {
  console.log(`进度: ${current}/${total} - ${year}年`);
});
// {
//   totalRecords: 850,
//   yearlyData: { 2020: [...], 2021: [...], ... }
// }

// 数据验证
const validation = scraper.validateData(onccData, cpzhanData);
// { valid: true, issueMatch: true, numbersMatch: true }
```

---

## 🧪 测试与验证

### 1. 测试双数据源架构

```bash
node test-dual-source.js
```

**测试内容**:
- ✅ On.cc API 健康检查
- ✅ cpzhan.com 健康检查
- ✅ 数据准确性验证
- ✅ 性能对比
- ✅ 历史数据完整性

### 2. 验证数据准确性

```bash
node verify-cpzhan-accuracy.js
```

**验证项**:
- 期号是否一致
- 开奖号码是否一致（排序后比对）
- 开奖时间是否一致

### 3. 测试小样本导入

```bash
# 在容器内运行
docker exec -it lottery-crawler-compose node test-import-sample.js
```

仅导入 2024 年数据测试

---

## 📊 数据格式说明

### On.cc API 原始格式

```json
{
  "drawNumber": "25/133",
  "drawDate": "2025-12-25",
  "drawDay": "4",
  "drawResult": "1,2,4,30,41,43,13",
  "nextDrawNumber": "25/134",
  "nextDrawDate": "2025-12-28",
  "stopSellingTime": "21:15",
  "jackpot": "24216278",
  "totalTurnover": "74326662"
}
```

### cpzhan.com 原始格式

```
HTML表格:
年份 | 期数 | 開獎日期 | N1 | N2 | N3 | N4 | N5 | N6 | 特码
2025 | 133  | 2025-12-25 | 1 | 30 | 41 | 2 | 4 | 43 | 13
```

### 系统统一格式

```json
{
  "period": "25133",           // 期号 (年份后2位 + 期数)
  "opencode": "1,2,4,30,41,43", // 正码 (6个号码)
  "extra": "13",               // 特别号
  "opentime": "2025-12-25 21:30:00", // 开奖时间
  "countdown": 86400           // 倒计时（秒）
}
```

---

## 🚀 性能优化建议

### 1. 历史数据导入策略

✅ **推荐**: 一次性导入所有历史数据到数据库

```bash
# 导入 2011-2025 年历史数据（约30秒）
docker exec -it lottery-crawler-compose node scripts/importHKJCHistory.js 2011 2025
```

**好处**:
- 数据永久保存在数据库
- 不依赖 cpzhan.com 可用性
- 查询速度快

### 2. 实时数据轮询

系统已自动配置，默认策略：
- 距离开奖 > 300秒: 每 5秒 轮询一次
- 距离开奖 ≤ 300秒: 每 1秒 轮询一次
- 开奖后: 立即获取新期号

### 3. 数据验证

定期（如每月）运行验证脚本：

```bash
node verify-cpzhan-accuracy.js
```

确保两个数据源保持一致。

---

## ⚠️ 注意事项

### cpzhan.com 使用限制

1. **第三方网站风险**
   - 非官方数据源
   - 可能关闭或变更
   - **建议**: 尽快导入历史数据到本地数据库

2. **请求频率**
   - 脚本已内置 1.5秒 请求间隔
   - 避免短时间大量请求

3. **数据更新**
   - 历史数据相对稳定
   - 仅用于一次性批量导入
   - 日常使用 On.cc API

### On.cc API 使用建议

1. **稳定性高** - 大型新闻门户，长期稳定
2. **响应快** - 平均 ~420ms
3. **无限制** - 测试显示无反爬虫机制
4. **实时性好** - 开奖后立即更新

---

## 📖 相关文档

- `HKJC-Integration-Report.md` - 集成完成报告
- `verify-hkjc-integration.sh` - 集成验证脚本
- `test-hkjc-oncc.js` - On.cc API 功能测试

---

## 🎉 总结

双数据源架构优势：

| 优势 | 说明 |
|------|------|
| ⚡ **性能** | On.cc API 响应快 (~420ms) |
| 📊 **完整性** | cpzhan 提供50年历史数据 |
| ✅ **准确性** | 两个源数据完全一致，互为验证 |
| 🔄 **容错性** | 数据源互为备份 |
| 🚀 **扩展性** | 易于添加更多数据源 |

**最佳实践**:
1. ✅ 运行一次历史数据导入: `node scripts/importHKJCHistory.js 2011 2025`
2. ✅ 日常使用 On.cc API 自动轮询实时数据
3. ✅ 定期验证数据准确性

**当前状态**:
- 实时数据: ✅ 运行中
- 历史数据: ⏳ 待导入（可选）
