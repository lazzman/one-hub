# 质量指南

> 本项目后端代码质量、检查和评审约定。

---

## 概览

Backend 是 Go + Gin + GORM 单体。代码应优先匹配现有模式，而不是引入新的架构层。格式化与 lint 由 Taskfile 和 `.golangci.yml` 定义：

- `task gofmt`: `gofmt -s -w .` + `goimports -w .`
- `task golint`: `golangci-lint run -v ./...`
- `task lint`: gofmt + golint
- `.golangci.yml` 启用 `goimports`, `gofmt`, `govet`, `misspell`, `ineffassign`, `typecheck`, `whitespace`, `gocyclo`, `revive`, `unused`
- Go 文件用 gofmt 标准 tab；非 Go 文件由 `.editorconfig` 规定 2-space indent、UTF-8、LF、final newline。

---

## 禁止模式

- 不要用 `fmt.Println`、`log.Println` 或 `log.Printf` 添加应用日志；使用 `one-api/common/logger`。
- 不要硬编码 credential、token、API key、payment secret、private URL 或环境相关 secret。
- 不要让功能强依赖 Redis。检查 `one-api/common/config` 的 `config.RedisEnabled`，并提供进程内或 DB fallback。
- 不要添加只适配单一数据库方言的数据库逻辑；MySQL、PostgreSQL、SQLite 都必须继续支持。
- 不要从 request 接受任意排序字段或 SQL 片段。
- 列表接口不要返回原始 channel key 或其他 secret。
- 不要在 controller/model/provider package 中注册路由。
- 当 provider 行为应由 `providers/base` interface 或 provider implementation 承担时，不要把重复 provider 逻辑堆到 relay。
- DB write、HTTP request 构造、body close、JSON marshal/unmarshal、cache operation 等返回 error 会影响行为时，不要忽略。

真实反例类别在代码中能看到少量历史遗留，例如 application code 中的 raw `log.Printf`/`fmt.Println`。新代码不要扩大这些用法。

---

## 必须遵循的模式

- import 分组使用标准库、空行、第三方、空行、内部 `one-api/...`。
- Controller 使用 Gin binding，并在错误后早返回。
- Admin/user endpoint 使用标准 dashboard response shape：

```go
c.JSON(http.StatusOK, gin.H{
  "success": true,
  "message": "",
  "data":    result,
})
```

- Dashboard error 使用 `common.APIRespondWithError` 或既有 inline `{success:false,message:...}` shape。
- Relay/provider error 使用 OpenAI-compatible wrapper。
- 列表 endpoint 使用 `model.PaginateAndOrder` 和 allowlist map。
- 保留字段和 SQL function 使用 `quotePostgresField` 或方言分支处理。
- 修改有缓存支撑的 DB 数据后，刷新或更新对应内存缓存。
- 新增 helper 前先复用既有 common helper：`common/utils`、`common/requester`、`common/cache`、`common/redis`、`common/test`。
- 新增 config 时，default 放在 `common/config/config.go`，exported var/constant 放在 `common/config/*.go`。
- 新增 provider 时，实现相关 `providers/base` interface，并在 `providers/providers.go` 注册。

---

## 测试要求

既有测试覆盖是选择性的，主要集中在 provider/relay/common helper。修改共享行为、provider request formatting、relay compatibility、parsing、billing、cache fallback 或 DB query contract 时，要补充聚焦测试。

模式：

- 使用 Go `testing` package 和 `github.com/stretchr/testify/assert`。
- Test file 常使用 external package suffix，例如 `package ali_test`、`package storage_test`。
- Provider HTTP test 可使用 `common/test.NewTestServer()`。
- 依赖配置的测试常调用 `viper.ReadInConfig()`。
- 需要真实外部 credential 的测试属于 integration-style；普通 unit coverage 不应引入这类依赖。

真实例子：

```go
// providers/openai/custom_params_test.go
server := test.NewTestServer()
assert.Nil(t, errWithCode)
assert.Contains(t, capturedBody, `"service_tier":"flex"`)
assert.NotContains(t, capturedBody, `"service_tier":"priority"`)
```

```go
// common/image/image_test.go
assert.NoError(t, err)
assert.Equal(t, c.width, size.X)
assert.Equal(t, c.height, size.Y)
```

Docs/spec-only 变更可以用 Markdown 占位文本搜索、链接和路径检查做轻量验证，不需要运行 `go test ./...`。

## Provider 请求构建契约：OpenAI Responses raw passthrough

### 1. Scope / Trigger

修改 OpenAI provider 的 `/v1/responses` 请求体构建时，如果涉及 `Channel.AllowExtraBody` 或 raw request body，必须按本契约检查。这个路径承载上游原生 Responses payload，不能把 `tools` 等字段先绑定到 `types.OpenAIResponsesRequest` 再整体重组。

### 2. Signatures

- `providers/openai.(*OpenAIProvider).GetRequestTextBody(relayMode int, ModelName string, request any)`
- `providers/base.(*BaseProvider).GetRawBody() ([]byte, bool)`
- `relay.(*relayResponses).setRequest()`

### 3. Contracts

- `AllowExtraBody=false`：保持结构体序列化路径，不能从 raw body 透传未知字段。
- `AllowExtraBody=true` 且 `relayMode == config.RelayModeResponses`：以上游原始 JSON object 为请求体基础。
- Responses raw passthrough 只从结构体结果覆盖 `model`，确保上游收到映射后的模型名。
- send 阶段 custom params 仍在 raw passthrough 之后合并，并继续遵守 `overwrite`、`per_model`、`pre_add=false` 规则。
- raw body 缺失、不是 JSON object 或解析失败时，必须回退到当前结构体序列化路径。
- Responses 兼容 Chat 路径不使用该 raw passthrough 规则，继续走结构体转换。

### 4. Validation & Error Matrix

- raw body 缺失 -> 使用结构体序列化，不返回额外错误。
- raw body 解析失败 -> 使用结构体序列化，不返回额外错误。
- custom params 解析失败 -> 按 provider 现有 `custom_parameter_error` 返回。
- request marshal/unmarshal 失败 -> 按 provider 现有 `marshal_request_failed` / `unmarshal_request_failed` 返回。

### 5. Good/Base/Bad Cases

- Good：raw `tools` 中包含 provider 未建模字段，`AllowExtraBody=true` 后上游 body 仍保留这些字段，同时 `model` 是映射后名称。
- Base：`AllowExtraBody=false` 时上游 body 来自 `types.OpenAIResponsesRequest` marshal，未知 raw 字段不会透传。
- Bad：把结构体 marshal 后的 `tools` 整体覆盖回 raw map，导致 server-executed tools 的原生字段丢失或被重组。

### 6. Tests Required

- provider 测试断言 `AllowExtraBody=true` 保留 raw `tools` 未建模字段并覆盖 mapped `model`。
- provider 测试断言 `AllowExtraBody=false` 仍使用结构体序列化。
- provider 测试断言 raw body 无法解析时回退到结构体序列化。
- relay 测试断言 Responses `setRequest` 会把原始 body 缓存在 `GinRequestBodyKey`，供 provider passthrough 使用。
- custom params 测试断言 send 阶段按映射后模型选择配置并保持 overwrite 行为。

### 7. Wrong vs Correct

#### Wrong

```go
for key, value := range requestMap {
	rawRequest[key] = value
}
```

这会把 `tools` 从结构体版本覆盖回 raw body。

#### Correct

```go
if modelName, ok := requestMap["model"]; ok {
	rawRequest["model"] = modelName
}
```

Responses raw passthrough 只覆盖 mapped `model`，再执行已有 send 阶段 custom params 合并。

---

## 代码评审清单

- Scope：变更保持在请求的 package/layer 内，不重构无关代码。
- Routing：新增 endpoint 在 `router/` 注册，并使用合适 middleware。
- API contract：dashboard endpoint 返回 `{success,message,data}`；relay endpoint 返回 OpenAI-compatible error。
- Database：query 使用占位符，排序字段有 allowlist，方言差异已处理，mutation 后刷新缓存。
- Redis/cache：`RedisEnabled == false` 时功能仍可用。
- Provider changes：能力 interface 已实现，factory 注册完整，request header/URL 跟随 provider base 模式。
- Logging：不记录 secret，不使用裸 `fmt.Println`/`log.Printf`，request path 使用 context-aware logging。
- Tests：有风险的共享行为有聚焦测试；纯本地逻辑不要求外部服务测试。
- Formatting：Go 变更通过 `gofmt/goimports`；文档保留 final newline，且没有非预期占位文本。

## 常见错误

- 只在一处更新 config 或 channel type，遗漏 provider factory、frontend list、model price metadata 等镜像登记点。
- 新增 helper 前没有搜索既有 utility。
- 把 SQLite 当成唯一 local database，忘记 PostgreSQL quoting/date 行为。
- 返回 nil provider 或 nil response，没有转换成既有 error wrapper。
- 构造 relay/provider HTTP request 后忘记 `defer req.Body.Close()`。
