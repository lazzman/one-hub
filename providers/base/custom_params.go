package base

const (
	CustomParamsPhasePreAdd = "pre_add"
	CustomParamsPhaseSend   = "send"
)

func SelectCustomParamsForPhase(customParams map[string]interface{}, phase string, originalModel string, mappedModel string) map[string]interface{} {
	perModel, _ := customParams["per_model"].(bool)
	if !perModel {
		return customParams
	}

	var key string
	if phase == CustomParamsPhasePreAdd {
		key = originalModel
	} else {
		key = mappedModel
	}

	if key == "" {
		return map[string]interface{}{}
	}

	value, exists := customParams[key]
	if !exists {
		return map[string]interface{}{}
	}

	modelConfig, ok := value.(map[string]interface{})
	if !ok {
		return map[string]interface{}{}
	}

	return modelConfig
}

func MergeSelectedCustomParams(requestMap map[string]interface{}, selected map[string]interface{}, overwrite bool) map[string]interface{} {
	for key, value := range selected {
		if key == "stream" || key == "overwrite" || key == "per_model" || key == "pre_add" {
			continue
		}
		if overwrite {
			requestMap[key] = value
			continue
		}
		if _, exists := requestMap[key]; !exists {
			requestMap[key] = value
		}
	}
	return requestMap
}

func GetCustomParamsOverwrite(customParams map[string]interface{}) bool {
	overwrite, _ := customParams["overwrite"].(bool)
	return overwrite
}
