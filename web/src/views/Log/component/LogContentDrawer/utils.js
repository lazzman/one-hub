/**
 * 工具函数模块
 * 包含 debounce 和内容解析相关函数
 */

import { createEmptyParsedModel, parseRawLogContent, ProtocolKind } from './parsers/rawLogParser';

/**
 * 请求格式枚举
 */
export const RequestFormat = {
  OPENAI: 'openai',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  UNKNOWN: 'unknown'
};

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * 检测请求格式
 * @param {Object} requestJson - 原始请求 JSON
 * @returns {string} 请求格式类型
 */
export const detectRequestFormat = (requestJson) => {
  if (!requestJson || typeof requestJson !== 'object') {
    return RequestFormat.UNKNOWN;
  }

  // Gemini 格式：有 contents 数组或 systemInstruction
  if (Array.isArray(requestJson.contents) || requestJson.systemInstruction !== undefined) {
    return RequestFormat.GEMINI;
  }

  // Claude 格式：有顶层 system 字段（字符串或数组）且有 messages
  // 注意：Claude 的 system 是顶层字段，不在 messages 里
  if (requestJson.system !== undefined && Array.isArray(requestJson.messages)) {
    // 进一步检查 messages 内容格式是否符合 Claude（content 是数组且包含 type 字段）
    const firstMsg = requestJson.messages[0];
    if (firstMsg && Array.isArray(firstMsg.content)) {
      const firstContent = firstMsg.content[0];
      if (firstContent && typeof firstContent === 'object' && firstContent.type) {
        return RequestFormat.CLAUDE;
      }
    }
    // 即使 content 是字符串，有顶层 system 也认为是 Claude
    return RequestFormat.CLAUDE;
  }

  // OpenAI 格式：有 messages 数组
  if (Array.isArray(requestJson.messages)) {
    return RequestFormat.OPENAI;
  }

  return RequestFormat.UNKNOWN;
};

/**
 * 解析内容项（用于 UI 展示）
 * @param {Object|string} item - 内容项
 * @returns {Object} 解析后的内容项
 */
export const parseContentItem = (item) => {
  if (typeof item === 'string') {
    return { type: 'text', text: item.trim() };
  } else if (item.type === 'text') {
    return { type: 'text', text: (item.text || '').trim() };
  } else if (item.type === 'image_url') {
    return { type: 'image', url: item.image_url?.url || item.url };
  } else if (item.type === 'image') {
    // Claude 图片格式
    if (item.source?.type === 'base64') {
      return { type: 'image', url: `data:${item.source.media_type};base64,${item.source.data}`, isBase64: true };
    } else if (item.source?.type === 'url') {
      return { type: 'image', url: item.source.url };
    }
  }
  return { type: 'text', text: JSON.stringify(item) };
};

/**
 * 解析 Gemini parts 为统一内容格式
 * @param {Array} parts - Gemini parts 数组
 * @returns {Array} 统一格式的内容数组
 */
export const parseGeminiParts = (parts) => {
  if (!Array.isArray(parts)) return [];
  return parts.map((part) => {
    if (part.text !== undefined) {
      return { type: 'text', text: part.text };
    } else if (part.inlineData) {
      return {
        type: 'image',
        url: `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`,
        isBase64: true,
        mimeType: part.inlineData.mimeType
      };
    } else if (part.fileData) {
      return { type: 'image', url: part.fileData.fileUri, mimeType: part.fileData.mimeType };
    } else if (part.functionCall) {
      return { type: 'function_call', functionCall: part.functionCall };
    } else if (part.functionResponse) {
      return { type: 'function_response', functionResponse: part.functionResponse };
    }
    return { type: 'text', text: JSON.stringify(part) };
  });
};

/**
 * 解析 Claude content blocks 为统一内容格式
 * @param {Array|string} content - Claude content
 * @returns {Array} 统一格式的内容数组
 */
export const parseClaudeContent = (content) => {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  if (!Array.isArray(content)) return [];
  return content.map((item) => {
    if (item.type === 'text') {
      return { type: 'text', text: item.text || '' };
    } else if (item.type === 'image') {
      if (item.source?.type === 'base64') {
        return {
          type: 'image',
          url: `data:${item.source.media_type};base64,${item.source.data}`,
          isBase64: true,
          mimeType: item.source.media_type
        };
      } else if (item.source?.type === 'url') {
        return { type: 'image', url: item.source.url };
      }
    } else if (item.type === 'tool_use') {
      return { type: 'tool_use', toolUse: item };
    } else if (item.type === 'tool_result') {
      return { type: 'tool_result', toolResult: item };
    }
    return { type: 'text', text: JSON.stringify(item) };
  });
};

/**
 * 解析消息（用于 UI 展示）
 * @param {Object} message - 消息对象
 * @returns {Object} 解析后的消息
 */
export const parseMessage = (message) => {
  const { role, content } = message;
  const parsedContent = Array.isArray(content) ? content.map(parseContentItem) : [{ type: 'text', text: content?.trim() || '' }];

  return {
    role,
    content: parsedContent
  };
};

/**
 * 归一化请求结构
 * 将 OpenAI/Claude/Gemini 格式统一为内部规范结构
 * @param {Object} requestJson - 原始请求 JSON
 * @returns {Object} 归一化后的请求结构
 */
export const normalizeRequest = (requestJson) => {
  const format = detectRequestFormat(requestJson);

  const normalized = {
    format,
    model: null,
    systemText: null,
    messages: [],
    params: {},
    tools: null,
    toolChoice: null,
    rawRequest: requestJson
  };

  switch (format) {
    case RequestFormat.OPENAI:
      return normalizeFromOpenAI(requestJson, normalized);
    case RequestFormat.CLAUDE:
      return normalizeFromClaude(requestJson, normalized);
    case RequestFormat.GEMINI:
      return normalizeFromGemini(requestJson, normalized);
    default:
      // 尝试按 OpenAI 格式解析
      if (requestJson.messages) {
        return normalizeFromOpenAI(requestJson, normalized);
      }
      return normalized;
  }
};

/**
 * 从 OpenAI 格式归一化
 */
const normalizeFromOpenAI = (requestJson, normalized) => {
  const { messages = [], model, tools, tool_choice, ...otherParams } = requestJson;

  normalized.model = model;
  normalized.tools = tools;
  normalized.toolChoice = tool_choice;

  // 提取常用参数
  const paramKeys = [
    'temperature',
    'max_tokens',
    'top_p',
    'stream',
    'frequency_penalty',
    'presence_penalty',
    'seed',
    'response_format',
    'stop',
    'n',
    'logprobs',
    'top_logprobs'
  ];
  paramKeys.forEach((key) => {
    if (otherParams[key] !== undefined) {
      normalized.params[key] = otherParams[key];
    }
  });

  // 处理 messages，提取 system
  messages.forEach((msg) => {
    if (msg.role === 'system') {
      // 合并多个 system 消息
      const text = typeof msg.content === 'string' ? msg.content : msg.content?.map((c) => c.text || '').join('\n');
      normalized.systemText = normalized.systemText ? `${normalized.systemText}\n${text}` : text;
    }
    // 所有消息都保留（包括 system），用于 UI 展示
    normalized.messages.push({
      role: msg.role,
      content: normalizeOpenAIContent(msg.content),
      toolCalls: msg.tool_calls,
      toolCallId: msg.tool_call_id,
      name: msg.name
    });
  });

  return normalized;
};

/**
 * 归一化 OpenAI content
 */
const normalizeOpenAIContent = (content) => {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }
  if (!Array.isArray(content)) {
    return [{ type: 'text', text: String(content || '') }];
  }
  return content.map((item) => {
    if (typeof item === 'string') {
      return { type: 'text', text: item };
    }
    if (item.type === 'text') {
      return { type: 'text', text: item.text || '' };
    }
    if (item.type === 'image_url') {
      const url = item.image_url?.url || '';
      const isBase64 = url.startsWith('data:');
      return { type: 'image', url, isBase64, detail: item.image_url?.detail };
    }
    if (item.type === 'input_audio') {
      return { type: 'audio', audio: item.input_audio };
    }
    return item;
  });
};

/**
 * 从 Claude 格式归一化
 */
const normalizeFromClaude = (requestJson, normalized) => {
  const { messages = [], model, system, tools, tool_choice, ...otherParams } = requestJson;

  normalized.model = model;
  normalized.tools = tools;
  normalized.toolChoice = tool_choice;

  // 处理顶层 system（Claude 特有）
  if (system !== undefined) {
    if (typeof system === 'string') {
      normalized.systemText = system;
    } else if (Array.isArray(system)) {
      // Claude 的 system 可以是 content blocks 数组
      normalized.systemText = system.map((item) => (typeof item === 'string' ? item : item.text || '')).join('\n');
    }
  }

  // 提取常用参数
  const paramKeys = ['temperature', 'max_tokens', 'top_p', 'top_k', 'stream', 'stop_sequences', 'metadata'];
  paramKeys.forEach((key) => {
    if (otherParams[key] !== undefined) {
      normalized.params[key] = otherParams[key];
    }
  });

  // 处理 messages
  messages.forEach((msg) => {
    normalized.messages.push({
      role: msg.role,
      content: parseClaudeContent(msg.content)
    });
  });

  return normalized;
};

/**
 * 从 Gemini 格式归一化
 */
const normalizeFromGemini = (requestJson, normalized) => {
  const { contents = [], systemInstruction, generationConfig, tools, toolConfig, model } = requestJson;

  normalized.model = model;
  normalized.tools = tools;
  normalized.toolChoice = toolConfig;

  // 处理 systemInstruction
  if (systemInstruction) {
    if (typeof systemInstruction === 'string') {
      normalized.systemText = systemInstruction;
    } else if (systemInstruction.parts) {
      normalized.systemText = systemInstruction.parts.map((p) => p.text || '').join('\n');
    }
  }

  // 处理 generationConfig
  if (generationConfig) {
    if (generationConfig.temperature !== undefined) normalized.params.temperature = generationConfig.temperature;
    if (generationConfig.maxOutputTokens !== undefined) normalized.params.max_tokens = generationConfig.maxOutputTokens;
    if (generationConfig.topP !== undefined) normalized.params.top_p = generationConfig.topP;
    if (generationConfig.topK !== undefined) normalized.params.top_k = generationConfig.topK;
    if (generationConfig.stopSequences !== undefined) normalized.params.stop = generationConfig.stopSequences;
    // 保留原始 generationConfig 以便转换回 Gemini 格式
    normalized.params._generationConfig = generationConfig;
  }

  // 处理 contents
  contents.forEach((content) => {
    const role = content.role === 'model' ? 'assistant' : content.role || 'user';
    normalized.messages.push({
      role,
      content: parseGeminiParts(content.parts)
    });
  });

  return normalized;
};

/**
 * 提取请求和响应部分
 * @param {string} content - 原始内容
 * @returns {Array} [请求部分, 响应部分]
 */
export const extractRequestAndResponse = (content) => {
  const lastIndex = content.lastIndexOf('【Response Body】:');

  // 如果找不到响应体标记，则将所有内容作为请求部分
  if (lastIndex === -1) {
    return [content, '[{"type": "text", "text": ""}]'];
  }

  const requestPart = content.substring(0, lastIndex);
  const responsePart = content.substring(lastIndex + '【Response Body】:'.length);

  // 如果响应部分为空，也返回空的JSON对象字符串
  return [requestPart, responsePart.trim() || '[{"type": "text", "text": ""}]'];
};

/**
 * 解析请求体
 * @param {string} requestPart - 请求部分字符串
 * @returns {Object} 解析后的请求体
 */
export const parseRequestBody = (requestPart) => {
  const match = requestPart.match(/【Request Body】:([\s\S]*)/);
  if (!match?.[1]?.trim()) {
    throw new Error('无法找到请求体内容');
  }

  try {
    return JSON.parse(match[1].trim());
  } catch {
    throw new Error('请求体内容不是有效的JSON格式');
  }
};

/**
 * 解析响应体
 * @param {string} responsePart - 响应部分字符串
 * @returns {Object|string} 解析后的响应体
 */
export const parseResponseBody = (responsePart) => {
  const trimmed = responsePart?.trim?.() || '';
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed);

    // 如果响应数据包含 type 和 content 字段（如 stream 类型的响应），
    // 直接提取并返回 content 的内容，跳过外层包装
    if (parsed && typeof parsed === 'object' && 'type' in parsed && 'content' in parsed) {
      return parsed.content;
    }

    return parsed;
  } catch {
    // 降级返回原文，避免抛错影响外层流程
    return trimmed;
  }
};

/**
 * 提取响应体内容（处理 type/content 包装）
 * @param {string} responsePart - 响应部分字符串
 * @returns {string} 提取后的响应体字符串
 */
export const extractResponseContent = (responsePart) => {
  try {
    const parsed = JSON.parse(responsePart.trim());

    // 如果响应数据包含 type 和 content 字段（如 stream 类型的响应），
    // 直接提取 content 的内容，跳过外层包装
    if (parsed && typeof parsed === 'object' && 'type' in parsed && 'content' in parsed) {
      return JSON.stringify(parsed.content, null, 2);
    }

    return responsePart.trim();
  } catch {
    return responsePart.trim();
  }
};

/**
 * 将协议类型映射为旧版 RequestFormat
 * @param {string} protocol
 * @returns {string}
 */
const mapProtocolToRequestFormat = (protocol) => {
  if (protocol === ProtocolKind.CLAUDE) return RequestFormat.CLAUDE;
  if (protocol === ProtocolKind.GEMINI) return RequestFormat.GEMINI;
  if (protocol === ProtocolKind.OPENAI_CHAT || protocol === ProtocolKind.RESPONSES) return RequestFormat.OPENAI;
  return RequestFormat.UNKNOWN;
};

/**
 * 创建兜底 normalized 结构
 * @param {string} protocol
 * @param {Object} rawRequest
 * @returns {Object}
 */
const createNormalizedFallback = (protocol, rawRequest = {}) => ({
  format: mapProtocolToRequestFormat(protocol),
  model: null,
  systemText: null,
  messages: [],
  params: {},
  tools: null,
  toolChoice: null,
  rawRequest: rawRequest && typeof rawRequest === 'object' ? rawRequest : {}
});

/**
 * 创建空解析结果（兼容旧 UI + 提供新统一模型）
 * @returns {Object}
 */
const createEmptyParseResult = () => {
  const empty = createEmptyParsedModel();
  const viewModel = {
    protocol: empty.protocol || ProtocolKind.UNKNOWN,
    request: { raw: empty.request.raw || '', parsed: empty.request.parsed ?? null },
    response: { raw: empty.response.raw || '', parsed: empty.response.parsed ?? null },
    events: Array.isArray(empty.events) ? empty.events : [],
    messages: Array.isArray(empty.messages) ? empty.messages : [],
    toolCalls: Array.isArray(empty.toolCalls) ? empty.toolCalls : [],
    reasoning: Array.isArray(empty.reasoning) ? empty.reasoning : [],
    media: Array.isArray(empty.media) ? empty.media : []
  };

  return {
    protocol: viewModel.protocol,
    viewModel,
    requestProps: empty.requestProps || {},
    rawRequestBody: empty.rawRequestBody || '',
    messages: Array.isArray(empty.messagesForUI) ? empty.messagesForUI : [],
    response: empty.responseForUI || {},
    rawResponseBody: empty.rawResponseBody || '',
    responsesFinalText: empty.responsesFinalText || '',
    normalized: createNormalizedFallback(viewModel.protocol, empty.normalizedRequest || {}),
    // 额外对外字段（供后续 UI 重构消费）
    request: viewModel.request,
    responseMeta: viewModel.response,
    events: viewModel.events,
    toolCalls: viewModel.toolCalls,
    reasoning: viewModel.reasoning,
    media: viewModel.media
  };
};

/**
 * 解析完整内容
 * @param {string} content - 原始内容字符串
 * @returns {Object} 解析后的内容对象
 */
export const parseContent = (content) => {
  if (!content?.trim()) {
    return createEmptyParseResult();
  }

  try {
    const parsed = parseRawLogContent(content);
    const protocol = parsed.protocol || ProtocolKind.UNKNOWN;

    const requestParsed = parsed.request?.parsed;
    const requestObject = requestParsed && typeof requestParsed === 'object' && !Array.isArray(requestParsed) ? requestParsed : {};

    let normalized = createNormalizedFallback(protocol, requestObject);
    if (Object.keys(requestObject).length > 0) {
      normalized = normalizeRequest(requestObject);
      if (normalized.format === RequestFormat.UNKNOWN) {
        normalized = {
          ...normalized,
          format: mapProtocolToRequestFormat(protocol)
        };
      }
    }

    const viewModel = {
      protocol,
      request: {
        raw: parsed.request?.raw || '',
        parsed: parsed.request?.parsed ?? null
      },
      response: {
        raw: parsed.response?.raw || '',
        parsed: parsed.response?.parsed ?? null
      },
      events: Array.isArray(parsed.events) ? parsed.events : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      toolCalls: Array.isArray(parsed.toolCalls) ? parsed.toolCalls : [],
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [],
      media: Array.isArray(parsed.media) ? parsed.media : []
    };

    return {
      protocol,
      viewModel,
      requestProps: parsed.requestProps || {},
      rawRequestBody: parsed.rawRequestBody || viewModel.request.raw,
      messages: Array.isArray(parsed.messagesForUI) ? parsed.messagesForUI : [],
      response: parsed.responseForUI !== undefined && parsed.responseForUI !== null ? parsed.responseForUI : {},
      rawResponseBody: parsed.rawResponseBody || viewModel.response.raw,
      responsesFinalText: typeof parsed.responsesFinalText === 'string' ? parsed.responsesFinalText : '',
      normalized,
      // 额外对外字段（供后续 UI 重构消费）
      request: viewModel.request,
      responseMeta: viewModel.response,
      events: viewModel.events,
      toolCalls: viewModel.toolCalls,
      reasoning: viewModel.reasoning,
      media: viewModel.media
    };
  } catch (error) {
    console.error('解析内容时出错:', error.message);
    return createEmptyParseResult();
  }
};
