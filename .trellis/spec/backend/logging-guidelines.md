# 日志指南

> 本项目日志记录约定。

---

## 概览

项目日志封装在 `one-api/common/logger`，底层是 Zap，文件轮转使用 `gopkg.in/natefinch/lumberjack.v2`。日志同时写入文件和 stderr，并维护最近 500 条内存日志用于系统日志查看。

初始化顺序在 `main.go`：

```go
config.InitConf()
logger.SetupLogger()
logger.SysLog("One Hub " + config.Version + " started")
```

不要在新应用代码中直接使用 `fmt.Println`、`log.Println`、`log.Printf`。测试 helper 或历史代码里存在少量旧用法，不代表新代码可以继续添加。

---

## 日志级别

- `logger.SysLog(...)`: 系统生命周期、初始化、迁移、批处理开始/结束、可恢复的重要状态。
- `logger.SysError(...)`: 后台任务、迁移、缓存、provider 初始化等无 Gin request context 的错误。
- `logger.SysDebug(...)`: 仅 debug 级别可见的系统调试信息。
- `logger.LogInfo(ctx, ...)`, `LogWarn`, `LogError`, `LogDebug`: 有 request context 的日志，会带 request id。
- `logger.FatalLog(...)`: 启动期不可恢复错误，例如数据库初始化失败、Redis URL 解析失败、Redis ping 失败。

真实例子：

```go
// model/main.go
logger.SysLog("database migration started")
logger.SysLog("database migrated")
logger.FatalLog("failed to initialize database: " + err.Error())
```

```go
// relay/main.go
logger.LogError(c.Request.Context(), fmt.Sprintf("using channel #%d(%s) to retry (remain times %d)", channel.Id, channel.Name, i))
```

---

## 结构化日志

`common/logger` 的系统日志是 message-oriented；Gin 请求日志是 structured fields。

Logger encoder 设置：

- `time` 格式：`2006/01/02 - 15:04:05`
- level 使用大写
- caller 使用短路径
- 输出到 `logs.filename` 指定文件，默认 `one-hub.log`，同时输出 stderr

Request id 由 `middleware.RequestId()` 写入 Gin context、request context 和 response header，key 是 `X-Oneapi-Request-Id`。

```go
// middleware/request-id.go
id := utils.GetTimeString() + utils.GetRandomString(8)
c.Set(logger.RequestIdKey, id)
ctx := context.WithValue(c.Request.Context(), logger.RequestIdKey, id)
c.Request = c.Request.WithContext(ctx)
c.Header(logger.RequestIdKey, id)
```

Gin request log fields 定义在 `middleware/logger.go`：

```go
fields := []zapcore.Field{
  zap.Int("status", c.Writer.Status()),
  zap.String("request_id", requestID),
  zap.String("method", c.Request.Method),
  zap.String("path", path),
  zap.String("query", query),
  zap.String("ip", c.ClientIP()),
  zap.String("user-agent", c.Request.UserAgent()),
  zap.Duration("latency", latency),
  zap.Int("user_id", userID),
  zap.String("original_model", c.GetString("original_model")),
  zap.String("new_model", c.GetString("new_model")),
  zap.Int("token_id", c.GetInt("token_id")),
  zap.String("token_name", c.GetString("token_name")),
  zap.Int("channel_id", c.GetInt("channel_id")),
}
```

---

## 应记录的内容

- 进程启动和可选子系统状态：One Hub version、数据库选择、Redis enabled/disabled、memory cache enabled、MCP enabled、monthly invoice enabled。
- 数据库迁移开始、完成和失败。
- Batch updater 和 batch insert 失败。
- Relay/provider 重试决策和上游错误；有 request context 时使用 context-aware logging。
- middleware 捕获的 panic 和 stack trace。
- 无法返回给 HTTP client 的后台任务错误。
- 不暴露凭证或 secret 的安全相关校验失败。

真实例子：

```go
// common/redis/redis.go
if redisConn == "" {
  logger.SysLog("REDIS_CONN_STRING not set, Redis is not enabled")
  return nil
}
logger.SysLog("Redis is enabled")
```

```go
// model/utils.go
logger.SysLog(fmt.Sprintf("batch inserting %d logs", len(logs)))
logger.SysError("failed to batch insert logs: " + err.Error())
```

---

## 不应记录的内容

- 不要记录 API key、token secret、session secret、OAuth client secret、SMTP token、payment secret 或原始 provider credential。
- 除非相关日志路径已经完成敏感值脱敏，不要记录原始 request body。
- 不要记录 channel key。列表查询通常调用 `DB.Omit("key")` 也是出于同一原因。
- 除既有 bootstrap 行为外，不要把明文用户密码或生成的 root 凭证写入日志。
- 不要记录包含 `key=sk-...` 的完整 query string；Gin logger 已对这个特例做脱敏。

```go
// middleware/logger.go
if query != "" {
  if i := strings.Index(query, "key=sk-"); i >= 0 {
    start := i + 4 // "key=" length
    end := strings.Index(query[start:], "&")
    if end == -1 {
      end = len(query)
    } else {
      end += start
    }
    query = query[:start] + "sk-***" + query[end:]
  }
}
```

## 常见错误

- 调试时添加 `fmt.Println`，然后遗留在应用代码中。
- 记录错误时缺少 channel/user/request 上下文。request path 中优先使用 `logger.LogError(c.Request.Context(), ...)`。
- 记录可能包含 secret 或用户 prompt 的原始上游响应。
- 应用开始服务流量后继续使用 `logger.FatalLog`。Fatal 应只用于启动期不可恢复错误。
