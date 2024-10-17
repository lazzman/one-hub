package hijack

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

// formatContentWithThinking 将 thinking 内容以标签方式添加到 content 开头
// 支持 Claude thinking 和 DeepSeek reasoning_content
func formatContentWithThinking(content string, thinking string) string {
	if thinking != "" {
		return fmt.Sprintf("<thinking>%s</thinking>\n\n%s", thinking, content)
	}
	return content
}

// mergeThinkingToContent 将 result 中的 thinking 或 reasoning_content 合并到 content 字段
// 用于流式响应的最终结果处理
func mergeThinkingToContent(result map[string]interface{}) {
	var thinking string

	// 优先检查 Claude 的 thinking 字段
	if t, ok := result["thinking"].(string); ok && t != "" {
		thinking = t
		delete(result, "thinking")
	}

	// 检查 DeepSeek 的 reasoning_content 字段
	if rc, ok := result["reasoning_content"].(string); ok && rc != "" {
		thinking = rc
		delete(result, "reasoning_content")
	}

	// 如果有 thinking 内容，合并到 content 中
	if thinking != "" {
		content, _ := result["content"].(string)
		result["content"] = formatContentWithThinking(content, thinking)
	}
}

type ContextStorageInterface interface {
	Store(ctx context.Context, key string, value string)
	Load(ctx context.Context, key string) (string, bool)
	Delete(ctx context.Context, key string)
}

type ContextStorage struct {
	mu   sync.RWMutex
	data map[context.Context]map[string]string
}

func (cs *ContextStorage) Store(ctx context.Context, key string, value string) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	if _, ok := cs.data[ctx]; !ok {
		cs.data[ctx] = make(map[string]string)
	}
	cs.data[ctx][key] = value
}

func (cs *ContextStorage) Load(ctx context.Context, key string) (string, bool) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	if ctxData, ok := cs.data[ctx]; ok {
		value, ok := ctxData[key]
		return value, ok
	}
	return "", false
}

func (cs *ContextStorage) Delete(ctx context.Context, key string) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	if ctxData, ok := cs.data[ctx]; ok {
		delete(ctxData, key)
		if len(ctxData) == 0 {
			delete(cs.data, ctx)
		}
	}
}

var GlobalContextStorage ContextStorageInterface

func init() {
	GlobalContextStorage = &ContextStorage{
		data: make(map[context.Context]map[string]string),
	}
}

type ResponseType string

const (
	ResponseTypeJSON      ResponseType = "json"
	ResponseTypeStream    ResponseType = "stream"
	ResponseTypeCustom    ResponseType = "custom"
	ResponseTypeMultipart ResponseType = "multipart" // 新增
)

type ResponseData struct {
	Type    ResponseType
	Content interface{}
}

func StoreFullResponse(ctx context.Context, responseType ResponseType, content interface{}) {
	responseData := ResponseData{
		Type:    responseType,
		Content: content,
	}
	jsonData, _ := json.Marshal(responseData)
	GlobalContextStorage.Store(ctx, "full_response", string(jsonData))
}

func GetAndDeleteFullResponse(ctx context.Context) (*ResponseData, bool) {
	jsonData, ok := GlobalContextStorage.Load(ctx, "full_response")
	if ok {
		GlobalContextStorage.Delete(ctx, "full_response")
		var responseData ResponseData
		err := json.Unmarshal([]byte(jsonData), &responseData)
		if err == nil {
			return &responseData, true
		}
	}
	return nil, false
}

func StoreRequestBody(ctx context.Context, requestBody string) {
	GlobalContextStorage.Store(ctx, "request_body", requestBody)
}

func GetAndDeleteRequestBody(ctx context.Context) (string, bool) {
	requestBody, ok := GlobalContextStorage.Load(ctx, "request_body")
	if ok {
		GlobalContextStorage.Delete(ctx, "request_body")
	}
	return requestBody, ok
}

func AppendResponseToLogContent(ctx context.Context) string {
	var logContent string
	if requestBody, ok := GetAndDeleteRequestBody(ctx); ok {
		logContent = "\n【Request Body】:\n" + requestBody
	}

	if responseData, ok := GetAndDeleteFullResponse(ctx); ok {
		unifiedResponse := UnifiedResponse{
			Type: responseData.Type,
		}

		switch responseData.Type {
		case ResponseTypeJSON:
			unifiedResponse.Content = extractJSONContent(responseData.Content)
		case ResponseTypeStream:
			unifiedResponse.Content = extractFinalStreamContent(responseData.Content.(string))
		case ResponseTypeCustom:
			unifiedResponse.Content = formatCustomResponse(responseData.Content)
		case ResponseTypeMultipart:
			unifiedResponse.Content = formatMultipartResponse(responseData.Content)
		}

		jsonResponse, err := json.MarshalIndent(unifiedResponse, "", "  ")
		if err == nil {
			logContent += "\n【Response Body】:\n" + string(jsonResponse)
		} else {
			logContent += "\n【Response Body】:\nError marshaling response: " + err.Error()
		}
	}
	return logContent
}

func extractJSONContent(content interface{}) interface{} {
	jsonStr, ok := content.(string)
	if !ok {
		jsonStr = fmt.Sprintf("%v", content)
	}
	var jsonResponse map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &jsonResponse); err == nil {
		// 保存完整的响应结构，只对 thinking 内容进行处理

		// 处理 OpenAI 格式的 thinking/reasoning_content
		if choices, ok := jsonResponse["choices"].([]interface{}); ok && len(choices) > 0 {
			for i, choice := range choices {
				if choiceMap, ok := choice.(map[string]interface{}); ok {
					// 处理 message 中的 reasoning_content
					if message, ok := choiceMap["message"].(map[string]interface{}); ok {
						processThinkingInMessage(message)
						choiceMap["message"] = message
						choices[i] = choiceMap
					}
					// 处理 delta 中的 reasoning_content
					if delta, ok := choiceMap["delta"].(map[string]interface{}); ok {
						processThinkingInMessage(delta)
						choiceMap["delta"] = delta
						choices[i] = choiceMap
					}
				}
			}
			jsonResponse["choices"] = choices
		}

		// 处理 Claude 格式的 thinking content
		if contentArr, ok := jsonResponse["content"].([]interface{}); ok && len(contentArr) > 0 {
			processClaudeThinkingContent(jsonResponse, contentArr)
		}

		return jsonResponse
	}
	return jsonStr
}

// processThinkingInMessage 处理 OpenAI 格式消息中的 reasoning_content
func processThinkingInMessage(message map[string]interface{}) {
	var thinking string

	// 检查 reasoning_content 字段 (DeepSeek 格式)
	if rc, ok := message["reasoning_content"].(string); ok && rc != "" {
		thinking = rc
		delete(message, "reasoning_content")
	}

	// 如果有 thinking 内容，合并到 content 中
	if thinking != "" {
		content, _ := message["content"].(string)
		message["content"] = formatContentWithThinking(content, thinking)
	}
}

// processClaudeThinkingContent 处理 Claude 格式响应中的 thinking content
func processClaudeThinkingContent(jsonResponse map[string]interface{}, contentArr []interface{}) {
	var thinkingContent string
	var newContentArr []interface{}

	for _, item := range contentArr {
		if contentItem, ok := item.(map[string]interface{}); ok {
			contentType, _ := contentItem["type"].(string)
			if contentType == "thinking" {
				// 提取 thinking 内容
				if thinking, ok := contentItem["thinking"].(string); ok {
					thinkingContent += thinking
				}
				// 不将 thinking block 添加到新数组中
				continue
			}
			// 如果是 text 类型且有 thinking 内容，将 thinking 合并到 text 中
			if contentType == "text" && thinkingContent != "" {
				if text, ok := contentItem["text"].(string); ok {
					contentItem["text"] = formatContentWithThinking(text, thinkingContent)
					thinkingContent = "" // 清空，避免重复添加
				}
			}
		}
		newContentArr = append(newContentArr, item)
	}

	// 如果还有未处理的 thinking 内容（没有 text block 的情况），添加一个新的 text block
	if thinkingContent != "" {
		newTextBlock := map[string]interface{}{
			"type": "text",
			"text": formatContentWithThinking("", thinkingContent),
		}
		newContentArr = append([]interface{}{newTextBlock}, newContentArr...)
	}

	jsonResponse["content"] = newContentArr
}

func extractFinalStreamContent(response string) interface{} {
	// 完整响应结构，保存所有上游返回的字段
	fullResponse := make(map[string]interface{})
	// 用于合并流式内容的临时结构
	mergedContent := make(map[string]interface{})
	var toolCalls []map[string]interface{}
	var detectedFormat string // "openai", "claude", "gemini"

	lines := strings.Split(response, "\n")
	for _, line := range lines {
		jsonResponse := parseStreamLine(line)
		if jsonResponse == nil {
			continue
		}

		// Try OpenAI format first
		if processOpenAIStreamFormat(jsonResponse, fullResponse, mergedContent, &toolCalls) {
			detectedFormat = "openai"
			continue
		}

		// Try Claude format
		if processClaudeStreamFormat(jsonResponse, fullResponse, mergedContent, &toolCalls) {
			detectedFormat = "claude"
			continue
		}

		// Try Gemini format
		if processGeminiStreamFormat(jsonResponse, fullResponse, mergedContent) {
			detectedFormat = "gemini"
			continue
		}
	}

	// 将 thinking 或 reasoning_content 以标签方式合并到 content 中
	mergeThinkingToContent(mergedContent)

	// 根据检测到的格式构建最终响应
	return buildFinalStreamResponse(detectedFormat, fullResponse, mergedContent, toolCalls)
}

// processOpenAIStreamFormat 处理 OpenAI 流式响应格式，提取完整响应结构
func processOpenAIStreamFormat(jsonResponse map[string]interface{}, fullResponse map[string]interface{}, mergedContent map[string]interface{}, toolCalls *[]map[string]interface{}) bool {
	// 提取顶层字段（id, model, created, system_fingerprint 等）
	extractTopLevelFields(jsonResponse, fullResponse, []string{"id", "object", "created", "model", "system_fingerprint", "service_tier"})

	// 提取 usage 信息（通常在最后一个 chunk 中）
	// 必须在 choices 检查之前处理，因为 usage-only chunk 的 choices 可能为空
	hasUsage := false
	if usage, ok := jsonResponse["usage"].(map[string]interface{}); ok {
		fullResponse["usage"] = usage
		hasUsage = true
	}

	choices, ok := jsonResponse["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		// 如果有 usage 信息，说明这是一个 usage-only chunk，应该返回 true
		return hasUsage
	}

	choice, ok := choices[0].(map[string]interface{})
	if !ok {
		return false
	}

	// 提取 finish_reason
	if finishReason, ok := choice["finish_reason"].(string); ok && finishReason != "" {
		mergedContent["finish_reason"] = finishReason
	}

	// 提取 index
	if index, ok := choice["index"].(float64); ok {
		mergedContent["index"] = int(index)
	}

	delta, ok := choice["delta"].(map[string]interface{})
	if !ok {
		return false
	}

	processDeltaContent(delta, mergedContent, toolCalls)
	return true
}

// processClaudeStreamFormat 处理 Claude 流式响应格式，提取完整响应结构
func processClaudeStreamFormat(jsonResponse map[string]interface{}, fullResponse map[string]interface{}, mergedContent map[string]interface{}, toolCalls *[]map[string]interface{}) bool {
	eventType, ok := jsonResponse["type"].(string)
	if !ok {
		return false
	}

	switch eventType {
	case "message_start":
		// 提取完整的 message 结构
		if message, ok := jsonResponse["message"].(map[string]interface{}); ok {
			// 提取顶层字段
			extractTopLevelFields(message, fullResponse, []string{"id", "type", "role", "model", "stop_reason", "stop_sequence"})
			if role, ok := message["role"].(string); ok {
				mergedContent["role"] = role
			}
			// 提取 usage
			if usage, ok := message["usage"].(map[string]interface{}); ok {
				fullResponse["usage"] = usage
			}
		}
		return true

	case "content_block_delta":
		if delta, ok := jsonResponse["delta"].(map[string]interface{}); ok {
			deltaType, _ := delta["type"].(string)
			switch deltaType {
			case "text_delta":
				if text, ok := delta["text"].(string); ok {
					existingContent, _ := mergedContent["content"].(string)
					mergedContent["content"] = existingContent + text
				}
			case "thinking_delta":
				if thinking, ok := delta["thinking"].(string); ok {
					existingThinking, _ := mergedContent["thinking"].(string)
					mergedContent["thinking"] = existingThinking + thinking
				}
			case "input_json_delta":
				if partialJson, ok := delta["partial_json"].(string); ok {
					if len(*toolCalls) > 0 {
						lastToolCall := (*toolCalls)[len(*toolCalls)-1]
						existingArgs, _ := lastToolCall["arguments"].(string)
						lastToolCall["arguments"] = existingArgs + partialJson
					}
				}
			}
		}
		return true

	case "content_block_start":
		if contentBlock, ok := jsonResponse["content_block"].(map[string]interface{}); ok {
			blockType, _ := contentBlock["type"].(string)
			if blockType == "tool_use" {
				toolCall := make(map[string]interface{})
				if id, ok := contentBlock["id"].(string); ok {
					toolCall["id"] = id
				}
				if name, ok := contentBlock["name"].(string); ok {
					toolCall["name"] = name
				}
				toolCall["arguments"] = ""
				*toolCalls = append(*toolCalls, toolCall)
			}
		}
		return true

	case "message_delta":
		if delta, ok := jsonResponse["delta"].(map[string]interface{}); ok {
			if stopReason, ok := delta["stop_reason"].(string); ok {
				fullResponse["stop_reason"] = stopReason
				mergedContent["stop_reason"] = stopReason
			}
		}
		// 提取最终 usage
		if usage, ok := jsonResponse["usage"].(map[string]interface{}); ok {
			// 合并 usage 信息
			if existingUsage, ok := fullResponse["usage"].(map[string]interface{}); ok {
				for k, v := range usage {
					existingUsage[k] = v
				}
			} else {
				fullResponse["usage"] = usage
			}
		}
		return true
	}

	return false
}

// processGeminiStreamFormat 处理 Gemini 流式响应格式，提取完整响应结构
func processGeminiStreamFormat(jsonResponse map[string]interface{}, fullResponse map[string]interface{}, mergedContent map[string]interface{}) bool {
	candidates, ok := jsonResponse["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return false
	}

	// 提取 Gemini 特有的顶层字段
	extractTopLevelFields(jsonResponse, fullResponse, []string{"modelVersion"})

	// 提取 usageMetadata
	if usageMetadata, ok := jsonResponse["usageMetadata"].(map[string]interface{}); ok {
		fullResponse["usageMetadata"] = usageMetadata
	}

	candidate, ok := candidates[0].(map[string]interface{})
	if !ok {
		return false
	}

	// 提取 finishReason
	if finishReason, ok := candidate["finishReason"].(string); ok && finishReason != "" {
		mergedContent["finish_reason"] = finishReason
	}

	// 提取 index
	if index, ok := candidate["index"].(float64); ok {
		mergedContent["index"] = int(index)
	}

	// 提取 safetyRatings
	if safetyRatings, ok := candidate["safetyRatings"].([]interface{}); ok {
		fullResponse["safetyRatings"] = safetyRatings
	}

	content, ok := candidate["content"].(map[string]interface{})
	if !ok {
		return false
	}

	processGeminiContent(content, mergedContent)
	return true
}

// extractTopLevelFields 从源 map 提取指定字段到目标 map
func extractTopLevelFields(source map[string]interface{}, target map[string]interface{}, fields []string) {
	for _, field := range fields {
		if value, ok := source[field]; ok && value != nil {
			target[field] = value
		}
	}
}

// buildFinalStreamResponse 根据检测到的格式构建最终的完整响应
func buildFinalStreamResponse(format string, fullResponse map[string]interface{}, mergedContent map[string]interface{}, toolCalls []map[string]interface{}) interface{} {
	switch format {
	case "openai":
		return buildOpenAIResponse(fullResponse, mergedContent, toolCalls)
	case "claude":
		return buildClaudeResponse(fullResponse, mergedContent, toolCalls)
	case "gemini":
		return buildGeminiResponse(fullResponse, mergedContent)
	default:
		// 如果无法识别格式，返回合并后的内容
		if len(toolCalls) > 0 {
			mergedContent["tool_calls"] = toolCalls
		}
		return mergedContent
	}
}

// buildOpenAIResponse 构建 OpenAI 格式的完整响应
func buildOpenAIResponse(fullResponse map[string]interface{}, mergedContent map[string]interface{}, toolCalls []map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// 复制顶层字段
	for k, v := range fullResponse {
		result[k] = v
	}

	// 构建 message 对象
	message := make(map[string]interface{})
	if role, ok := mergedContent["role"].(string); ok {
		message["role"] = role
	} else {
		message["role"] = "assistant"
	}
	if content, ok := mergedContent["content"].(string); ok {
		message["content"] = content
	}
	if refusal, ok := mergedContent["refusal"]; ok {
		message["refusal"] = refusal
	}
	if len(toolCalls) > 0 {
		message["tool_calls"] = toolCalls
	}

	// 构建 choice 对象
	choice := map[string]interface{}{
		"message": message,
	}
	if index, ok := mergedContent["index"].(int); ok {
		choice["index"] = index
	} else {
		choice["index"] = 0
	}
	if finishReason, ok := mergedContent["finish_reason"].(string); ok {
		choice["finish_reason"] = finishReason
	}
	if logprobs, ok := mergedContent["logprobs"]; ok {
		choice["logprobs"] = logprobs
	}

	result["choices"] = []interface{}{choice}

	// 设置默认的 object 类型
	if _, ok := result["object"]; !ok {
		result["object"] = "chat.completion"
	}

	return result
}

// buildClaudeResponse 构建 Claude 格式的完整响应
func buildClaudeResponse(fullResponse map[string]interface{}, mergedContent map[string]interface{}, toolCalls []map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// 复制顶层字段
	for k, v := range fullResponse {
		result[k] = v
	}

	// 构建 content 数组
	var contentArr []interface{}

	// 添加文本内容
	if content, ok := mergedContent["content"].(string); ok && content != "" {
		contentArr = append(contentArr, map[string]interface{}{
			"type": "text",
			"text": content,
		})
	}

	// 添加 tool_use 内容
	for _, toolCall := range toolCalls {
		toolUse := map[string]interface{}{
			"type": "tool_use",
		}
		if id, ok := toolCall["id"].(string); ok {
			toolUse["id"] = id
		}
		if name, ok := toolCall["name"].(string); ok {
			toolUse["name"] = name
		}
		if args, ok := toolCall["arguments"].(string); ok {
			var input interface{}
			if err := json.Unmarshal([]byte(args), &input); err == nil {
				toolUse["input"] = input
			} else {
				toolUse["input"] = args
			}
		}
		contentArr = append(contentArr, toolUse)
	}

	result["content"] = contentArr

	// 设置默认的 type
	if _, ok := result["type"]; !ok {
		result["type"] = "message"
	}

	// 设置 role
	if role, ok := mergedContent["role"].(string); ok {
		result["role"] = role
	} else {
		result["role"] = "assistant"
	}

	return result
}

// buildGeminiResponse 构建 Gemini 格式的完整响应
func buildGeminiResponse(fullResponse map[string]interface{}, mergedContent map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	// 复制顶层字段
	for k, v := range fullResponse {
		result[k] = v
	}

	// 构建 content 对象
	content := make(map[string]interface{})
	if role, ok := mergedContent["role"].(string); ok {
		content["role"] = role
	} else {
		content["role"] = "model"
	}

	// 构建 parts 数组
	var parts []interface{}
	if text, ok := mergedContent["content"].(string); ok && text != "" {
		parts = append(parts, map[string]interface{}{
			"text": text,
		})
	}
	content["parts"] = parts

	// 构建 candidate 对象
	candidate := map[string]interface{}{
		"content": content,
	}
	if index, ok := mergedContent["index"].(int); ok {
		candidate["index"] = index
	} else {
		candidate["index"] = 0
	}
	if finishReason, ok := mergedContent["finish_reason"].(string); ok {
		candidate["finishReason"] = finishReason
	}
	if safetyRatings, ok := fullResponse["safetyRatings"]; ok {
		candidate["safetyRatings"] = safetyRatings
		delete(result, "safetyRatings") // 移动到 candidate 中
	}

	result["candidates"] = []interface{}{candidate}

	return result
}

// parseStreamLine extracts and parses JSON from a stream line
func parseStreamLine(line string) map[string]interface{} {
	line = strings.TrimSpace(line)

	// Skip empty lines
	if line == "" {
		return nil
	}

	// Handle data: prefix (common in SSE streams)
	jsonStr := line
	if strings.HasPrefix(line, "data: ") {
		jsonStr = strings.TrimPrefix(line, "data: ")
	}

	// Skip [DONE] markers
	if jsonStr == "[DONE]" {
		return nil
	}

	var jsonResponse map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &jsonResponse); err != nil {
		return nil
	}

	return jsonResponse
}

// processDeltaContent processes delta content from OpenAI format
func processDeltaContent(delta map[string]interface{}, result map[string]interface{}, toolCalls *[]map[string]interface{}) {
	for key, value := range delta {
		switch key {
		case "tool_calls":
			processToolCalls(value, toolCalls)
		case "content", "reasoning_content":
			processContentField(key, value, result)
		default:
			result[key] = value
		}
	}
}

// processToolCalls handles tool calls processing
func processToolCalls(value interface{}, toolCalls *[]map[string]interface{}) {
	newToolCalls, ok := value.([]interface{})
	if !ok {
		return
	}

	for _, newToolCall := range newToolCalls {
		toolCall, ok := newToolCall.(map[string]interface{})
		if !ok {
			continue
		}

		index, _ := toolCall["index"].(float64)
		// Ensure toolCalls slice is large enough
		for len(*toolCalls) <= int(index) {
			*toolCalls = append(*toolCalls, make(map[string]interface{}))
		}
		mergeToolCall((*toolCalls)[int(index)], toolCall)
	}
}

// processContentField handles content and reasoning_content fields
func processContentField(key string, value interface{}, result map[string]interface{}) {
	content, ok := value.(string)
	if !ok {
		return
	}

	existingContent, _ := result[key].(string)
	result[key] = existingContent + content
}

// processGeminiContent processes Gemini content structure
func processGeminiContent(content map[string]interface{}, result map[string]interface{}) {
	// Handle role if present
	if role, ok := content["role"].(string); ok {
		result["role"] = role
	}

	// Handle parts array
	parts, ok := content["parts"].([]interface{})
	if !ok {
		return
	}

	for _, part := range parts {
		partMap, ok := part.(map[string]interface{})
		if !ok {
			continue
		}

		text, ok := partMap["text"].(string)
		if !ok {
			continue
		}

		existingContent, _ := result["content"].(string)
		result["content"] = existingContent + text
	}
}

func mergeToolCall(existing, new map[string]interface{}) {
	for key, value := range new {
		if key == "function" {
			if existingFunc, ok := existing["function"].(map[string]interface{}); ok {
				if newFunc, ok := value.(map[string]interface{}); ok {
					for funcKey, funcValue := range newFunc {
						if funcKey == "arguments" {
							// arguments: 继续拼接
							existingArgs, _ := existingFunc["arguments"].(string)
							newArgs, _ := funcValue.(string)
							existingFunc["arguments"] = existingArgs + newArgs
						} else {
							// 其他字段（如 name）: 仅当新值为非空字符串时才覆盖
							if strValue, ok := funcValue.(string); ok {
								if strValue != "" {
									existingFunc[funcKey] = funcValue
								}
								// 如果新值为空字符串，跳过（保留已有值）
							} else {
								// 非字符串类型，直接覆盖
								existingFunc[funcKey] = funcValue
							}
						}
					}
				}
			} else {
				existing["function"] = value
			}
		} else {
			// 顶层字段（如 id, type）: 仅当新值为非空字符串时才覆盖
			if strValue, ok := value.(string); ok {
				if strValue != "" {
					existing[key] = value
				}
				// 如果新值为空字符串，跳过（保留已有值）
			} else {
				// 非字符串类型，直接覆盖
				existing[key] = value
			}
		}
	}
}

func formatCustomResponse(response interface{}) interface{} {
	switch v := response.(type) {
	case string:
		return v
	case []byte:
		return base64.StdEncoding.EncodeToString(v)
	default:
		return v
	}
}

func formatMultipartResponse(response interface{}) interface{} {
	switch v := response.(type) {
	case []byte:
		return base64.StdEncoding.EncodeToString(v)
	default:
		return v
	}
}

type UnifiedResponse struct {
	Type    ResponseType `json:"type"`
	Content interface{}  `json:"content"`
}
