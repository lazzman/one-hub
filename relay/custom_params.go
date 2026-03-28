package relay

import "strings"

func shouldApplyPreAddForJSONRequest(path string, requestMap map[string]interface{}) bool {
	if _, ok := requestMap["model"].(string); !ok {
		return false
	}

	return strings.HasPrefix(path, "/v1/chat/completions") ||
		strings.HasPrefix(path, "/v1/completions") ||
		strings.HasPrefix(path, "/v1/responses")
}
