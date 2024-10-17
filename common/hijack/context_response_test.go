package hijack

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type testContextKey struct{}

func newTestContext(t *testing.T) context.Context {
	t.Helper()
	return context.WithValue(context.Background(), testContextKey{}, t.Name())
}

func parseUnifiedResponseFromLog(t *testing.T, logContent string) UnifiedResponse {
	t.Helper()
	parts := strings.Split(logContent, "\n【Response Body】:\n")
	if len(parts) != 2 {
		t.Fatalf("unexpected log format, missing response body section: %s", logContent)
	}

	var response UnifiedResponse
	if err := json.Unmarshal([]byte(parts[1]), &response); err != nil {
		t.Fatalf("failed to unmarshal response body: %v", err)
	}
	return response
}

func TestAppendResponseToLogContent_StoresRawStreamBody(t *testing.T) {
	ctx := newTestContext(t)
	rawRequest := `{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}]}`
	rawStream := "data: {\"id\":\"chatcmpl-1\",\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\n\n" +
		"data: {\"id\":\"chatcmpl-1\",\"choices\":[{\"delta\":{\"content\":\"hello\"}}]}\n\n" +
		"data: [DONE]\n\n"

	StoreRequestBody(ctx, rawRequest)
	StoreFullResponse(ctx, ResponseTypeStream, rawStream)

	logContent := AppendResponseToLogContent(ctx)
	if !strings.Contains(logContent, rawRequest) {
		t.Fatalf("request body should be stored as raw text")
	}

	response := parseUnifiedResponseFromLog(t, logContent)
	if response.Type != ResponseTypeStream {
		t.Fatalf("unexpected response type: %s", response.Type)
	}

	content, ok := response.Content.(string)
	if !ok {
		t.Fatalf("stream response content should be raw string, got %T", response.Content)
	}
	if content != rawStream {
		t.Fatalf("stream response should keep raw SSE text, expected %q, got %q", rawStream, content)
	}
}

func TestAppendResponseToLogContent_StoresRawJSONWithoutTransform(t *testing.T) {
	ctx := newTestContext(t)
	rawJSON := `{"choices":[{"message":{"content":"answer","reasoning_content":"raw-reasoning"}}]}`

	StoreFullResponse(ctx, ResponseTypeJSON, rawJSON)
	logContent := AppendResponseToLogContent(ctx)

	response := parseUnifiedResponseFromLog(t, logContent)
	if response.Type != ResponseTypeJSON {
		t.Fatalf("unexpected response type: %s", response.Type)
	}

	content, ok := response.Content.(string)
	if !ok {
		t.Fatalf("json response content should be raw string, got %T", response.Content)
	}
	if content != rawJSON {
		t.Fatalf("json response should keep raw body without conversion, expected %q, got %q", rawJSON, content)
	}
}

func TestAppendResponseToLogContent_StoresCompleteRequestAndResponse(t *testing.T) {
	ctx := newTestContext(t)
	requestBody := strings.Repeat("a", maxRequestBodyLogBytes+5)
	responseBody := strings.Repeat("b", maxResponseBodyLogBytes+7)

	StoreRequestBody(ctx, requestBody)
	StoreFullResponse(ctx, ResponseTypeJSON, responseBody)

	logContent := AppendResponseToLogContent(ctx)
	if !strings.Contains(logContent, requestBody) {
		t.Fatalf("request body should be stored completely without truncation")
	}
	if strings.Contains(logContent, "[TRUNCATED") {
		t.Fatalf("log content should not contain truncation marker")
	}

	response := parseUnifiedResponseFromLog(t, logContent)
	content, ok := response.Content.(string)
	if !ok {
		t.Fatalf("json response content should be raw string, got %T", response.Content)
	}
	if content != responseBody {
		t.Fatalf("response body should be stored completely, expected length=%d, got length=%d", len(responseBody), len(content))
	}
}
