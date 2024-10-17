export const DEFAULT_FLAGS = {
  payloadParsed: false,
  requestParsed: false,
  responseParsed: false,
  parseFailed: false,
  usedFallback: false
};

export const createDefaultPreviewModel = () => ({
  source: {
    protocol: 'unknown',
    protocolHint: 'unknown',
    provider: 'unknown',
    channelType: 0,
    channelName: '',
    endpointPath: '',
    isStream: false
  },
  flags: {
    ...DEFAULT_FLAGS
  },
  raw: {
    payload: '',
    request: '',
    response: ''
  },
  request: {
    raw: '',
    parsed: null,
    summary: {},
    normalized: null,
    convertTargets: [],
    bytes: 0
  },
  conversation: [],
  response: {
    type: '',
    raw: '',
    parsed: null,
    finalText: '',
    bytes: 0,
    rawOnly: false
  },
  tools: [],
  reasoning: [],
  media: [],
  trace: [],
  capabilities: {
    request: false,
    conversation: false,
    finalAnswer: false,
    reasoning: false,
    tools: false,
    media: false,
    trace: false,
    rawResponse: false
  }
});

export const createUnknownPreviewModel = (payload = '') => ({
  ...createDefaultPreviewModel(),
  raw: {
    payload,
    request: '',
    response: payload
  },
  flags: {
    ...DEFAULT_FLAGS,
    parseFailed: true,
    usedFallback: true
  },
  response: {
    type: 'unknown',
    raw: payload,
    parsed: null,
    finalText: typeof payload === 'string' ? payload : '',
    bytes: typeof payload === 'string' ? payload.length : 0,
    rawOnly: true
  },
  capabilities: {
    request: false,
    conversation: false,
    finalAnswer: Boolean(payload),
    reasoning: false,
    tools: false,
    media: false,
    trace: false,
    rawResponse: Boolean(payload)
  }
});

export const createRawOnlyPreviewModel = (payload, parsedPayload = null) => ({
  ...createDefaultPreviewModel(),
  raw: {
    payload,
    request: parsedPayload?.request?.raw || '',
    response: parsedPayload?.response?.raw || payload
  },
  source: {
    ...createDefaultPreviewModel().source,
    protocol: parsedPayload?.source?.protocol_hint || 'unknown',
    protocolHint: parsedPayload?.source?.protocol_hint || 'unknown',
    provider: parsedPayload?.source?.provider || 'unknown',
    channelType: parsedPayload?.source?.channel_type || 0,
    channelName: parsedPayload?.source?.channel_name || '',
    endpointPath: parsedPayload?.source?.endpoint_path || '',
    isStream: Boolean(parsedPayload?.source?.is_stream)
  },
  flags: {
    ...DEFAULT_FLAGS,
    payloadParsed: Boolean(parsedPayload),
    requestParsed: Boolean(parsedPayload?.request?.parsed),
    responseParsed: Boolean(parsedPayload?.response?.parsed),
    usedFallback: true
  },
  request: {
    ...createDefaultPreviewModel().request,
    raw: parsedPayload?.request?.raw || '',
    parsed: parsedPayload?.request?.parsed ?? null,
    bytes: parsedPayload?.request?.bytes || 0
  },
  response: {
    type: parsedPayload?.response?.type || 'unknown',
    raw: parsedPayload?.response?.raw || payload,
    parsed: parsedPayload?.response?.parsed ?? null,
    finalText: parsedPayload?.response?.raw || payload,
    bytes: parsedPayload?.response?.bytes || (typeof payload === 'string' ? payload.length : 0),
    rawOnly: true
  },
  capabilities: {
    request: Boolean(parsedPayload?.request?.raw),
    conversation: false,
    finalAnswer: Boolean(parsedPayload?.response?.raw || payload),
    reasoning: false,
    tools: false,
    media: false,
    trace: false,
    rawResponse: Boolean(parsedPayload?.response?.raw || payload)
  }
});
