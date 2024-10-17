/**
 * 工具函数模块
 * 包含 debounce 和内容解析相关函数
 */

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
 * @returns {Object} 解析后的响应体
 */
export const parseResponseBody = (responsePart) => {
  try {
    const parsed = JSON.parse(responsePart.trim());

    // 如果响应数据包含 type 和 content 字段（如 stream 类型的响应），
    // 直接提取并返回 content 的内容，跳过外层包装
    if (parsed && typeof parsed === 'object' && 'type' in parsed && 'content' in parsed) {
      return parsed.content;
    }

    return parsed;
  } catch {
    throw new Error('响应体内容不是有效的JSON格式');
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
 * 解析完整内容
 * @param {string} content - 原始内容字符串
 * @returns {Object} 解析后的内容对象
 */
export const parseContent = (content) => {
  try {
    // 验证输入内容
    if (!content?.trim()) {
      throw new Error('无效的内容格式');
    }

    // 提取请求和响应部分
    const [requestPart, responsePart] = extractRequestAndResponse(content);

    // 提取原始请求体字符串（用于"查看原始"功能）
    const requestBodyMatch = requestPart.match(/【Request Body】:([\s\S]*)/);
    const rawRequestBody = requestBodyMatch?.[1]?.trim() || '';

    // 原始响应体字符串（处理 type/content 包装）
    const rawResponseBody = extractResponseContent(responsePart);

    // 解析请求体
    const requestJson = parseRequestBody(requestPart);

    // 归一化请求结构
    const normalized = normalizeRequest(requestJson);

    // 检测格式并提取对应的 messages（用于 UI 展示）
    const format = normalized.format;
    let messages = [];
    let otherProps = {};

    if (format === RequestFormat.GEMINI) {
      // Gemini 格式：从 contents 提取
      // eslint-disable-next-line no-unused-vars
      const { contents = [], systemInstruction: _si, generationConfig, tools, toolConfig, model, ...rest } = requestJson;
      otherProps = { model, generationConfig, tools, toolConfig, ...rest };

      // 如果有 systemInstruction，添加为 system 消息
      if (normalized.systemText) {
        messages.push({
          role: 'system',
          content: [{ type: 'text', text: normalized.systemText }],
          rawContent: { role: 'system', content: normalized.systemText }
        });
      }

      // 转换 contents 为消息格式
      contents.forEach((c, index) => {
        const role = c.role === 'model' ? 'assistant' : c.role || 'user';
        const parsedContent = parseGeminiParts(c.parts);
        messages.push({
          role,
          content: parsedContent.map((p) =>
            p.type === 'text' ? { type: 'text', text: p.text } : p.type === 'image' ? { type: 'image', url: p.url } : { type: 'text', text: JSON.stringify(p) }
          ),
          rawContent: contents[index]
        });
      });
    } else if (format === RequestFormat.CLAUDE) {
      // Claude 格式：处理顶层 system
      // eslint-disable-next-line no-unused-vars
      const { messages: claudeMessages = [], system: _sys, tools, tool_choice, model, ...rest } = requestJson;
      otherProps = { model, tools, tool_choice, ...rest };

      // 如果有顶层 system，添加为 system 消息
      if (normalized.systemText) {
        messages.push({
          role: 'system',
          content: [{ type: 'text', text: normalized.systemText }],
          rawContent: { role: 'system', content: normalized.systemText }
        });
      }

      // 处理 Claude messages
      claudeMessages.forEach((msg, index) => {
        const parsedContent = parseClaudeContent(msg.content);
        messages.push({
          role: msg.role,
          content: parsedContent.map((p) =>
            p.type === 'text' ? { type: 'text', text: p.text } : p.type === 'image' ? { type: 'image', url: p.url } : { type: 'text', text: JSON.stringify(p) }
          ),
          rawContent: claudeMessages[index]
        });
      });
    } else {
      // OpenAI 格式或未知格式
      const { messages: openaiMessages = [], ...rest } = requestJson;
      otherProps = rest;

      // 处理消息数组
      messages = Array.isArray(openaiMessages)
        ? openaiMessages.map((msg, index) => ({
            ...parseMessage(msg),
            rawContent: openaiMessages[index]
          }))
        : [];
    }

    // 解析响应体
    const responseJson = parseResponseBody(responsePart);

    return {
      requestProps: otherProps,
      rawRequestBody,
      messages,
      response: responseJson,
      rawResponseBody,
      normalized // 返回归一化结构，供 curl 转换使用
    };
  } catch (error) {
    console.error('解析内容时出错:', error.message);
    return {
      requestProps: {},
      rawRequestBody: '',
      messages: [],
      response: {},
      rawResponseBody: '',
      normalized: { format: RequestFormat.UNKNOWN, model: null, systemText: null, messages: [], params: {}, tools: null, toolChoice: null }
    };
  }
};
