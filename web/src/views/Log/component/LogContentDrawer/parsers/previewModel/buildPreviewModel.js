import { createDefaultPreviewModel, createRawOnlyPreviewModel } from './defaultModel';
import { resolveProviderName, resolveProtocolName } from '../providerMapping';
import { pickPreviewAdapter } from '../adapters';
import { extractRequestConversationMessages } from '../normalizers';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const buildRequestSummary = (requestParsed) => {
  if (!isObject(requestParsed)) return {};
  const summary = {};
  ['model', 'stream', 'temperature', 'max_tokens', 'max_output_tokens', 'top_p', 'top_k'].forEach((key) => {
    if (requestParsed[key] !== undefined) summary[key] = requestParsed[key];
  });
  return summary;
};

const buildConvertTargets = (protocol) => {
  switch (protocol) {
    case 'claude':
      return ['claude', 'openai', 'gemini'];
    case 'gemini':
      return ['gemini', 'openai', 'claude'];
    case 'responses':
      return ['responses', 'openai', 'claude', 'gemini'];
    case 'openai-chat':
    case 'openai-compatible':
      return ['openai', 'responses', 'claude', 'gemini'];
    default:
      return [];
  }
};

export const buildPreviewModel = (parsedPayload) => {
  if (!parsedPayload?.ok || !parsedPayload.payload) {
    return createRawOnlyPreviewModel(parsedPayload?.rawPayload || '', parsedPayload?.payload || null);
  }

  const payload = parsedPayload.payload;
  const protocol = resolveProtocolName(payload.source || {});
  const provider = resolveProviderName(payload.source || {});

  const baseModel = createDefaultPreviewModel();
  const previewModel = {
    ...baseModel,
    source: {
      protocol,
      protocolHint: protocol,
      provider,
      channelType: payload?.source?.channel_type || 0,
      channelName: payload?.source?.channel_name || '',
      endpointPath: payload?.source?.endpoint_path || '',
      isStream: Boolean(payload?.source?.is_stream)
    },
    flags: {
      payloadParsed: true,
      requestParsed: parsedPayload.request.parsed !== null,
      responseParsed: parsedPayload.response.parsed !== null,
      parseFailed: false,
      usedFallback: false
    },
    raw: {
      payload: parsedPayload.rawPayload,
      request: parsedPayload.request.raw,
      response: parsedPayload.response.raw
    },
    request: {
      raw: parsedPayload.request.raw,
      parsed: parsedPayload.request.parsed,
      summary: buildRequestSummary(parsedPayload.request.parsed),
      normalized: parsedPayload.request.parsed,
      convertTargets: buildConvertTargets(protocol),
      bytes: parsedPayload.request.bytes
    },
    conversation: extractRequestConversationMessages({ requestParsed: parsedPayload.request.parsed, protocol }),
    response: {
      type: parsedPayload.response.type || 'unknown',
      raw: parsedPayload.response.raw,
      parsed: parsedPayload.response.parsed,
      finalText: '',
      bytes: parsedPayload.response.bytes,
      rawOnly: false
    },
    tools: [],
    reasoning: [],
    media: [],
    trace: [],
    capabilities: {
      ...baseModel.capabilities,
      request: Boolean(parsedPayload.request.raw),
      conversation: false,
      rawResponse: Boolean(parsedPayload.response.raw)
    }
  };

  const adapter = pickPreviewAdapter({ previewModel, parsedPayload });
  if (!adapter) {
    return createRawOnlyPreviewModel(parsedPayload.rawPayload, payload);
  }

  return adapter.build({ previewModel, parsedPayload }) || previewModel;
};
