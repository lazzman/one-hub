export const ProtocolKind = Object.freeze({
  RESPONSES: 'responses',
  OPENAI_CHAT: 'openai-chat',
  OPENAI_COMPATIBLE: 'openai-compatible',
  OPENAI_COMPLETIONS: 'openai-completions',
  OPENAI_EMBEDDINGS: 'openai-embeddings',
  OPENAI_IMAGES: 'openai-images',
  OPENAI_AUDIO: 'openai-audio',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  UNKNOWN: 'unknown'
});

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const detectProtocol = ({ payloadSource, requestParsed, responseParsed }) => {
  const hint = typeof payloadSource?.protocol_hint === 'string' ? payloadSource.protocol_hint.trim() : '';
  if (hint) return hint;

  if (Array.isArray(requestParsed?.input) || responseParsed?.object === 'response' || Array.isArray(responseParsed?.output)) {
    return ProtocolKind.RESPONSES;
  }
  if (Array.isArray(requestParsed?.messages) && requestParsed?.anthropic_version) {
    return ProtocolKind.CLAUDE;
  }
  if (Array.isArray(requestParsed?.contents) || Array.isArray(responseParsed?.candidates)) {
    return ProtocolKind.GEMINI;
  }
  if (Array.isArray(requestParsed?.messages) || Array.isArray(responseParsed?.choices)) {
    return ProtocolKind.OPENAI_CHAT;
  }
  if (isObject(responseParsed)) {
    return ProtocolKind.OPENAI_COMPATIBLE;
  }
  return ProtocolKind.UNKNOWN;
};
