package hijack

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

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

func StoreRequestClientIP(ctx context.Context, clientIP string) {
	//var clientIP string
	//
	//// 1. 首先尝试从 X-Real-IP 获取
	//clientIP = ginCtx.GetHeader("X-Real-IP")
	//
	//// 2. 如果 X-Real-IP 为空，则尝试从 X-Forwarded-For 获取第一个 IP
	//if clientIP == "" {
	//	forwardedFor := ginCtx.GetHeader("X-Forwarded-For")
	//	if forwardedFor != "" {
	//		// X-Forwarded-For 可能包含多个 IP，以逗号分隔，取第一个
	//		ips := strings.Split(forwardedFor, ",")
	//		clientIP = strings.TrimSpace(ips[0])
	//	}
	//}
	//
	//// 3. 如果前两种方法都没有获取到 IP，则使用 gin 的 ClientIP 方法
	//if clientIP == "" {
	//	clientIP = ginCtx.ClientIP()
	//}

	GlobalContextStorage.Store(ctx, "client_ip", clientIP)
}

func GetAndDeleteRequestClientIP(ctx context.Context) (string, bool) {
	remoteAddr, ok := GlobalContextStorage.Load(ctx, "client_ip")
	if ok {
		GlobalContextStorage.Delete(ctx, "client_ip")
	}
	return remoteAddr, ok
}

func AppendResponseToLogContent(ctx context.Context, logContent string) string {
	if requestBody, ok := GetAndDeleteRequestBody(ctx); ok {
		clientIP, ipOk := GetAndDeleteRequestClientIP(ctx)
		if ipOk {
			logContent = logContent + " | " + clientIP + "\n【Request Body】:\n" + requestBody
		} else {
			logContent = logContent + "\n【Request Body】:\n" + requestBody
		}
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
		if choices, ok := jsonResponse["choices"].([]interface{}); ok && len(choices) > 0 {
			if choice, ok := choices[0].(map[string]interface{}); ok {
				if message, ok := choice["message"].(map[string]interface{}); ok {
					// 直接返回整个 message 对象
					return message
				} else if delta, ok := choice["delta"].(map[string]interface{}); ok {
					// 直接返回整个 delta 对象
					return delta
				}
			}
		}
	}
	return jsonStr
}

func extractFinalStreamContent(response string) interface{} {
	result := make(map[string]interface{})
	var toolCalls []map[string]interface{}

	lines := strings.Split(response, "\n")
	for _, line := range lines {
		jsonResponse := parseStreamLine(line)
		if jsonResponse == nil {
			continue
		}

		// Try OpenAI format first
		if processOpenAIFormat(jsonResponse, result, &toolCalls) {
			continue
		}

		// Try Gemini format
		processGeminiFormat(jsonResponse, result)
	}

	if len(toolCalls) > 0 {
		result["tool_calls"] = toolCalls
	}

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

// processOpenAIFormat handles OpenAI response format and returns true if processed
func processOpenAIFormat(jsonResponse map[string]interface{}, result map[string]interface{}, toolCalls *[]map[string]interface{}) bool {
	choices, ok := jsonResponse["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		return false
	}

	choice, ok := choices[0].(map[string]interface{})
	if !ok {
		return false
	}

	delta, ok := choice["delta"].(map[string]interface{})
	if !ok {
		return false
	}

	processDeltaContent(delta, result, toolCalls)
	return true
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

// processGeminiFormat handles Gemini response format
func processGeminiFormat(jsonResponse map[string]interface{}, result map[string]interface{}) {
	candidates, ok := jsonResponse["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return
	}

	candidate, ok := candidates[0].(map[string]interface{})
	if !ok {
		return
	}

	content, ok := candidate["content"].(map[string]interface{})
	if !ok {
		return
	}

	processGeminiContent(content, result)
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
							existingArgs, _ := existingFunc["arguments"].(string)
							newArgs, _ := funcValue.(string)
							existingFunc["arguments"] = existingArgs + newArgs
						} else {
							existingFunc[funcKey] = funcValue
						}
					}
				}
			} else {
				existing["function"] = value
			}
		} else {
			existing[key] = value
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
