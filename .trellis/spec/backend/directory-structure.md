# 目录结构

> 本项目后端代码的组织方式与放置规则。

---

## 概览

One Hub 是单体 Go 项目，模块名为 `one-api`。后端入口在 `main.go`，HTTP 框架是 Gin，数据库访问集中在 `model/`，中转核心在 `relay/`，供应商适配在 `providers/`。

新增后端能力时先按现有边界放置代码：

- 路由只放在 `router/`，不要在 controller 里注册路由。
- HTTP 参数绑定、鉴权后的上下文读取、后台接口响应放在 `controller/`。
- 数据模型、GORM 查询、分页、缓存刷新和领域状态更新放在 `model/`。
- OpenAI/Claude/Gemini 等中转请求编排放在 `relay/`。
- 具体上游供应商请求 URL、请求头、响应解析和能力接口实现放在 `providers/<provider>/`。
- 共享基础设施放在 `common/`，例如 logger、redis、cache、requester、config、test helper。
- Gin 中间件放在 `middleware/`，例如鉴权、限流、日志、request id、metrics。
- 请求/响应 DTO 与 OpenAI 兼容类型放在 `types/`。

---

## 目录布局

```text
main.go                         # 初始化配置、日志、DB、Redis/cache、router、cron 等
router/                         # Gin 路由分组注册
controller/                     # 后台与管理 API handler
model/                          # GORM model、查询、迁移、批量更新、领域逻辑
relay/                          # OpenAI-compatible relay 编排、计费、重试、流式响应
relay/task/                     # Midjourney/Suno/Kling 等异步任务 relay
providers/                      # 每个上游供应商的适配实现
providers/base/                 # 供应商通用接口与 BaseProvider
middleware/                     # Gin middleware
common/                         # 配置、日志、Redis/cache、requester、工具、测试 helper
common/config/                  # 全局配置变量与常量
common/logger/                  # Zap + lumberjack 日志封装
common/test/                    # httptest helper 与 relay/provider 测试工具
types/                          # API request/response 类型
metrics/                        # Prometheus metrics
mcp/                            # MCP server integration
safty/                          # 内容安全检查器
cron/                           # 定时任务初始化
i18n/                           # 国际化资源
web/                            # 前端，不属于 backend spec 范围
```

---

## 模块组织

- Backend API 的典型路径是 `router -> middleware -> controller -> model`。例如 `router/api-router.go` 注册 `/api/channel`，调用 `controller/channel.go`，查询逻辑在 `model/channel.go`。
- Relay 请求的典型路径是 `router/relay-router.go -> relay/<mode>.go -> providers/<provider>/`。例如 chat 请求由 `relay/chat.go` 选择 `providers/base.ChatInterface`，具体上游请求在 `providers/openai/chat.go` 等文件实现。
- 新 provider 必须实现 `providers/base/interface.go` 中对应能力接口，并在 `providers/providers.go` 的 `providerFactories` 注册，同时在 `common/config/` 增加 channel type 常量。
- 共享分页使用 `model.PaginateAndOrder`，不要在每个 model 里重复拼装分页响应。`model/channel.go`、`model/log.go`、`model/order.go` 都按这个模式返回 `DataResult[T]`。
- Redis 相关代码要走 `common/redis` 或 `common/cache`，业务层通过 `one-api/common/config` 的 `config.RedisEnabled` 决定是否使用 Redis fallback。
- 配置默认值放在 `common/config/config.go` 的 `defaultConfig()`；全局配置变量放在 `common/config/*.go`。

真实例子：

```go
// router/api-router.go
channelRoute := apiRouter.Group("/channel")
channelRoute.Use(middleware.AdminAuth())
{
  channelRoute.GET("/", controller.GetChannelsList)
  channelRoute.POST("/", controller.AddChannel)
  channelRoute.PUT("/", controller.UpdateChannel)
}
```

```go
// providers/providers.go
var providerFactories = make(map[int]ProviderFactory)

func GetProvider(channel *model.Channel, c *gin.Context) base.ProviderInterface {
  factory, ok := providerFactories[channel.Type]
  var provider base.ProviderInterface
  if !ok {
    baseURL := channel.GetBaseURL()
    if baseURL == "" {
      return nil
    }
    provider = openai.CreateOpenAIProvider(channel, baseURL)
  } else {
    provider = factory.Create(channel)
  }
  provider.SetContext(c)
  return provider
}
```

---

## 命名约定

- Go package name 使用小写，通常是单词：`controller`、`model`、`relay`、`middleware`、`providers`、`common`。
- Go 文件名使用小写。既有代码同时存在 underscore 和 hyphen；新增文件跟随相邻 package 风格。例如 `model/channel_tag.go`、`controller/channel-billing.go`、`middleware/rate-limit.go`、`relay/image-generations.go`。
- Exported function/type 使用 PascalCase：`GetChannelsList`、`BatchInsertChannels`、`ProviderInterface`、`OpenAIProviderFactory`。
- 局部变量使用 camelCase：`localChannel`、`baseUrls`、`requestStartTime`。
- Constant 和 exported global var 使用 PascalCase：`ChannelStatusEnabled`、`UserStatusDisabled`、`DefaultChannelWeight`。
- JSON/form field name 在 tag 中使用 snake_case：`created_time`、`base_url`、`disabled_stream`、`test_model`。
- 当既有 model 需要区分 empty 和 unset 时，nullable DB/config 字段使用 pointer type。例如 `model.Channel` 中的 `BaseURL *string`、`Weight *uint`、`Priority *int64`。

---

## 真实代码示例位置

- `model/channel.go`：model struct tag、允许排序字段、过滤查询、批量更新、变更后的缓存刷新。
- `controller/channel.go`：Gin binding、早返回、标准 dashboard response shape。
- `router/api-router.go`：route group 和 middleware 放置方式。
- `relay/chat.go`：relay object 模式、request validation、provider interface assertion、stream/non-stream 分支。
- `providers/openai/base.go` 和 `providers/openai/chat.go`：provider factory、base config、request URL/header 行为、response 和 usage 处理。
- `common/logger/logger.go` 和 `middleware/logger.go`：custom logger 和 request logging middleware。
- `common/cache/main.go` 和 `middleware/rate-limit.go`：Redis-enabled path 加 in-memory fallback。

## 禁止模式

- 不要把 SQL-heavy business logic 放在 controller。Controller 应负责 bind/validate、调用 model function、返回 response。
- 不要在 `router/` 之外注册 route。
- 当 provider interface 或 provider implementation 可以承载行为时，不要在无关 relay 文件中添加 provider-specific conditional。
- 不要引入第二套 logging/config/cache abstraction。既有调用方使用 `one-api/common/logger`、`viper` 加 `common/config`、以及 `common/cache`/`common/redis`。
- 不要在代码或测试中硬编码 secret、API key 或 provider credential。
