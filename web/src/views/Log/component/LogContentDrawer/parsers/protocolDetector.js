/**
 * 协议检测器
 * 负责在原始日志解析后识别具体协议类型
 */

export const ProtocolKind = Object.freeze({
  RESPONSES: 'responses',
  OPENAI_CHAT: 'openai-chat',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  UNKNOWN: 'unknown'
});

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const hasArray = (obj, key) => isObject(obj) && Array.isArray(obj[key]);

const looksLikeGeminiRequest = (requestParsed) => {
  if (!isObject(requestParsed)) return false;
  return Array.isArray(requestParsed.contents) || requestParsed.systemInstruction !== undefined;
};

const looksLikeClaudeRequest = (requestParsed) => {
  if (!isObject(requestParsed)) return false;

  if (requestParsed.anthropic_version !== undefined) return true;

  if (!Array.isArray(requestParsed.messages)) return false;
  if (requestParsed.system !== undefined) return true;

  const firstMessage = requestParsed.messages[0];
  if (!isObject(firstMessage)) return false;

  if (Array.isArray(firstMessage.content)) {
    return firstMessage.content.some((item) => isObject(item) && typeof item.type === 'string');
  }

  return false;
};

const looksLikeOpenAIResponsesRequest = (requestParsed) => {
  if (!isObject(requestParsed)) return false;

  // Responses API 常见字段：input/instructions/tools/max_output_tokens/previous_response_id
  if (requestParsed.input !== undefined) return true;
  if (requestParsed.instructions !== undefined) return true;
  if (requestParsed.previous_response_id !== undefined) return true;
  if (requestParsed.max_output_tokens !== undefined) return true;

  return false;
};

const looksLikeOpenAIChatRequest = (requestParsed) => {
  if (!isObject(requestParsed)) return false;
  return Array.isArray(requestParsed.messages);
};

const looksLikeGeminiResponse = (responseParsed) => {
  if (!isObject(responseParsed)) return false;
  return Array.isArray(responseParsed.candidates) || responseParsed.promptFeedback !== undefined;
};

const looksLikeClaudeResponse = (responseParsed) => {
  if (!isObject(responseParsed)) return false;
  if (Array.isArray(responseParsed.content) && responseParsed.stop_reason !== undefined) return true;
  if (responseParsed.type === 'message' && Array.isArray(responseParsed.content)) return true;
  return false;
};

const looksLikeOpenAIResponsesResponse = (responseParsed) => {
  if (!isObject(responseParsed)) return false;

  if (responseParsed.object === 'response') return true;
  if (Array.isArray(responseParsed.output)) return true;
  if (responseParsed.output_text !== undefined) return true;

  return false;
};

const looksLikeOpenAIChatResponse = (responseParsed) => {
  if (!isObject(responseParsed)) return false;
  return hasArray(responseParsed, 'choices');
};

const detectFromEvents = (events) => {
  if (!Array.isArray(events) || events.length === 0) {
    return ProtocolKind.UNKNOWN;
  }

  const eventNames = events.map((eventItem) => eventItem?.event).filter(Boolean);
  const eventTypes = events
    .map((eventItem) => eventItem?.parsed?.type)
    .filter((type) => typeof type === 'string');

  // OpenAI Responses 流式事件
  if (eventTypes.some((type) => type.startsWith('response.'))) {
    return ProtocolKind.RESPONSES;
  }

  // Claude SSE 常见事件名
  if (eventNames.some((name) => ['message_start', 'content_block_start', 'content_block_delta', 'message_delta', 'message_stop'].includes(name))) {
    return ProtocolKind.CLAUDE;
  }

  // OpenAI Chat Completion stream: data 中常见 choices 字段
  if (events.some((eventItem) => isObject(eventItem?.parsed) && Array.isArray(eventItem.parsed.choices))) {
    return ProtocolKind.OPENAI_CHAT;
  }

  return ProtocolKind.UNKNOWN;
};

/**
 * 检测协议类型
 * @param {Object} params
 * @param {any} params.requestParsed
 * @param {any} params.responseParsed
 * @param {Array} params.events
 * @returns {string}
 */
export const detectProtocol = ({ requestParsed, responseParsed, events }) => {
  if (looksLikeGeminiRequest(requestParsed)) return ProtocolKind.GEMINI;
  if (looksLikeClaudeRequest(requestParsed)) return ProtocolKind.CLAUDE;
  if (looksLikeOpenAIResponsesRequest(requestParsed)) return ProtocolKind.RESPONSES;
  if (looksLikeOpenAIChatRequest(requestParsed)) return ProtocolKind.OPENAI_CHAT;

  if (looksLikeGeminiResponse(responseParsed)) return ProtocolKind.GEMINI;
  if (looksLikeClaudeResponse(responseParsed)) return ProtocolKind.CLAUDE;
  if (looksLikeOpenAIResponsesResponse(responseParsed)) return ProtocolKind.RESPONSES;
  if (looksLikeOpenAIChatResponse(responseParsed)) return ProtocolKind.OPENAI_CHAT;

  const protocolFromEvents = detectFromEvents(events);
  if (protocolFromEvents !== ProtocolKind.UNKNOWN) {
    return protocolFromEvents;
  }

  return ProtocolKind.UNKNOWN;
};
