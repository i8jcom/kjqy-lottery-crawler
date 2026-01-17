# 体彩（sportslottery）健康检查567错误修复总结

## 🔍 问题诊断

### 问题现象
- 体彩（sportslottery）健康检查一直返回 **567错误**
- 数据库显示：`Request failed with status code 567`
- curl测试返回HTTP 200成功，但axios请求失败

### 根本原因
**体彩API受腾讯云EdgeOne（WAF）保护，会检测HTTP请求头的完整性**

通过诊断脚本 `test-sportslottery-health.js` 发现：

1. **简单User-Agent请求** → 返回567，被EdgeOne拦截
   ```
   响应体：Protected by Tencent Cloud EdgeOne
   错误：Your request has been blocked by the security policy
   ```

2. **完整浏览器请求头** → ✅ 返回200成功
   ```javascript
   {
     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
     'Accept': 'application/json, text/plain, */*',
     'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
     'Accept-Encoding': 'gzip, deflate, br',
     'Referer': 'https://webapi.sporttery.cn/',
     'Origin': 'https://webapi.sporttery.cn'
   }
   ```

---

## ✅ 已完成的修复

### 1. 修复健康检查请求头（CWLDomainManager.js）

**文件**: `src/managers/CWLDomainManager.js`
**位置**: 第137-153行

**修改内容**:
```javascript
// 🔧 体彩API需要完整浏览器头（受腾讯云EdgeOne保护，会检测请求头）
const headers = domain.source_type === 'sportslottery' ? {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://webapi.sporttery.cn/',
  'Origin': 'https://webapi.sporttery.cn'
} : {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

const response = await axios.get(testUrl, {
  timeout: 8000,
  headers
});
```

---

### 2. 修复健康检查日志记录（CWLDomainManager.js）

**问题**: 代码尝试插入的列名与数据库表不匹配，导致日志无法写入

**数据库表结构**:
```sql
CREATE TABLE `cwl_domain_health_logs` (
  `domain_id` int NOT NULL,
  `domain_url` varchar(255) NOT NULL,
  `check_type` enum('scheduled','on_demand','after_failure') DEFAULT 'scheduled',
  `status_code` int DEFAULT NULL,        -- 不是 http_status
  `response_time_ms` int DEFAULT NULL,
  `is_success` tinyint(1) DEFAULT NULL,  -- 不是 check_result
  `error_message` text,
  `checked_at` datetime DEFAULT CURRENT_TIMESTAMP
)
```

**修改内容** (第170-188行):
```javascript
async logHealthCheck(domainId, domainUrl, checkResult, responseTimeMs, httpStatus, errorMessage) {
  const pool = this._initPool();

  // 🔧 修复列名匹配：is_success (1=成功, 0=失败), status_code (HTTP状态码)
  const isSuccess = checkResult === 'success' ? 1 : 0;

  const query = `
    INSERT INTO cwl_domain_health_logs
    (domain_id, domain_url, check_type, status_code, response_time_ms, is_success, error_message)
    VALUES (?, ?, 'scheduled', ?, ?, ?, ?)
  `;

  try {
    await pool.query(query, [domainId, domainUrl, httpStatus, responseTimeMs, isSuccess, errorMessage]);
    logger.debug(`[CWLDomainManager] 📝 健康检查日志已记录: ${domainUrl} - ${isSuccess ? '成功' : '失败'}`);
  } catch (error) {
    logger.error('[CWLDomainManager] ❌ 记录健康检查日志失败', error);
  }
}
```

---

### 3. 增强体彩错误调试日志（CWLDomainManager.js）

**修改内容** (第158-169行):
```javascript
// 🔧 体彩API特殊处理：记录详细错误信息
if (domain.source_type === 'sportslottery') {
  logger.warn(`[CWLDomainManager] 🔍 体彩健康检查失败详情:`);
  logger.warn(`  - URL: ${testUrl}`);
  logger.warn(`  - 错误信息: ${errorMessage}`);
  logger.warn(`  - HTTP状态码: ${httpStatus || '无'}`);
  logger.warn(`  - 错误代码: ${error.code || '无'}`);
  if (error.response) {
    logger.warn(`  - 响应数据: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    logger.warn(`  - 响应头: ${JSON.stringify(error.response.headers)}`);
  }
}
```

---

### 4. 修复测试端点变量作用域（CWLDomainManager.js）

**问题**: `testUrl` 在try块内定义，catch块无法访问
**修改**: 将 `testEndpoints`、`testPath`、`testUrl` 移到函数顶部（第121-135行）

---

## 📋 需要执行的操作

### 重启服务以应用修复

**当前状态**:
- 服务进程 PID: `729464`
- 进程所有者: `root`
- 需要root权限才能重启

**重启命令**:
```bash
cd /home/i8/claude-demo/kjqy-deploy/crawler-service

# 方式1: 使用提供的脚本（需要输入sudo密码）
./restart-as-root.sh

# 方式2: 手动重启
sudo kill 729464
sleep 3
nohup node src/index.js > logs/service.log 2>&1 &

# 查看新进程
ps aux | grep "node.*src/index.js"
```

---

## ✅ 验证修复

### 1. 立即验证（重启后）

查看日志，确认服务启动成功：
```bash
tail -f logs/service.log
```

应该看到：
```
[CWLDomainManager] 🚀 域名管理器初始化成功
[CWLDomainManager] ⏰ 定时健康检查已启动 (间隔: 5分钟)
```

---

### 2. 等待5分钟后验证健康检查

查询体彩健康状态：
```bash
mysql -h 127.0.0.1 -P 3308 -uroot -proot123456 lottery_crawler -e \
"SELECT id, domain_url, source_type, status, consecutive_failures, response_time_ms,
        success_rate, last_check_at, failure_reason
 FROM cwl_api_domains
 WHERE source_type = 'sportslottery';"
```

**预期结果**:
```
status: active
consecutive_failures: 0
response_time_ms: 70-100 (正常响应时间)
success_rate: 100.00
failure_reason: NULL
```

---

### 3. 验证健康检查日志

检查日志是否正常写入：
```bash
mysql -h 127.0.0.1 -P 3308 -uroot -proot123456 lottery_crawler -e \
"SELECT domain_id, domain_url, status_code, response_time_ms, is_success,
        error_message, checked_at
 FROM cwl_domain_health_logs
 WHERE domain_id = 22
 ORDER BY checked_at DESC
 LIMIT 5;"
```

**预期结果**:
```
is_success: 1
status_code: 200
response_time_ms: 70-100
error_message: NULL
```

---

### 4. 在前端验证

访问域名管理页面：
```
http://localhost:4000/v2/domain-management
```

找到体彩（sportslottery）行：
- **状态**: 应显示为 `active`（绿色徽章）
- **响应时间**: 应显示 `70-100ms`
- **成功率**: 应显示 `100.00%`

---

## 🎯 预期效果

### 修复前
```
❌ status: failed
❌ consecutive_failures: 32
❌ response_time_ms: 0
❌ success_rate: 0.00
❌ failure_reason: Request failed with status code 567
```

### 修复后
```
✅ status: active
✅ consecutive_failures: 0
✅ response_time_ms: 70-100
✅ success_rate: 100.00
✅ failure_reason: NULL
```

---

## 📌 技术要点总结

1. **腾讯云EdgeOne WAF**: 体彩API受此保护，会检测请求头完整性
2. **必需的请求头**: Accept、Accept-Language、Referer、Origin 都不可缺少
3. **567错误**: 非标准HTTP状态码，是EdgeOne自定义的拦截响应
4. **其他数据源**: 不受影响，继续使用简单User-Agent即可

---

## 🔧 诊断工具

如果以后需要调试类似问题，可使用：
```bash
node test-sportslottery-health.js
```

该脚本会：
1. 测试简单请求头（健康检查原始配置）
2. 测试完整浏览器头
3. 测试禁用SSL验证
4. 提供详细的错误信息和响应体

---

## ✅ 完成检查清单

- [x] 修复健康检查请求头（添加完整浏览器头）
- [x] 修复健康日志列名匹配问题
- [x] 增强体彩错误调试日志
- [x] 修复变量作用域问题
- [x] 创建诊断测试脚本
- [x] 创建重启脚本
- [ ] **重启服务** ← 需要用户执行
- [ ] **验证修复效果** ← 需要用户确认

---

**准备就绪，请重启服务后验证！** 🚀
