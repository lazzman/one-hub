package relay

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/common/config"
	"one-api/common/logger"
	"one-api/common/requester"
	"one-api/common/utils"
	"one-api/controller"
	"one-api/metrics"
	"one-api/model"
	"one-api/providers"
	providersBase "one-api/providers/base"
	"one-api/relay/relay_util"
	"one-api/types"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

func Path2Relay(c *gin.Context, path string) RelayBaseInterface {
	allowCache := false
	var relay RelayBaseInterface
	if strings.HasPrefix(path, "/v1/chat/completions") {
		allowCache = true
		relay = NewRelayChat(c)
	} else if strings.HasPrefix(path, "/v1/completions") {
		allowCache = true
		relay = NewRelayCompletions(c)
	} else if strings.HasPrefix(path, "/v1/embeddings") {
		relay = NewRelayEmbeddings(c)
	} else if strings.HasPrefix(path, "/v1/moderations") {
		relay = NewRelayModerations(c)
	} else if strings.HasPrefix(path, "/v1/images/generations") {
		relay = NewRelayImageGenerations(c)
	} else if strings.HasPrefix(path, "/v1/images/edits") {
		relay = NewRelayImageEdits(c)
	} else if strings.HasPrefix(path, "/v1/images/variations") {
		relay = NewRelayImageVariations(c)
	} else if strings.HasPrefix(path, "/v1/audio/speech") {
		relay = NewRelaySpeech(c)
	} else if strings.HasPrefix(path, "/v1/audio/transcriptions") {
		relay = NewRelayTranscriptions(c)
	} else if strings.HasPrefix(path, "/v1/audio/translations") {
		relay = NewRelayTranslations(c)
	}

	if relay != nil {
		relay.SetChatCache(allowCache)
	}

	return relay
}

func GetProvider(c *gin.Context, modeName string) (provider providersBase.ProviderInterface, newModelName string, fail error) {
	channel, fail := fetchChannel(c, modeName)
	if fail != nil {
		return
	}
	c.Set("channel_id", channel.Id)
	c.Set("channel_type", channel.Type)

	provider = providers.GetProvider(channel, c)
	if provider == nil {
		fail = errors.New("channel not found")
		return
	}
	provider.SetOriginalModel(modeName)
	c.Set("original_model", modeName)

	newModelName, fail = provider.ModelMappingHandler(modeName)
	if fail != nil {
		return
	}

	return
}

func fetchChannel(c *gin.Context, modelName string) (channel *model.Channel, fail error) {
	channelId := c.GetInt("specific_channel_id")
	ignore := c.GetBool("specific_channel_id_ignore")
	if channelId > 0 && !ignore {
		return fetchChannelById(channelId)
	}

	return fetchChannelByModel(c, modelName)
}

func fetchChannelById(channelId int) (*model.Channel, error) {
	channel, err := model.GetChannelById(channelId)
	if err != nil {
		return nil, errors.New("无效的渠道 Id")
	}
	if channel.Status != config.ChannelStatusEnabled {
		return nil, errors.New("该渠道已被禁用")
	}

	return channel, nil
}

func fetchChannelByModel(c *gin.Context, modelName string) (*model.Channel, error) {
	group := c.GetString("token_group")
	skipOnlyChat := c.GetBool("skip_only_chat")
	var filters []model.ChannelsFilterFunc
	if skipOnlyChat {
		filters = append(filters, model.FilterOnlyChat())
	}

	skipChannelIds, ok := utils.GetGinValue[[]int](c, "skip_channel_ids")
	if ok {
		filters = append(filters, model.FilterChannelId(skipChannelIds))
	}

	channel, err := model.ChannelGroup.Next(group, modelName, filters...)
	if err != nil {
		message := fmt.Sprintf("当前分组 %s 下对于模型 %s 无可用渠道", group, modelName)
		if channel != nil {
			logger.SysError(fmt.Sprintf("渠道不存在：%d", channel.Id))
			message = "数据库一致性已被破坏，请联系管理员"
		}
		return nil, errors.New(message)
	}

	return channel, nil
}

func responseJsonClient(c *gin.Context, data interface{}) *types.OpenAIErrorWithStatusCode {
	// 将data转换为 JSON
	responseBody, err := json.Marshal(data)
	if err != nil {
		return common.ErrorWrapperLocal(err, "marshal_response_body_failed", http.StatusInternalServerError)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusOK)
	_, err = c.Writer.Write(responseBody)
	if err != nil {
		return common.ErrorWrapperLocal(err, "write_response_body_failed", http.StatusInternalServerError)
	}

	return nil
}

type StreamEndHandler func() string

func responseStreamClient(c *gin.Context, stream requester.StreamReaderInterface[string], cache *relay_util.ChatCacheProps, endHandler StreamEndHandler) (errWithOP *types.OpenAIErrorWithStatusCode) {
	requester.SetEventStreamHeaders(c)
	dataChan, errChan := stream.Recv()

	defer stream.Close()
	c.Stream(func(w io.Writer) bool {
		select {
		case data := <-dataChan:
			streamData := "data: " + data + "\n\n"
			fmt.Fprint(w, streamData)
			cache.SetResponse(streamData)
			return true
		case err := <-errChan:
			if !errors.Is(err, io.EOF) {
				fmt.Fprint(w, "data: "+err.Error()+"\n\n")
				errWithOP = common.ErrorWrapper(err, "stream_error", http.StatusInternalServerError)
				// 报错不应该缓存
				cache.NoCache()
			}

			if errWithOP == nil && endHandler != nil {
				streamData := endHandler()
				if streamData != "" {
					fmt.Fprint(w, "data: "+streamData+"\n\n")
					cache.SetResponse(streamData)
				}
			}

			streamData := "data: [DONE]\n\n"
			fmt.Fprint(w, streamData)
			cache.SetResponse(streamData)
			return false
		}
	})

	return nil
}

func responseGeneralStreamClient(c *gin.Context, stream requester.StreamReaderInterface[string], cache *relay_util.ChatCacheProps, endHandler StreamEndHandler) {
	requester.SetEventStreamHeaders(c)
	dataChan, errChan := stream.Recv()

	defer stream.Close()
	c.Stream(func(w io.Writer) bool {
		select {
		case data := <-dataChan:
			fmt.Fprint(w, data)
			cache.SetResponse(data)
			return true
		case err := <-errChan:
			if !errors.Is(err, io.EOF) {
				fmt.Fprint(w, err.Error())
				logger.LogError(c.Request.Context(), "Stream err:"+err.Error())
				// 报错不应该缓存
				cache.NoCache()
			}

			if endHandler != nil {
				streamData := endHandler()
				if streamData != "" {
					fmt.Fprint(w, streamData)
					cache.SetResponse(streamData)
				}
			}
			return false
		}
	})

}

func responseMultipart(c *gin.Context, resp *http.Response) *types.OpenAIErrorWithStatusCode {
	defer resp.Body.Close()

	for k, v := range resp.Header {
		c.Writer.Header().Set(k, v[0])
	}

	c.Writer.WriteHeader(resp.StatusCode)

	_, err := io.Copy(c.Writer, resp.Body)
	if err != nil {
		return common.ErrorWrapper(err, "write_response_body_failed", http.StatusInternalServerError)
	}

	return nil
}

func responseCustom(c *gin.Context, response *types.AudioResponseWrapper) *types.OpenAIErrorWithStatusCode {
	for k, v := range response.Headers {
		c.Writer.Header().Set(k, v)
	}
	c.Writer.WriteHeader(http.StatusOK)

	_, err := c.Writer.Write(response.Body)
	if err != nil {
		return common.ErrorWrapper(err, "write_response_body_failed", http.StatusInternalServerError)
	}

	return nil
}

func responseCache(c *gin.Context, response string, isStream bool) {
	if isStream {
		requester.SetEventStreamHeaders(c)
		c.Stream(func(w io.Writer) bool {
			fmt.Fprint(w, response)
			return false
		})
	} else {
		c.Data(http.StatusOK, "application/json", []byte(response))
	}

}

func shouldRetry(c *gin.Context, apiErr *types.OpenAIErrorWithStatusCode, channelType int) bool {
	channelId := c.GetInt("specific_channel_id")
	ignore := c.GetBool("specific_channel_id_ignore")

	if apiErr == nil {
		return false
	}

	metrics.RecordProvider(c, apiErr.StatusCode)

	if apiErr.LocalError {
		return false
	}

	if channelId > 0 && !ignore {
		return false
	}

	if apiErr.StatusCode == http.StatusTooManyRequests {
		return true
	}

	if apiErr.StatusCode == 307 {
		return true
	}

	if apiErr.StatusCode/100 == 5 {
		// 超时不重试
		if apiErr.StatusCode == 504 || apiErr.StatusCode == 524 {
			return false
		}
		return true
	}

	if apiErr.StatusCode == http.StatusBadRequest {
		// 如果是culade 400错误，需要重试
		if channelType == config.ChannelTypeAnthropic && strings.Contains(apiErr.Message, "This organization has been disabled") {
			return true
		}
		return false
	}

	if apiErr.StatusCode == 408 {
		// azure处理超时不重试
		return false
	}

	if apiErr.StatusCode/100 == 2 {
		return false
	}
	return true
}

func processChannelRelayError(ctx context.Context, channelId int, channelName string, err *types.OpenAIErrorWithStatusCode, channelType int) {
	logger.LogError(ctx, fmt.Sprintf("relay error (channel #%d(%s)): %s", channelId, channelName, err.Message))
	if controller.ShouldDisableChannel(channelType, err) {
		controller.DisableChannel(channelId, channelName, err.Message, true)
	}
}

var (
	requestIdRegex = regexp.MustCompile(`\(request id: [^\)]+\)`)
	quotaKeywords  = []string{"余额", "额度", "quota", "无可用渠道", "令牌"}
)

func relayResponseWithErr(c *gin.Context, err *types.OpenAIErrorWithStatusCode) {
	statusCode := err.StatusCode
	// 如果message中已经包含 request id: 则不再添加
	if strings.Contains(err.Message, "(request id:") {
		err.Message = requestIdRegex.ReplaceAllString(err.Message, "")
	}

	requestId := c.GetString(logger.RequestIdKey)
	err.OpenAIError.Message = utils.MessageWithRequestId(err.OpenAIError.Message, requestId)

	switch err.OpenAIError.Type {
	case "new_api_error", "one_api_error", "shell_api_error":
		err.OpenAIError.Type = "system_error"
		if utils.ContainsString(err.Message, quotaKeywords) {
			err.Message = "上游负载已饱和，请稍后再试"
			statusCode = http.StatusTooManyRequests
		}
	}

	c.JSON(statusCode, gin.H{
		"error": err.OpenAIError,
	})
}

func relayRerankResponseWithErr(c *gin.Context, err *types.OpenAIErrorWithStatusCode) {
	// 如果message中已经包含 request id: 则不再添加
	if !strings.Contains(err.Message, "request id:") {
		requestId := c.GetString(logger.RequestIdKey)
		err.OpenAIError.Message = utils.MessageWithRequestId(err.OpenAIError.Message, requestId)
	}

	if err.OpenAIError.Type == "new_api_error" || err.OpenAIError.Type == "one_api_error" {
		err.OpenAIError.Type = "system_error"
	}

	c.JSON(err.StatusCode, gin.H{
		"detail": err.OpenAIError.Message,
	})
}
