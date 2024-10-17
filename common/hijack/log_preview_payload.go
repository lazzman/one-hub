package hijack

import (
	"context"
	"encoding/json"
	"fmt"
	"one-api/common/config"
	"strings"
)

type LogPreviewSource struct {
	ProtocolHint string `json:"protocol_hint,omitempty"`
	Provider     string `json:"provider,omitempty"`
	ChannelType  int    `json:"channel_type,omitempty"`
	ChannelName  string `json:"channel_name,omitempty"`
	EndpointPath string `json:"endpoint_path,omitempty"`
	IsStream     bool   `json:"is_stream"`
	APIProvider  string `json:"api_provider,omitempty"`
	APISchema    string `json:"api_schema,omitempty"`
	APIEndpoint  string `json:"api_endpoint,omitempty"`
	APITransport string `json:"api_transport,omitempty"`
}

type LogPreviewBody struct {
	Raw   string `json:"raw,omitempty"`
	Bytes int    `json:"bytes"`
}

type LogPreviewResponse struct {
	Type  ResponseType `json:"type,omitempty"`
	Raw   string       `json:"raw,omitempty"`
	Bytes int          `json:"bytes"`
}

type LogPreviewPayload struct {
	Version  int                `json:"version"`
	Source   LogPreviewSource   `json:"source"`
	Request  LogPreviewBody     `json:"request"`
	Response LogPreviewResponse `json:"response"`
}

func StoreLogPreviewSource(ctx context.Context, source LogPreviewSource) {
	payload, err := json.Marshal(source)
	if err != nil {
		return
	}
	GlobalContextStorage.Store(ctx, "log_preview_source", string(payload))
}

func GetAndDeleteLogPreviewSource(ctx context.Context) (LogPreviewSource, bool) {
	jsonData, ok := GlobalContextStorage.Load(ctx, "log_preview_source")
	if !ok {
		return LogPreviewSource{}, false
	}
	GlobalContextStorage.Delete(ctx, "log_preview_source")

	var source LogPreviewSource
	if err := json.Unmarshal([]byte(jsonData), &source); err != nil {
		return LogPreviewSource{}, false
	}
	return source, true
}

func BuildLogPreviewPayload(source LogPreviewSource, requestBody string, responseData *ResponseData) LogPreviewPayload {
	responseRaw := ""
	responseType := ResponseType("")
	if responseData != nil {
		responseType = responseData.Type
		responseRaw = rawResponseContentToString(responseData.Content)
	}

	protocolHint := normalizeProtocolHint(source.ProtocolHint, source.EndpointPath, source.ChannelType)
	provider := normalizeProvider(source.Provider, source.ChannelType)
	endpoint := normalizeEndpointKind(source.APIEndpoint, source.EndpointPath, protocolHint)
	transport := normalizeTransport(source.APITransport, source.IsStream)

	return LogPreviewPayload{
		Version: 1,
		Source: LogPreviewSource{
			ProtocolHint: protocolHint,
			Provider:     provider,
			ChannelType:  source.ChannelType,
			ChannelName:  source.ChannelName,
			EndpointPath: source.EndpointPath,
			IsStream:     source.IsStream,
			APIProvider:  normalizeAPIProvider(source.APIProvider, provider),
			APISchema:    normalizeAPISchema(source.APISchema, protocolHint, provider),
			APIEndpoint:  endpoint,
			APITransport: transport,
		},
		Request: LogPreviewBody{
			Raw:   requestBody,
			Bytes: len(requestBody),
		},
		Response: LogPreviewResponse{
			Type:  responseType,
			Raw:   responseRaw,
			Bytes: len(responseRaw),
		},
	}
}

func normalizeAPIProvider(current string, provider string) string {
	if current != "" {
		return current
	}
	return provider
}

func normalizeAPISchema(current string, protocolHint string, provider string) string {
	if current != "" {
		return current
	}
	switch protocolHint {
	case "responses":
		return "openai-responses"
	case "claude":
		return "claude-messages"
	case "gemini":
		return "gemini-generate-content"
	case "openai-chat":
		if !isNativeOpenAIChatProvider(provider) {
			return "openai-compatible"
		}
		return "openai-chat-completions"
	case "openai-compatible":
		return "openai-compatible"
	case "openai-completions":
		return "openai-completions"
	case "openai-embeddings":
		return "openai-embeddings"
	case "openai-images":
		return "openai-images"
	case "openai-audio":
		return "openai-audio"
	default:
		return "unknown"
	}
}

func isNativeOpenAIChatProvider(provider string) bool {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "openai", "azure":
		return true
	default:
		return false
	}
}

func normalizeEndpointKind(current string, endpointPath string, protocolHint string) string {
	if current != "" {
		return current
	}
	path := strings.ToLower(endpointPath)
	switch {
	case strings.HasPrefix(path, "/v1/responses"):
		return "responses"
	case strings.HasPrefix(path, "/v1/chat/completions"):
		return "chat-completions"
	case strings.HasPrefix(path, "/v1/completions"):
		return "completions"
	case strings.HasPrefix(path, "/v1/embeddings"):
		return "embeddings"
	case strings.HasPrefix(path, "/v1/images"):
		return "images"
	case strings.HasPrefix(path, "/v1/audio"):
		return "audio"
	case strings.HasPrefix(path, "/claude"):
		return "claude-messages"
	case strings.HasPrefix(path, "/gemini"):
		return "gemini-generate-content"
	}
	return protocolHint
}

func normalizeTransport(current string, isStream bool) string {
	if current != "" {
		return current
	}
	if isStream {
		return "stream"
	}
	return "non-stream"
}

func MarshalLogPreviewPayload(payload LogPreviewPayload) string {
	data, err := json.Marshal(payload)
	if err != nil {
		fallback := fmt.Sprintf(`{"version":1,"source":{"protocol_hint":"unknown"},"request":{"bytes":0},"response":{"bytes":0,"raw":%q}}`, err.Error())
		return fallback
	}
	return string(data)
}

func normalizeProtocolHint(current string, endpointPath string, channelType int) string {
	if current != "" {
		return current
	}
	path := strings.ToLower(endpointPath)
	switch {
	case strings.HasPrefix(path, "/v1/responses"):
		return "responses"
	case strings.HasPrefix(path, "/claude"):
		return "claude"
	case strings.HasPrefix(path, "/gemini"):
		return "gemini"
	case strings.HasPrefix(path, "/v1/chat/completions"):
		return "openai-chat"
	case strings.HasPrefix(path, "/v1/completions"):
		return "openai-completions"
	case strings.HasPrefix(path, "/v1/embeddings"):
		return "openai-embeddings"
	case strings.HasPrefix(path, "/v1/images"):
		return "openai-images"
	case strings.HasPrefix(path, "/v1/audio"):
		return "openai-audio"
	}

	switch channelType {
	case config.ChannelTypeAnthropic:
		return "claude"
	case config.ChannelTypeGemini, config.ChannelTypePaLM, config.ChannelTypeVertexAI:
		return "gemini"
	case config.ChannelTypeOpenAI, config.ChannelTypeAzure, config.ChannelTypeAzureV1, config.ChannelTypeAzureDatabricks,
		config.ChannelTypeOpenRouter, config.ChannelTypeCustom, config.ChannelTypeGroq, config.ChannelTypeDeepseek,
		config.ChannelTypeMoonshot, config.ChannelTypeMistral, config.ChannelTypeSiliconflow, config.ChannelTypeXAI,
		config.ChannelTypeGithub, config.ChannelTypeOllama, config.ChannelTypeLingyi, config.ChannelTypeMiniMax,
		config.ChannelTypeAli, config.ChannelTypeTencent, config.ChannelTypeHunyuan, config.ChannelTypeZhipu,
		config.ChannelTypeBaidu, config.ChannelTypeBaichuan, config.ChannelType360, config.ChannelTypeCloudflareAI:
		return "openai-compatible"
	default:
		return "unknown"
	}
}

func normalizeProvider(current string, channelType int) string {
	if current != "" {
		return current
	}
	switch channelType {
	case config.ChannelTypeOpenAI:
		return "openai"
	case config.ChannelTypeAzure, config.ChannelTypeAzureV1, config.ChannelTypeAzureDatabricks, config.ChannelTypeAzureSpeech:
		return "azure"
	case config.ChannelTypeAnthropic:
		return "anthropic"
	case config.ChannelTypeGemini:
		return "gemini"
	case config.ChannelTypeOpenRouter:
		return "openrouter"
	case config.ChannelTypeGroq:
		return "groq"
	case config.ChannelTypeDeepseek:
		return "deepseek"
	case config.ChannelTypeMoonshot:
		return "moonshot"
	case config.ChannelTypeMistral:
		return "mistral"
	case config.ChannelTypeAli:
		return "ali"
	case config.ChannelTypeTencent:
		return "tencent"
	case config.ChannelTypeZhipu:
		return "zhipu"
	case config.ChannelTypeBaidu:
		return "baidu"
	case config.ChannelTypeCloudflareAI:
		return "cloudflare"
	case config.ChannelTypeGithub:
		return "github"
	case config.ChannelTypeOllama:
		return "ollama"
	case config.ChannelTypeVertexAI:
		return "vertex-ai"
	case config.ChannelTypeXAI:
		return "xai"
	default:
		return "unknown"
	}
}
