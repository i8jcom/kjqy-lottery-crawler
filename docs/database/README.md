# 数据库归档文件

## sql-archive/ 目录

包含历史数据和测试用 SQL 文件，已从根目录移除。

### 文件说明

#### 表结构定义
- `cwl_domain_management.sql` - 福彩域名管理表结构（旧版）
- `universal_domain_management_upgrade.sql` - 通用域名管理升级脚本

#### 历史数据导入
- `insert_fc3d_history.sql` - 福彩3D历史数据（100期）
- `insert_kl8_history.sql` - 快乐8历史数据
- `insert_qlc_history.sql` - 七乐彩历史数据
- `insert_ssq_history.sql` - 双色球历史数据

#### 全年数据
- `full_year_fc3d_2024.sql` - 福彩3D 2024全年数据
- `full_year_fc3d_2025.sql` - 福彩3D 2025全年数据
- `full_year_kl8_2025.sql` - 快乐8 2025全年数据
- `full_year_qlc_2024.sql` - 七乐彩 2024全年数据
- `full_year_qlc_2025.sql` - 七乐彩 2025全年数据
- `full_year_ssq_2024.sql` - 双色球 2024全年数据
- `full_year_ssq_2025.sql` - 双色球 2025全年数据

### 用途

这些文件用于：
1. 新环境初始化时导入历史数据
2. 测试爬虫对历史数据的处理
3. 数据库表结构参考

### 注意事项

- 生产环境不需要这些文件
- 数据库初始化使用根目录的 `init.sql`
- 表结构迁移使用 `migrations/` 目录
- 这些文件仅作归档保留

---

**归档时间**: 2026-01-17  
**归档原因**: 清理根目录，这些文件不是运行时必需
