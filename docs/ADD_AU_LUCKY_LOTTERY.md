# 如何添加新的 AU Lucky Lotteries 彩种

## 概述

从现在开始，您可以直接在前端「添加新彩种」功能中添加 AU Lucky Lotteries 的新彩种，**无需修改代码**！

系统已经支持动态配置，只需要正确填写配置信息即可。

---

## 前提条件

AU Lucky Lotteries 官网（https://auluckylotteries.com/）新增了彩种，例如：
- Lucky 3 Ball（3个号码）
- Lucky 15 Ball（15个号码）
- 或其他新彩种

---

## 添加步骤

### 1. 访问前端管理界面

打开浏览器访问：http://localhost:4000

点击「彩种配置」选项卡

### 2. 点击「添加新彩种」按钮

### 3. 填写彩种配置信息

#### 必填字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| **彩种代码 (lotCode)** | 唯一标识符，建议格式：`300XX` | `30005` |
| **彩种名称** | 中文显示名称 | `澳洲幸运3` 或 `Lucky 3 Ball` |
| **开奖间隔（秒）** | 通常为 300 秒（5分钟） | `300` |
| **优先级** | 建议选择 `medium` | `medium` |
| **数据源** | **必须选择** `AU Lucky Lotteries` | `auluckylotteries` |
| **Scraper Key** | 彩种简称标识符 | `lucky3` |
| **API端点** | 官网彩种页面路径 | `/results/lucky-ball-3/` |
| **历史端点** | 通常与API端点相同 | `/results/lucky-ball-3/` |
| **描述** | 彩种说明 | `AU Lucky Lotteries - 3个号码(0-9)` |

#### 关键字段说明：

**Scraper Key（最重要！）**
- 格式：`luckyX`（X 为号码个数）
- 必须唯一，不能与现有彩种重复
- 示例：
  - Lucky 3 Ball → `lucky3`
  - Lucky 15 Ball → `lucky15`

**API端点（第二重要！）**
- 从官网URL中获取
- 例如官网地址：`https://auluckylotteries.com/results/lucky-ball-3/`
- 则API端点为：`/results/lucky-ball-3/`
- **注意：** 开头必须有 `/`，结尾建议也有 `/`

**彩种代码（lotCode）**
- 建议使用 `300XX` 格式（AU Lucky Lotteries 代码段）
- 已使用的代码：
  - `30001` - 澳洲幸运5
  - `30002` - Lucky 8 Ball
  - `30003` - Lucky 10 Ball
  - `30004` - Lucky 20 Ball
- 新彩种可以使用 `30005`、`30006`...

---

## 配置示例

### 示例 1：添加 Lucky 3 Ball

假设官网新增了 Lucky 3 Ball 彩种，URL 为：
`https://auluckylotteries.com/results/lucky-ball-3/`

配置如下：

```json
{
  "lotCode": "30005",
  "name": "澳洲幸运3",
  "interval": 300,
  "priority": "medium",
  "endpoint": "auluckylotteries",
  "source": "auluckylotteries",
  "enabled": true,
  "description": "AU Lucky Lotteries - 3个号码(0-9)",
  "scraperKey": "lucky3",
  "apiEndpoint": "/results/lucky-ball-3/",
  "historyEndpoint": "/results/lucky-ball-3/"
}
```

### 示例 2：添加 Lucky 15 Ball

假设官网新增了 Lucky 15 Ball 彩种，URL 为：
`https://auluckylotteries.com/results/lucky-ball-15/`

配置如下：

```json
{
  "lotCode": "30006",
  "name": "Lucky 15 Ball",
  "interval": 300,
  "priority": "medium",
  "endpoint": "auluckylotteries",
  "source": "auluckylotteries",
  "enabled": true,
  "description": "AU Lucky Lotteries - 15个号码(1-50)",
  "scraperKey": "lucky15",
  "apiEndpoint": "/results/lucky-ball-15/",
  "historyEndpoint": "/results/lucky-ball-15/"
}
```

---

## 验证步骤

### 1. 保存配置后，检查是否出错

保存后，系统应该显示「✅ 彩种已添加」

### 2. 检查彩种列表

在「彩种配置」页面，应该能看到新添加的彩种

### 3. 等待首次数据获取（约5-10秒）

新彩种会自动开始获取数据

### 4. 查看实时数据

访问 API 测试：
```bash
curl http://localhost:4000/api/realtime-data?lotCode=30005
```

应该返回类似：
```json
{
  "success": true,
  "data": {
    "lotCode": "30005",
    "issue": "12345678",
    "drawCode": "01,02,03",
    "drawTime": "Wednesday, Dec 24,2025 11:29 pm (ACDT)",
    "countdown": 244,
    "source": "auluckylotteries"
  }
}
```

### 5. 检查日志

查看 Docker 日志，确认没有错误：
```bash
docker logs lottery-crawler-compose --tail 50 | grep "30005\|lucky3"
```

应该看到类似：
```
[AULuckyLotteries] 🚀 请求: http://auluckylotteries.com/results/lucky-ball-3/
[AULuckyLotteries] ✅ 成功获取 lucky3 第12345678期数据
⏱️ 澳洲幸运3 倒计时244秒 → 下次3.0秒后轮询
```

---

## 常见问题

### Q1: 保存后提示"缺少scraperKey映射"

**原因：** Scraper Key 字段为空

**解决：** 确保填写了 Scraper Key，格式为 `luckyX`

---

### Q2: 数据获取失败，日志显示 404 错误

**原因：** API 端点路径不正确

**解决方法：**
1. 访问官网，找到新彩种的实际URL
2. 复制路径部分（从 `/results/` 开始）
3. 确保开头有 `/`

示例：
- ❌ 错误：`results/lucky-ball-3/`
- ✅ 正确：`/results/lucky-ball-3/`

---

### Q3: 数据获取成功，但号码解析不正确

**原因：** HTML 页面结构可能与现有彩种不同

**解决方法：**
这种情况需要开发者修改 scraper 的解析逻辑。

请联系系统管理员，提供：
1. 新彩种的官网URL
2. 号码个数和范围
3. 页面截图

---

### Q4: 倒计时不显示

**检查清单：**
1. ✅ 确认 `scraperKey` 已填写
2. ✅ 确认彩种已启用（enabled = true）
3. ✅ 检查 API 是否返回数据：
   ```bash
   curl http://localhost:4000/api/realtime-data?lotCode=30005
   ```
4. ✅ 检查日志是否有错误：
   ```bash
   docker logs lottery-crawler-compose --tail 50
   ```

---

## 技术说明（开发者参考）

### 架构改进

系统已从**硬编码 URL 映射**改为**动态配置架构**：

**之前：**
```javascript
// 硬编码在 scraper 中
this.lotteryUrls = {
  'lucky5': '/results/lucky-ball-5/',
  'lucky8': '/results/lucky-ball-8/'
}
```

**现在：**
```javascript
// 从配置文件读取
async fetchLatestData(lotCode, apiEndpoint) {
  const targetUrl = `${this.baseUrl}${apiEndpoint}`;
  // ...
}
```

### 修改的文件

1. **MultiSourceDataManager.js**
   - 从 `lotteryConfig` 读取 `apiEndpoint`
   - 传递给 scraper

2. **AULuckyLotteriesScraper.js**
   - 移除硬编码的 `lotteryUrls`
   - `fetchLatestData()` 接受 `apiEndpoint` 参数

3. **无需修改前端**
   - 前端已经支持配置 `apiEndpoint` 字段

---

## 总结

✅ **可以直接在前端添加新彩种**
✅ **无需修改任何代码**
✅ **只需正确填写配置信息**

关键是：
1. **数据源** 选择 `AU Lucky Lotteries`
2. **Scraper Key** 格式为 `luckyX`
3. **API端点** 从官网URL获取，格式为 `/results/lucky-ball-X/`

---

**最后更新：** 2025-12-24
**架构版本：** v2.0（动态配置支持）
