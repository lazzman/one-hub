/**
 * API 格式转换模块
 * 基于归一化请求结构生成 OpenAI、Claude、Gemini 格式
 */

import { RequestFormat } from './utils';
import { extractToolDefinitionsFromTools } from './toolDefinitionModel';

/**
 * 官方 API 端点
 */
export const OFFICIAL_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  responses: 'https://api.openai.com/v1/responses',
  claude: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models'
};

/**
 * One Hub 端点路径
 */
export const ONEHUB_PATHS = {
  openai: '/v1/chat/completions',
  responses: '/v1/responses',
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

const toFunctionInputObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
};

const getMessageText = (content = []) => {
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => {
      if (item?.type === 'text') return item.text || '';
      return '';
    })
    .filter(Boolean)
    .join('\n');
};

const TOOL_CONVERSION_META_KEY = '__toolConversionMeta';

const buildFunctionToolConversionPlan = (tools) => {
  const definitions = extractToolDefinitionsFromTools(tools);

  const convertibleTools = definitions
    .filter((tool) => tool.kind === 'function' && tool.convertibility?.convertible)
    .map((tool) => ({
      name: tool.displayName,
      description: tool.description,
      parameters: tool.schema,
      path: tool.path,
      raw: tool.raw
    }));

  const omittedTools = definitions
    .filter((tool) => !(tool.kind === 'function' && tool.convertibility?.convertible))
    .map((tool) => ({
      toolType: tool.toolType,
      displayName: tool.displayName,
      kind: tool.kind,
      path: tool.path,
      reason: tool.convertibility?.reason || '',
      raw: tool.raw
    }));

  return {
    totalTools: definitions.length,
    convertibleTools,
    omittedTools
  };
};

const attachToolConversionMeta = (requestBody, meta) => {
  if (!requestBody || typeof requestBody !== 'object') {
    return requestBody;
  }

  Object.defineProperty(requestBody, TOOL_CONVERSION_META_KEY, {
    value: meta,
    enumerable: false,
    configurable: true
  });

  return requestBody;
};

const buildToolConversionMeta = (targetFormat, plan) => {
  const omittedNames = plan.omittedTools.map((tool) => tool.displayName).filter(Boolean);
  const warningMessage =
    omittedNames.length > 0 ? `部分工具不可跨协议转换：${omittedNames.join('、')} 已从 ${targetFormat} 请求中省略。` : '';

  return {
    targetFormat,
    sourceToolCount: plan.totalTools,
    convertedToolCount: plan.convertibleTools.length,
    omittedTools: plan.omittedTools,
    warnings: warningMessage ? [warningMessage] : [],
    hasOmittedTools: plan.omittedTools.length > 0
  };
};

export const getToolConversionMeta = (requestBody) => {
  if (!requestBody || typeof requestBody !== 'object') {
    return {
      targetFormat: '',
      sourceToolCount: 0,
      convertedToolCount: 0,
      omittedTools: [],
      warnings: [],
      hasOmittedTools: false
    };
  }

  return (
    requestBody[TOOL_CONVERSION_META_KEY] || {
      targetFormat: '',
      sourceToolCount: 0,
      convertedToolCount: 0,
      omittedTools: [],
      warnings: [],
      hasOmittedTools: false
    }
  );
};

export const getCrossProtocolToolWarnings = (normalized, targets = []) => {
  if (!normalized || !Array.isArray(targets) || targets.length === 0) {
    return [];
  }

  const converterMap = {
    openai: convertToOpenAI,
    responses: convertToResponses,
    claude: convertToClaude,
    gemini: convertToGemini
  };

  return targets
    .map((target) => {
      const converter = converterMap[target];
      if (typeof converter !== 'function') return null;

      const conversionMeta = getToolConversionMeta(converter(normalized));
      if (!conversionMeta.hasOmittedTools) {
        return null;
      }

      return {
        target,
        ...conversionMeta
      };
    })
    .filter(Boolean);
};

const buildConvertedFunctionTools = (tools) => buildFunctionToolConversionPlan(tools).convertibleTools;

const isSystemLikeRole = (role) => role === 'system' || role === 'developer';

const buildSystemText = (systemText, messages = []) => {
  const textParts = [];
  if (typeof systemText === 'string' && systemText.trim()) {
    textParts.push(systemText.trim());
  }

  messages.forEach((msg) => {
    if (!isSystemLikeRole(msg?.role)) return;
    const messageText = getMessageText(msg.content).trim();
    if (!messageText) return;
    if (textParts.includes(messageText)) return;
    textParts.push(messageText);
  });

  return textParts.join('\n\n').trim();
};

/**
 * 从归一化结构转换为 OpenAI 格式
 * @param {Object} normalized - 归一化请求结构
 * @returns {Object} OpenAI 格式的请求体
 */
export const convertToOpenAI = (normalized) => {
  const { model, systemText, messages, params, tools, toolChoice } = normalized;
  const toolConversionPlan = buildFunctionToolConversionPlan(tools);

  const openaiMessages = [];
  const mergedSystemText = buildSystemText(systemText, messages);

  if (mergedSystemText) {
    openaiMessages.push({ role: 'system', content: mergedSystemText });
  }

  messages.forEach((msg) => {
    if (isSystemLikeRole(msg.role) && mergedSystemText) {
      const msgText = getMessageText(msg.content).trim();
      if (!msgText || mergedSystemText.includes(msgText)) return;
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
      openaiMsg.tool_calls = msg.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: 'function',
        function: {
          name: toolCall.function?.name || toolCall.name || '',
          arguments: toolCall.function?.arguments || toolCall.arguments || '{}'
        }
      }));
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
    'n'
  ];
  paramKeys.forEach((key) => {
    if (params[key] !== undefined) {
      openaiRequest[key] = params[key];
    }
  });

  // 添加 tools
  if (toolConversionPlan.convertibleTools.length > 0) {
    openaiRequest.tools = convertToolsToOpenAI(tools);
  }

  // 添加 tool_choice
  if (toolChoice !== undefined && toolChoice !== null) {
    openaiRequest.tool_choice = convertToolChoiceToOpenAI(toolChoice, normalized.format);
  }

  return attachToolConversionMeta(openaiRequest, buildToolConversionMeta('openai', toolConversionPlan));
};

/**
 * 转换 tools 为 OpenAI 格式
 */
const convertToolsToOpenAI = (tools) => {
  return buildConvertedFunctionTools(tools).map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
};

const convertToolsToResponses = (tools) => {
  return buildConvertedFunctionTools(tools).map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
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

export const convertToResponses = (normalized) => {
  const { model, systemText, messages, params, tools, toolChoice } = normalized;
  const toolConversionPlan = buildFunctionToolConversionPlan(tools);

  const input = [];
  const mergedSystemText = buildSystemText(systemText, messages);

  if (mergedSystemText) {
    input.push({
      role: 'system',
      content: [{ type: 'input_text', text: mergedSystemText }]
    });
  }

  messages.forEach((msg) => {
    if (isSystemLikeRole(msg.role) && mergedSystemText) {
      const msgText = getMessageText(msg.content).trim();
      if (!msgText || mergedSystemText.includes(msgText)) {
        return;
      }
    }

    if (msg.role === 'tool' && msg.toolCallId) {
      input.push({
        type: 'function_call_output',
        call_id: msg.toolCallId,
        output: msg.content?.map((c) => c.text || '').join('') || ''
      });
      return;
    }

    const content = [];

    if (Array.isArray(msg.content)) {
      msg.content.forEach((item) => {
        if (item.type === 'text') {
          content.push({ type: 'input_text', text: item.text || '' });
          return;
        }

        if (item.type === 'image') {
          content.push({ type: 'input_image', image_url: item.url, detail: item.detail || 'auto' });
          return;
        }

        if (item.type === 'audio') {
          content.push({ type: 'input_audio', input_audio: item.audio });
        }
      });
    }

    if (content.length > 0) {
      input.push({
        type: 'message',
        role: msg.role || 'user',
        content
      });
    }

    if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
      msg.toolCalls.forEach((toolCall) => {
        input.push({
          type: 'function_call',
          call_id: toolCall.id,
          name: toolCall.function?.name || toolCall.name,
          arguments: toolCall.function?.arguments || toolCall.arguments || '{}'
        });
      });
    }
  });

  const responsesRequest = {
    model: model || 'gpt-4.1',
    input
  };

  const paramKeys = ['temperature', 'max_output_tokens', 'max_tokens', 'top_p', 'stream', 'store', 'parallel_tool_calls'];
  paramKeys.forEach((key) => {
    if (params[key] !== undefined) {
      responsesRequest[key === 'max_tokens' ? 'max_output_tokens' : key] = params[key];
    }
  });

  if (toolConversionPlan.convertibleTools.length > 0) {
    responsesRequest.tools = convertToolsToResponses(tools);
  }

  if (toolChoice !== undefined && toolChoice !== null) {
    responsesRequest.tool_choice = convertToolChoiceToOpenAI(toolChoice, normalized.format);
  }

  return attachToolConversionMeta(responsesRequest, buildToolConversionMeta('responses', toolConversionPlan));
};

/**
 * 从归一化结构转换为 Claude 格式
 * @param {Object} normalized - 归一化请求结构
 * @returns {Object} Claude 格式的请求体
 */
export const convertToClaude = (normalized) => {
  const { model, systemText, messages, params, tools, toolChoice } = normalized;

  const claudeMessages = [];
  const mergedSystemText = buildSystemText(systemText, messages);

  // 转换消息（跳过 system / developer）
  messages.forEach((msg) => {
    if (isSystemLikeRole(msg.role)) return;

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
          name: tc.function?.name || tc.name || '',
          input: toFunctionInputObject(tc.function?.arguments || tc.arguments)
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
  if (mergedSystemText) {
    claudeRequest.system = mergedSystemText;
  }

  // 添加参数
  if (params.temperature !== undefined) claudeRequest.temperature = params.temperature;
  if (params.top_p !== undefined) claudeRequest.top_p = params.top_p;
  if (params.top_k !== undefined) claudeRequest.top_k = params.top_k;
  if (params.stream !== undefined) claudeRequest.stream = params.stream;
  if (params.stop) claudeRequest.stop_sequences = Array.isArray(params.stop) ? params.stop : [params.stop];

  // 添加 tools
  const toolConversionPlan = buildFunctionToolConversionPlan(tools);

  if (toolConversionPlan.convertibleTools.length > 0) {
    claudeRequest.tools = convertToolsToClaude(tools);
  }

  // 添加 tool_choice
  if (toolChoice !== undefined && toolChoice !== null) {
    claudeRequest.tool_choice = convertToolChoiceToClaude(toolChoice, normalized.format);
  }

  return attachToolConversionMeta(claudeRequest, buildToolConversionMeta('claude', toolConversionPlan));
};

/**
 * 转换 tools 为 Claude 格式
 */
const convertToolsToClaude = (tools) => {
  return buildConvertedFunctionTools(tools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }));
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
  const toolConversionPlan = buildFunctionToolConversionPlan(tools);

  const contents = [];
  const mergedSystemText = buildSystemText(systemText, messages);

  // 转换消息（跳过 system / developer）
  messages.forEach((msg) => {
    if (isSystemLikeRole(msg.role)) return;

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
            name: tc.function?.name || tc.name || '',
            args: toFunctionInputObject(tc.function?.arguments || tc.arguments)
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
  if (mergedSystemText) {
    geminiRequest.systemInstruction = {
      parts: [{ text: mergedSystemText }]
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
  if (toolConversionPlan.convertibleTools.length > 0) {
    geminiRequest.tools = convertToolsToGemini(tools);
  }

  // 添加 toolConfig
  if (toolChoice !== undefined && toolChoice !== null) {
    geminiRequest.toolConfig = convertToolChoiceToGemini(toolChoice, normalized.format);
  }

  return attachToolConversionMeta(geminiRequest, buildToolConversionMeta('gemini', toolConversionPlan));
};

/**
 * 转换 tools 为 Gemini 格式
 */
const convertToolsToGemini = (tools) => {
  const functionDeclarations = buildConvertedFunctionTools(tools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));

  return functionDeclarations.length > 0 ? [{ functionDeclarations }] : [];
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

export const convertToResponsesCurl = (normalized, options = {}) => {
  const { useOfficial = false, baseUrl } = options;
  const responsesRequest = convertToResponses(normalized);
  const jsonBody = JSON.stringify(responsesRequest, null, 2);

  let endpoint;
  if (useOfficial) {
    endpoint = OFFICIAL_ENDPOINTS.responses;
  } else {
    const base = baseUrl || getOneHubBaseUrl();
    endpoint = `${base}${ONEHUB_PATHS.responses}`;
  }

  return `curl "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -d '${escapeForCurl(jsonBody)}'`;
};

export const convertToOriginalProtocolCurl = ({ rawRequest, endpointPath }) => {
  const base = getOneHubBaseUrl();
  const endpoint = `${base}${endpointPath || ONEHUB_PATHS.openai}`;
  let body = rawRequest || '{}';
  if (typeof body !== 'string') {
    body = JSON.stringify(body, null, 2);
  }

  return `curl "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -d '${escapeForCurl(body)}'`;
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
