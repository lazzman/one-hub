package openai

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"one-api/common/config"
	"one-api/common/requester"
	test "one-api/common/test"
	_ "one-api/common/test/init"
	providersBase "one-api/providers/base"
	"one-api/types"

	"github.com/stretchr/testify/assert"
)

func setupOpenAITestServer() (string, *test.ServerTest, func()) {
	server := test.NewTestServer()
	ts := server.TestServer(test.OpenAICheck)
	ts.Start()
	return ts.URL, server, ts.Close
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
	_, errWithCode := responseProvider.CreateResponses(req)

	assert.Nil(t, errWithCode)
	assert.Contains(t, capturedBody, `"service_tier":"flex"`)
	assert.Contains(t, capturedBody, `"effort":"high"`)
	assert.NotContains(t, capturedBody, `"service_tier":"priority"`)
}
