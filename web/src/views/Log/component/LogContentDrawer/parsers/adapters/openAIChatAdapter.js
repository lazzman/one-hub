import { createCollector, collectOpenAIChatResponse, extractAssistantTextFromCollector, collectFromSSEEvents } from '../normalizers';

export const openAIChatAdapter = {
  id: 'openai-chat',
  match: ({ previewModel, scoreByProtocol, parsedPayload }) => {
    if (Array.isArray(parsedPayload.response.parsed?.choices)) {
      return Math.max(scoreByProtocol('openai-chat', previewModel.source.protocol), 90);
    }
    return scoreByProtocol('openai-chat', previewModel.source.protocol);
  },
  build: ({ previewModel, parsedPayload }) => {
    const collector = createCollector();
    collectOpenAIChatResponse(parsedPayload.response.parsed, collector);
    collectFromSSEEvents(parsedPayload.events, collector);
    const finalText = extractAssistantTextFromCollector(collector);

    return {
      ...previewModel,
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
