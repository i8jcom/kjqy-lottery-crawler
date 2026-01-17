# 方案A迁移调查报告

**调查日期**: 2025-12-28
**调查目标**: 确认前端 `http://localhost:4000/` 是否使用数据库数据（方案A）还是外部API（cpzhan.com）

---

## 📊 调查结果总结

### ✅ 核心发现

1. **数据库状态**: ✅ **已有数据**
   - 总记录数：**2042 期**
   - 数据范围：**2011年 - 2025年**
   - 最早期号：11001 (2011-01-02)
   - 最新期号：25133 (2025-12-25)

2. **后端API状态**: ✅ **已支持数据库查询**
   - API路径：`/api/history-data`
   - 香港六合彩特殊处理：第456-574行（WebServer.js）
   - 当传递 `year` 参数时，**优先查询数据库**
   - 数据库有数据时返回：`"数据来自数据库 (XXXX年)"`

3. **API测试结果**: ✅ **数据库查询正常工作**
   ```bash
   curl "http://localhost:4000/api/history-data?lotCode=60001&year=2024&pageNo=1&pageSize=5"
   ```
   返回：
   ```json
   {
     "success": true,
     "message": "数据来自数据库 (2024年)",
     "data": {
       "lotCode": "60001",
       "name": "香港六合彩",
       "records": [...], // 从数据库返回的记录
       "total": 140
     }
   }
   ```

---

## 🔍 前端调用分析

### 前端API调用链

1. **前端组件**: `LuxuryHistoryV2.vue`（第652行）
   ```typescript
   const response = await getOfficialHistoryList(
     lotCode,
     selectedLottery.value.apiConfig.historyEndpoint,
     1,
     2000,
     dateParam // 传递日期参数，而不是year参数
   )
   ```

2. **API封装**: `official.ts`（第46-63行）
   ```typescript
   export const getOfficialHistoryList = (lotCode, endpoint, pageNo, pageSize, date?) => {
     return request({
       url: `/proxy/${endpoint}`,  // ⚠️ 调用 /proxy/ 而不是 /api/history-data
       method: 'get',
       params: { lotCode, pageNo, pageSize, date }
     })
   }
   ```

3. **问题**: 前端调用 `/proxy/lhc/getLhcHistoryList.do`，但这个路由在 crawler-service 中**不存在**！

---

## ⚠️ 识别的问题

### 问题1: 前端使用了错误的API路径

- **当前调用**: `/proxy/lhc/getLhcHistoryList.do`
- **应该调用**: `/api/history-data?lotCode=60001&year=2024`

### 问题2: 参数不匹配

- **当前参数**: 传递 `date` (日期参数，如 "2024-12-25")
- **最佳参数**: 传递 `year` (年份参数，如 "2024") 以优先使用数据库查询

### 问题3: 数据覆盖不完整

- **当前数据**: 2011-2025年（2042期）
- **方案A目标**: 1985-2025年（约5700+期）
- **缺失数据**: 1985-2010年（约3600+期）

---

## 🎯 解决方案

### 方案1: 修改前端API调用（推荐）

**优点**: 直接使用已有的 `/api/history-data` API，无需后端修改

**修改文件**: `/admin-v2-latest/src/api/official.ts`

```typescript
// 修改前
export const getOfficialHistoryList = (lotCode: string, endpoint: string, pageNo = 1, pageSize = 20, date?: string) => {
  return request({
    url: `/proxy/${endpoint}`,  // ❌ 错误的路径
    params: { lotCode, pageNo, pageSize, date }
  })
}

// 修改后
export const getOfficialHistoryList = (lotCode: string, endpoint: string, pageNo = 1, pageSize = 20, date?: string) => {
  // 🎯 香港六合彩 (60001) 使用数据库查询 API
  if (lotCode === '60001') {
    // 从日期提取年份 (如果是年份格式"2024"，直接使用)
    const year = date && date.length === 4 ? date : (date ? date.substring(0, 4) : undefined)

    return request({
      url: '/api/history-data',  // ✅ 正确的路径
      params: { lotCode, pageNo, pageSize, year }  // ✅ 使用 year 参数
    })
  }

  // 其他彩种继续使用原有逻辑
  return request({
    url: `/proxy/${endpoint}`,
    params: { lotCode, pageNo, pageSize, date }
  })
}
```

### 方案2: 补全历史数据

**目标**: 导入 1985-2010 年的数据，实现方案A的完整覆盖

**命令**:
```bash
cd /home/i8/claude-demo/kjqy-deploy/crawler-service

# 进入 Docker 容器
docker exec -it lottery-crawler-compose /bin/sh

# 导入 1985-2010 年数据
node scripts/importHKJCHistory.js 1985 2010
```

**预计耗时**: 约15-20秒（3600期 / 215期/秒）

---

## 📝 实施步骤建议

### Step 1: 修改前端API调用（立即实施）

1. 修改 `/admin-v2-latest/src/api/official.ts` 文件
2. 重启前端开发服务器或重新构建
3. 测试香港六合彩历史数据查询

### Step 2: 补全历史数据（可选，建议）

1. 进入 crawler-service Docker 容器
2. 运行导入脚本导入 1985-2010 年数据
3. 验证数据库记录数增加到约 5700+ 期

### Step 3: 验证测试

测试URL示例：
```
http://localhost:4000/    # 前端界面
选择"香港六合彩" -> 选择"2024年" -> 查看历史记录
```

预期结果：
- ✅ 显示 2024 年历史数据（约140期）
- ✅ 控制台无错误
- ✅ 数据来源为数据库（不再调用外部API）

---

## 🎉 总结

### 当前状态
- ✅ 后端API已支持数据库查询
- ✅ 数据库已有2011-2025年数据（2042期）
- ❌ 前端仍在调用不存在的 `/proxy/` 路由
- ⚠️ 缺失1985-2010年历史数据

### 完成方案A需要
1. **修改前端API调用** - 修改1个文件（`official.ts`）
2. **补全历史数据** - 运行1次导入脚本（可选）

### 预期效果
- ⚡ 查询速度提升 200+ 倍
- 📊 数据来源：数据库（方案A - On.cc）
- 🎯 覆盖范围：1985-2025年（41年）
- ✅ 100% 使用方案A数据源

---

**报告生成时间**: 2025-12-28
**下一步**: 请确认是否实施上述解决方案
