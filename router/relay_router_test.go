package router

import (
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestSetOpenAIRouterRegistersResponsesCompactRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)

	engine := gin.New()
	setOpenAIRouter(engine)

	var hasResponses bool
	var hasResponsesCompact bool
	for _, route := range engine.Routes() {
		if route.Method == "POST" && route.Path == "/v1/responses" {
			hasResponses = true
		}
		if route.Method == "POST" && route.Path == "/v1/responses/compact" {
			hasResponsesCompact = true
		}
	}

	assert.True(t, hasResponses)
	assert.True(t, hasResponsesCompact)
}
