package relay_util

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
)

// ContextStorageInterface 定义接口
type ContextStorageInterface interface {
	Store(ctx context.Context, key string, value string)
	Load(ctx context.Context, key string) (string, bool)
	Delete(ctx context.Context, key string)
}

// ContextStorage 结构体及其方法
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

// GlobalContextStorage 声明
var GlobalContextStorage ContextStorageInterface

// 初始化函数
func init() {
	GlobalContextStorage = &ContextStorage{
		data: make(map[context.Context]map[string]string),
	}
}

// ResponseType 用于标识不同类型的响应
type ResponseType string

const (
	ResponseTypeJSON      ResponseType = "json"
	ResponseTypeStream    ResponseType = "stream"
	ResponseTypeCustom    ResponseType = "custom"
	ResponseTypeMultipart ResponseType = "multipart" // 新增
)

// ResponseData 结构体用于存储响应数据和类型
type ResponseData struct {
	Type    ResponseType
	Content interface{}
}

// StoreFullResponse 用于存储完整响应的辅助函数
func StoreFullResponse(ctx context.Context, responseType ResponseType, content interface{}) {
	responseData := ResponseData{
		Type:    responseType,
		Content: content,
	}
	jsonData, _ := json.Marshal(responseData)
	GlobalContextStorage.Store(ctx, "full_response", string(jsonData))
}

// GetAndDeleteFullResponse 用于获取完整响应的辅助函数
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

// StoreRequestBody 用于存储请求体
func StoreRequestBody(ctx context.Context, requestBody string) {
	GlobalContextStorage.Store(ctx, "request_body", requestBody)
}

// GetAndDeleteRequestBody 用于获取并删除存储的请求体
func GetAndDeleteRequestBody(ctx context.Context) (string, bool) {
	requestBody, ok := GlobalContextStorage.Load(ctx, "request_body")
	if ok {
		GlobalContextStorage.Delete(ctx, "request_body")
	}
	return requestBody, ok
}

// AppendResponseToLogContent 用于在日志中添加请求体和响应内容的辅助函数
func AppendResponseToLogContent(ctx context.Context, logContent string) string {
	if requestBody, ok := GetAndDeleteRequestBody(ctx); ok {
		logContent += "\n【Request Body】:\n" + requestBody
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
			unifiedResponse.Content = formatMultipartResponse(responseData.Content.(*http.Response))
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
				if delta, ok := choice["delta"].(map[string]interface{}); ok {
					// 直接返回整个 delta 对象
					return delta
				} else if message, ok := choice["message"].(map[string]interface{}); ok {
					// 直接返回整个 message 对象
					return message
				}
			}
		}
	}
	return jsonStr
}

func extractFinalStreamContent(response string) interface{} {
	result := make(map[string]interface{})
	var toolCalls []map[string]interface{}

	jsonObjects := strings.Split(response, "}{")

	for i, jsonStr := range jsonObjects {
		if i > 0 {
			jsonStr = "{" + jsonStr
		}
		if i < len(jsonObjects)-1 {
			jsonStr += "}"
		}

		var jsonResponse map[string]interface{}
		if err := json.Unmarshal([]byte(jsonStr), &jsonResponse); err == nil {
			if choices, ok := jsonResponse["choices"].([]interface{}); ok && len(choices) > 0 {
				if choice, ok := choices[0].(map[string]interface{}); ok {
					if delta, ok := choice["delta"].(map[string]interface{}); ok {
						for key, value := range delta {
							if key == "tool_calls" {
								if newToolCalls, ok := value.([]interface{}); ok {
									for _, newToolCall := range newToolCalls {
										if toolCall, ok := newToolCall.(map[string]interface{}); ok {
											index, _ := toolCall["index"].(float64)
											for len(toolCalls) <= int(index) {
												toolCalls = append(toolCalls, make(map[string]interface{}))
											}
											mergeToolCall(toolCalls[int(index)], toolCall)
										}
									}
								}
							} else if key == "content" {
								if content, ok := value.(string); ok {
									existingContent, _ := result[key].(string)
									result[key] = existingContent + content
								}
							} else {
								result[key] = value
							}
						}
					}
				}
			}
		}
	}

	if len(toolCalls) > 0 {
		result["tool_calls"] = toolCalls
	}

	return result
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
		return string(v)
	default:
		return v
	}
}

func formatMultipartResponse(resp *http.Response) map[string]interface{} {
	body, _ := io.ReadAll(resp.Body)
	return map[string]interface{}{
		"Status":  resp.Status,
		"Headers": resp.Header,
		"Body":    string(body),
	}
}

// StoreMultipartResponse 用于存储多部分响应
func StoreMultipartResponse(ctx context.Context, resp *http.Response, bodyBytes []byte) {
	responseCopy := &http.Response{
		Status:     resp.Status,
		StatusCode: resp.StatusCode,
		Header:     resp.Header.Clone(),
		Body:       io.NopCloser(bytes.NewBuffer(bodyBytes)),
	}
	StoreFullResponse(ctx, ResponseTypeMultipart, responseCopy)
}

// UnifiedResponse 结构体用于统一不同类型的响应格式
type UnifiedResponse struct {
	Type    ResponseType `json:"type"`
	Content interface{}  `json:"content"`
}
