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

func parsePreviewPayloadFromLog(t *testing.T, logContent string) LogPreviewPayload {
	t.Helper()

	var payload LogPreviewPayload
	if err := json.Unmarshal([]byte(logContent), &payload); err != nil {
		t.Fatalf("failed to unmarshal preview payload: %v\ncontent=%s", err, logContent)
	}
	return payload
}

func TestAppendResponseToLogContent_StoresRawStreamBody(t *testing.T) {
	ctx := newTestContext(t)
	rawRequest := `{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hello"}]}`
	rawStream := "data: {\"id\":\"chatcmpl-1\",\"choices\":[{\"delta\":{\"role\":\"assistant\"}}]}\n\n" +
		"data: {\"id\":\"chatcmpl-1\",\"choices\":[{\"delta\":{\"content\":\"hello\"}}]}\n\n" +
		"data: [DONE]\n\n"

	StoreRequestBody(ctx, rawRequest)
	StoreFullResponse(ctx, ResponseTypeStream, rawStream)
	StoreLogPreviewSource(ctx, LogPreviewSource{
		ChannelType:  20,
		ChannelName:  "OpenRouter",
		EndpointPath: "/v1/chat/completions",
		IsStream:     true,
	})

	logContent := AppendResponseToLogContent(ctx)
	payload := parsePreviewPayloadFromLog(t, logContent)

	if payload.Version != 1 {
		t.Fatalf("unexpected payload version: %d", payload.Version)
	}
	if payload.Source.ProtocolHint != "openai-chat" {
		t.Fatalf("unexpected protocol hint: %s", payload.Source.ProtocolHint)
	}
	if payload.Source.Provider != "openrouter" {
		t.Fatalf("unexpected provider: %s", payload.Source.Provider)
	}
	if payload.Request.Raw != rawRequest {
		t.Fatalf("request body should be stored as raw text")
	}
	if payload.Response.Type != ResponseTypeStream {
		t.Fatalf("unexpected response type: %s", payload.Response.Type)
	}
	if payload.Response.Raw != rawStream {
		t.Fatalf("stream response should keep raw SSE text, expected %q, got %q", rawStream, payload.Response.Raw)
	}
}

func TestAppendResponseToLogContent_StoresRawJSONWithoutTransform(t *testing.T) {
	ctx := newTestContext(t)
	rawJSON := `{"choices":[{"message":{"content":"answer","reasoning_content":"raw-reasoning"}}]}`

	StoreFullResponse(ctx, ResponseTypeJSON, rawJSON)
	StoreLogPreviewSource(ctx, LogPreviewSource{
		ChannelType:  1,
		ChannelName:  "OpenAI",
		EndpointPath: "/v1/chat/completions",
		IsStream:     false,
	})
	logContent := AppendResponseToLogContent(ctx)
	payload := parsePreviewPayloadFromLog(t, logContent)

	if payload.Response.Type != ResponseTypeJSON {
		t.Fatalf("unexpected response type: %s", payload.Response.Type)
	}
	if payload.Response.Raw != rawJSON {
		t.Fatalf("json response should keep raw body without conversion, expected %q, got %q", rawJSON, payload.Response.Raw)
	}
	if payload.Source.ProtocolHint != "openai-chat" {
		t.Fatalf("unexpected protocol hint: %s", payload.Source.ProtocolHint)
	}
}

func TestAppendResponseToLogContent_StoresCompleteRequestAndResponse(t *testing.T) {
	ctx := newTestContext(t)
	requestBody := strings.Repeat("a", maxRequestBodyLogBytes+5)
	responseBody := strings.Repeat("b", maxResponseBodyLogBytes+7)

	StoreRequestBody(ctx, requestBody)
	StoreFullResponse(ctx, ResponseTypeJSON, responseBody)
	StoreLogPreviewSource(ctx, LogPreviewSource{
		EndpointPath: "/v1/responses",
		IsStream:     false,
	})

	logContent := AppendResponseToLogContent(ctx)
	payload := parsePreviewPayloadFromLog(t, logContent)

	if payload.Request.Raw != requestBody {
		t.Fatalf("request body should be stored completely without truncation")
	}
	if strings.Contains(logContent, "[TRUNCATED") {
		t.Fatalf("log content should not contain truncation marker")
	}
	if payload.Response.Raw != responseBody {
		t.Fatalf("response body should be stored completely, expected length=%d, got length=%d", len(responseBody), len(payload.Response.Raw))
	}
	if payload.Source.ProtocolHint != "responses" {
		t.Fatalf("unexpected protocol hint: %s", payload.Source.ProtocolHint)
	}
}
