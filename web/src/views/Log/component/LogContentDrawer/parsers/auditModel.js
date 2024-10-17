import { extractToolDefinitionsFromRequest } from '../toolDefinitionModel';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const normalizeKey = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const hasValue = (value) => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim() !== '';
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (isObject(value)) {
    return Object.keys(value).length > 0;
  }

  return `${value}`.trim() !== '';
};
const isPrimitive = (value) => value === null || ['string', 'number', 'boolean'].includes(typeof value);

const REQUEST_HIGHLIGHT_FIELDS = [
  { label: '模型', paths: ['model'] },
  { label: '流式', paths: ['stream'] },
  { label: '存储', paths: ['store'] },
  { label: '服务层级', paths: ['service_tier'] },
  { label: '附加字段', paths: ['include'] },
  { label: '温度', paths: ['temperature', 'generationConfig.temperature'] },
  { label: '最大 Token 数', paths: ['max_tokens', 'max_completion_tokens'] },
  { label: '最大输出', paths: ['max_output_tokens', 'generationConfig.maxOutputTokens'] },
  { label: 'Top P', paths: ['top_p', 'generationConfig.topP'] },
  { label: 'Top K', paths: ['top_k', 'generationConfig.topK'] },
  { label: '停止序列', paths: ['stop', 'stop_sequences', 'generationConfig.stopSequences'] },
  {
    label: '工具选择',
    paths: ['tool_choice', 'toolConfig.functionCallingConfig.mode', 'toolConfig.functionCallingConfig.allowedFunctionNames']
  },
  {
    label: '推理过程',
    paths: [
      'reasoning.effort',
      'reasoning.type',
      'reasoning',
      'thinking.type',
      'thinking.budget_tokens',
      'thinking',
      'thinkingConfig.includeThoughts'
    ]
  },
  {
    label: '响应格式',
    paths: ['response_format.type', 'response_format', 'generationConfig.responseMimeType', 'generationConfig.responseSchema']
  },
  { label: '元数据', paths: ['metadata'] },
  { label: 'N', paths: ['n', 'candidateCount', 'generationConfig.candidateCount'] },
  { label: '尺寸', paths: ['size'] },
  { label: '质量', paths: ['quality'] },
  { label: '风格', paths: ['style'] },
  { label: '音色', paths: ['voice'] },
  { label: '格式', paths: ['format'] },
  { label: '维度', paths: ['dimensions'] },
  { label: '编码格式', paths: ['encoding_format'] }
];

const HIDDEN_TOP_LEVEL_KEYS = new Set([
  'messages',
  'message',
  'input',
  'contents',
  'system',
  'systemInstruction',
  'instructions',
  'tools',
  'prompt',
  'history',
  'conversation',
  'conversation_history',
  'chat_history',
  'previous_messages',
  'past_messages'
]);

const readPath = (root, path) => {
  if (!isObject(root) || !path) return undefined;
  return path.split('.').reduce((current, key) => {
    if (current === undefined || current === null) return undefined;
    return current[key];
  }, root);
};

const stringifyValue = (value, pretty = false) => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, pretty ? 2 : 0);
  } catch {
    return String(value);
  }
};

const summarizePrimitiveArray = (items) => {
  const visibleItems = items.map((item) => `${item}`).filter(Boolean);
  if (visibleItems.length <= 3) {
    return visibleItems.join(', ');
  }
  return `${visibleItems.slice(0, 3).join(', ')} +${visibleItems.length - 3}`;
};

const summarizeObjectValue = (value) => {
  if (!isObject(value)) {
    return stringifyValue(value);
  }

  if (typeof value.type === 'string' && value.type.trim()) {
    return value.type.trim();
  }

  if (typeof value.mode === 'string' && value.mode.trim()) {
    return value.mode.trim();
  }

  if (typeof value.effort === 'string' && value.effort.trim()) {
    return `强度：${value.effort.trim()}`;
  }

  const keys = Object.keys(value);
  if (keys.length === 0) {
    return '{}';
  }

  const preview = keys.slice(0, 3).join(', ');
  return keys.length > 3 ? `${keys.length} 个键：${preview} ...` : `${keys.length} 个键：${preview}`;
};

export const formatAuditValue = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    if (value.every((item) => isPrimitive(item))) {
      return summarizePrimitiveArray(value);
    }

    return `${value.length} 项`;
  }

  return summarizeObjectValue(value);
};

const pushParam = (items, root, label, paths) => {
  for (const path of paths) {
    const value = readPath(root, path);
    if (hasValue(value)) {
      items.push({
        label,
        value,
        displayValue: formatAuditValue(value),
        path
      });
      return;
    }
  }
};

const isLikelyEmbeddingInput = (value) => {
  if (isPrimitive(value)) return true;
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;

  return value.every((item) => {
    if (isPrimitive(item)) return true;
    if (Array.isArray(item)) {
      return item.every((nestedItem) => isPrimitive(nestedItem));
    }
    return false;
  });
};

export const buildRequestAuditModel = (requestParsed, options = {}) => {
  const params = [];
  if (!isObject(requestParsed)) {
    return { params, remaining: {}, tools: [], nonConversation: null };
  }

  REQUEST_HIGHLIGHT_FIELDS.forEach((field) => {
    pushParam(params, requestParsed, field.label, field.paths);
  });

  const consumedTopLevel = new Set(
    params
      .map((item) => item.path)
      .filter((path) => !path.includes('.'))
      .concat(Array.from(HIDDEN_TOP_LEVEL_KEYS))
  );

  const remaining = Object.entries(requestParsed).reduce((acc, [key, value]) => {
    if (!consumedTopLevel.has(key)) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return {
    params,
    remaining,
    tools: extractToolDefinitions(requestParsed),
    nonConversation: buildNonConversationRequest(requestParsed, options.schemaKey)
  };
};

export const extractToolDefinitions = (requestParsed) => {
  return extractToolDefinitionsFromRequest(requestParsed);
};

export const buildToolCallSummary = (toolCalls) => {
  if (!Array.isArray(toolCalls)) return [];
  const summary = new Map();

  toolCalls.forEach((toolCall) => {
    const name = toolCall?.name || '未知工具';
    const current = summary.get(name) || { name, count: 0, results: 0 };
    current.count += 1;
    if (toolCall?.result !== undefined && toolCall?.result !== null && stringifyValue(toolCall.result).trim()) {
      current.results += 1;
    }
    summary.set(name, current);
  });

  return Array.from(summary.values());
};

export const buildNonConversationResponse = (responseParsed, schemaKey = '') => {
  if (!isObject(responseParsed)) return null;

  if (schemaKey.includes('image')) {
    const images = Array.isArray(responseParsed.data)
      ? responseParsed.data.map((item, index) => ({
          label: item.url ? `图片 URL ${index + 1}` : `图片 Base64 ${index + 1}`,
          value: item.url || item.b64_json || '',
          displayValue: item.url || (item.b64_json ? `Base64 图片 ${index + 1}` : ''),
          path: item.url ? `data[${index}].url` : `data[${index}].b64_json`
        }))
      : [];
    if (images.length > 0) return { kind: 'images', items: images };
  }

  if (schemaKey.includes('embedding') || responseParsed.object === 'list') {
    return {
      kind: 'embeddings',
      items: [
        { label: '对象类型', value: responseParsed.object, displayValue: formatAuditValue(responseParsed.object), path: 'object' },
        {
          label: '向量数量',
          value: Array.isArray(responseParsed.data) ? responseParsed.data.length : undefined,
          displayValue: formatAuditValue(Array.isArray(responseParsed.data) ? responseParsed.data.length : undefined),
          path: 'data'
        },
        {
          label: '输入 Token 数',
          value: responseParsed.usage?.prompt_tokens,
          displayValue: formatAuditValue(responseParsed.usage?.prompt_tokens),
          path: 'usage.prompt_tokens'
        },
        {
          label: '总 Token 数',
          value: responseParsed.usage?.total_tokens,
          displayValue: formatAuditValue(responseParsed.usage?.total_tokens),
          path: 'usage.total_tokens'
        }
      ].filter((item) => hasValue(item.value))
    };
  }

  if (schemaKey.includes('completion') && Array.isArray(responseParsed.choices)) {
    return {
      kind: 'completions',
      items: responseParsed.choices
        .map((choice, index) => {
          const value = choice.text || choice.message?.content || '';
          return {
            label: `补全结果 ${index + 1}`,
            value,
            displayValue: formatAuditValue(value),
            path: choice.text !== undefined ? `choices[${index}].text` : `choices[${index}].message.content`
          };
        })
        .filter((item) => hasValue(item.value))
    };
  }

  if (schemaKey.includes('audio')) {
    return {
      kind: 'audio',
      items: [
        { label: '文本', value: responseParsed.text, displayValue: formatAuditValue(responseParsed.text), path: 'text' },
        { label: '语言', value: responseParsed.language, displayValue: formatAuditValue(responseParsed.language), path: 'language' },
        { label: '时长', value: responseParsed.duration, displayValue: formatAuditValue(responseParsed.duration), path: 'duration' },
        {
          label: '分段数',
          value: Array.isArray(responseParsed.segments) ? responseParsed.segments.length : undefined,
          displayValue: formatAuditValue(Array.isArray(responseParsed.segments) ? responseParsed.segments.length : undefined),
          path: 'segments'
        }
      ].filter((item) => hasValue(item.value))
    };
  }

  return null;
};

const isConversationSchema = (schemaKey) =>
  [
    'openai-chat',
    'openai-compatible',
    'openai-chat-completions',
    'responses',
    'openai-responses',
    'claude',
    'claude-messages',
    'gemini',
    'gemini-generate-content'
  ].includes(normalizeKey(schemaKey));

const buildNonConversationRequest = (requestParsed, schemaKey = '') => {
  const normalizedSchemaKey = normalizeKey(schemaKey);

  if (isConversationSchema(normalizedSchemaKey)) {
    return null;
  }

  const isAudioSchema = normalizedSchemaKey.includes('audio');
  const isImageSchema = normalizedSchemaKey.includes('image');
  const isEmbeddingSchema = normalizedSchemaKey.includes('embedding');

  if (
    isAudioSchema ||
    requestParsed.voice !== undefined ||
    requestParsed.file !== undefined ||
    requestParsed.format !== undefined ||
    (requestParsed.response_format !== undefined &&
      (requestParsed.voice !== undefined || requestParsed.file !== undefined || requestParsed.format !== undefined)) ||
    isImageSchema ||
    requestParsed.prompt !== undefined ||
    requestParsed.size !== undefined ||
    requestParsed.quality !== undefined ||
    requestParsed.style !== undefined
  ) {
    return {
      kind: isAudioSchema || requestParsed.voice || requestParsed.file || requestParsed.format ? 'audio' : 'images',
      items: [
        {
          label: '输入内容',
          value: requestParsed.prompt ?? requestParsed.input,
          displayValue: formatAuditValue(requestParsed.prompt ?? requestParsed.input),
          path: requestParsed.prompt !== undefined ? 'prompt' : 'input'
        },
        { label: '尺寸', value: requestParsed.size, displayValue: formatAuditValue(requestParsed.size), path: 'size' },
        { label: '质量', value: requestParsed.quality, displayValue: formatAuditValue(requestParsed.quality), path: 'quality' },
        { label: '风格', value: requestParsed.style, displayValue: formatAuditValue(requestParsed.style), path: 'style' },
        { label: 'N', value: requestParsed.n, displayValue: formatAuditValue(requestParsed.n), path: 'n' },
        { label: '音色', value: requestParsed.voice, displayValue: formatAuditValue(requestParsed.voice), path: 'voice' },
        {
          label: '格式',
          value: requestParsed.format ?? requestParsed.response_format,
          displayValue: formatAuditValue(requestParsed.format ?? requestParsed.response_format),
          path: requestParsed.format !== undefined ? 'format' : 'response_format'
        },
        {
          label: '文件',
          value: requestParsed.file?.name || requestParsed.file,
          displayValue: formatAuditValue(requestParsed.file?.name || requestParsed.file),
          path: 'file'
        }
      ].filter((item) => hasValue(item.value))
    };
  }

  if (
    requestParsed.input !== undefined &&
    (isEmbeddingSchema ||
      requestParsed.encoding_format !== undefined ||
      requestParsed.dimensions !== undefined ||
      (Array.isArray(requestParsed.input) && isLikelyEmbeddingInput(requestParsed.input)))
  ) {
    const inputValue = Array.isArray(requestParsed.input) ? `${requestParsed.input.length} 项` : stringifyValue(requestParsed.input, false);
    return {
      kind: 'embeddings',
      items: [
        { label: '输入内容', value: inputValue, displayValue: formatAuditValue(inputValue), path: 'input' },
        {
          label: '编码格式',
          value: requestParsed.encoding_format,
          displayValue: formatAuditValue(requestParsed.encoding_format),
          path: 'encoding_format'
        },
        {
          label: '维度',
          value: requestParsed.dimensions,
          displayValue: formatAuditValue(requestParsed.dimensions),
          path: 'dimensions'
        }
      ].filter((item) => hasValue(item.value))
    };
  }

  return null;
};
