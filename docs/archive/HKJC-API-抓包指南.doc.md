# HKJC 香港六合彩 API 抓包指南

## ⏰ 开奖时间
- **今晚 21:30** (香港时间)
- **提前10分钟准备** (21:20开始)

---

## 📝 步骤1: 准备工作 (21:20)

### 1.1 打开浏览器开发者工具

```bash
# 推荐使用Chrome或Edge浏览器
1. 访问: https://bet.hkjc.com/ch/marksix/results
2. 按 F12 打开开发者工具
3. 切换到 "Network" (网络) 标签
```

### 1.2 配置过滤器

```
在Network标签中：
✅ 勾选 "Preserve log" (保留日志)
✅ 勾选 "Disable cache" (禁用缓存)
✅ 点击 "Clear" (清空) 按钮清空现有记录
✅ 在过滤器中输入: json 或 api
```

---

## 📝 步骤2: 观察请求 (21:25-21:35)

### 2.1 刷新页面

```
21:25 刷新一次页面，观察初始加载的请求
```

### 2.2 等待开奖

```
21:30 开奖时刻！观察新增的网络请求
```

### 2.3 查找关键请求

在Network列表中寻找：

#### 🎯 关键特征：
- **Type**: `XHR` 或 `Fetch` 或 `json`
- **Status**: `200`
- **Name** 可能包含：
  - `result`
  - `draw`
  - `marksix`
  - `data`
  - `latest`
  - `getJSON`
  - `api`

#### 📌 查看响应内容：
1. 点击可疑的请求
2. 切换到 "Response" (响应) 标签
3. 查看是否包含开奖数据（期号、号码）

---

## 📝 步骤3: 提取API信息

### 3.1 记录URL

找到正确的请求后，记录以下信息：

```
1. 完整URL: ___________________________________
   示例: https://bet.hkjc.com/marksix/getJSON.aspx

2. 请求方法: GET / POST

3. 查询参数 (如有):
   - 参数1: _______
   - 参数2: _______

4. 请求头 (Headers):
   - User-Agent: _______
   - Referer: _______
   - 其他重要header: _______
```

### 3.2 记录响应格式

复制响应JSON的结构：

```json
{
  "draw": "25/154",           // 期号字段
  "numbers": [1, 15, 22, ...], // 号码字段
  "extra": 49,                // 特别号字段
  "date": "2025-12-28",       // 日期字段
  ...
}
```

---

## 📝 步骤4: 测试API

### 4.1 在浏览器中测试

```bash
# 右键点击请求 → Copy → Copy as cURL
# 在终端中粘贴运行，验证是否能获取数据
```

### 4.2 或用curl测试

```bash
curl "复制的URL" \
  -H "User-Agent: Mozilla/5.0..." \
  -H "Referer: https://bet.hkjc.com/ch/marksix/results"
```

---

## 📝 步骤5: 更新代码

将找到的API信息更新到代码中：

### 5.1 打开文件
```bash
vi /home/i8/claude-demo/kjqy-deploy/crawler-service/src/scrapers/HKJCScraper.js
```

### 5.2 更新API端点

```javascript
// 第26-30行，更新为真实API
this.apiEndpoints = [
  '/marksix/实际找到的端点.aspx',  // 替换这里
  '/marksix/getJSON.aspx',
  '/info/ch/racing/ResultsOfDraw.aspx'
];
```

### 5.3 更新解析逻辑

```javascript
// 第103-116行，根据实际响应格式调整
parseAPIResponse(data) {
  // 根据实际JSON结构解析
  if (data.实际的期号字段 && data.实际的号码字段) {
    return {
      period: data.实际的期号字段.toString(),
      opencode: data.实际的号码字段.join(','),
      extra: data.实际的特别号字段 || null,
      opentime: data.实际的日期字段 || null,
      countdown: this.calculateNextDrawCountdown()
    };
  }
  return null;
}
```

---

## 📸 记录截图

**重要**: 对以下内容截图保存：

1. ✅ Network标签中的完整请求列表
2. ✅ 选中的API请求的Headers
3. ✅ 选中的API请求的Response
4. ✅ 浏览器地址栏显示的完整URL

---

## 🚨 常见问题

### Q1: 找不到API请求？
**A**: 可能数据是通过WebSocket或GraphQL加载的
- 查看 "WS" (WebSocket) 标签
- 或搜索包含 "graphql" 的请求

### Q2: API需要认证？
**A**: 检查请求头中的Cookie或Token
- 复制完整的请求头信息
- 可能需要模拟登录

### Q3: 响应是HTML不是JSON？
**A**: 可能需要额外的参数
- 检查URL中的查询参数
- 尝试添加 `?format=json` 等参数

---

## ✅ 完成后

将以下信息发送给我：

```
1. API URL: ___________________
2. 请求方法: ___________________
3. 响应JSON示例: (粘贴完整JSON)
4. 遇到的问题: ___________________
```

我会帮你更新HKJCScraper的代码！

---

**祝抓包顺利！🎉**
