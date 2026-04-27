package relay

import (
	"encoding/json"
	"testing"

	"one-api/common/requester"
	test "one-api/common/test"
	"one-api/model"
	providersBase "one-api/providers/base"
	"one-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

type stubResponsesProvider struct {
	capturedModel string
}

func (s *stubResponsesProvider) GetRequestHeaders() map[string]string { return map[string]string{} }
func (s *stubResponsesProvider) GetUsage() *types.Usage               { return &types.Usage{} }
func (s *stubResponsesProvider) SetUsage(usage *types.Usage)          {}
func (s *stubResponsesProvider) SetContext(c *gin.Context)            {}
func (s *stubResponsesProvider) SetOriginalModel(ModelName string)    {}
func (s *stubResponsesProvider) GetOriginalModel() string             { return "" }
func (s *stubResponsesProvider) GetChannel() *model.Channel           { return nil }
func (s *stubResponsesProvider) ModelMappingHandler(modelName string) (string, error) {
	return modelName, nil
}
func (s *stubResponsesProvider) GetRequester() *requester.HTTPRequester { return nil }
func (s *stubResponsesProvider) SetOtherArg(otherArg string)            {}
func (s *stubResponsesProvider) GetOtherArg() string                    { return "" }
func (s *stubResponsesProvider) CustomParameterHandler() (map[string]interface{}, error) {
	return nil, nil
}
func (s *stubResponsesProvider) GetSupportedResponse() bool { return true }
func (s *stubResponsesProvider) CreateResponses(relayMode int, request *types.OpenAIResponsesRequest) (*types.OpenAIResponsesResponses, *types.OpenAIErrorWithStatusCode) {
	s.capturedModel = request.Model
	return &types.OpenAIResponsesResponses{
		ID:     "resp_compat",
		Model:  request.Model,
		Object: "response",
		Status: "completed",
		Output: []types.ResponsesOutput{{Type: types.InputTypeMessage, Role: types.ChatMessageRoleAssistant, Content: "ok"}},
		Usage:  &types.ResponsesUsage{InputTokens: 1, OutputTokens: 1, TotalTokens: 2},
	}, nil
}
func (s *stubResponsesProvider) CreateResponsesStream(relayMode int, request *types.OpenAIResponsesRequest) (requester.StreamReaderInterface[string], *types.OpenAIErrorWithStatusCode) {
	return nil, nil
}

var _ providersBase.ResponsesInterface = (*stubResponsesProvider)(nil)

func TestRelayChatCompatibleSend_UsesMappedModelInResponsesRequest(t *testing.T) {
	c, w := test.GetContext("POST", "/v1/chat/completions", test.RequestJSONConfig(), nil)
	provider := &stubResponsesProvider{}
	relay := &relayChat{
		relayBase: relayBase{
			c:         c,
			provider:  provider,
			modelName: "o3-pro-2025-06-10",
		},
		chatRequest: types.ChatCompletionRequest{
			Model: "alias-o3-pro",
			Messages: []types.ChatCompletionMessage{{
				Role:    types.ChatMessageRoleUser,
				Content: "hi",
			}},
		},
	}

	errWithCode, done := relay.compatibleSend(provider)

	assert.Nil(t, errWithCode)
	assert.False(t, done)
	assert.Equal(t, "o3-pro-2025-06-10", provider.capturedModel)

	var response types.ChatCompletionResponse
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.Nil(t, err)
	assert.Equal(t, "o3-pro-2025-06-10", response.Model)
}
