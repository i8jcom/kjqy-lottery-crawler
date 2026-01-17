# 🚀 部署检查清单

## ✅ 重新部署时的关键检查项

### 📋 必须检查的配置

#### 1. 数据库配置 ✅ 已修复
**文件**: `src/db/Database.js` (Line 27)
```javascript
dateStrings: true  // ✅ 必须保留此配置
```
**作用**: 防止MySQL2自动将DATETIME转换为UTC时间

---

#### 2. Cheerio版本 ✅ 已锁定
**文件**: `package.json`
```json
"cheerio": "^1.0.0-rc.12"
```
**原因**: 1.1.0版本的undici依赖与Node 18不兼容

---

#### 3. 时间格式化方法 ✅ 已修复

**SG Lotteries** (`src/scrapers/SGLotteriesScraper.js`)
- Lines 102-104: 直接使用 `recordData.datetime`
- Lines 206-208: 历史数据也直接使用 `recordData.datetime`

**SpeedyLot88** (`src/scrapers/SpeedyLot88Scraper.js`)
- Lines 297-304: 使用本地时区方法，**不使用** `toISOString()`

---

#### 4. 环境变量配置
**文件**: `.env`
```bash
# 数据库配置（根据实际环境修改）
DB_HOST=mysql              # Docker网络内使用容器名
DB_PORT=3306
DB_USER=lottery
DB_PASSWORD=lottery123
DB_NAME=lottery_crawler

# 调度器模式
SCHEDULER_MODE=continuous  # 或 dynamic
```

---

## 🐳 Docker部署步骤

### 方式1: 使用 docker-compose（推荐）

```bash
# 1. 确保配置正确
cat .env
cat docker-compose.yml

# 2. 构建并启动
docker-compose build
docker-compose up -d

# 3. 检查状态
docker-compose ps
docker logs lottery-crawler-compose --tail 50

# 4. 验证时间格式
curl -s http://localhost:4000/api/latest-data | jq '.data[0].drawTime'
# ✅ 应显示: "2025-12-24 10:45:00"
# ❌ 不应显示: "2025-12-24T02:45:00.000Z"
```

### 方式2: 直接使用 Node.js

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
node src/index.js

# 3. 或使用后台运行
nohup node src/index.js > logs/service.log 2>&1 &
```

---

## ⚠️ 常见陷阱

### ❌ 不要做的事情

1. **不要升级cheerio到1.1.0+**
   - 会导致undici兼容性问题

2. **不要移除 `dateStrings: true`**
   - 会导致时间自动转换为UTC

3. **不要使用 `toISOString()`**
   - 任何地方都不要用，会转换为UTC

4. **不要回滚代码**
   - 确保使用最新的修复版本

---

## ✅ 部署后验证

### 1. 检查服务状态
```bash
docker ps | grep lottery
# 应看到两个容器都是 healthy 状态
```

### 2. 检查API响应
```bash
curl -s http://localhost:4000/api/latest-data | jq '.data[0]'
```

### 3. 检查数据库数据
```bash
docker exec lottery-mysql-compose mysql -u lottery -plottery123 lottery_crawler \
  -e "SELECT lot_code, issue, draw_time FROM lottery_results ORDER BY id DESC LIMIT 3;" \
  2>&1 | grep -v Warning
```

### 4. 检查时间格式
**正确格式**: `2025-12-24 10:45:00`
**错误格式**: `2025-12-24T02:45:00.000Z`

---

## 🔧 故障排查

### 问题1: 时间显示UTC格式

**原因**:
- 使用了旧版本代码
- `dateStrings: true` 被移除

**解决**:
```bash
# 1. 检查代码版本
grep "dateStrings" src/db/Database.js

# 2. 如果没有，添加配置
# 在 Database.js 的 createPool 中添加:
# dateStrings: true

# 3. 重启服务
docker-compose restart crawler-service
```

### 问题2: 服务启动失败

**检查**:
```bash
docker logs lottery-crawler-compose --tail 100
```

**常见原因**:
- 端口4000被占用
- 数据库连接失败
- cheerio版本问题

---

## 📝 版本控制建议

### Git提交前检查

```bash
# 1. 确认关键文件状态
git diff src/db/Database.js
git diff src/scrapers/SGLotteriesScraper.js
git diff src/scrapers/SpeedyLot88Scraper.js
git diff package.json

# 2. 确保没有临时文件
ls test-*.js check-*.js 2>/dev/null
# 应该为空

# 3. 提交
git add .
git commit -m "fix: 修复时区问题，使用本地时区和dateStrings配置"
git push
```

---

## 🎯 新服务器部署流程

```bash
# 1. 克隆代码
git clone <repository-url>
cd crawler-service

# 2. 复制环境配置
cp .env.example .env
# 编辑 .env 根据实际情况修改

# 3. 启动服务
docker-compose up -d

# 4. 等待健康检查通过（约30秒）
watch -n 2 'docker-compose ps'

# 5. 验证时间格式
curl -s http://localhost:4000/api/latest-data | \
  jq '.data[0].drawTime' | \
  grep -E '^"[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}"$' && \
  echo "✅ 时间格式正确" || \
  echo "❌ 时间格式错误"
```

---

## 📞 技术支持

如果遇到问题：
1. 检查 `docker logs lottery-crawler-compose`
2. 检查 `logs/service.log`
3. 参考本文档的故障排查部分
4. 确认所有关键配置都已正确设置

---

**最后更新**: 2025-12-24
**版本**: 修复时区问题后的稳定版本
