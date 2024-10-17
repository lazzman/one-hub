/**
 * API 格式转换模块
 * 基于归一化请求结构生成 OpenAI、Claude、Gemini 格式
 */

import { RequestFormat } from './utils';

/**
 * 官方 API 端点
 */
export const OFFICIAL_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  claude: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models'
};

/**
 * One Hub 端点路径
 */
export const ONEHUB_PATHS = {
  openai: '/v1/chat/completions',
  claude: '/v1/messages', // One Hub 兼容 OpenAI 格式，也可用 /claude/v1/messages
  gemini: '/v1/chat/completions' // One Hub 统一使用 OpenAI 兼容格式
};

/**
 * 获取 One Hub baseUrl
 * @returns {string} baseUrl
 */
export const getOneHubBaseUrl = () => {
  // 优先使用 window.location.origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

/**
 * 判断图片 URL 是否为 base64 数据
 * @param {string} url - 图片 URL
 * @returns {boolean}
 */
const isBase64DataUrl = (url) => {
  return url && url.startsWith('data:');
};

/**
 * 从 data URL 提取 base64 数据和 MIME 类型
 * @param {string} dataUrl - data URL
 * @returns {Object} { mimeType, data }
 */
const parseDataUrl = (dataUrl) => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/jpeg', data: dataUrl };
};

/**
 * 从归一化结构转换为 OpenAI 格式
 * @param {Object} normalized - 归一化请求结构
 * @returns {Object} OpenAI 格式的请求体
 */
export const convertToOpenAI = (normalized) => {
  const { model, systemText, messages, params, tools, toolChoice } = normalized;

  const openaiMessages = [];

  // 添加 system 消息
  if (systemText) {
    openaiMessages.push({ role: 'system', content: systemText });
  }

  // 转换消息
  messages.forEach((msg) => {
    // 跳过已经处理过的 system 消息（避免重复）
    if (msg.role === 'system' && systemText) {
      // 检查是否与 systemText 相同
      const msgText = msg.content?.map((c) => c.text || '').join('\n');
      if (msgText === systemText) return;
    }

    const openaiMsg = { role: msg.role };

    // 处理 content
    if (msg.content && msg.content.length > 0) {
      const hasMultiModal = msg.content.some((c) => c.type === 'image' || c.type === 'audio');

      if (hasMultiModal) {
        openaiMsg.content = msg.content.map((item) => {
          if (item.type === 'text') {
            return { type: 'text', text: item.text || '' };
          } else if (item.type === 'image') {
            return {
              type: 'image_url',
              image_url: { url: item.url, ...(item.detail && { detail: item.detail }) }
            };
          } else if (item.type === 'audio') {
            return { type: 'input_audio', input_audio: item.audio };
          }
          return item;
        });
      } else {
        // 纯文本消息
        openaiMsg.content = msg.content.map((c) => c.text || '').join('');
      }
    }

    // 处理 tool_calls
    if (msg.toolCalls) {
      openaiMsg.tool_calls = msg.toolCalls;
    }

    // 处理 tool 消息
    if (msg.role === 'tool' && msg.toolCallId) {
      openaiMsg.tool_call_id = msg.toolCallId;
      if (msg.name) openaiMsg.name = msg.name;
    }

    openaiMessages.push(openaiMsg);
  });

  const openaiRequest = {
    model: model || 'gpt-4',
    messages: openaiMessages
  };

  // 添加参数
  const paramKeys = ['temperature', 'max_tokens', 'top_p', 'stream', 'frequency_penalty', 'presence_penalty', 'seed', 'response_format', 'stop', 'n'];
  paramKeys.forEach((key) => {
    if (params[key] !== undefined) {
      openaiRequest[key] = params[key];
    }
  });

  // 添加 tools
  if (tools && Array.isArray(tools) && tools.length > 0) {
    // 转换 tools 格式（如果需要）
    openaiRequest.tools = convertToolsToOpenAI(tools, normalized.format);
  }

  // 添加 tool_choice
  if (toolChoice !== undefined && toolChoice !== null) {
    openaiRequest.tool_choice = convertToolChoiceToOpenAI(toolChoice, normalized.format);
  }

  return openaiRequest;
};

/**
 * 转换 tools 为 OpenAI 格式
 */
const convertToolsToOpenAI = (tools, sourceFormat) => {
  if (sourceFormat === RequestFormat.GEMINI) {
    // Gemini tools 格式转换
    return tools.flatMap((tool) => {
      if (tool.functionDeclarations) {
        return tool.functionDeclarations.map((fn) => ({
          type: 'function',
          function: {
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters
          }
        }));
      }
      return tool;
    });
  }
  // OpenAI 和 Claude 的 tools 格式基本兼容
  return tools;
};

/**
 * 转换 tool_choice 为 OpenAI 格式
 */
const convertToolChoiceToOpenAI = (toolChoice, sourceFormat) => {
  if (sourceFormat === RequestFormat.GEMINI && toolChoice?.functionCallingConfig) {
    const mode = toolChoice.functionCallingConfig.mode;
    if (mode === 'NONE') return 'none';
    if (mode === 'AUTO') return 'auto';
    if (mode === 'ANY') return 'required';
  }
  return toolChoice;
};

/**
 * 从归一化结构转换为 Claude 格式
 * @param {Object} normalized - 归一化请求结构
 * @returns {Object} Claude 格式的请求体
 */
export const convertToClaude = (normalized) => {
  const { model, systemText, messages, params, tools, toolChoice } = normalized;

  const claudeMessages = [];

  // 转换消息（跳过 system）
  messages.forEach((msg) => {
    if (msg.role === 'system') return;

    const claudeMsg = {
      role: msg.role === 'assistant' ? 'assistant' : 'user'
    };

    // 处理 content
    if (msg.content && msg.content.length > 0) {
      claudeMsg.content = msg.content.map((item) => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text || '' };
        } else if (item.type === 'image') {
          if (isBase64DataUrl(item.url)) {
            const { mimeType, data } = parseDataUrl(item.url);
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: data
              }
            };
          } else {
            return {
              type: 'image',
              source: {
                type: 'url',
                url: item.url
              }
            };
          }
        } else if (item.type === 'tool_use') {
          return item.toolUse || item;
        } else if (item.type === 'tool_result') {
          return item.toolResult || item;
        }
        return { type: 'text', text: JSON.stringify(item) };
      });
    }

    // 处理 tool_calls（转换为 Claude 的 tool_use）
    if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
      if (!claudeMsg.content) claudeMsg.content = [];
      msg.toolCalls.forEach((tc) => {
        claudeMsg.content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function?.name,
          input: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}
        });
      });
    }

    // 处理 tool 消息（转换为 Claude 的 tool_result）
    if (msg.role === 'tool') {
      claudeMsg.role = 'user';
      claudeMsg.content = [
        {
          type: 'tool_result',
          tool_use_id: msg.toolCallId,
          content: msg.content?.map((c) => c.text).join('') || ''
        }
      ];
    }

    claudeMessages.push(claudeMsg);
  });

  const claudeRequest = {
    model: model || 'claude-3-opus-20240229',
    messages: claudeMessages,
    max_tokens: params.max_tokens || 4096
  };

  // 添加 system
  if (systemText) {
    claudeRequest.system = systemText;
  }

  // 添加参数
  if (params.temperature !== undefined) claudeRequest.temperature = params.temperature;
  if (params.top_p !== undefined) claudeRequest.top_p = params.top_p;
  if (params.top_k !== undefined) claudeRequest.top_k = params.top_k;
  if (params.stream !== undefined) claudeRequest.stream = params.stream;
  if (params.stop) claudeRequest.stop_sequences = Array.isArray(params.stop) ? params.stop : [params.stop];

  // 添加 tools
  if (tools && Array.isArray(tools) && tools.length > 0) {
    claudeRequest.tools = convertToolsToClaude(tools, normalized.format);
  }

  // 添加 tool_choice
  if (toolChoice !== undefined && toolChoice !== null) {
    claudeRequest.tool_choice = convertToolChoiceToClaude(toolChoice, normalized.format);
  }

  return claudeRequest;
};

/**
 * 转换 tools 为 Claude 格式
 */
const convertToolsToClaude = (tools, sourceFormat) => {
  if (sourceFormat === RequestFormat.OPENAI) {
    return tools
      .filter((t) => t.type === 'function')
      .map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }));
  }
  if (sourceFormat === RequestFormat.GEMINI) {
    return tools.flatMap((tool) => {
      if (tool.functionDeclarations) {
        return tool.functionDeclarations.map((fn) => ({
          name: fn.name,
          description: fn.description,
          input_schema: fn.parameters
        }));
      }
      return [];
    });
  }
  return tools;
};

/**
 * 转换 tool_choice 为 Claude 格式
 */
const convertToolChoiceToClaude = (toolChoice, sourceFormat) => {
  if (sourceFormat === RequestFormat.OPENAI) {
    if (toolChoice === 'auto') return { type: 'auto' };
    if (toolChoice === 'none') return { type: 'none' };
    if (toolChoice === 'required') return { type: 'any' };
    if (typeof toolChoice === 'object' && toolChoice.function?.name) {
      return { type: 'tool', name: toolChoice.function.name };
    }
  }
  if (sourceFormat === RequestFormat.GEMINI && toolChoice?.functionCallingConfig) {
    const mode = toolChoice.functionCallingConfig.mode;
    if (mode === 'NONE') return { type: 'none' };
    if (mode === 'AUTO') return { type: 'auto' };
    if (mode === 'ANY') return { type: 'any' };
  }
  return toolChoice;
};

/**
 * 从归一化结构转换为 Gemini 格式
 * @param {Object} normalized - 归一化请求结构
 * @returns {Object} Gemini 格式的请求体
 */
export const convertToGemini = (normalized) => {
  const { systemText, messages, params, tools, toolChoice } = normalized;

  const contents = [];

  // 转换消息（跳过 system）
  messages.forEach((msg) => {
    if (msg.role === 'system') return;

    const geminiContent = {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: []
    };

    // 处理 content
    if (msg.content && msg.content.length > 0) {
      msg.content.forEach((item) => {
        if (item.type === 'text') {
          geminiContent.parts.push({ text: item.text || '' });
        } else if (item.type === 'image') {
          if (isBase64DataUrl(item.url)) {
            const { mimeType, data } = parseDataUrl(item.url);
            geminiContent.parts.push({
              inlineData: {
                mimeType: mimeType,
                data: data
              }
            });
          } else {
            // URL 图片使用 fileData
            geminiContent.parts.push({
              fileData: {
                mimeType: item.mimeType || 'image/jpeg',
                fileUri: item.url
              }
            });
          }
        } else if (item.type === 'function_call') {
          geminiContent.parts.push({ functionCall: item.functionCall });
        } else if (item.type === 'function_response') {
          geminiContent.parts.push({ functionResponse: item.functionResponse });
        }
      });
    }

    // 处理 tool_calls（转换为 Gemini 的 functionCall）
    if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
      msg.toolCalls.forEach((tc) => {
        geminiContent.parts.push({
          functionCall: {
            name: tc.function?.name,
            args: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}
          }
        });
      });
    }

    // 处理 tool 消息（转换为 Gemini 的 functionResponse）
    if (msg.role === 'tool') {
      geminiContent.role = 'user';
      geminiContent.parts = [
        {
          functionResponse: {
            name: msg.name || 'function',
            response: {
              content: msg.content?.map((c) => c.text).join('') || ''
            }
          }
        }
      ];
    }

    if (geminiContent.parts.length > 0) {
      contents.push(geminiContent);
    }
  });

  const geminiRequest = {
    contents
  };

  // 添加 systemInstruction
  if (systemText) {
    geminiRequest.systemInstruction = {
      parts: [{ text: systemText }]
    };
  }

  // 添加 generationConfig
  const generationConfig = {};
  if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
  if (params.max_tokens !== undefined) generationConfig.maxOutputTokens = params.max_tokens;
  if (params.top_p !== undefined) generationConfig.topP = params.top_p;
  if (params.top_k !== undefined) generationConfig.topK = params.top_k;
  if (params.stop) generationConfig.stopSequences = Array.isArray(params.stop) ? params.stop : [params.stop];

  // 如果有原始 generationConfig，合并其他字段
  if (params._generationConfig) {
    Object.keys(params._generationConfig).forEach((key) => {
      if (generationConfig[key] === undefined) {
        generationConfig[key] = params._generationConfig[key];
      }
    });
  }

  if (Object.keys(generationConfig).length > 0) {
    geminiRequest.generationConfig = generationConfig;
  }

  // 添加 tools
  if (tools && Array.isArray(tools) && tools.length > 0) {
    geminiRequest.tools = convertToolsToGemini(tools, normalized.format);
  }

  // 添加 toolConfig
  if (toolChoice !== undefined && toolChoice !== null) {
    geminiRequest.toolConfig = convertToolChoiceToGemini(toolChoice, normalized.format);
  }

  return geminiRequest;
};

/**
 * 转换 tools 为 Gemini 格式
 */
const convertToolsToGemini = (tools, sourceFormat) => {
  if (sourceFormat === RequestFormat.OPENAI) {
    const functionDeclarations = tools
      .filter((t) => t.type === 'function')
      .map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }));
    return [{ functionDeclarations }];
  }
  if (sourceFormat === RequestFormat.CLAUDE) {
    const functionDeclarations = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema
    }));
    return [{ functionDeclarations }];
  }
  return tools;
};

/**
 * 转换 tool_choice 为 Gemini 格式
 */
const convertToolChoiceToGemini = (toolChoice, sourceFormat) => {
  if (sourceFormat === RequestFormat.OPENAI) {
    if (toolChoice === 'auto') return { functionCallingConfig: { mode: 'AUTO' } };
    if (toolChoice === 'none') return { functionCallingConfig: { mode: 'NONE' } };
    if (toolChoice === 'required') return { functionCallingConfig: { mode: 'ANY' } };
  }
  if (sourceFormat === RequestFormat.CLAUDE) {
    if (toolChoice?.type === 'auto') return { functionCallingConfig: { mode: 'AUTO' } };
    if (toolChoice?.type === 'none') return { functionCallingConfig: { mode: 'NONE' } };
    if (toolChoice?.type === 'any') return { functionCallingConfig: { mode: 'ANY' } };
  }
  return toolChoice;
};

/**
 * 转义 JSON 字符串用于 curl 命令
 * @param {string} jsonStr - JSON 字符串
 * @returns {string} 转义后的字符串
 */
const escapeForCurl = (jsonStr) => {
  return jsonStr.replace(/'/g, "'\\''");
};

/**
 * 转换为 OpenAI curl 命令格式
 * @param {Object} normalized - 归一化请求结构
 * @param {Object} options - 选项
 * @param {boolean} options.useOfficial - 是否使用官方端点
 * @param {string} options.baseUrl - 自定义 baseUrl
 * @returns {string} curl 命令字符串
 */
export const convertToOpenAICurl = (normalized, options = {}) => {
  const { useOfficial = false, baseUrl } = options;
  const openaiRequest = convertToOpenAI(normalized);
  const jsonBody = JSON.stringify(openaiRequest, null, 2);

  let endpoint;
  if (useOfficial) {
    endpoint = OFFICIAL_ENDPOINTS.openai;
  } else {
    const base = baseUrl || getOneHubBaseUrl();
    endpoint = `${base}${ONEHUB_PATHS.openai}`;
  }

  const curlCommand = `curl "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -d '${escapeForCurl(jsonBody)}'`;

  return curlCommand;
};

/**
 * 转换为 Claude curl 命令格式
 * @param {Object} normalized - 归一化请求结构
 * @param {Object} options - 选项
 * @param {boolean} options.useOfficial - 是否使用官方端点
 * @param {string} options.baseUrl - 自定义 baseUrl
 * @returns {string} curl 命令字符串
 */
export const convertToClaudeCurl = (normalized, options = {}) => {
  const { useOfficial = false, baseUrl } = options;
  const claudeRequest = convertToClaude(normalized);
  const jsonBody = JSON.stringify(claudeRequest, null, 2);

  let endpoint;
  let headers;

  if (useOfficial) {
    endpoint = OFFICIAL_ENDPOINTS.claude;
    headers = `  -H "Content-Type: application/json" \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2023-06-01"`;
  } else {
    const base = baseUrl || getOneHubBaseUrl();
    endpoint = `${base}${ONEHUB_PATHS.claude}`;
    // One Hub 使用 OpenAI 兼容格式
    headers = `  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY"`;
  }

  const curlCommand = `curl "${endpoint}" \\
${headers} \\
  -d '${escapeForCurl(jsonBody)}'`;

  return curlCommand;
};

/**
 * 转换为 Gemini curl 命令格式
 * @param {Object} normalized - 归一化请求结构
 * @param {Object} options - 选项
 * @param {boolean} options.useOfficial - 是否使用官方端点
 * @param {string} options.baseUrl - 自定义 baseUrl
 * @returns {string} curl 命令字符串
 */
export const convertToGeminiCurl = (normalized, options = {}) => {
  const { useOfficial = false, baseUrl } = options;
  const geminiRequest = convertToGemini(normalized);
  const modelName = normalized.model || 'gemini-pro';
  const jsonBody = JSON.stringify(geminiRequest, null, 2);

  let endpoint;
  let headers;

  if (useOfficial) {
    endpoint = `${OFFICIAL_ENDPOINTS.gemini}/${modelName}:generateContent?key=$GOOGLE_API_KEY`;
    headers = `  -H "Content-Type: application/json"`;
  } else {
    const base = baseUrl || getOneHubBaseUrl();
    endpoint = `${base}${ONEHUB_PATHS.gemini}`;
    // One Hub 使用 OpenAI 兼容格式，需要转换请求体
    const openaiRequest = convertToOpenAI(normalized);
    const openaiJsonBody = JSON.stringify(openaiRequest, null, 2);
    headers = `  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY"`;

    return `curl "${endpoint}" \\
${headers} \\
  -d '${escapeForCurl(openaiJsonBody)}'`;
  }

  const curlCommand = `curl "${endpoint}" \\
${headers} \\
  -d '${escapeForCurl(jsonBody)}'`;

  return curlCommand;
};

// ============ 兼容旧接口（用于平滑迁移） ============

/**
 * 兼容旧接口：从 requestProps 和 messages 转换
 * @deprecated 请使用新的归一化结构接口
 */
export const convertToOpenAILegacy = (requestProps, messages) => {
  // 构造一个简单的归一化结构
  const normalized = {
    format: RequestFormat.OPENAI,
    model: requestProps.model,
    systemText: null,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    })),
    params: requestProps,
    tools: requestProps.tools,
    toolChoice: requestProps.tool_choice
  };
  return convertToOpenAI(normalized);
};

export const convertToClaudeLegacy = (requestProps, messages) => {
  const normalized = {
    format: RequestFormat.OPENAI,
    model: requestProps.model,
    systemText: null,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    })),
    params: requestProps,
    tools: requestProps.tools,
    toolChoice: requestProps.tool_choice
  };
  return convertToClaude(normalized);
};

export const convertToGeminiLegacy = (requestProps, messages) => {
  const normalized = {
    format: RequestFormat.OPENAI,
    model: requestProps.model,
    systemText: null,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    })),
    params: requestProps,
    tools: requestProps.tools,
    toolChoice: requestProps.tool_choice
  };
  return convertToGemini(normalized);
};
