export const fallbackTextAdapter = {
  id: 'fallback-text',
  match: () => 1,
  build: ({ previewModel, parsedPayload }) => {
    const finalText = parsedPayload.response.raw || parsedPayload.rawPayload || '';
    return {
      ...previewModel,
      flags: {
        ...previewModel.flags,
        usedFallback: true,
        parseFailed: !parsedPayload.response.parsed
      },
      response: {
        ...previewModel.response,
        finalText,
        rawOnly: true
      },
      capabilities: {
        ...previewModel.capabilities,
        request: Boolean(previewModel.request.raw),
        finalAnswer: Boolean(finalText),
        rawResponse: Boolean(finalText)
      }
    };
  }
};
