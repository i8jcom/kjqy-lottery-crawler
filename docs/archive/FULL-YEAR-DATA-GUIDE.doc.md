# 📅 福彩完整年度数据获取指南

## 🎯 功能说明

获取福彩任意年份的**完整历史数据**，通过多次API调用自动合并去重。

### 核心特点

✅ **智能多次查询**：自动计算需要查询几次
✅ **自动合并去重**：多次查询结果自动去重
✅ **完整年度覆盖**：低频彩100%+，高频彩100%
✅ **生成SQL文件**：方便导入和备份
✅ **附带相邻年份**：一次查询多年受益

---

## 📊 各彩种年度期数

| 彩种 | 年度期数 | 查询次数 | 覆盖率 | 时间 |
|------|----------|----------|--------|------|
| **福彩双色球** | ~149期 | 2次 | 101%+ | ~6秒 |
| **福彩3D** | ~352期 | 4次 | 100% | ~12秒 |
| **福彩七乐彩** | ~149期 | 2次 | 101%+ | ~6秒 |
| **福彩快乐8** | ~352期 | 4次 | 100% | ~12秒 |

**说明**：
- 低频彩（双色球、七乐彩）：2次查询完全覆盖
- 高频彩（福彩3D、快乐8）：4次查询完全覆盖
- 覆盖率>100%：实际期数可能略多于预期

---

## 🚀 使用方法

### 基本用法

```bash
node fetch-full-year-data.js <彩种> [年份]
```

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `<彩种>` | 必需 | ssq, fc3d, qlc, kl8 |
| `[年份]` | 可选 | 2024, 2023, 2022... |

### 彩种代码

| 代码 | 彩种名称 | 说明 |
|------|----------|------|
| `ssq` | 福彩双色球 | 周二、四、日开奖 |
| `fc3d` | 福彩3D | 每天开奖 |
| `qlc` | 福彩七乐彩 | 周一、三、五开奖 |
| `kl8` | 福彩快乐8 | 每天开奖 |

---

## 📝 使用示例

### 示例1：获取2024年双色球完整数据

```bash
node fetch-full-year-data.js ssq 2024
```

**输出**：
```
🎯 开始获取 福彩双色球 2024年完整数据
   预计年度期数: ~149期
   需要查询次数: 2次

📡 查询 1/2: date=2024-12-31
   ✅ 返回100期，新增100期，累计100期

📡 查询 2/2: date=2024-06-30
   ✅ 返回100期，新增77期，累计177期

📊 数据汇总:
   总获取: 177期
   2024年: 151期
   覆盖率: 101.3%
   期号范围: 2024001 ~ 2024151

💾 生成SQL文件...
✅ SQL文件已生成: sql/full_year_ssq_2024.sql

📥 导入到数据库:
   cat sql/full_year_ssq_2024.sql | docker exec -i lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler
```

**导入数据库**：
```bash
cat sql/full_year_ssq_2024.sql | docker exec -i lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler
```

**验证**：
```bash
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e \
  "SELECT COUNT(*) FROM lottery_results WHERE lot_code='70001' AND YEAR(draw_time)=2024;"
# 结果：151
```

### 示例2：获取2024年福彩3D完整数据

```bash
node fetch-full-year-data.js fc3d 2024
```

**输出**：
```
🎯 开始获取 福彩3D 2024年完整数据
   预计年度期数: ~352期
   需要查询次数: 4次

📡 查询 1/4: date=2024-12-31
   ✅ 返回100期，新增100期，累计100期

📡 查询 2/4: date=2024-09-30
   ✅ 返回100期，新增88期，累计188期

📡 查询 3/4: date=2024-06-30
   ✅ 返回100期，新增92期，累计280期

📡 查询 4/4: date=2024-03-31
   ✅ 返回100期，新增91期，累计371期

📊 数据汇总:
   总获取: 371期
   2024年: 352期
   覆盖率: 100.0%
   期号范围: 2024001 ~ 2024352
```

### 示例3：获取2023年七乐彩数据

```bash
node fetch-full-year-data.js qlc 2023
```

---

## 🔧 工作原理

### 查询策略

通过在一年内的不同时间点查询，获取完整年度数据：

**福彩双色球/七乐彩**（2次查询）：
```
查询1: date=2024-12-31 → 获取后100期（2024-05-09 ~ 2024-12-31）
查询2: date=2024-06-30 → 获取前100期（2023-11-02 ~ 2024-06-30）
合并去重 → 151期完整数据
```

**福彩3D/快乐8**（4次查询）：
```
查询1: date=2024-12-31 → 100期（2024-09-23 ~ 2024-12-31）
查询2: date=2024-09-30 → 100期（2024-06-23 ~ 2024-09-30）
查询3: date=2024-06-30 → 100期（2024-03-22 ~ 2024-06-30）
查询4: date=2024-03-31 → 100期（2023-12-22 ~ 2024-03-31）
合并去重 → 352期完整数据
```

### 自动去重

使用期号（issue）作为唯一键，自动去重：
```javascript
const allRecords = new Map(); // key = 期号

for (const record of apiData) {
  if (!allRecords.has(record.period)) {
    allRecords.set(record.period, record);
  }
}
```

---

## 📊 实测数据

### 福彩双色球 2024年

| 指标 | 数值 |
|------|------|
| 实际期数 | 151期 |
| 期号范围 | 2024001 ~ 2024151 |
| 时间范围 | 2024-01-02 ~ 2024-12-31 |
| 查询次数 | 2次 |
| 总获取 | 177期（包含26期2023年） |
| 覆盖率 | 101.3% |

### 福彩3D 2024年

| 指标 | 数值 |
|------|------|
| 实际期数 | 352期 |
| 期号范围 | 2024001 ~ 2024352 |
| 时间范围 | 2024-01-01 ~ 2024-12-31 |
| 查询次数 | 4次 |
| 总获取 | 371期（包含19期2023年） |
| 覆盖率 | 100.0% |

---

## 🎁 附带收益

除了获取查询年份的数据，还会附带获取**相邻年份**的部分数据：

### 查询2024年的附带数据

| 彩种 | 2024年期数 | 附带2023年 | 总计 |
|------|-----------|-----------|------|
| 福彩双色球 | 151期 | **26期** | 177期 |
| 福彩3D | 352期 | **19期** | 371期 |

**意义**：
- 查询2024年，免费得到2023年部分数据
- 减少后续查询2023年的API调用次数
- 数据自动积累，逐渐完整

---

## 📁 生成的文件

### SQL文件位置

```
sql/full_year_<彩种>_<年份>.sql
```

### 文件示例

```
sql/full_year_ssq_2024.sql    # 福彩双色球2024年
sql/full_year_fc3d_2024.sql   # 福彩3D2024年
sql/full_year_qlc_2023.sql    # 福彩七乐彩2023年
```

### 文件内容

```sql
-- 福彩双色球 2024年完整数据 (151期)
-- 数据范围: 2024-01-02 21:30:00 ~ 2024-12-31 21:30:00

INSERT IGNORE INTO lottery_results (lot_code, issue, draw_code, draw_time, created_at) VALUES
  ('70001', '2024151', '06,13,17,19,24,31,08', '2024-12-31 21:30:00', NOW()),
  ('70001', '2024150', '...', '...', NOW()),
  ...
  ('70001', '2024001', '...', '2024-01-02 21:30:00', NOW());
```

---

## 💡 使用建议

### 场景1：新部署系统初始化

```bash
# 获取近3年完整数据
node fetch-full-year-data.js ssq 2024
node fetch-full-year-data.js ssq 2023
node fetch-full-year-data.js ssq 2022

# 导入数据库
cat sql/full_year_ssq_*.sql | docker exec -i lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler
```

### 场景2：数据分析需求

```bash
# 获取福彩3D 2024年完整数据用于分析
node fetch-full-year-data.js fc3d 2024
cat sql/full_year_fc3d_2024.sql | docker exec -i lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler
```

### 场景3：数据备份恢复

```bash
# 备份
node fetch-full-year-data.js ssq 2024
cp sql/full_year_ssq_2024.sql /backup/

# 恢复
cat /backup/full_year_ssq_2024.sql | docker exec -i lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler
```

---

## ⚙️ 技术细节

### 查询日期策略

| 彩种 | 查询日期 | 说明 |
|------|----------|------|
| 双色球/七乐彩 | 12-31, 06-30 | 2个时间点覆盖全年 |
| 福彩3D/快乐8 | 12-31, 09-30, 06-30, 03-31 | 4个时间点覆盖全年 |

### API调用间隔

每次查询间隔**1.5秒**，避免频繁请求：
```javascript
await new Promise(resolve => setTimeout(resolve, 1500));
```

### 数据去重算法

```javascript
const allRecords = new Map(); // 使用Map自动去重

for (const record of result.allData) {
  const issueKey = record.period; // 期号作为唯一键
  if (!allRecords.has(issueKey)) {
    allRecords.set(issueKey, record);
  }
}
```

---

## 🔍 验证数据

### 命令行验证

```bash
# 查看指定年份期数
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e \
  "SELECT COUNT(*) FROM lottery_results WHERE lot_code='70001' AND YEAR(draw_time)=2024;"

# 查看各年份统计
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e \
  "SELECT YEAR(draw_time) as year, COUNT(*) as count FROM lottery_results WHERE lot_code='70001' GROUP BY year ORDER BY year;"

# 查看期号范围
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e \
  "SELECT MIN(issue), MAX(issue), MIN(draw_time), MAX(draw_time) FROM lottery_results WHERE lot_code='70001' AND YEAR(draw_time)=2024;"
```

### Web验证

访问 http://localhost:4000 → 历史数据查询 → 选择彩种 → 选择年份

---

## 🆚 与单次查询对比

| 方式 | 查询次数 | 覆盖率 | 时间 | 数据完整性 |
|------|----------|--------|------|-----------|
| **单次查询** | 1次 | 64% (双色球)<br>28% (福彩3D) | ~2秒 | ⚠️ 不完整 |
| **完整获取** | 2次 (双色球)<br>4次 (福彩3D) | 101%+<br>100% | ~6秒<br>~12秒 | ✅ 完整 |

---

## 📋 常见问题

### Q1: 为什么覆盖率超过100%？

**A**: 福彩开奖期数每年略有不同（节假日调整），2024年双色球实际开奖151期，超过预估的149期。

### Q2: 为什么会获取到其他年份的数据？

**A**: API从指定日期往前返回100期，可能包含相邻年份。这些数据也会保存，实现数据复用。

### Q3: 如何只保存指定年份的数据？

**A**: 当前工具保存所有查询到的数据。如需只保存指定年份，可修改SQL文件或数据库查询。

### Q4: 查询失败怎么办？

**A**:
- 检查网络连接
- 等待1-2分钟后重试
- API可能临时不可用
- 查看日志中的错误信息

---

## 📊 成本分析

| 彩种 | API调用 | 获取数据 | 单次成本 | 年度成本 |
|------|---------|----------|----------|----------|
| 福彩双色球 | 2次 | 177期 | 免费 | 免费 |
| 福彩3D | 4次 | 371期 | 免费 | 免费 |

**说明**：使用的API完全免费，无限制调用。

---

## 🎉 总结

✅ **完整数据**：低频彩101%+，高频彩100%覆盖
✅ **高效获取**：自动多次查询，智能合并去重
✅ **附带收益**：一次查询，多年受益
✅ **方便导入**：生成SQL文件，一键导入
✅ **完全免费**：无API成本，无限制调用

---

**更新时间**：2025-12-30 19:00
**工具文件**：`fetch-full-year-data.js`
**运行脚本**：`run-full-year.sh`（可选）
