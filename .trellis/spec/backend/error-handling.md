# 错误处理

> 本项目错误传播、日志记录和 API 响应约定。

---

## 概览

后端使用 Go 标准 `error` 加少量项目封装。总体模式是早返回：

- Controller 绑定失败或 model 返回错误后立即响应并 `return`。
- Dashboard/admin API 返回 `{success, message, data}`。
- Relay/provider API 返回 OpenAI-compatible error，类型在 `types.OpenAIErrorWithStatusCode`。
- Provider 方法通常返回 `(*Response, *types.OpenAIErrorWithStatusCode)`。
- 日志使用 `one-api/common/logger`，上下文相关错误用 `logger.LogError(c.Request.Context(), ...)`。

真实例子：

```go
// controller/channel.go
channels, err := model.GetChannelsList(&params)
if err != nil {
  common.APIRespondWithError(c, http.StatusOK, err)
  return
}
c.JSON(http.StatusOK, gin.H{
  "success": true,
  "message": "",
  "data":    channels,
})
```

```go
// relay/chat.go
chatProvider, ok := r.provider.(providersBase.ChatInterface)
if !ok {
  err = common.StringErrorWrapperLocal("channel not implemented", "channel_error", http.StatusServiceUnavailable)
  done = true
  return
}
```

---

## 错误类型

- 标准 Go `error`：简单领域错误使用 `errors.New(...)`，需要上下文格式化时使用 `fmt.Errorf(...)`。
- GORM not found 和 sentinel error 比较应使用 `errors.Is(...)`。
- OpenAI-compatible error：
  - `common.ErrorWrapper(err, code, statusCode)`
  - `common.ErrorWrapperLocal(err, code, statusCode)`
  - `common.StringErrorWrapper(message, code, statusCode)`
  - `common.StringErrorWrapperLocal(message, code, statusCode)`
- Rerank 有并行 wrapper：`StringRerankErrorWrapper` 和 `OpenAIErrorToRerankError`。
- Midjourney 在 `providers/midjourney/error.go` 下有自己的 provider response wrapper；不要强行套用 OpenAI response shape。

```go
// common/gin.go
func StringErrorWrapper(err string, code string, statusCode int) *types.OpenAIErrorWithStatusCode {
  openAIError := types.OpenAIError{
    Message: err,
    Type:    "one_hub_error",
    Code:    code,
  }
  return &types.OpenAIErrorWithStatusCode{
    OpenAIError: openAIError,
    StatusCode:  statusCode,
  }
}
```

---

## 错误处理模式

- 请求数据通过 `ShouldBindQuery`、`ShouldBindJSON` 或 `common.UnmarshalBodyReusable` 绑定；绑定失败后早返回。
- 除 relay/provider-facing 方法外，model 方法通常向 controller 返回原始 `error`。
- Provider 方法把 request 构造、上游请求、decode 和上游错误响应包装成 `OpenAIErrorWithStatusCode`。
- Relay 层负责过滤/记录 provider error，并决定是否重试。
- 长任务或后台任务通过 `logger.SysError` 或 `logger.LogError` 记录错误，不写 HTTP response。
- 上游网络错误用 `common.ErrorWrapper` 将常见 dial/Post 失败脱敏为 `"请求上游地址失败"`，同时记录原始错误。

```go
// providers/openai/chat.go
req, errWithCode := p.GetRequestTextBody(config.RelayModeChatCompletions, request.Model, request)
if errWithCode != nil {
  return nil, errWithCode
}
defer req.Body.Close()

_, errWithCode = p.Requester.SendRequest(req, response, false)
if errWithCode != nil {
  return nil, errWithCode
}
```

```go
// common/gin.go
if strings.Contains(errString, "Post") || strings.Contains(errString, "dial") {
  logger.SysError(fmt.Sprintf("error: %s", errString))
  errString = "请求上游地址失败"
}
```

---

## API 错误响应

Dashboard/admin endpoint 的业务错误通常返回 HTTP 200，并在 body 中设置 `success: false`：

```go
// common/gin.go
func APIRespondWithError(c *gin.Context, status int, err error) {
  c.JSON(status, gin.H{
    "success": false,
    "message": err.Error(),
  })
}
```

Relay/proxy endpoint 返回 OpenAI-compatible error JSON，并 abort Gin context：

```go
// common/gin.go
func AbortWithMessage(c *gin.Context, statusCode int, message string) {
  c.JSON(statusCode, gin.H{
    "error": gin.H{
      "message": message,
      "type":    "one_hub_error",
    },
  })
  c.Abort()
  logger.LogError(c.Request.Context(), message)
}
```

正常 dashboard response 使用这个 shape：

```go
c.JSON(http.StatusOK, gin.H{
  "success": true,
  "message": "",
  "data":    result,
})
```

---

## 常见错误

- 不要用空 block 吞掉错误；要 return、wrap 或 log。
- 新错误处理不要在应用代码中使用裸 `fmt.Println`/`log.Printf`。既有旧用法是技术债，新代码使用 `common/logger`。
- Relay endpoint 不要返回 dashboard `{success, message}` 错误；relay client 期望 OpenAI-compatible error。
- 不要向用户泄露原始上游连接细节；上游请求失败使用 `common.ErrorWrapper`。
- 写入错误 response 后不要继续执行；`c.JSON`、`common.APIRespondWithError` 或 `common.AbortWithMessage` 后都要 `return`。
- 当 `errors.Is` 可用时，不要通过字符串匹配比较 GORM/sentinel error。

## 参数校验错误

可复用 body 绑定逻辑在 `common.UnmarshalBodyReusable`。它会保存 request body 供后续日志/relay 使用，并把 validator required-field 错误转换成 `"field <name> is required"`。

```go
// common/gin.go
if errs, ok := err.(validator.ValidationErrors); ok {
  return fmt.Errorf("field %s is required", errs[0].Field())
}
```
