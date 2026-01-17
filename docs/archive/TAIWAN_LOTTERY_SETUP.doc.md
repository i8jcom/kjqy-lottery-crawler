# 台湾彩票爬虫设置说明

## 🇹🇼 已完成的配置

### 1. 爬虫类创建 ✅
- 文件: `src/scrapers/TaiwanLotteryScraper.js`
- 支持彩种:
  - 威力彩 (lotto649) - lotCode: 100001
  - 大乐透 (biglotto) - lotCode: 100002
  - 今彩539 (daily539) - lotCode: 100003
  - 38樂合彩 (list38) - lotCode: 100004
  - 3D (lotto3d) - lotCode: 100005
  - 4D (lotto4d) - lotCode: 100006

### 2. MultiSourceDataManager集成 ✅
- 文件: `src/services/MultiSourceDataManager.js`
- 添加了导入: `import taiwanLotteryScraper from '../scrapers/TaiwanLotteryScraper.js';`
- 添加了路由逻辑: `else if (source === 'taiwanlottery')`
- 添加了获取方法: `fetchFromTaiwanLottery()`

### 3. UniversalDomainManager配置 ✅
- 文件: `src/managers/UniversalDomainManager.js`
- 添加了source类型: `taiwanlottery: { name: '台湾彩票官网', testEndpoint: '/lotto/result/lotto649' }`

### 4. 彩种配置 ✅
- 文件: `data/lottery-configs.json`
- 添加了6个台湾彩票彩种配置
- 添加了lotCodeToScraperKey映射
- 添加了endpointMap配置

## ⚠️ 需要手动完成的步骤

### 启动数据库后添加域名
当MySQL数据库可用时，运行以下命令:
```bash
cd /home/i8/claude-demo/kjqy-deploy/crawler-service
mysql -h lottery-mysql-compose -u lottery -plottery123 lottery_crawler < data/init-taiwan-lottery-domain.sql
```

或者在数据库中直接执行:
```sql
INSERT INTO cwl_api_domains (source_type, domain_url, priority, enabled, status, health_score, notes, created_at, updated_at)
VALUES ('taiwanlottery', 'https://www.taiwanlottery.com', 1, TRUE, 'active', 100, '台湾彩票官方网站', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();
```

## 📝 使用说明

### 测试单个彩种
```javascript
import taiwanLotteryScraper from './src/scrapers/TaiwanLotteryScraper.js';

// 测试威力彩
const result = await taiwanLotteryScraper.fetchLatestData('lotto649');
console.log(result);

// 测试大乐透
const bigLottoResult = await taiwanLotteryScraper.fetchLatestData('biglotto');
console.log(bigLottoResult);
```

### 通过MultiSourceDataManager使用
```javascript
import multiSourceDataManager from './src/services/MultiSourceDataManager.js';

// 获取威力彩数据
const result = await multiSourceDataManager.fetchLotteryData('100001');
console.log(result);
```

## 🔍 验证步骤

1. **检查配置文件**
```bash
cat data/lottery-configs.json | grep -A 10 "taiwanlottery"
```

2. **检查域名配置**
```bash
mysql -h lottery-mysql-compose -u lottery -plottery123 lottery_crawler -e "SELECT * FROM cwl_api_domains WHERE source_type='taiwanlottery';"
```

3. **测试爬虫功能**
```bash
node -e "
import('./src/scrapers/TaiwanLotteryScraper.js').then(async (module) => {
  const scraper = module.default;
  try {
    const result = await scraper.fetchLatestData('lotto649');
    console.log('✅ 测试成功:', result);
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
  process.exit(0);
});
"
```

## 🎯 特性

### 独立数据源
- source类型: `taiwanlottery`
- 完全独立于其他彩票源
- 不影响现有SpeedyLot88、SG Lotteries等数据源

### 域名管理
- 集成到UniversalDomainManager
- 支持健康检查和故障转移
- 性能监控和统计

### HTML解析
- 使用cheerio解析台湾彩票官网HTML
- 支持主号码区和特别号区分
- 错误处理和重试机制

## 📊 数据结构

### 返回格式
```javascript
{
  lotCode: '100001',
  period: '112000100',
  numbers: ['01', '05', '12', '23', '35', '38', '07'],  // 全部号码
  mainNumbers: ['01', '05', '12', '23', '35', '38'],    // 主号码区
  specialNumbers: ['07'],                                // 特别号区
  opencode: '01,05,12,23,35,38,07',
  drawDate: '2026-01-04',
  drawTime: '2026-01-04 21:30:00',
  timestamp: 1735948800000,
  source: 'taiwanlottery_html',
  lotteryName: '威力彩'
}
```

## 🔧 故障排查

### 问题1: 域名未找到
```
Error: [taiwanlottery] 没有可用的域名配置
```
**解决方案**: 运行 `data/init-taiwan-lottery-domain.sql`

### 问题2: HTML解析失败
```
Error: 无法从HTML中解析出有效数据
```
**解决方案**: 检查台湾彩票官网是否可访问，网站结构是否变化

### 问题3: 号码数量不正确
```
Warning: 号码数量异常: X个 (期望Y-Z个)
```
**解决方案**: 检查网站HTML结构，可能需要更新解析逻辑

## 📈 未来优化

1. **API接口发现**: 台湾彩票网站可能有JSON API，需进一步分析
2. **缓存策略**: 台湾彩票开奖频率较低，可增加缓存时间
3. **历史数据**: 完善fetchHistoryData方法
4. **更多彩种**: 添加刮刮乐等其他台湾彩票游戏

---
**Created**: 2026-01-04
**Status**: ✅ 配置完成，待数据库域名初始化
