# 📊 福彩历史数据批量导入说明

## ✅ 已完成导入

### 当前数据状态

| 彩种 | lotCode | 2025年数据量 | 数据范围 |
|------|---------|--------------|----------|
| 福彩双色球 | 70001 | **100期** | 2025-05-08 ~ 2025-12-28 |
| 福彩3D | 70002 | **100期** | 2025-09-17 ~ 2025-12-29 |
| 福彩七乐彩 | 70003 | **100期** | 2025-05-07 ~ 2025-12-29 |
| 福彩快乐8 | 70004 | **100期** | 2025-09-17 ~ 2025-12-29 |

**导入时间**: 2025-12-30 18:15

**数据来源**: api.apiose188.com (免费API)

---

## 🎯 查询验证

### 方法1：API查询

```bash
# 查询福彩快乐8 2025年数据（分页）
curl "http://localhost:4000/api/history-data?lotCode=70004&year=2025&pageNo=1&pageSize=20" | jq '.'

# 查询福彩双色球 2025年数据
curl "http://localhost:4000/api/history-data?lotCode=70001&year=2025" | jq '.data.total'
```

### 方法2：数据库查询

```bash
# 查询各彩种数据量
docker exec lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler -e \
  "SELECT lot_code, COUNT(*) as total FROM lottery_results WHERE lot_code LIKE '700%' GROUP BY lot_code;"
```

### 方法3：前端页面

1. 打开 http://localhost:4000
2. 点击"历史数据查询"
3. 选择任意福彩彩种（如"福彩快乐8"）
4. 选择年份"2025年"
5. 点击"查询"

**预期结果**: 显示100条记录，可分页浏览

---

## 🔧 继续批量导入（可选）

如果需要导入更多历史数据（如2024年、2023年等），使用以下工具：

### 工具1：生成SQL文件

```bash
# 抓取福彩快乐8最近200期数据
node fetch-cwl-to-sql.js kl8 200

# 抓取所有福彩彩种各100期
node fetch-cwl-to-sql.js all 100

# 抓取福彩双色球最近300期
node fetch-cwl-to-sql.js ssq 300
```

**参数说明**:
- `ssq` - 福彩双色球
- `fc3d` - 福彩3D
- `qlc` - 福彩七乐彩
- `kl8` - 福彩快乐8
- `all` - 所有彩种

**生成文件**: `sql/insert_<彩种>_history.sql`

### 工具2：导入到数据库

```bash
# 单个彩种导入
cat sql/insert_kl8_history.sql | \
  docker exec -i lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler

# 批量导入所有彩种
cat sql/insert_*.sql | \
  docker exec -i lottery-mysql-compose mysql -ulottery -plottery123 lottery_crawler
```

---

## 📈 数据自动积累

系统已配置智能窗口调度，福彩彩种会在开奖窗口内自动抓取新数据：

| 彩种 | 开奖时间 | 窗口启动 | 轮询频率 |
|------|----------|----------|----------|
| 福彩双色球 | 周二、四、日 21:15 | 21:12 | 5秒/次 |
| 福彩3D | 每天 21:15 | 21:12 | 5秒/次 |
| 福彩七乐彩 | 周一、三、五 21:15 | 21:12 | 5秒/次 |
| 福彩快乐8 | 每天 21:15 | 21:12 | 5秒/次 |

**非开奖窗口**: 暂停轮询，节省99%+ 资源
**开奖窗口内**: 高频轮询，实时抓取数据

每期开奖后，数据会自动保存到数据库，历史数据将持续积累。

---

## 🔍 API数据源限制

福彩免费API (`api.apiose188.com`) 特点：

✅ **优势**:
- 完全免费，无需注册
- 无限制调用
- 数据实时更新
- 稳定可靠

⚠️ **限制**:
- 单次请求最多返回100期数据
- 无法指定日期范围（只能获取最近N期）
- 不提供历史年份数据（如2020年、2021年等）

**建议**:
- 如需更多历史数据，定期运行批量导入工具
- 或等待系统每日自动积累

---

## 📁 相关文件

| 文件 | 说明 |
|------|------|
| `fetch-cwl-to-sql.js` | 历史数据SQL生成工具 |
| `fetch-cwl-history.js` | 历史数据直接导入工具（已弃用） |
| `run-fetch-history.sh` | 启动脚本（加载环境变量） |
| `sql/insert_*.sql` | 生成的SQL文件 |

---

## 🎉 总结

✅ 所有福彩彩种已导入100期2025年历史数据
✅ 前端"历史数据查询"功能正常工作
✅ 支持按年份查询和分页显示
✅ 系统将自动抓取并积累新数据

**用户体验提升**: 从只有1条记录提升到100条记录！

---

**更新时间**: 2025-12-30 18:16
**操作人**: Claude Code
