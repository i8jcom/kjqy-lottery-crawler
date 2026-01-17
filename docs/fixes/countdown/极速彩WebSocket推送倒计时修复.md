# 极速彩WebSocket推送倒计时为0的问题修复

## 问题描述

**现象**：极速彩倒计时归零后，WebSocket虽然推送了新期号数据，但倒计时仍然是0或很小的值（如13秒），导致前端一直显示"开奖中"。

**关键日志**：
```
行396:✅ [极速飞艇] 其他彩种WebSocket推送倒计时: 13秒
行413: ⏰ 极速飞艇 倒计时归零，2秒后自动刷新
行415: ✅ [极速飞艇] 其他彩种手动刷新倒计时: 0秒
```

---

## 根本原因分析

### 问题1：爬虫返回的倒计时不准确

**位置**：`src/scrapers/SpeedyLot88Scraper.js:186-195`

```javascript
// 其他极速彩：间隔75秒
// 官网倒计时 + 13秒校正
officialCountdown = Math.min(Math.max(rawCountdown + 13, 0), 75);
```

**问题**：当检测到新期号时，官网的 `timeLeft` 变量可能是0-5秒，加上13秒校正后也只有13-18秒，而不是期望的75秒！

**原因**：官网的倒计时是实时更新的，当爬虫检测到新期号时，这一期的倒计时可能已经快结束了。

### 问题2：调度器使用检测时间而不是开奖时间

**位置**：`src/schedulers/ContinuousPollingScheduler.js:298-301`（修复前）

```javascript
// ❌ 错误代码
if (countdownBehavior === 'wait_for_zero') {
  // 使用检测时间，而不是实际开奖时间！
  this.lastDrawTimestamps.set(lotCode, Date.now());
}
```

**时间线对比**：

```
错误流程（使用检测时间）：
T0: 实际开奖时间
T0+60: 爬虫检测到新期号，记录timestamp = T0+60
T0+75: 下一期开奖时间
T0+60时计算倒计时 = 75 - 0 = 75秒 ✅（刚检测到时正确）
T0+135时计算倒计时 = 75 - 75 = 0秒 ❌（下一期开奖时归零）

正确流程（使用开奖时间）：
T0: 实际开奖时间，记录timestamp = T0
T0+60: 爬虫检测到新期号
T0+75: 下一期开奖时间
T0+60时计算倒计时 = 75 - 60 = 15秒 ✅
T0+75时计算倒计时 = 75 - 75 = 0秒 ✅
T0+135时计算倒计时 = 75 - (135-75) = 15秒 ✅（新一期）
```

### 问题3：WebSocket推送使用爬虫原始倒计时

**位置**：`src/schedulers/ContinuousPollingScheduler.js:288-294`（修复前）

```javascript
// ❌ 错误代码
const pushData = { ...result.data };  // 直接使用爬虫返回的倒计时（13秒）

wsManager.notifyNewPeriod(lotCode, pushData);  // 推送13秒倒计时
```

---

## 修复方案

### 修复1：调度器使用drawTime计算倒计时

**文件**：`src/schedulers/ContinuousPollingScheduler.js:285-307`

```javascript
// ✅ 修复后代码
// 🔧 准备推送数据（可能需要校正倒计时）
const pushData = { ...result.data };

// 🚀 记录开奖时间戳（用于计算倒计时）并校正推送数据的倒计时
if (countdownBehavior === 'wait_for_zero') {
  // SpeedyLot88模式：优先使用drawTime，fallback到检测时间
  if (result.data.drawTime) {
    // 使用爬虫返回的实际开奖时间
    const drawTimestamp = new Date(result.data.drawTime).getTime();
    this.lastDrawTimestamps.set(lotCode, drawTimestamp);
    logger.info(`🎯 ${name} 校准时间戳: ${drawTimestamp} (基于drawTime: ${result.data.drawTime})`);

    // 🔧 重新计算正确的倒计时并更新pushData
    const drawInterval = sourceConfig?.drawInterval || 75;
    const elapsed = (Date.now() - drawTimestamp) / 1000;
    const calculatedCountdown = Math.max(0, drawInterval - elapsed);
    pushData.officialCountdown = Math.round(calculatedCountdown);

    logger.info(
      `[${name}] 🔄 倒计时校正: ${result.data.officialCountdown}秒 → ${pushData.officialCountdown}秒 (基于drawTime计算)`
    );
  } else {
    // Fallback: 使用检测到新期号的当前时间作为基准
    this.lastDrawTimestamps.set(lotCode, Date.now());
  }
}
```

### 修复2：WebSocket推送校正后的倒计时

**文件**：`src/schedulers/ContinuousPollingScheduler.js:351-358`

```javascript
// ✅ 修复后代码
// 🚀 立即推送新期号到WebSocket订阅者（使用校正后的倒计时）
const wsManager = WebSocketManager.getInstance();
if (wsManager) {
  logger.info(
    `[${name}] 🚀 WebSocket推送倒计时: ${pushData.officialCountdown}秒 (期号${pushData.period})`
  );
  wsManager.notifyNewPeriod(lotCode, pushData);
}
```

### 修复3：后端API优先使用draw_time

**文件**：`src/web/WebServer.js:392-423, 608-637`

（已在 `极速彩倒计时归零修复方案.md` 中详细说明）

---

## 修复效果对比

### Before（修复前）

```
调度器检测到新期号：
- 爬虫返回: officialCountdown = 13秒 (官网倒计时+13)
- 记录时间戳: Date.now() (检测时间)
- WebSocket推送: 13秒
- 前端显示: 13 → 12 → ... → 0 → "开奖中"
- HTTP刷新: 0秒 (基于检测时间计算)
- 前端10秒强制刷新: 仍然0秒
- ❌ 永久卡在"开奖中"
```

### After（修复后）

```
调度器检测到新期号：
- 爬虫返回: officialCountdown = 13秒
- 解析drawTime: "2026-01-14 12:00:00"
- 记录时间戳: drawTimestamp (开奖时间)
- 计算倒计时: 75 - elapsed = 60秒
- WebSocket推送: 60秒 ✅
- 前端显示: 60 → 59 → ... → 1 → 0 → "开奖中"
- HTTP刷新: 15秒 ✅ (基于drawTime计算)
- 前端倒计时恢复: 15 → 14 → ...
- ✅ 正常运行
```

---

## 修复文件清单

1. **调度器倒计时校正**：`src/schedulers/ContinuousPollingScheduler.js`
   - 行285-307：使用drawTime计算并校正倒计时
   - 行351-358：WebSocket推送校正后的倒计时

2. **后端API**：`src/web/WebServer.js`
   - 行392-423：单个彩种API优先使用draw_time
   - 行608-637：批量彩种API优先使用drawTime

3. **前端兜底机制**：`src/web/vue-app/src/views/RealtimeElementPlus.vue`
   - 行822-850：10秒强制刷新机制

---

## 测试验证

### 预期日志

**调度器日志**：
```
🎯 极速飞艇 校准时间戳: 1736875200000 (基于drawTime: 2026-01-14 12:00:00)
🔄 倒计时校正: 13秒 → 60秒 (基于drawTime计算)
🚀 WebSocket推送倒计时: 60秒 (期号54513170)
```

**前端日志**：
```
🚀 WebSocket推送: 极速飞艇 新期号 54513170
✅ [极速飞艇] 其他彩种WebSocket推送倒计时: 60秒  ← ✅ 不再是13秒
```

---

## 技术要点

1. **三层修复**：
   - 调度器：WebSocket推送前校正倒计时
   - 后端API：HTTP请求时使用draw_time计算
   - 前端：10秒强制刷新兜底

2. **时间字段优先级**：
   - 调度器：`drawTime` > `Date.now()`
   - 后端API：`lastDrawTimestamp` > `draw_time` > `created_at`

3. **向后兼容**：
   - 如果drawTime不存在，fallback到检测时间
   - 不影响SG彩种（使用unixtime字段）

---

**修复时间**：2026-01-14
**修复版本**：v1.0.3
**相关文档**：`极速彩倒计时归零修复方案.md`
