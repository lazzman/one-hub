const PROVIDER_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  claude: 'Anthropic',
  gemini: 'Gemini',
  google: 'Google Gemini',
  azure: 'Azure OpenAI',
  'vertex-ai': 'Vertex AI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  deepseek: 'DeepSeek',
  moonshot: 'Moonshot',
  mistral: 'Mistral',
  siliconflow: 'SiliconFlow',
  xai: 'xAI',
  github: 'GitHub Models',
  ollama: 'Ollama',
  ali: 'Alibaba Cloud',
  tencent: 'Tencent Hunyuan',
  hunyuan: 'Tencent Hunyuan',
  zhipu: 'Zhipu AI',
  baidu: 'Baidu Qianfan',
  cloudflare: 'Cloudflare AI',
  unknown: '未知提供方'
};

const SCHEMA_LABELS = {
  'openai-chat': 'OpenAI Chat Completions',
  'openai-compatible': 'OpenAI-compatible Chat',
  'openai-chat-completions': 'OpenAI Chat Completions',
  responses: 'OpenAI Responses',
  'openai-responses': 'OpenAI Responses',
  claude: 'Claude Messages',
  'claude-messages': 'Claude Messages',
  gemini: 'Gemini GenerateContent',
  'gemini-generate-content': 'Gemini GenerateContent',
  'openai-completions': 'OpenAI Completions',
  'openai-embeddings': 'OpenAI Embeddings',
  'openai-images': 'OpenAI Images',
  'openai-audio': 'OpenAI Audio',
  unknown: '未知 API 协议'
};

const ENDPOINT_LABELS = {
  responses: '/v1/responses',
  'chat-completions': '/v1/chat/completions',
  completions: '/v1/completions',
  embeddings: '/v1/embeddings',
  images: '/v1/images',
  audio: '/v1/audio',
  'claude-messages': 'Claude Messages 端点',
  'gemini-generate-content': 'Gemini generateContent 端点',
  unknown: '未知端点'
};

const toKey = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const toText = (value) => (typeof value === 'string' ? value.trim() : '');
const isNativeOpenAIChatProvider = (providerKey) => ['openai', 'azure'].includes(providerKey);

const inferSchemaKey = ({ source, requestParsed, responseParsed }) => {
  const providerKey = toKey(source?.api_provider || source?.provider);
  const explicit = toKey(source?.api_schema);
  if (explicit) return explicit;

  const hint = toKey(source?.protocol_hint || source?.protocol || source?.protocolHint);
  if (hint === 'openai-chat' && providerKey && !isNativeOpenAIChatProvider(providerKey)) {
    return 'openai-compatible';
  }
  if (hint) return hint;

  const path = toKey(source?.endpoint_path || source?.endpointPath);
  if (path.startsWith('/v1/responses')) return 'openai-responses';
  if (path.startsWith('/v1/chat/completions')) return 'openai-chat';
  if (path.startsWith('/v1/completions')) return 'openai-completions';
  if (path.startsWith('/v1/embeddings')) return 'openai-embeddings';
  if (path.startsWith('/v1/images')) return 'openai-images';
  if (path.startsWith('/v1/audio')) return 'openai-audio';
  if (path.startsWith('/claude')) return 'claude-messages';
  if (path.startsWith('/gemini')) return 'gemini-generate-content';

  if (Array.isArray(requestParsed?.input) || responseParsed?.object === 'response' || Array.isArray(responseParsed?.output)) {
    return 'openai-responses';
  }
  if (Array.isArray(requestParsed?.messages) && requestParsed?.anthropic_version) return 'claude-messages';
  if (Array.isArray(requestParsed?.contents) || Array.isArray(responseParsed?.candidates)) return 'gemini-generate-content';
  if (Array.isArray(requestParsed?.messages) || Array.isArray(responseParsed?.choices)) return 'openai-chat';
  return 'unknown';
};

const inferEndpointKey = ({ source, schemaKey }) => {
  const explicit = toKey(source?.api_endpoint);
  if (explicit) return explicit;

  const path = toKey(source?.endpoint_path || source?.endpointPath);
  if (path.startsWith('/v1/responses')) return 'responses';
  if (path.startsWith('/v1/chat/completions')) return 'chat-completions';
  if (path.startsWith('/v1/completions')) return 'completions';
  if (path.startsWith('/v1/embeddings')) return 'embeddings';
  if (path.startsWith('/v1/images')) return 'images';
  if (path.startsWith('/v1/audio')) return 'audio';
  if (path.startsWith('/claude')) return 'claude-messages';
  if (path.startsWith('/gemini')) return 'gemini-generate-content';

  if (schemaKey.includes('responses')) return 'responses';
  if (schemaKey.includes('completion') && !schemaKey.includes('chat')) return 'completions';
  if (schemaKey.includes('embedding')) return 'embeddings';
  if (schemaKey.includes('image')) return 'images';
  if (schemaKey.includes('audio')) return 'audio';
  if (schemaKey.includes('claude')) return 'claude-messages';
  if (schemaKey.includes('gemini')) return 'gemini-generate-content';
  if (schemaKey.includes('chat')) return 'chat-completions';
  return 'unknown';
};

export const buildSourceDisplayModel = ({ source = {}, requestParsed = null, responseParsed = null } = {}) => {
  const providerKey = toKey(source.api_provider || source.provider) || 'unknown';
  const schemaKey = inferSchemaKey({ source, requestParsed, responseParsed });
  const endpointKey = inferEndpointKey({ source, schemaKey });
  const transportKey = toKey(source.api_transport) || (source.isStream ? 'stream' : 'non-stream');
  const endpointPath = toText(source.endpoint_path || source.endpointPath);
  const channelName = toText(source.channel_name || source.channelName);
  const parseFailed = Boolean(source.parseFailed);

  return {
    provider: {
      key: providerKey,
      label: PROVIDER_LABELS[providerKey] || source.api_provider || source.provider || providerKey
    },
    schema: {
      key: schemaKey,
      label: SCHEMA_LABELS[schemaKey] || source.api_schema || schemaKey
    },
    endpoint: {
      key: endpointKey,
      label: endpointPath || ENDPOINT_LABELS[endpointKey] || source.api_endpoint || endpointKey,
      path: endpointPath
    },
    transport: {
      key: transportKey,
      label: transportKey === 'stream' ? '流式' : '非流式',
      isStream: transportKey === 'stream'
    },
    channel: {
      name: channelName,
      type: source.channel_type || source.channelType || 0
    },
    badges: [
      { key: 'provider', label: PROVIDER_LABELS[providerKey] || source.provider || providerKey, color: 'primary' },
      { key: 'schema', label: SCHEMA_LABELS[schemaKey] || schemaKey, color: 'secondary' },
      { key: 'transport', label: transportKey === 'stream' ? '流式' : '非流式', color: transportKey === 'stream' ? 'success' : 'default' },
      channelName ? { key: 'channel', label: channelName, color: 'default' } : null,
      parseFailed ? { key: 'fallback', label: '降级视图', color: 'warning' } : null
    ].filter(Boolean),
    capabilities: {
      conversation: [
        'openai-chat',
        'openai-compatible',
        'openai-chat-completions',
        'responses',
        'openai-responses',
        'claude',
        'claude-messages',
        'gemini',
        'gemini-generate-content'
      ].includes(schemaKey),
      nonConversation: ['openai-completions', 'openai-embeddings', 'openai-images', 'openai-audio'].includes(schemaKey)
    }
  };
};

export const getPreferredCurlTarget = (sourceDisplay) => {
  const schemaKey = sourceDisplay?.schema?.key || '';
  if (schemaKey.includes('responses')) return 'responses';
  if (schemaKey.includes('claude')) return 'claude';
  if (schemaKey.includes('gemini')) return 'gemini';
  return 'openai';
};
