package hijack

import (
	"context"
	"encoding/json"
	"fmt"
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

const (
	maxRequestBodyLogBytes  = 256 * 1024
	maxResponseBodyLogBytes = 512 * 1024
)

func AppendResponseToLogContent(ctx context.Context) string {
	var logContent string
	if requestBody, ok := GetAndDeleteRequestBody(ctx); ok {
		logContent = "\n【Request Body】:\n" + requestBody
	}

	if responseData, ok := GetAndDeleteFullResponse(ctx); ok {
		unifiedResponse := UnifiedResponse{
			Type:    responseData.Type,
			Content: rawResponseContentToString(responseData.Content),
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

func rawResponseContentToString(content interface{}) string {
	switch v := content.(type) {
	case string:
		return v
	case []byte:
		return string(v)
	default:
		jsonData, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(jsonData)
	}
}

func truncateLogBody(raw string, maxBytes int) string {
	if maxBytes <= 0 || len(raw) <= maxBytes {
		return raw
	}
	omitted := len(raw) - maxBytes
	return raw[:maxBytes] + fmt.Sprintf("\n...[TRUNCATED %d BYTES]...", omitted)
}

type UnifiedResponse struct {
	Type    ResponseType `json:"type"`
	Content interface{}  `json:"content"`
}
