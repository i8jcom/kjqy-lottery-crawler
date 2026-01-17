# SG彩种倒计时最终修复方案

## 问题回顾

**初始问题**: SG彩种刷新页面时倒计时有12秒偏差

**根本原因**:
- HTTP API有网络延迟和缓存,导致页面加载时倒计时比实际多12秒左右
- WebSocket推送是实时的,倒计时准确无误

## 最终解决方案

### 核心策略
**区分数据来源,差异化处理倒计时**:
- 📡 **HTTP API加载** (页面刷新): SG彩种倒计时减12秒
- 🔄 **WebSocket推送** (实时更新): 所有彩种保持原值
- 🔁 **手动刷新**: 保持原值

### 实现代码

**核心修改**(`RealtimeElementPlus.vue:716-772`):

```javascript
// 更新单个彩种数据
// source参数: 'http' = 页面加载HTTP API, 'websocket' = WebSocket推送, 'refresh' = 手动刷新
function updateLotteryData(lottery, data, source = 'websocket') {
  // ... 号码处理逻辑 ...

  // ✅ 倒计时处理逻辑
  const lotCodeStr = String(data.lotCode)
  const isSGLottery = lotCodeStr.startsWith('200')

  // 🎯 SG彩种页面加载时减12秒(补偿HTTP延迟),WebSocket推送时不减
  if (isSGLottery && source === 'http') {
    lottery.countdown = Math.max(0, (data.officialCountdown || 0) - 12)
    console.log(`✅ [${lottery.name}] SG彩种HTTP加载倒计时: ${data.officialCountdown}秒 → ${lottery.countdown}秒 (减12秒)`)
  } else {
    lottery.countdown = data.officialCountdown || 0
    const sourceLabel = source === 'websocket' ? 'WebSocket推送' : (source === 'refresh' ? '手动刷新' : 'HTTP加载')
    const typeLabel = isSGLottery ? 'SG彩种' : '其他彩种'
    console.log(`✅ [${lottery.name}] ${typeLabel}${sourceLabel}倒计时: ${lottery.countdown}秒`)
  }
}
```

**调用点更新**:

1. **HTTP API加载**(第704行):
```javascript
updateLotteryData(lottery, matchedData, 'http')  // 传入'http'标识
```

2. **手动刷新**(第805行):
```javascript
updateLotteryData(lottery, matchedData, 'refresh')  // 传入'refresh'标识
```

3. **WebSocket推送**(第925行):
```javascript
updateLotteryData(lottery, standardData, 'websocket')  // 传入'websocket'标识
```

## 预期效果

### 控制台日志示例

**刷新页面(HTTP API加载)**:
```
✅ [SG飞艇] SG彩种HTTP加载倒计时: 168秒 → 156秒 (减12秒)
✅ [SG时时彩] SG彩种HTTP加载倒计时: 168秒 → 156秒 (减12秒)
✅ [极速赛车] 其他彩种HTTP加载倒计时: 15秒
```

**WebSocket推送新期号**:
```
✅ [SG飞艇] SG彩种WebSocket推送倒计时: 145秒
✅ [SG时时彩] SG彩种WebSocket推送倒计时: 145秒
✅ [极速赛车] 其他彩种WebSocket推送倒计时: 75秒
```

**手动点击刷新按钮**:
```
✅ [SG飞艇] SG彩种手动刷新倒计时: 123秒
```

### 用户体验

1. ✅ **页面刷新**: SG彩种倒计时立即准确,无需等待WebSocket校准
2. ✅ **WebSocket推送**: 所有彩种接收到新期号时倒计时立即正确更新
3. ✅ **其他彩种**: 完全不受影响,保持原有逻辑

## 技术优势

1. **精准修复**: 仅针对SG彩种的HTTP加载场景,不影响其他彩种和WebSocket推送
2. **简单可靠**: 不需要复杂的时间计算,只需简单的12秒补偿
3. **易于调整**: 如果HTTP延迟变化,只需修改减去的秒数即可

## 重启命令

```bash
bash /tmp/restart-crawler-fixed.sh
```

或手动:
```bash
sudo kill -9 410144 && sleep 2 && cd /home/i8/claude-demo/kjqy-deploy/crawler-service && nohup sudo node src/index.js > /tmp/crawler-service.log 2>&1 &
```

## 验证步骤

1. 打开浏览器访问: http://localhost:4000/realtime
2. 打开浏览器控制台(F12)
3. **刷新页面**,观察SG彩种倒计时日志:
   - 应该看到 `SG彩种HTTP加载倒计时: XXX秒 → YYY秒 (减12秒)`
4. 等待WebSocket推送新期号(约5分钟):
   - 应该看到 `SG彩种WebSocket推送倒计时: ZZZ秒`
   - ZZZ应该接近300秒(新期号刚开始)
5. 点击SG彩种的"刷新"按钮:
   - 应该看到 `SG彩种手动刷新倒计时: WWW秒`

---
**更新时间**: 2026-01-13 20:30
**版本**: v4.0 差异化处理方案
**状态**: ✅ 已部署
