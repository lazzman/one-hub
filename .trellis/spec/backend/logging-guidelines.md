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

---

## 场景：日志详情审计预览载荷

### 1. Scope / Trigger

- Trigger: 日志详情抽屉需要跨后端和前端共享可执行的审计预览契约，用于展示 provider、协议、端点、流式状态、请求体和响应体。
- Trigger: `common/hijack/log_preview_payload.go` 变更了写入 `logs.content` 的 JSON 结构，属于跨层 request/response contract 变更。

### 2. Signatures

- 后端构造入口：`common/hijack.BuildLogPreviewPayload(source LogPreviewSource, requestBody string, responseData *ResponseData) LogPreviewPayload`
- 后端序列化入口：`common/hijack.MarshalLogPreviewPayload(payload LogPreviewPayload) string`
- 前端解析入口：`web/src/views/Log/component/LogContentDrawer/utils.js` 的 `parseContent(content)`
- 前端请求审计入口：`web/src/views/Log/component/LogContentDrawer/parsers/auditModel.js` 的 `buildRequestAuditModel(requestParsed, { schemaKey })`

请求摘要判定签名要求：

- `buildRequestAuditModel` 构建请求审计模型时，必须传入 `schemaKey`、`api_schema`、`protocol_hint` 中至少一个可稳定表达协议语义的上下文字段。
- 缺少 schema/protocol 上下文时，不得直接生成 `audio`、`images`、`embeddings` 这类非对话摘要；必须退回完整参数视图或原始请求视图。

关键结构：

```go
type LogPreviewSource struct {
	ProtocolHint     string `json:"protocol_hint,omitempty"`
	Provider         string `json:"provider,omitempty"`
	ChannelType      int    `json:"channel_type,omitempty"`
	ChannelName      string `json:"channel_name,omitempty"`
	EndpointPath     string `json:"endpoint_path,omitempty"`
	IsStream         bool   `json:"is_stream"`
	APIProvider      string `json:"api_provider,omitempty"`
	APIProviderLabel string `json:"api_provider_label,omitempty"`
	APISchema        string `json:"api_schema,omitempty"`
	APISchemaLabel   string `json:"api_schema_label,omitempty"`
	APIEndpointKind  string `json:"api_endpoint_kind,omitempty"`
	APITransport     string `json:"api_transport,omitempty"`
}
```

```go
type LogPreviewPayload struct {
	Version  int                `json:"version"`
	Source   LogPreviewSource   `json:"source"`
	Request  LogPreviewBody     `json:"request"`
	Response LogPreviewResponse `json:"response"`
}
```

### 3. Contracts

基础契约：

- `version`：当前固定为 `1`。
- `source.protocol_hint`：旧前端兼容字段，必须保留。
- `source.provider`：旧前端兼容字段，必须保留。
- `source.endpoint_path`：旧前端兼容字段，必须保留。
- `source.is_stream`：旧前端兼容字段，必须保留。
- `request.raw`：原始请求体字符串；允许为空字符串。
- `request.bytes`：请求体字节长度；应与 `len(request.raw)` 一致。
- `response.raw`：原始响应体字符串；允许为空字符串。
- `response.type`：`json` / `stream` / `custom` / `multipart` 之一，未知时可为空。
- `response.bytes`：响应体字节长度；应与 `len(response.raw)` 一致。

新增 `api_*` 契约：

- `source.api_provider`：稳定机器语义，例如 `openai`、`openrouter`、`anthropic`、`gemini`、`azure`。
- `source.api_provider_label`：展示名称，例如 `OpenAI`、`OpenRouter`、`Anthropic`。
- `source.api_schema`：稳定协议语义，例如 `openai-chat`、`openai-compatible`、`responses`、`claude`、`gemini`、`openai-images`。
- `source.api_schema_label`：展示名称，例如 `OpenAI Chat Completions`、`OpenAI-compatible Chat`、`OpenAI Responses`。
- `source.api_endpoint_kind`：端点类别，例如 `chat`、`responses`、`completions`、`embeddings`、`images`、`audio`。
- `source.api_transport`：`stream` / `non-stream`。

兼容规则：

- 新字段只追加，不能删除或替换旧字段。
- 前端优先消费 `api_*` 字段；缺失时回退到 `protocol_hint`、`provider`、`endpoint_path` 和请求/响应 shape 推断。
- 对 OpenRouter、Groq、DeepSeek、Moonshot 等兼容渠道，即使 endpoint 是 `/v1/chat/completions`，`api_schema` 也应保持 `openai-compatible`，不能误写成原生 `openai-chat`。

请求摘要归类规则：

- 非对话请求摘要判定必须先读取 schema/protocol 上下文，再决定是否进入 `audio`、`images`、`embeddings`、`completions` 分支。
- 以下 schema 必须优先按对话协议处理，禁止进入非对话摘要分支：`openai-chat`、`openai-compatible`、`openai-chat-completions`、`responses`、`openai-responses`、`claude`、`claude-messages`、`gemini`、`gemini-generate-content`。
- 对话协议日志优先按 `conversation`、`request`、`response` 语义解析；即使请求体含有 `input`、`response_format`、`voice`、`prompt` 等字段，也不得因此跳过对话语义解析。
- `input`、`response_format`、`voice`、`format`、`prompt`、`size`、`quality`、`style`、`encoding_format`、`dimensions` 仅可作为弱信号，不能单独作为非对话摘要归类依据。
- 友好降级只允许用于两类情况：
  - schema 已明确指向 `embeddings`、`images`、`audio`、`completions`
  - 已先排除对话协议，且同时命中强信号组合
- 强信号 fallback 必须从严：
  - `embeddings`：`input` 存在，且同时满足 `encoding_format`、`dimensions`、或明显的向量数组输入之一
  - `images`：`prompt` 存在，且同时满足 `size`、`quality`、`style` 中至少一个
  - `audio`：`file` 存在，且同时满足 `voice` 或 `format` 中至少一个
  - `completions`：需有明确 `completions` schema；不能仅凭 `prompt` 存在就降级为 completions 摘要

### 4. Validation & Error Matrix

- `requestBody == ""` -> 允许，`request.raw=""`，`request.bytes=0`
- `responseData == nil` -> 允许，`response.raw=""`，`response.bytes=0`
- `json.Marshal(payload)` 失败 -> 返回 fallback JSON，至少包含 `version=1`、`source.protocol_hint="unknown"`、`response.raw=<error>`
- 未识别 provider / schema -> `api_*` 可为空，旧字段仍需尽量填写，前端走 fallback 审计视图
- 流式响应但无法解析 SSE -> `response.type=stream` 保留，前端展示 raw 折叠视图并记录 SSE parse error
- 旧日志缺失 `api_*` -> 前端不得空白，必须使用 fallback 审计视图
- `schemaKey` 缺失或为空 -> 请求审计不得生成非对话摘要；必须保守展示完整参数视图
- `schemaKey` 属于对话协议，且请求体同时出现 `input` 或 `response_format` -> 仍按对话协议处理，`nonConversation` 必须为空
- 请求体仅出现 `input`、`response_format`、`voice` 中任一弱信号 -> 不得推断为 `audio`、`images`、`embeddings`
- 走 fallback 生成非对话摘要时 -> 必须先通过“非对话 schema 已明确”或“强信号组合成立”校验，任一条件不满足都应返回空摘要

### 5. Good / Base / Bad Cases

- Good:
  - OpenRouter `/v1/chat/completions` 日志同时包含：
    - `protocol_hint="openai-chat"` 或旧兼容值
    - `api_provider="openrouter"`
    - `api_schema="openai-compatible"`
    - `api_endpoint_kind="chat"`
    - `api_transport="stream"`
- Base:
  - 原生 OpenAI `/v1/responses` 非流式日志包含：
    - `api_provider="openai"`
    - `api_schema="responses"`
    - `api_endpoint_kind="responses"`
    - `api_transport="non-stream"`
  - `schemaKey="openai-responses"` 且请求体为 `{ "input": "hello", "response_format": { "type": "json_schema" } }`
    - Request 审计视图展示对话参数
    - `nonConversation=null`
- Bad:
  - 兼容渠道 `/v1/chat/completions` 被错误写成 `api_schema="openai-chat"`，前端会把兼容代理误显示成原生 OpenAI。
  - 新字段存在但删除了 `protocol_hint` / `provider` / `endpoint_path`，旧日志详情实现会直接退化或失效。
  - `schemaKey="openai-chat"` 或 `schemaKey="openai-responses"` 时，仅因存在 `input`、`response_format`、`voice` 就生成 `audio` 或 `embeddings` 摘要，导致对话请求被误判为非对话协议。
  - 未传入 `schemaKey`，却仅根据 `prompt`、`size`、`voice` 这类字段直接显示非对话摘要，导致旧日志或未知协议出现错误审计标签。

### 6. Tests Required

- Go 单元测试：
  - 原生 OpenAI `/v1/chat/completions` 应写出 `api_schema=openai-chat`
  - 兼容渠道 `/v1/chat/completions` 应写出 `api_schema=openai-compatible`
  - `/v1/responses`、`/v1/embeddings`、`/v1/images`、`/v1/audio` 的 `api_endpoint_kind` 应正确
  - `responseData == nil` 时 bytes/raw 契约正确
  - `MarshalLogPreviewPayload` fallback JSON 至少可被前端降级消费
- 前端测试：
  - `sourceDisplayModel` 优先使用 `api_*`
  - 缺少 `api_*` 时回退到旧字段和 shape
  - 兼容渠道旧日志 `provider=openrouter + protocol_hint=openai-chat` 展示为 `OpenAI-compatible Chat`
  - `buildRequestAuditModel(request, { schemaKey: 'openai-chat' })` 在请求体包含 `response_format` 时，`nonConversation` 仍为 `null`
  - `buildRequestAuditModel(request, { schemaKey: 'openai-responses' })` 在请求体包含 `input` 时，`nonConversation` 仍为 `null`
  - `buildRequestAuditModel(request, { schemaKey: 'openai-embeddings' })` 可生成 `embeddings` 摘要
  - `buildRequestAuditModel(request, { schemaKey: '' })` 或缺少 `schemaKey` 时，即使请求体含 `input` / `response_format` / `voice`，也不得生成非对话摘要
  - 仅强信号 fallback 场景允许生成非对话摘要；单字段弱信号必须返回空摘要

### 7. Wrong vs Correct

#### Wrong

```go
if request.input != nil || request.response_format != nil || request.voice != nil {
	return buildAudioOrEmbeddingSummary(request)
}
```

问题：

- 只看字段形状，忽略 schema/protocol 上下文，会把 chat/responses 请求误归类为 audio 或 embeddings。

#### Correct

```go
if isConversationSchema(schemaKey) {
	return nil
}

if isExplicitNonConversationSchema(schemaKey) {
	return buildNonConversationSummary(request, schemaKey)
}

if hasStrongNonConversationSignals(request) {
	return buildNonConversationSummary(request, schemaKey)
}

return nil
```

要求：

- 先排除对话协议，再处理非对话摘要。
- `input`、`response_format`、`voice` 只能参与强信号组合判断，不能单独触发摘要归类。
- 友好降级必须保守，宁可展示完整参数视图，也不能把对话请求标错协议。
