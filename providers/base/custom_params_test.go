package base

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSelectCustomParamsForPhase_PreAddUsesOriginalModel(t *testing.T) {
	params := map[string]interface{}{
		"per_model":    true,
		"alias-model":  map[string]interface{}{"service_tier": "priority"},
		"mapped-model": map[string]interface{}{"service_tier": "flex"},
	}

	selected := SelectCustomParamsForPhase(params, CustomParamsPhasePreAdd, "alias-model", "mapped-model")
	assert.Equal(t, map[string]interface{}{"service_tier": "priority"}, selected)
}

func TestSelectCustomParamsForPhase_SendUsesMappedModel(t *testing.T) {
	params := map[string]interface{}{
		"per_model":    true,
		"alias-model":  map[string]interface{}{"service_tier": "priority"},
		"mapped-model": map[string]interface{}{"service_tier": "flex"},
	}

	selected := SelectCustomParamsForPhase(params, CustomParamsPhaseSend, "alias-model", "mapped-model")
	assert.Equal(t, map[string]interface{}{"service_tier": "flex"}, selected)
}

func TestMergeSelectedCustomParams_SkipsControlKeys(t *testing.T) {
	requestMap := map[string]interface{}{"model": "alias-model"}
	selected := map[string]interface{}{
		"stream":       true,
		"pre_add":      true,
		"per_model":    true,
		"overwrite":    true,
		"service_tier": "priority",
	}

	merged := MergeSelectedCustomParams(requestMap, selected, true)
	assert.Equal(t, "priority", merged["service_tier"])

	for _, key := range []string{"stream", "overwrite", "per_model", "pre_add"} {
		_, exists := merged[key]
		assert.False(t, exists, "%s 不应注入请求体", key)
	}
}
