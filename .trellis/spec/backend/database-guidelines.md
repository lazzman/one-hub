# 数据库指南

> 本项目数据库访问、迁移和查询约定。

---

## 概览

数据库层使用 GORM，全局连接是 `model.DB`。项目必须同时兼容 MySQL、PostgreSQL 和 SQLite：

- `model/main.go` 根据 `sql_dsn` 选择数据库；未设置时使用 SQLite。
- PostgreSQL 通过 `common.UsingPostgreSQL = true` 标记，SQLite 通过 `common.UsingSQLite = true` 标记。
- 初始化迁移只在 master node 执行：`if !config.IsMasterNode { return nil }`。
- 自动迁移在 `model.InitDB()` 里逐个调用 `db.AutoMigrate(&Model{})`。
- 历史数据迁移在 `model/migrate.go` 用 `github.com/go-gormigrate/gormigrate/v2` 管理。

真实例子：

```go
// model/main.go
if strings.HasPrefix(dsn, "postgres://") {
  logger.SysLog("using PostgreSQL as database")
  common.UsingPostgreSQL = true
  return gorm.Open(postgres.New(postgres.Config{
    DSN:                  dsn,
    PreferSimpleProtocol: true,
  }), &gorm.Config{PrepareStmt: true})
}
```

```go
// model/channel.go
type Channel struct {
  Id      int     `json:"id"`
  Type    int     `json:"type" form:"type" gorm:"default:0"`
  Key     string  `json:"key" form:"key" gorm:"type:text"`
  Weight  *uint   `json:"weight" gorm:"default:1"`
  BaseURL *string `json:"base_url" gorm:"column:base_url;default:''"`
}
```

---

## 查询模式

- 查询函数放在 `model/`，不要放在 `controller/`。根据既有调用点返回 `(*DataResult[T], error)`、`([]*T, error)`、`(*T, error)`、`(int64, error)` 或普通 `error`。
- 用户输入必须通过 GORM 占位符（`?`）传入，不要把用户值拼进 SQL 字符串。
- 列表接口要定义允许排序字段 map，并调用 `PaginateAndOrder`，避免任意 `ORDER BY` 注入。
- 敏感字段或大字段不应返回时，使用 `DB.Omit("key")` 或 `Select(...)`。
- PostgreSQL 保留字字段（如 `key`、`group`）参与 SQL 片段拼装前，使用 `quotePostgresField()`。
- 修改 channel/user-group 这类有内存缓存的数据后，按既有 model 行为刷新对应缓存，例如 `ChannelGroup.Load()`、`GlobalUserGroupRatio.Load()`。
- 批量写入优先复用现有 helper。`model.BatchInsert` 会递归拆分失败批次并记录单条失败。

真实例子：

```go
// model/common.go
func PaginateAndOrder[T modelable](db *gorm.DB, params *PaginationParams, result *[]*T, allowedOrderFields map[string]bool) (*DataResult[T], error) {
  if params.Order != "" {
    orderFields := strings.Split(params.Order, ",")
    for _, field := range orderFields {
      field = strings.TrimSpace(field)
      desc := strings.HasPrefix(field, "-")
      if desc {
        field = field[1:]
      }
      if !allowedOrderFields[field] {
        return nil, fmt.Errorf("不允许对字段 '%s' 进行排序", field)
      }
      if desc {
        field = field + " DESC"
      }
      db = db.Order(field)
    }
  }
  err = db.Find(result).Error
}
```

```go
// model/channel.go
if params.Key != "" {
  db = db.Where(quotePostgresField("key")+" = ?", params.Key)
}
```

---

## 迁移

- 新 model struct 放在 `model/`，并在 `model.InitDB()` 中通过 `AutoMigrate` 注册。
- 数据迁移或 `AutoMigrate` 无法安全表达的 DB-specific DDL 放在 `model/migrate.go`。
- 每个 `gormigrate.Migration` 使用稳定的时间戳式 `ID`，例如 `"202411300001"`。
- 破坏性 DDL 前先检查表或索引是否存在，例如 `HasTable("tokens")`、`HasIndex(&Channel{}, "idx_channels_key")`。
- 原始 DDL 要按数据库方言分支。既有代码使用 `tx.Dialector.Name()` 区分 `mysql`、`postgres` 和 `sqlite`。
- 迁移失败通过 `logger.SysLog`/`logger.SysError` 记录；必须停止迁移时返回 error。
- slave node 不执行迁移；`migrationBefore` 和 `migrationAfter` 都显式在 `!config.IsMasterNode` 时跳过。

真实例子：

```go
// model/migrate.go
func changeTokenKeyColumnType() *gormigrate.Migration {
  return &gormigrate.Migration{
    ID: "202411300001",
    Migrate: func(tx *gorm.DB) error {
      if !tx.Migrator().HasTable("tokens") {
        return nil
      }
      dialect := tx.Dialector.Name()
      var err error
      switch dialect {
      case "mysql":
        err = tx.Exec("ALTER TABLE tokens MODIFY COLUMN `key` varchar(59)").Error
      case "postgres":
        err = tx.Exec("ALTER TABLE tokens ALTER COLUMN key TYPE varchar(59)").Error
      case "sqlite":
        return nil
      }
      if err != nil {
        logger.SysLog("修改 tokens.key 字段类型失败: " + err.Error())
        return err
      }
      return nil
    },
  }
}
```

```go
// model/main.go
err = db.AutoMigrate(&Channel{})
if err != nil {
  return err
}
```

---

## 命名约定

- Struct 字段使用 PascalCase；JSON/form 字段使用 snake_case。
- GORM tag 承载 DB default、index、column name 和 SQL type。
- 当既有 API 需要区分 unset 和 empty 时，nullable/optional column 使用 pointer 字段。
- 既有主键字段常用 `Id` 而不是 `ID`；除非正在修改的类型已使用 `ID`，否则跟随相邻 model 风格。
- 需要软删除时使用 `gorm.DeletedAt`，tag 为 `json:"-" gorm:"index"`，例如 `model.Channel`。
- 排序 allowlist key 必须匹配前端发送的 API 字段名/列名，例如 `response_time`、`priority`、`weight`。

---

## 常见错误

- 忘记 MySQL/PostgreSQL/SQLite 兼容性。任何 raw SQL、日期格式、保留字段名、JSON 类型或 DDL 都需要方言判断。
- 从 query params 接受任意排序字段。列表排序必须通过 allowlist 和 `PaginateAndOrder`。
- 更新数据库支撑的缓存数据后，忘记调用 reload/change hook。
- 在列表接口读取或返回 channel key 等敏感字段。
- 创建 Redis-only 行为。Redis 是可选能力，关闭后代码仍需可用。
- 手动开启事务但没有在每个早返回错误路径 rollback。新原子流程优先用 `DB.Transaction(func(tx *gorm.DB) error { ... })`，除非相邻代码已经使用显式 `Begin/Commit`。

## 事务

必须保持原子性的多步骤更新要使用事务。既有代码同时存在 `DB.Transaction` 和显式 `Begin/Commit`；新代码通常优先使用更清晰、更安全的 `DB.Transaction`。

```go
// model/redemption.go
err = DB.Transaction(func(tx *gorm.DB) error {
  err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", key).First(redemption).Error
  if err != nil {
    return errors.New("无效的兑换码")
  }
  err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
  if err != nil {
    return err
  }
  redemption.Status = config.RedemptionCodeStatusUsed
  return tx.Save(redemption).Error
})
```
