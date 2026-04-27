package relay

import (
	"net/http"
	"testing"

	"one-api/common/config"
	"one-api/common/requester"
	test "one-api/common/test"
	"one-api/model"
	providersBase "one-api/providers/base"
	"one-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type stubCompactResponsesProvider struct {
	createCalled bool
	streamCalled bool
	relayMode    int
	createErr    *types.OpenAIErrorWithStatusCode
	channelType  int
}

func (s *stubCompactResponsesProvider) GetRequestHeaders() map[string]string {
	return map[string]string{}
}
func (s *stubCompactResponsesProvider) GetUsage() *types.Usage            { return &types.Usage{} }
func (s *stubCompactResponsesProvider) SetUsage(usage *types.Usage)       {}
func (s *stubCompactResponsesProvider) SetContext(c *gin.Context)         {}
func (s *stubCompactResponsesProvider) SetOriginalModel(modelName string) {}
func (s *stubCompactResponsesProvider) GetOriginalModel() string          { return "" }
func (s *stubCompactResponsesProvider) GetChannel() *model.Channel {
	return &model.Channel{Type: s.channelType}
}
func (s *stubCompactResponsesProvider) ModelMappingHandler(modelName string) (string, error) {
	return modelName, nil
}
func (s *stubCompactResponsesProvider) GetRequester() *requester.HTTPRequester { return nil }
func (s *stubCompactResponsesProvider) SetOtherArg(otherArg string)            {}
func (s *stubCompactResponsesProvider) GetOtherArg() string                    { return "" }
func (s *stubCompactResponsesProvider) CustomParameterHandler() (map[string]interface{}, error) {
	return nil, nil
}
func (s *stubCompactResponsesProvider) GetSupportedResponse() bool { return true }
func (s *stubCompactResponsesProvider) CreateResponses(relayMode int, request *types.OpenAIResponsesRequest) (*types.OpenAIResponsesResponses, *types.OpenAIErrorWithStatusCode) {
	s.createCalled = true
	s.relayMode = relayMode
	if s.createErr != nil {
		return nil, s.createErr
	}
	return &types.OpenAIResponsesResponses{
		ID:     "resp_compact",
		Model:  request.Model,
		Object: "response.compaction",
		Status: "completed",
		Output: []types.ResponsesOutput{{Type: "compaction", EncryptedContent: strPtr("enc")}},
		Usage:  &types.ResponsesUsage{InputTokens: 1, OutputTokens: 0, TotalTokens: 1},
	}, nil
}
func (s *stubCompactResponsesProvider) CreateResponsesStream(relayMode int, request *types.OpenAIResponsesRequest) (requester.StreamReaderInterface[string], *types.OpenAIErrorWithStatusCode) {
	s.streamCalled = true
	return nil, nil
}

var _ providersBase.ResponsesInterface = (*stubCompactResponsesProvider)(nil)

type stubChatOnlyProvider struct {
	channelType int
}

func (s *stubChatOnlyProvider) GetRequestHeaders() map[string]string { return map[string]string{} }
func (s *stubChatOnlyProvider) GetUsage() *types.Usage               { return &types.Usage{} }
func (s *stubChatOnlyProvider) SetUsage(usage *types.Usage)          {}
func (s *stubChatOnlyProvider) SetContext(c *gin.Context)            {}
func (s *stubChatOnlyProvider) SetOriginalModel(modelName string)    {}
func (s *stubChatOnlyProvider) GetOriginalModel() string             { return "" }
func (s *stubChatOnlyProvider) GetChannel() *model.Channel {
	return &model.Channel{Type: s.channelType}
}
func (s *stubChatOnlyProvider) ModelMappingHandler(modelName string) (string, error) {
	return modelName, nil
}
func (s *stubChatOnlyProvider) GetRequester() *requester.HTTPRequester { return nil }
func (s *stubChatOnlyProvider) SetOtherArg(otherArg string)            {}
func (s *stubChatOnlyProvider) GetOtherArg() string                    { return "" }
func (s *stubChatOnlyProvider) CustomParameterHandler() (map[string]interface{}, error) {
	return nil, nil
}
func (s *stubChatOnlyProvider) GetSupportedResponse() bool { return true }
func (s *stubChatOnlyProvider) CreateChatCompletion(request *types.ChatCompletionRequest) (*types.ChatCompletionResponse, *types.OpenAIErrorWithStatusCode) {
	return nil, nil
}
func (s *stubChatOnlyProvider) CreateChatCompletionStream(request *types.ChatCompletionRequest) (requester.StreamReaderInterface[string], *types.OpenAIErrorWithStatusCode) {
	return nil, nil
}

var _ providersBase.ChatInterface = (*stubChatOnlyProvider)(nil)

func strPtr(value string) *string {
	return &value
}

func TestGetResponsesRelayModeDetectsCompactPath(t *testing.T) {
	assert.Equal(t, config.RelayModeResponses, getResponsesRelayMode("/v1/responses"))
	assert.Equal(t, config.RelayModeResponsesCompact, getResponsesRelayMode("/v1/responses/compact"))
}

func TestRelayResponsesCompactRejectsStream(t *testing.T) {
	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), nil)
	provider := &stubCompactResponsesProvider{channelType: config.ChannelTypeOpenAI}
	relay := &relayResponses{
		relayBase: relayBase{
			c:         c,
			provider:  provider,
			modelName: "gpt-5.4-mini",
		},
		relayMode: config.RelayModeResponsesCompact,
		responsesRequest: types.OpenAIResponsesRequest{
			Model:  "gpt-5.4-mini",
			Input:  "hi",
			Stream: true,
		},
	}

	errWithCode, done := relay.send()

	if assert.NotNil(t, errWithCode) {
		assert.Equal(t, 400, errWithCode.StatusCode)
		assert.Equal(t, "invalid_request", errWithCode.Code)
		assert.Equal(t, "The responses compact API does not support stream=true", errWithCode.Message)
	}
	assert.True(t, done)
	assert.False(t, shouldRetry(c, errWithCode, config.ChannelTypeOpenAI))
	assert.False(t, provider.createCalled)
	assert.False(t, provider.streamCalled)
}

func TestRelayResponsesCompactLocalUnsupportedCanRetry(t *testing.T) {
	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), nil)
	relay := &relayResponses{
		relayBase: relayBase{
			c:         c,
			provider:  &stubChatOnlyProvider{channelType: config.ChannelTypeOpenAI},
			modelName: "gpt-5.4-mini",
		},
		relayMode: config.RelayModeResponsesCompact,
		responsesRequest: types.OpenAIResponsesRequest{
			Model: "gpt-5.4-mini",
			Input: "hi",
		},
	}

	errWithCode, done := relay.send()

	if assert.NotNil(t, errWithCode) {
		assert.Equal(t, 501, errWithCode.StatusCode)
		assert.Equal(t, "unsupported_api", errWithCode.Code)
		assert.Equal(t, responsesCompactUnsupportedMessage, errWithCode.Message)
	}
	assert.False(t, done)
	assert.True(t, shouldRetry(c, errWithCode, config.ChannelTypeOpenAI))
}

func TestRelayResponsesCompactNonOpenAIProviderDoesNotCallUpstream(t *testing.T) {
	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), nil)
	provider := &stubCompactResponsesProvider{channelType: config.ChannelTypeAzure}
	relay := &relayResponses{
		relayBase: relayBase{
			c:         c,
			provider:  provider,
			modelName: "gpt-5.4-mini",
		},
		relayMode: config.RelayModeResponsesCompact,
		responsesRequest: types.OpenAIResponsesRequest{
			Model: "gpt-5.4-mini",
			Input: "hi",
		},
	}

	errWithCode, done := relay.send()

	if assert.NotNil(t, errWithCode) {
		assert.Equal(t, 501, errWithCode.StatusCode)
		assert.Equal(t, "unsupported_api", errWithCode.Code)
		assert.Equal(t, responsesCompactUnsupportedMessage, errWithCode.Message)
	}
	assert.False(t, done)
	assert.True(t, shouldRetry(c, errWithCode, config.ChannelTypeAzure))
	assert.False(t, provider.createCalled)
	assert.False(t, provider.streamCalled)
}

func TestRelayResponsesCompactPassesCompactRelayModeToProvider(t *testing.T) {
	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), nil)
	provider := &stubCompactResponsesProvider{channelType: config.ChannelTypeOpenAI}
	relay := &relayResponses{
		relayBase: relayBase{
			c:         c,
			provider:  provider,
			modelName: "gpt-5.4-mini",
		},
		relayMode: config.RelayModeResponsesCompact,
		responsesRequest: types.OpenAIResponsesRequest{
			Model: "gpt-5.4-mini",
			Input: "hi",
		},
	}

	errWithCode, done := relay.send()

	assert.Nil(t, errWithCode)
	assert.False(t, done)
	assert.True(t, provider.createCalled)
	assert.Equal(t, config.RelayModeResponsesCompact, provider.relayMode)
}

func TestRelayResponsesCompactUpstreamInvalidURLCanRetry(t *testing.T) {
	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), nil)
	provider := &stubCompactResponsesProvider{
		channelType: config.ChannelTypeOpenAI,
		createErr: &types.OpenAIErrorWithStatusCode{
			StatusCode: http.StatusNotFound,
			OpenAIError: types.OpenAIError{
				Message: "Invalid URL (POST /v1/responses/compact)",
				Type:    "invalid_request_error",
				Code:    "bad_response_status_code",
			},
		},
	}
	relay := &relayResponses{
		relayBase: relayBase{
			c:         c,
			provider:  provider,
			modelName: "gpt-5.4-mini",
		},
		relayMode: config.RelayModeResponsesCompact,
		responsesRequest: types.OpenAIResponsesRequest{
			Model: "gpt-5.4-mini",
			Input: "hi",
		},
	}

	errWithCode, done := relay.send()

	if assert.NotNil(t, errWithCode) {
		assert.Equal(t, 501, errWithCode.StatusCode)
		assert.Equal(t, "unsupported_api", errWithCode.Code)
		assert.Equal(t, responsesCompactUnsupportedMessage, errWithCode.Message)
	}
	assert.False(t, done)
	assert.True(t, shouldRetry(c, errWithCode, config.ChannelTypeOpenAI))
}

func TestRelayResponsesCompactUpstreamBadRequestInvalidURLCanRetry(t *testing.T) {
	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), nil)
	provider := &stubCompactResponsesProvider{
		channelType: config.ChannelTypeOpenAI,
		createErr: &types.OpenAIErrorWithStatusCode{
			StatusCode: http.StatusBadRequest,
			OpenAIError: types.OpenAIError{
				Message: "Invalid URL (POST /v1/responses/compact)",
				Type:    "invalid_request_error",
				Code:    "bad_response_status_code",
			},
		},
	}
	relay := &relayResponses{
		relayBase: relayBase{
			c:         c,
			provider:  provider,
			modelName: "gpt-5.4-mini",
		},
		relayMode: config.RelayModeResponsesCompact,
		responsesRequest: types.OpenAIResponsesRequest{
			Model: "gpt-5.4-mini",
			Input: "hi",
		},
	}

	errWithCode, done := relay.send()

	if assert.NotNil(t, errWithCode) {
		assert.Equal(t, 501, errWithCode.StatusCode)
		assert.Equal(t, "unsupported_api", errWithCode.Code)
		assert.Equal(t, responsesCompactUnsupportedMessage, errWithCode.Message)
	}
	assert.False(t, done)
	assert.True(t, shouldRetry(c, errWithCode, config.ChannelTypeOpenAI))
}

func TestCompactUnsupportedDoesNotBypassRetryTimesZero(t *testing.T) {
	originalRetryTimes := config.RetryTimes
	config.RetryTimes = 0
	t.Cleanup(func() {
		config.RetryTimes = originalRetryTimes
	})

	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), nil)
	errWithCode := unsupportedResponsesCompactError()

	assert.True(t, shouldRetry(c, errWithCode, config.ChannelTypeOpenAI))
	assert.Equal(t, 0, getChannelRetryTimes(c, errWithCode, config.ChannelTypeOpenAI, false))
	assert.Equal(t, 0, getChannelRetryTimes(c, errWithCode, config.ChannelTypeOpenAI, true))
}

func TestCompactUnsupportedKeepsRetryBudgetWhenConfigured(t *testing.T) {
	originalRetryTimes := config.RetryTimes
	config.RetryTimes = 2
	t.Cleanup(func() {
		config.RetryTimes = originalRetryTimes
	})

	c, _ := test.GetContext("POST", "/v1/responses/compact", test.RequestJSONConfig(), nil)
	provider := &stubCompactResponsesProvider{
		channelType: config.ChannelTypeOpenAI,
		createErr: &types.OpenAIErrorWithStatusCode{
			StatusCode: http.StatusNotFound,
			OpenAIError: types.OpenAIError{
				Message: "Invalid URL (POST /v1/responses/compact)",
				Type:    "invalid_request_error",
				Code:    "bad_response_status_code",
			},
		},
	}
	relay := &relayResponses{
		relayBase: relayBase{
			c:         c,
			provider:  provider,
			modelName: "gpt-5.4-mini",
		},
		relayMode: config.RelayModeResponsesCompact,
		responsesRequest: types.OpenAIResponsesRequest{
			Model: "gpt-5.4-mini",
			Input: "hi",
		},
	}

	errWithCode, done := relay.send()

	if assert.NotNil(t, errWithCode) {
		assert.Equal(t, 501, errWithCode.StatusCode)
		assert.Equal(t, "unsupported_api", errWithCode.Code)
		assert.Equal(t, responsesCompactUnsupportedMessage, errWithCode.Message)
	}
	assert.False(t, done)
	assert.True(t, shouldRetry(c, errWithCode, config.ChannelTypeOpenAI))
	assert.Equal(t, 2, getChannelRetryTimes(c, errWithCode, config.ChannelTypeOpenAI, done))
}

func TestRelayResponsesStandardPathDoesNotUseCompactNormalization(t *testing.T) {
	c, _ := test.GetContext("POST", "/v1/responses", test.RequestJSONConfig(), nil)
	provider := &stubCompactResponsesProvider{
		channelType: config.ChannelTypeOpenAI,
		createErr: &types.OpenAIErrorWithStatusCode{
			StatusCode: http.StatusNotFound,
			OpenAIError: types.OpenAIError{
				Message: "Invalid URL (POST /v1/responses)",
				Type:    "invalid_request_error",
				Code:    "bad_response_status_code",
			},
		},
	}
	relay := &relayResponses{
		relayBase: relayBase{
			c:         c,
			provider:  provider,
			modelName: "gpt-5.4-mini",
		},
		relayMode: config.RelayModeResponses,
		responsesRequest: types.OpenAIResponsesRequest{
			Model: "gpt-5.4-mini",
			Input: "hi",
		},
	}

	errWithCode, done := relay.send()

	if assert.NotNil(t, errWithCode) {
		assert.Equal(t, 404, errWithCode.StatusCode)
		assert.Equal(t, "bad_response_status_code", errWithCode.Code)
		assert.Equal(t, "Invalid URL (POST /v1/responses)", errWithCode.Message)
	}
	assert.False(t, done)
	assert.True(t, shouldRetry(c, errWithCode, config.ChannelTypeOpenAI))
}
