package relay

import (
	"io"
	"strings"
	"testing"

	"one-api/common/config"
	test "one-api/common/test"
	_ "one-api/common/test/init"
	"one-api/providers"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestApplyPreMappingBeforeRequest_ResponsesUsesOriginalModelConfig(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := `{"model":"gpt-5.4-mini-high","input":"hi"}`
	c, _ := test.GetContext("POST", "/v1/responses", test.RequestJSONConfig(), strings.NewReader(body))

	customParameter := `{
		"per_model": true,
		"pre_add": true,
		"overwrite": true,
		"gpt-5.4-mini-high": {
			"service_tier": "priority"
		},
		"gpt-5.4-mini": {
			"service_tier": "flex"
		}
	}`
	mapping := `{"gpt-5.4-mini-high":"gpt-5.4-mini"}`
	baseURL := "https://example.com"
	proxy := ""
	channel := test.GetChannel(config.ChannelTypeOpenAI, baseURL, "", proxy, mapping)
	channel.CustomParameter = &customParameter

	provider := providers.GetProvider(&channel, c)
	c.Set("channel_id", 1)
	c.Set("channel_type", channel.Type)
	_ = provider

	applyPreMappingBeforeRequestWithProvider(c, provider)

	bodyBytes, _ := io.ReadAll(c.Request.Body)
	assert.Contains(t, string(bodyBytes), `"service_tier":"priority"`)
	assert.NotContains(t, string(bodyBytes), `"service_tier":"flex"`)
}
