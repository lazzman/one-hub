package relay

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/common/config"
	"one-api/common/logger"
	"one-api/common/utils"
	"one-api/metrics"
	"one-api/model"
	providersBase "one-api/providers/base"
	"one-api/relay/relay_util"
	"one-api/types"
	"time"

	"github.com/gin-gonic/gin"
)

var getProviderForPreMapping = GetProvider

func Relay(c *gin.Context) {
	relay := Path2Relay(c, c.Request.URL.Path)
	if relay == nil {
		common.AbortWithMessage(c, http.StatusNotFound, "Not Found")
		return
	}

	// Apply pre-mapping before setRequest to ensure request body modifications take effect
	applyPreMappingBeforeRequest(c)

	if err := relay.setRequest(); err != nil {
		openaiErr := common.StringErrorWrapperLocal(err.Error(), "one_hub_error", http.StatusBadRequest)
		relay.HandleJsonError(openaiErr)
		return
	}

	c.Set("is_stream", relay.IsStream())
	if err := relay.setProvider(relay.getOriginalModel()); err != nil {
		openaiErr := common.StringErrorWrapperLocal(err.Error(), "one_hub_error", http.StatusServiceUnavailable)
		relay.HandleJsonError(openaiErr)
		return
	}

	heartbeat := relay.SetHeartbeat(relay.IsStream())
	if heartbeat != nil {
		defer heartbeat.Close()
	}

	apiErr, done := RelayHandler(relay)
	if apiErr == nil {
		metrics.RecordProvider(c, 200)
		return
	}

	channel := relay.getProvider().GetChannel()
	go processChannelRelayError(c.Request.Context(), channel.Id, channel.Name, apiErr, channel.Type)

	retryTimes := config.RetryTimes
	if done || !shouldRetry(c, apiErr, channel.Type) {
		logger.LogError(c.Request.Context(), fmt.Sprintf("relay error happen, status code is %d, won't retry in this case", apiErr.StatusCode))
		retryTimes = 0
	}

	startTime := c.GetTime("requestStartTime")
	timeout := time.Duration(config.RetryTimeOut) * time.Second

	for i := retryTimes; i > 0; i-- {
		// 冻结通道
		shouldCooldowns(c, channel, apiErr)

		if time.Since(startTime) > timeout {
			apiErr = common.StringErrorWrapperLocal("重试超时，上游负载已饱和，请稍后再试", "system_error", http.StatusTooManyRequests)
			break
		}

		if err := relay.setProvider(relay.getOriginalModel()); err != nil {
			break
		}

		channel = relay.getProvider().GetChannel()
		logger.LogError(c.Request.Context(), fmt.Sprintf("using channel #%d(%s) to retry (remain times %d)", channel.Id, channel.Name, i))
		apiErr, done = RelayHandler(relay)
		if apiErr == nil {
			metrics.RecordProvider(c, 200)
			return
		}
		go processChannelRelayError(c.Request.Context(), channel.Id, channel.Name, apiErr, channel.Type)
		if done || !shouldRetry(c, apiErr, channel.Type) {
			break
		}
	}

	if apiErr != nil {
		if heartbeat != nil && heartbeat.IsSafeWriteStream() {
			relay.HandleStreamError(apiErr)
			return
		}

		relay.HandleJsonError(apiErr)
	}
}

func RelayHandler(relay RelayBaseInterface) (err *types.OpenAIErrorWithStatusCode, done bool) {
	promptTokens, tonkeErr := relay.getPromptTokens()
	if tonkeErr != nil {
		err = common.ErrorWrapperLocal(tonkeErr, "token_error", http.StatusBadRequest)
		done = true
		return
	}

	usage := &types.Usage{
		PromptTokens: promptTokens,
	}

	relay.getProvider().SetUsage(usage)

	quota := relay_util.NewQuota(relay.getContext(), relay.getModelName(), promptTokens)
	if err = quota.PreQuotaConsumption(); err != nil {
		done = true
		return
	}

	err, done = relay.send()
	// 最后处理流式中断时计算tokens
	if usage.CompletionTokens == 0 && usage.TextBuilder.Len() > 0 {
		usage.CompletionTokens = common.CountTokenText(usage.TextBuilder.String(), relay.getModelName())
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	if err != nil {
		quota.Undo(relay.getContext())
		return
	}

	quota.SetFirstResponseTime(relay.GetFirstResponseTime())

	quota.Consume(relay.getContext(), usage, relay.IsStream())

	return
}

func shouldCooldowns(c *gin.Context, channel *model.Channel, apiErr *types.OpenAIErrorWithStatusCode) {
	modelName := c.GetString("new_model")
	channelId := channel.Id

	// 如果是频率限制，冻结通道
	if apiErr.StatusCode == http.StatusTooManyRequests {
		model.ChannelGroup.SetCooldowns(channelId, modelName)
	}

	skipChannelIds, ok := utils.GetGinValue[[]int](c, "skip_channel_ids")
	if !ok {
		skipChannelIds = make([]int, 0)
	}

	skipChannelIds = append(skipChannelIds, channelId)

	c.Set("skip_channel_ids", skipChannelIds)
}

// applies pre-mapping before setRequest to ensure modifications take effect
func applyPreMappingBeforeRequest(c *gin.Context) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return
	}
	c.Request.Body.Close()

	finalBodyBytes := bodyBytes
	defer func() {
		c.Request.Body = io.NopCloser(bytes.NewBuffer(finalBodyBytes))
	}()

	var requestMap map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &requestMap); err != nil {
		return
	}
	if !shouldApplyPreAddForJSONRequest(c.Request.URL.Path, requestMap) {
		return
	}

	originalBody := c.Request.Body
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	defer func() {
		c.Request.Body = originalBody
	}()

	modelName, _ := requestMap["model"].(string)
	provider, _, err := getProviderForPreMapping(c, modelName)
	if err != nil {
		return
	}

	applyPreMappingBeforeRequestWithProvider(c, provider)
	if modifiedBodyBytes, err := io.ReadAll(c.Request.Body); err == nil {
		finalBodyBytes = modifiedBodyBytes
	}
}

func applyPreMappingBeforeRequestWithProvider(c *gin.Context, provider providersBase.ProviderInterface) {
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return
	}
	c.Request.Body.Close()

	finalBodyBytes := bodyBytes
	defer func() {
		c.Request.Body = io.NopCloser(bytes.NewBuffer(finalBodyBytes))
	}()

	customParams, err := provider.CustomParameterHandler()
	if err != nil || customParams == nil {
		return
	}

	preAdd, exists := customParams["pre_add"]
	if !exists || preAdd != true {
		return
	}

	var requestMap map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &requestMap); err != nil {
		return
	}
	if !shouldApplyPreAddForJSONRequest(c.Request.URL.Path, requestMap) {
		return
	}

	modifiedRequestMap := mergeCustomParamsForPreMapping(requestMap, customParams)
	if modifiedBodyBytes, err := json.Marshal(modifiedRequestMap); err == nil {
		finalBodyBytes = modifiedBodyBytes
	}
}
