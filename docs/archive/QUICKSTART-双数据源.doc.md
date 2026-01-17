# 香港六合彩双数据源 - 快速开始

## ⚡ 5分钟快速上手

### ✅ 当前状态

系统已完成集成，**实时数据正在运行**：

```bash
# 查看实时数据
curl "http://localhost:4000/api/realtime-data?lotCode=60001"
```

**响应示例**:
```json
{
  "lotCode": "60001",
  "issue": "25133",
  "drawCode": "1,2,4,30,41,43",
  "extra": "13",
  "source": "hkjc"
}
```

---

## 📥 导入历史数据（可选）

### 方法1: 完整历史（推荐）

```bash
# 1. 进入容器
docker exec -it lottery-crawler-compose bash

# 2. 导入 2011-2025 年历史数据（约30秒）
node scripts/importHKJCHistory.js 2011 2025

# 3. 退出容器
exit
```

### 方法2: 指定年份

```bash
# 仅导入2024年
docker exec -it lottery-crawler-compose node scripts/importHKJCHistory.js 2024 2024

# 导入最近5年
docker exec -it lottery-crawler-compose node scripts/importHKJCHistory.js 2020 2025
```

---

## 🧪 测试验证

### 1. 测试双数据源

```bash
node test-dual-source.js
```

**输出**:
```
✅ 双数据源架构验证成功！

实时数据: On.cc API      - 快速响应 (~420ms)
历史数据: cpzhan.com     - 完整历史 (1976-2025)
数据验证: 两个源完全一致  - 互为验证和备份
```

### 2. 验证数据准确性

```bash
node verify-cpzhan-accuracy.js
```

### 3. 查看集成报告

```bash
cat HKJC-Integration-Report.md
```

---

## 📊 数据源对比

| 特性 | On.cc API | cpzhan.com |
|------|-----------|------------|
| **响应速度** | ⚡ ~420ms | 🐢 ~1674ms |
| **数据范围** | 最近154期 | 🎯 1976-2025 (50年) |
| **用途** | ✅ 实时轮询 | ✅ 历史补充 |
| **自动运行** | ✅ 已配置 | ❌ 需手动导入 |
| **数据准确性** | ✅ 验证一致 | ✅ 验证一致 |

---

## 🎯 推荐工作流

### 首次使用

```bash
# 1. 测试双数据源（验证功能）
node test-dual-source.js

# 2. 导入历史数据（一次性）
docker exec -it lottery-crawler-compose node scripts/importHKJCHistory.js 2011 2025

# 3. 验证数据（可选）
docker exec -it lottery-crawler-compose bash
mysql -h 1Panel-mysql-7kLA -u lottery -p lottery_crawler
SELECT COUNT(*) FROM lottery_results WHERE lotCode = 60001;
exit
```

### 日常使用

系统自动运行，无需手动操作：
- ✅ 每5秒自动轮询 On.cc API
- ✅ 自动保存到数据库
- ✅ API 自动提供实时数据

---

## 📁 核心文件

| 文件 | 用途 |
|------|------|
| `src/scrapers/HKJCScraper.js` | On.cc API 实时爬虫 |
| `src/scrapers/CPZhanHistoryScraper.js` | cpzhan 历史爬虫 |
| `scripts/importHKJCHistory.js` | 批量导入脚本 |
| `test-dual-source.js` | 双数据源测试 |
| `verify-cpzhan-accuracy.js` | 数据验证 |
| `README-dual-source.md` | 详细文档 |

---

## ❓ 常见问题

### Q1: 必须导入历史数据吗？

**A**: 不必须。系统已经可以正常运行实时数据。导入历史数据的好处：
- 提供完整的历史查询
- 不依赖第三方网站（cpzhan.com）

### Q2: 导入历史数据需要多久？

**A**:
- 单年数据：~2秒
- 2011-2025 (15年)：约30秒
- 1976-2025 (50年)：约2分钟

### Q3: 数据会重复吗？

**A**: 不会。导入脚本会自动检查：
- 已存在 → 更新
- 不存在 → 插入

### Q4: cpzhan.com 稳定吗？

**A**:
- ✅ 运营16年（2009-2025）
- ✅ 数据准确（已验证）
- ⚠️ 第三方网站，存在关闭风险
- 💡 建议尽快导入历史数据到本地

### Q5: On.cc API 会失败吗？

**A**:
- 测试显示100%成功率
- 大型新闻门户，长期稳定
- 如果失败，系统会自动重试

---

## ✅ 下一步

1. **可选**: 导入历史数据
   ```bash
   docker exec -it lottery-crawler-compose node scripts/importHKJCHistory.js 2011 2025
   ```

2. **验证**: 运行测试
   ```bash
   node test-dual-source.js
   ```

3. **使用**: 系统已在运行，通过 API 访问数据
   ```bash
   curl "http://localhost:4000/api/realtime-data?lotCode=60001"
   ```

---

## 📖 完整文档

查看详细说明: `cat README-dual-source.md`
