package openai

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"one-api/common/config"
	"one-api/common/requester"
	test "one-api/common/test"
	_ "one-api/common/test/init"
	"one-api/model"
	providersBase "one-api/providers/base"
	"one-api/types"

	"github.com/stretchr/testify/assert"
	"gorm.io/datatypes"
)

func setupOpenAITestServer() (string, *test.ServerTest, func()) {
	server := test.NewTestServer()
	ts := server.TestServer(test.OpenAICheck)
	ts.Start()
	return ts.URL, server, ts.Close
}

func strPtr(value string) *string {
	return &value
}

func TestResponsesCustomParams_SendPhaseUsesMappedModel(t *testing.T) {
	requester.InitHttpClient()

	url, server, teardown := setupOpenAITestServer()
	defer teardown()

	var capturedBody string
	server.RegisterHandler("/v1/responses", func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		capturedBody = string(bodyBytes)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"resp_123","model":"gpt-5.4-mini","object":"response","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`))
	})

	body := `{"model":"gpt-5.4-mini-high","input":"hi"}`
	c, _ := test.GetContext("POST", "/v1/responses", test.RequestJSONConfig(), strings.NewReader(body))
	c.Set(config.GinRequestBodyKey, []byte(body))

	customParameter := `{
		"per_model": true,
		"pre_add": false,
		"overwrite": true,
		"gpt-5.4-mini-high": {"service_tier": "priority"},
		"gpt-5.4-mini": {"service_tier": "flex", "reasoning": {"effort": "high", "summary": "auto"}}
	}`
	mapping := `{"gpt-5.4-mini-high":"gpt-5.4-mini"}`
	proxy := ""
	channel := test.GetChannel(config.ChannelTypeOpenAI, url, "", proxy, mapping)
	channel.CustomParameter = &customParameter
	allowExtra := true
	channel.AllowExtraBody = allowExtra

	provider := CreateOpenAIProvider(&channel, url)
	provider.SetContext(c)
	provider.SetOriginalModel("gpt-5.4-mini-high")
	responseProvider := providersBase.ResponsesInterface(provider)

	usage := &types.Usage{}
	provider.SetUsage(usage)

	req := &types.OpenAIResponsesRequest{Model: "gpt-5.4-mini", Input: "hi"}
	_, errWithCode := responseProvider.CreateResponses(config.RelayModeResponses, req)

	assert.Nil(t, errWithCode)
	assert.Contains(t, capturedBody, `"service_tier":"flex"`)
	assert.Contains(t, capturedBody, `"effort":"high"`)
	assert.NotContains(t, capturedBody, `"service_tier":"priority"`)
}

func TestResponsesAllowExtraBodyUsesRawToolsAndMappedModel(t *testing.T) {
	requester.InitHttpClient()

	url, server, teardown := setupOpenAITestServer()
	defer teardown()

	var capturedBody string
	server.RegisterHandler("/v1/responses", func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		capturedBody = string(bodyBytes)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"resp_123","model":"gpt-5.4-mini","object":"response","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`))
	})

	body := `{"model":"gpt-5.4-mini-high","input":"hi","tools":[{"type":"tool_search","server_only":{"mode":"strict"}}]}`
	c, _ := test.GetContext("POST", "/v1/responses", test.RequestJSONConfig(), strings.NewReader(body))
	c.Set(config.GinRequestBodyKey, []byte(body))

	mapping := `{"gpt-5.4-mini-high":"gpt-5.4-mini"}`
	proxy := ""
	channel := test.GetChannel(config.ChannelTypeOpenAI, url, "", proxy, mapping)
	channel.AllowExtraBody = true

	provider := CreateOpenAIProvider(&channel, url)
	provider.SetContext(c)
	provider.SetOriginalModel("gpt-5.4-mini-high")
	provider.SetUsage(&types.Usage{})

	req := &types.OpenAIResponsesRequest{
		Model: "gpt-5.4-mini",
		Input: "hi",
		Tools: []types.ResponsesTools{
			{Type: "tool_search"},
		},
	}
	_, errWithCode := provider.CreateResponses(config.RelayModeResponses, req)

	assert.Nil(t, errWithCode)

	var captured map[string]interface{}
	assert.NoError(t, json.Unmarshal([]byte(capturedBody), &captured))
	assert.Equal(t, "gpt-5.4-mini", captured["model"])
	assert.Contains(t, capturedBody, `"server_only"`)
}

func TestResponsesAllowExtraBodyFalseKeepsStructSerialization(t *testing.T) {
	requester.InitHttpClient()

	url, server, teardown := setupOpenAITestServer()
	defer teardown()

	var capturedBody string
	server.RegisterHandler("/v1/responses", func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		capturedBody = string(bodyBytes)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"resp_123","model":"gpt-5.4-mini","object":"response","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`))
	})

	body := `{"model":"gpt-5.4-mini-high","input":"hi","tools":[{"type":"tool_search","server_only":{"mode":"strict"}}]}`
	c, _ := test.GetContext("POST", "/v1/responses", test.RequestJSONConfig(), strings.NewReader(body))
	c.Set(config.GinRequestBodyKey, []byte(body))

	mapping := `{"gpt-5.4-mini-high":"gpt-5.4-mini"}`
	proxy := ""
	channel := test.GetChannel(config.ChannelTypeOpenAI, url, "", proxy, mapping)

	provider := CreateOpenAIProvider(&channel, url)
	provider.SetContext(c)
	provider.SetOriginalModel("gpt-5.4-mini-high")
	provider.SetUsage(&types.Usage{})

	req := &types.OpenAIResponsesRequest{
		Model: "gpt-5.4-mini",
		Input: "hi",
		Tools: []types.ResponsesTools{
			{Type: "tool_search"},
		},
	}
	_, errWithCode := provider.CreateResponses(config.RelayModeResponses, req)

	assert.Nil(t, errWithCode)
	assert.Contains(t, capturedBody, `"model":"gpt-5.4-mini"`)
	assert.NotContains(t, capturedBody, `"server_only"`)
}

func TestResponsesAllowExtraBodyFallsBackWhenRawBodyInvalid(t *testing.T) {
	requester.InitHttpClient()

	url, server, teardown := setupOpenAITestServer()
	defer teardown()

	var capturedBody string
	server.RegisterHandler("/v1/responses", func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		capturedBody = string(bodyBytes)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"resp_123","model":"gpt-5.4-mini","object":"response","status":"completed","output":[],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`))
	})

	c, _ := test.GetContext("POST", "/v1/responses", test.RequestJSONConfig(), strings.NewReader(`not-json`))
	c.Set(config.GinRequestBodyKey, []byte(`not-json`))

	mapping := `{"gpt-5.4-mini-high":"gpt-5.4-mini"}`
	proxy := ""
	channel := test.GetChannel(config.ChannelTypeOpenAI, url, "", proxy, mapping)
	channel.AllowExtraBody = true

	provider := CreateOpenAIProvider(&channel, url)
	provider.SetContext(c)
	provider.SetOriginalModel("gpt-5.4-mini-high")
	provider.SetUsage(&types.Usage{})

	req := &types.OpenAIResponsesRequest{
		Model: "gpt-5.4-mini",
		Input: "hi",
		Tools: []types.ResponsesTools{
			{Type: "tool_search"},
		},
	}
	_, errWithCode := provider.CreateResponses(config.RelayModeResponses, req)

	assert.Nil(t, errWithCode)
	assert.Contains(t, capturedBody, `"model":"gpt-5.4-mini"`)
	assert.Contains(t, capturedBody, `"tools":[{"type":"tool_search"}]`)
}

func TestResponsesCompactUsesCompactEndpoint(t *testing.T) {
	requester.InitHttpClient()

	url, server, teardown := setupOpenAITestServer()
	defer teardown()

	var capturedPath string
	server.RegisterHandler("/v1/responses/compact", func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"resp_compact_123","model":"gpt-5.4-mini","object":"response.compaction","status":"completed","output":[{"type":"compaction","encrypted_content":"enc_123"}],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`))
	})

	body := `{"model":"gpt-5.4-mini","input":"hi"}`
	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), strings.NewReader(body))
	c.Set(config.GinRequestBodyKey, []byte(body))

	proxy := ""
	channel := test.GetChannel(config.ChannelTypeOpenAI, url, "", proxy, "")
	provider := CreateOpenAIProvider(&channel, url)
	provider.SetContext(c)
	provider.SetOriginalModel("gpt-5.4-mini")
	provider.SetUsage(&types.Usage{})

	response, errWithCode := provider.CreateResponses(config.RelayModeResponsesCompact, &types.OpenAIResponsesRequest{
		Model: "gpt-5.4-mini",
		Input: "hi",
	})

	assert.Nil(t, errWithCode)
	assert.Equal(t, "/v1/responses/compact", capturedPath)
	assert.Equal(t, "response.compaction", response.Object)
	assert.Len(t, response.Output, 1)
	assert.Equal(t, "compaction", response.Output[0].Type)
	if assert.NotNil(t, response.Output[0].EncryptedContent) {
		assert.Equal(t, "enc_123", *response.Output[0].EncryptedContent)
	}
}

func TestResponsesCompactAllowExtraBodyUsesRawToolsAndMappedModel(t *testing.T) {
	requester.InitHttpClient()

	url, server, teardown := setupOpenAITestServer()
	defer teardown()

	var capturedBody string
	server.RegisterHandler("/v1/responses/compact", func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		capturedBody = string(bodyBytes)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"resp_compact_123","model":"gpt-5.4-mini","object":"response.compaction","status":"completed","output":[{"type":"compaction","encrypted_content":"enc_123"}],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`))
	})

	body := `{"model":"gpt-5.4-mini-high","input":"hi","tools":[{"type":"tool_search","server_only":{"mode":"strict"}}]}`
	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), strings.NewReader(body))
	c.Set(config.GinRequestBodyKey, []byte(body))

	mapping := `{"gpt-5.4-mini-high":"gpt-5.4-mini"}`
	proxy := ""
	channel := test.GetChannel(config.ChannelTypeOpenAI, url, "", proxy, mapping)
	channel.AllowExtraBody = true

	provider := CreateOpenAIProvider(&channel, url)
	provider.SetContext(c)
	provider.SetOriginalModel("gpt-5.4-mini-high")
	provider.SetUsage(&types.Usage{})

	response, errWithCode := provider.CreateResponses(config.RelayModeResponsesCompact, &types.OpenAIResponsesRequest{
		Model: "gpt-5.4-mini",
		Input: "hi",
		Tools: []types.ResponsesTools{
			{Type: "tool_search"},
		},
	})

	assert.Nil(t, errWithCode)
	assert.Equal(t, "response.compaction", response.Object)

	var captured map[string]interface{}
	assert.NoError(t, json.Unmarshal([]byte(capturedBody), &captured))
	assert.Equal(t, "gpt-5.4-mini", captured["model"])
	assert.Contains(t, capturedBody, `"server_only"`)
}

func TestResponsesCompactCustomChannelAlwaysReturnsDeterministicError(t *testing.T) {
	requester.InitHttpClient()

	body := `{"model":"gpt-5.4-mini","input":"hi"}`
	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), strings.NewReader(body))
	c.Set(config.GinRequestBodyKey, []byte(body))

	customize := model.PluginType{
		"customize": {
			"16": "/v1/responses",
			"17": "/v1/responses/compact",
		},
	}
	plugin := datatypes.NewJSONType(customize)
	baseURL := "https://example.com"
	proxy := ""
	channel := test.GetChannel(config.ChannelTypeCustom, baseURL, "", proxy, "")
	channel.Plugin = &plugin

	provider := CreateOpenAIProvider(&channel, baseURL)
	provider.SetContext(c)
	provider.SetOriginalModel("gpt-5.4-mini")
	provider.SetUsage(&types.Usage{})

	response, errWithCode := provider.CreateResponses(config.RelayModeResponsesCompact, &types.OpenAIResponsesRequest{
		Model: "gpt-5.4-mini",
		Input: "hi",
	})

	assert.Nil(t, response)
	if assert.NotNil(t, errWithCode) {
		assert.Equal(t, 501, errWithCode.StatusCode)
		assert.Equal(t, "unsupported_api", errWithCode.Code)
		assert.Equal(t, "The responses compact API interface is not supported", errWithCode.Message)
	}
}
