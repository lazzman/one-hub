import { createCollector, collectOpenAIChatResponse, extractAssistantTextFromCollector, collectFromSSEEvents } from '../normalizers';

export const openAICompatibleAdapter = {
  id: 'openai-compatible',
  match: ({ previewModel, scoreByProtocol, parsedPayload }) => {
    if (Array.isArray(parsedPayload.response.parsed?.choices)) {
      return Math.max(scoreByProtocol('openai-compatible', previewModel.source.protocol), 85);
    }
    return scoreByProtocol('openai-compatible', previewModel.source.protocol);
  },
  build: ({ previewModel, parsedPayload }) => {
    const collector = createCollector();
    collectOpenAIChatResponse(parsedPayload.response.parsed, collector);
    collectFromSSEEvents(parsedPayload.events, collector);
    const finalText = extractAssistantTextFromCollector(collector);

    return {
      ...previewModel,
      source: {
        ...previewModel.source,
        protocol: 'openai-compatible'
      },
      response: {
        ...previewModel.response,
        finalText
      },
      tools: collector.toolCalls,
      reasoning: collector.reasoning,
      media: collector.media,
      capabilities: {
        ...previewModel.capabilities,
        conversation: previewModel.conversation.length > 0,
        finalAnswer: Boolean(finalText),
        reasoning: collector.reasoning.length > 0,
        tools: collector.toolCalls.length > 0,
        media: collector.media.length > 0,
        rawResponse: true
      }
    };
  }
};
