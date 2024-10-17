/**
 * 内容类型检测器
 * 用于智能检测 JSON 中的特殊内容类型（Markdown、图片、音频、文档、工具调用等）
 */

// 支持的内容类型
export const ContentType = {
  MARKDOWN: 'markdown',
  IMAGE_URL: 'image_url',
  IMAGE_BASE64: 'image_base64',
  AUDIO: 'audio',
  DOCUMENT: 'document',
  FILE: 'file',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  PLAIN_TEXT: 'plain_text'
};

// 消息格式类型
export const MessageFormat = {
  OPENAI: 'openai',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  UNKNOWN: 'unknown'
};

// 图片 URL 扩展名
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];

// Markdown 特征正则表达式
const MARKDOWN_PATTERNS = [
  /^#{1,6}\s+.+/m, // 标题 # ## ### 等
  /\*\*[^*]+\*\*/, // 粗体 **text**
  /\*[^*]+\*/, // 斜体 *text*
  /__[^_]+__/, // 粗体 __text__
  /_[^_]+_/, // 斜体 _text_
  /\[.+\]\(.+\)/, // 链接 [text](url)
  /!\[.*\]\(.+\)/, // 图片 ![alt](url)
  /```[\s\S]*?```/, // 代码块 ```code```
  /`[^`]+`/, // 行内代码 `code`
  /^\s*[-*+]\s+.+/m, // 无序列表 - item
  /^\s*\d+\.\s+.+/m, // 有序列表 1. item
  /^\s*>\s+.+/m, // 引用 > quote
  /^\s*\|.+\|.+\|/m, // 表格 | col1 | col2 |
  /^---+$/m, // 分隔线 ---
  /^\*\*\*+$/m // 分隔线 ***
];

/**
 * 检测字符串是否包含 Markdown 格式
 * @param {string} text - 要检测的文本
 * @returns {boolean} 是否包含 Markdown
 */
export function isMarkdown(text) {
  if (!text || typeof text !== 'string') return false;

  // 检测是否包含 <think> 或 <thinking> 标签
  if (/<(think|thinking)>[\s\S]*?<\/\1>/.test(text)) {
    return true;
  }

  // 至少匹配 2 个 Markdown 特征才认为是 Markdown
  let matchCount = 0;
  for (const pattern of MARKDOWN_PATTERNS) {
    if (pattern.test(text)) {
      matchCount++;
      if (matchCount >= 2) return true;
    }
  }

  // 如果只匹配一个特征，但文本较长且包含换行，也认为可能是 Markdown
  if (matchCount === 1 && text.length > 100 && text.includes('\n')) {
    return true;
  }

  return false;
}

/**
 * 检测字符串是否是图片 URL
 * @param {string} text - 要检测的文本
 * @returns {boolean} 是否是图片 URL
 */
export function isImageUrl(text) {
  if (!text || typeof text !== 'string') return false;

  // 检查是否是 HTTP(S) URL
  if (!text.startsWith('http://') && !text.startsWith('https://')) {
    return false;
  }

  // 检查扩展名
  const lowerText = text.toLowerCase();
  for (const ext of IMAGE_EXTENSIONS) {
    if (lowerText.includes(ext)) {
      return true;
    }
  }

  // 检查常见图片服务 URL 模式
  const imageServicePatterns = [
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i,
    /\/image\//i,
    /\/images\//i,
    /\/img\//i,
    /\/photo\//i,
    /imgur\.com/i,
    /cloudinary\.com/i,
    /unsplash\.com/i,
    /pexels\.com/i
  ];

  for (const pattern of imageServicePatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * 检测字符串是否是 Base64 图片
 * @param {string} text - 要检测的文本
 * @returns {boolean} 是否是 Base64 图片
 */
export function isBase64Image(text) {
  if (!text || typeof text !== 'string') return false;

  // 检查 data URI 格式
  if (text.startsWith('data:image/')) {
    return true;
  }

  // 检查纯 Base64 字符串（较长且只包含 Base64 字符）
  if (text.length > 100) {
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    if (base64Pattern.test(text.replace(/\s/g, ''))) {
      // 尝试检测是否是图片的 Base64
      // PNG 魔数: iVBORw0KGgo
      // JPEG 魔数: /9j/
      // GIF 魔数: R0lGOD
      if (text.startsWith('iVBORw0KGgo') || text.startsWith('/9j/') || text.startsWith('R0lGOD')) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 检测内容类型
 * @param {string} text - 要检测的文本
 * @returns {string} 内容类型
 */
export function detectContentType(text) {
  if (isBase64Image(text)) return ContentType.IMAGE_BASE64;
  if (isImageUrl(text)) return ContentType.IMAGE_URL;
  if (isMarkdown(text)) return ContentType.MARKDOWN;
  return ContentType.PLAIN_TEXT;
}

/**
 * 检测 AI 响应内容的类型（更宽松的 Markdown 检测）
 * AI 响应通常是 Markdown 格式的文本，因此使用更低的阈值
 * @param {string} text - 要检测的文本
 * @returns {string} 内容类型
 */
function detectContentTypeForAIResponse(text) {
  if (!text || typeof text !== 'string') return ContentType.PLAIN_TEXT;
  
  // 先检测图片类型
  if (isBase64Image(text)) return ContentType.IMAGE_BASE64;
  if (isImageUrl(text)) return ContentType.IMAGE_URL;
  
  // 检测是否包含 <think> 标签
  if (/<think>[\s\S]*?<\/think>/.test(text)) {
    return ContentType.MARKDOWN;
  }
  
  // 对于 AI 响应，使用更宽松的 Markdown 检测
  // 只要匹配 1 个 Markdown 特征就认为是 Markdown
  for (const pattern of MARKDOWN_PATTERNS) {
    if (pattern.test(text)) {
      return ContentType.MARKDOWN;
    }
  }
  
  // 如果文本较长（超过 200 字符）且包含换行，也认为可能是 Markdown
  // 因为 AI 通常会返回格式化的长文本
  if (text.length > 200 && text.includes('\n')) {
    return ContentType.MARKDOWN;
  }
  
  return ContentType.PLAIN_TEXT;
}

/**
 * 检测是否是 OpenAI 响应格式
 * OpenAI 格式: { choices: [{ message: { content: "..." } }] }
 * 或者: { choices: [{ message: { tool_calls: [...] } }] }
 * @param {any} data - 要检测的数据
 * @returns {boolean} 是否是 OpenAI 响应格式
 */
function isOpenAIResponse(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.choices) || data.choices.length === 0) {
    return false;
  }
  
  const message = data.choices[0]?.message;
  if (!message) return false;
  
  // 检测是否有 content 或 tool_calls
  return message.content !== undefined || Array.isArray(message.tool_calls);
}

/**
 * 检测是否是 Claude 响应格式
 * Claude 格式: { type: "message", role: "assistant", content: [{ type: "text", text: "..." }] }
 * @param {any} data - 要检测的数据
 * @returns {boolean} 是否是 Claude 响应格式
 */
function isClaudeResponse(data) {
  return (
    data &&
    typeof data === 'object' &&
    data.type === 'message' &&
    data.role === 'assistant' &&
    Array.isArray(data.content)
  );
}

/**
 * 检测是否是 Gemini 响应格式
 * Gemini 格式: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
 * @param {any} data - 要检测的数据
 * @returns {boolean} 是否是 Gemini 响应格式
 */
function isGeminiResponse(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.candidates) &&
    data.candidates.length > 0 &&
    data.candidates[0]?.content?.parts !== undefined
  );
}

/**
 * 检测 AI 响应格式类型
 * @param {any} data - 要检测的数据
 * @returns {string|null} 响应格式类型 ('openai', 'claude', 'gemini') 或 null
 */
function detectAIResponseFormat(data) {
  if (isOpenAIResponse(data)) return 'openai';
  if (isClaudeResponse(data)) return 'claude';
  if (isGeminiResponse(data)) return 'gemini';
  return null;
}

/**
 * 从 OpenAI 响应中提取内容
 * @param {Object} data - OpenAI 响应对象
 * @returns {Array} 提取的内容数组
 */
function extractOpenAIResponseContent(data) {
  const results = [];
  
  data.choices.forEach((choice, choiceIndex) => {
    const message = choice.message;
    if (!message) return;
    
    const basePath = `choices[${choiceIndex}].message`;
    
    // 处理 content 字段
    if (message.content !== undefined && message.content !== null) {
      if (typeof message.content === 'string') {
        // 字符串内容，使用启发式检测作为后备
        const type = detectContentTypeForAIResponse(message.content);
        if (type !== ContentType.PLAIN_TEXT) {
          results.push({
            type,
            content: message.content,
            path: `${basePath}.content`
          });
        }
      } else if (Array.isArray(message.content)) {
        // 处理多模态内容数组
        message.content.forEach((item, index) => {
          const itemPath = `${basePath}.content[${index}]`;
          if (typeof item === 'string') {
            // 字符串内容，使用启发式检测作为后备
            const type = detectContentTypeForAIResponse(item);
            if (type !== ContentType.PLAIN_TEXT) {
              results.push({ type, content: item, path: itemPath });
            }
          } else if (item.type === 'text' && item.text) {
            // OpenAI 格式：type: "text" 直接识别为 Markdown
            results.push({ type: ContentType.MARKDOWN, content: item.text, path: `${itemPath}.text` });
          } else if (item.type === 'image_url' && item.image_url?.url) {
            results.push({
              type: isBase64Image(item.image_url.url) ? ContentType.IMAGE_BASE64 : ContentType.IMAGE_URL,
              content: item.image_url.url,
              path: `${itemPath}.image_url.url`
            });
          }
        });
      }
    }
    
    // 处理 tool_calls - 将工具调用作为 TOOL_CALL 类型返回
    if (Array.isArray(message.tool_calls)) {
      message.tool_calls.forEach((toolCall, toolIndex) => {
        // 支持两种格式：
        // 1. 标准格式: { type: "function", function: { name, arguments } }
        // 2. 简化格式: { function: { name, arguments } } (没有 type 字段)
        if (toolCall.function) {
          results.push({
            type: ContentType.TOOL_CALL,
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
            path: `${basePath}.tool_calls[${toolIndex}]`
          });
        }
      });
    }
  });
  
  return results;
}

/**
 * 从 Claude 响应中提取内容
 * @param {Object} data - Claude 响应对象
 * @returns {Array} 提取的内容数组
 */
function extractClaudeResponseContent(data) {
  const results = [];
  
  if (!Array.isArray(data.content)) return results;
  
  data.content.forEach((item, index) => {
    const basePath = `content[${index}]`;
    
    // 处理文本内容
    // Claude 格式：type: "text" 直接识别为 Markdown
    if (item.type === 'text' && item.text) {
      results.push({
        type: ContentType.MARKDOWN,
        content: item.text,
        path: `${basePath}.text`
      });
    }
    
    // 处理思考内容 (thinking)
    // thinking 内容也直接识别为 Markdown
    if (item.type === 'thinking' && item.thinking) {
      results.push({
        type: ContentType.MARKDOWN,
        content: item.thinking,
        path: `${basePath}.thinking`
      });
    }
    
    // 处理图片内容
    if (item.type === 'image' && item.source) {
      if (item.source.type === 'base64' && item.source.data) {
        results.push({
          type: ContentType.IMAGE_BASE64,
          content: item.source.media_type
            ? `data:${item.source.media_type};base64,${item.source.data}`
            : item.source.data,
          path: `${basePath}.source.data`
        });
      } else if (item.source.type === 'url' && item.source.url) {
        results.push({
          type: ContentType.IMAGE_URL,
          content: item.source.url,
          path: `${basePath}.source.url`
        });
      }
    }
    
    // 处理工具调用结果
    if (item.type === 'tool_use' && item.input) {
      const toolResults = detectContentTypes(item.input, `${basePath}.input`);
      results.push(...toolResults);
    }
  });
  
  return results;
}

/**
 * 从 Gemini 响应中提取内容
 * @param {Object} data - Gemini 响应对象
 * @returns {Array} 提取的内容数组
 */
function extractGeminiResponseContent(data) {
  const results = [];
  
  if (!Array.isArray(data.candidates)) return results;
  
  data.candidates.forEach((candidate, candidateIndex) => {
    const content = candidate.content;
    if (!content || !Array.isArray(content.parts)) return;
    
    content.parts.forEach((part, partIndex) => {
      const basePath = `candidates[${candidateIndex}].content.parts[${partIndex}]`;
      
      // 处理文本内容
      // Gemini 格式：有 text 字段直接识别为 Markdown
      if (part.text !== undefined) {
        results.push({
          type: ContentType.MARKDOWN,
          content: part.text,
          path: `${basePath}.text`
        });
      }
      
      // 处理内联数据（图片等）
      if (part.inlineData) {
        if (part.inlineData.mimeType?.startsWith('image/') && part.inlineData.data) {
          results.push({
            type: ContentType.IMAGE_BASE64,
            content: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            path: `${basePath}.inlineData.data`
          });
        }
      }
      
      // 处理文件数据
      if (part.fileData && part.fileData.fileUri) {
        if (part.fileData.mimeType?.startsWith('image/')) {
          results.push({
            type: ContentType.IMAGE_URL,
            content: part.fileData.fileUri,
            path: `${basePath}.fileData.fileUri`
          });
        }
      }
      
      // 处理代码执行结果
      // 代码块本身就是 Markdown，直接识别
      if (part.executableCode && part.executableCode.code) {
        const codeContent = '```' + (part.executableCode.language || '') + '\n' + part.executableCode.code + '\n```';
        results.push({
          type: ContentType.MARKDOWN,
          content: codeContent,
          path: `${basePath}.executableCode.code`
        });
      }
      
      // 处理函数调用
      if (part.functionCall && part.functionCall.args) {
        const toolResults = detectContentTypes(part.functionCall.args, `${basePath}.functionCall.args`);
        results.push(...toolResults);
      }
    });
  });
  
  return results;
}

/**
 * 从 AI 响应中提取内容（统一入口）
 * @param {Object} data - AI 响应对象
 * @param {string} format - 响应格式类型
 * @returns {Array} 提取的内容数组
 */
function extractAIResponseContent(data, format) {
  switch (format) {
    case 'openai':
      return extractOpenAIResponseContent(data);
    case 'claude':
      return extractClaudeResponseContent(data);
    case 'gemini':
      return extractGeminiResponseContent(data);
    default:
      return [];
  }
}

/**
 * 从对象中递归提取所有可预览的内容
 * @param {any} data - 要检测的数据
 * @param {string} path - 当前路径
 * @returns {Array} 检测结果数组
 */
export function detectContentTypes(data, path = '') {
  const results = [];

  if (data === null || data === undefined) {
    return results;
  }

  // 处理字符串
  if (typeof data === 'string') {
    // 尝试解析为 JSON
    try {
      const parsed = JSON.parse(data);
      // 检测是否是 AI 响应格式
      const format = detectAIResponseFormat(parsed);
      if (format) {
        return extractAIResponseContent(parsed, format);
      }
      // 否则递归处理解析后的对象
      return detectContentTypes(parsed, path);
    } catch {
      // 不是 JSON，检测字符串本身的类型
      const type = detectContentType(data);
      if (type !== ContentType.PLAIN_TEXT) {
        results.push({
          type,
          content: data,
          path
        });
      }
      return results;
    }
  }

  // 特殊处理 AI 响应格式（OpenAI、Claude、Gemini）
  const format = detectAIResponseFormat(data);
  if (format) {
    return extractAIResponseContent(data, format);
  }

  // 处理数组
  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      const itemPath = path ? `${path}[${index}]` : `[${index}]`;
      results.push(...detectContentTypes(item, itemPath));
    });
    return results;
  }

  // 处理对象
  if (typeof data === 'object') {
    // 特殊处理 OpenAI 格式的 image_url
    if (data.type === 'image_url' && data.image_url?.url) {
      results.push({
        type: isBase64Image(data.image_url.url) ? ContentType.IMAGE_BASE64 : ContentType.IMAGE_URL,
        content: data.image_url.url,
        path: path ? `${path}.image_url.url` : 'image_url.url'
      });
      return results;
    }

    // 特殊处理 content 字段（通常包含主要文本内容）
    if (data.content !== undefined) {
      const contentPath = path ? `${path}.content` : 'content';

      if (typeof data.content === 'string') {
        const type = detectContentType(data.content);
        if (type !== ContentType.PLAIN_TEXT) {
          results.push({
            type,
            content: data.content,
            path: contentPath
          });
        }
      } else if (Array.isArray(data.content)) {
        // 处理 content 数组（如 OpenAI 多模态消息）
        data.content.forEach((item, index) => {
          const itemPath = `${contentPath}[${index}]`;
          if (typeof item === 'string') {
            const type = detectContentType(item);
            if (type !== ContentType.PLAIN_TEXT) {
              results.push({ type, content: item, path: itemPath });
            }
          } else if (item.type === 'text' && item.text) {
            const type = detectContentType(item.text);
            if (type !== ContentType.PLAIN_TEXT) {
              results.push({ type, content: item.text, path: `${itemPath}.text` });
            }
          } else if (item.type === 'image_url' && item.image_url?.url) {
            results.push({
              type: isBase64Image(item.image_url.url) ? ContentType.IMAGE_BASE64 : ContentType.IMAGE_URL,
              content: item.image_url.url,
              path: `${itemPath}.image_url.url`
            });
          }
        });
      }
    }

    // 递归处理其他字段
    for (const [key, value] of Object.entries(data)) {
      if (key === 'content') continue; // 已经处理过
      const fieldPath = path ? `${path}.${key}` : key;
      results.push(...detectContentTypes(value, fieldPath));
    }
  }

  return results;
}

/**
 * 按类型分组检测结果
 * @param {Array} detectedItems - 检测结果数组
 * @returns {Object} 按类型分组的结果
 */
export function groupByType(detectedItems) {
  const grouped = {
    [ContentType.MARKDOWN]: [],
    [ContentType.IMAGE_URL]: [],
    [ContentType.IMAGE_BASE64]: []
  };

  for (const item of detectedItems) {
    if (grouped[item.type]) {
      grouped[item.type].push(item);
    }
  }

  return grouped;
}

/**
 * 获取所有图片（合并 URL 和 Base64）
 * @param {Object} grouped - 分组后的结果
 * @returns {Array} 所有图片项
 */
export function getAllImages(grouped) {
  return [...grouped[ContentType.IMAGE_URL], ...grouped[ContentType.IMAGE_BASE64]];
}

/**
 * 检查是否有可预览的内容
 * @param {Array} detectedItems - 检测结果数组
 * @returns {boolean} 是否有可预览内容
 */
export function hasPreviewableContent(detectedItems) {
  return detectedItems.length > 0;
}

// ============================================================
// 请求格式检测函数
// ============================================================

/**
 * 请求格式类型
 */
export const RequestFormat = {
  OPENAI: 'openai',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  UNKNOWN: 'unknown'
};

/**
 * 检测请求体的格式类型
 * @param {Object} requestBody - 请求体对象
 * @returns {string} 请求格式类型 (RequestFormat)
 */
export function detectRequestFormat(requestBody) {
  if (!requestBody || typeof requestBody !== 'object') {
    return RequestFormat.UNKNOWN;
  }

  // Gemini 格式特征：有 contents 字段（消息数组）
  if (Array.isArray(requestBody.contents)) {
    return RequestFormat.GEMINI;
  }

  // Claude 格式特征：
  // - system 字段是数组（Claude 的系统提示格式）
  // - 或者 messages 中有 Claude 特有的内容类型
  if (Array.isArray(requestBody.system)) {
    return RequestFormat.CLAUDE;
  }

  // 检查 messages 数组中的消息格式
  if (Array.isArray(requestBody.messages) && requestBody.messages.length > 0) {
    // 遍历消息检测格式
    for (const message of requestBody.messages) {
      if (!message || typeof message !== 'object') continue;
      
      // Claude 特有：content 数组中有 tool_use/tool_result/image/document 类型
      if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (!item || typeof item !== 'object') continue;
          if (item.type === 'tool_use' || item.type === 'tool_result' ||
              item.type === 'image' || item.type === 'document') {
            return RequestFormat.CLAUDE;
          }
          // Claude 的 text 块可能有 cache_control
          if (item.type === 'text' && item.cache_control !== undefined) {
            return RequestFormat.CLAUDE;
          }
        }
      }
    }
    // 默认有 messages 字段的是 OpenAI 格式
    return RequestFormat.OPENAI;
  }

  // 检查是否有 OpenAI 格式的 tools 定义（即使没有 messages）
  // OpenAI tools 格式: [{ type: "function", function: { name: "...", ... } }]
  if (Array.isArray(requestBody.tools) && requestBody.tools.length > 0) {
    const firstTool = requestBody.tools[0];
    // OpenAI 格式的 tools 有 type: "function" 和 function 字段
    if (firstTool && (firstTool.type === 'function' || firstTool.function)) {
      return RequestFormat.OPENAI;
    }
    // Claude 格式的 tools 直接有 name 和 input_schema 字段
    if (firstTool && firstTool.name && firstTool.input_schema) {
      return RequestFormat.CLAUDE;
    }
  }

  // 如果有 messages 字段但为空数组，也认为是 OpenAI 格式
  if (Array.isArray(requestBody.messages)) {
    return RequestFormat.OPENAI;
  }

  // 检查是否有 model 字段（通用 AI API 特征）
  if (requestBody.model !== undefined) {
    return RequestFormat.OPENAI;
  }

  return RequestFormat.UNKNOWN;
}

/**
 * 从 OpenAI 请求体中检测内容
 * @param {Object} requestBody - OpenAI 格式的请求体
 * @returns {Array} 检测结果数组
 */
export function detectOpenAIRequestContent(requestBody) {
  const results = [];
  if (!requestBody || typeof requestBody !== 'object') return results;

  // 检测 messages 数组中的内容
  if (Array.isArray(requestBody.messages)) {
    requestBody.messages.forEach((message, index) => {
      const basePath = `messages[${index}]`;
      
      // 检测消息内容
      const contentResults = detectOpenAIMessageContent(message, basePath);
      results.push(...contentResults);
      
      // 检测工具调用
      const toolCallResults = detectOpenAIToolCalls(message, basePath);
      results.push(...toolCallResults);
      
      // 检测工具结果
      const toolResultResults = detectOpenAIToolResult(message, basePath);
      results.push(...toolResultResults);
    });
  }

  // 检测 tools 定义
  if (Array.isArray(requestBody.tools) && requestBody.tools.length > 0) {
    results.push({
      type: 'tool_definition',
      count: requestBody.tools.length,
      // 支持 OpenAI 格式 (t.function.name) 和直接 name 字段
      tools: requestBody.tools.map(t => t.function?.name || t.name || 'unknown'),
      path: 'tools'
    });
  }

  return results;
}

/**
 * 从 Claude 请求体中检测内容
 * @param {Object} requestBody - Claude 格式的请求体
 * @returns {Array} 检测结果数组
 */
export function detectClaudeRequestContent(requestBody) {
  const results = [];
  if (!requestBody || typeof requestBody !== 'object') return results;

  // 检测 system 字段（Claude 的系统提示）
  if (Array.isArray(requestBody.system)) {
    requestBody.system.forEach((item, index) => {
      const basePath = `system[${index}]`;
      if (item && typeof item === 'object') {
        if (item.type === 'text' && item.text) {
          const type = detectContentType(item.text);
          if (type !== ContentType.PLAIN_TEXT) {
            results.push({
              type,
              content: item.text,
              path: `${basePath}.text`
            });
          }
        }
      }
    });
  } else if (typeof requestBody.system === 'string') {
    // 字符串格式的系统提示
    const type = detectContentType(requestBody.system);
    if (type !== ContentType.PLAIN_TEXT) {
      results.push({
        type,
        content: requestBody.system,
        path: 'system'
      });
    }
  }

  // 检测 messages 数组中的内容
  if (Array.isArray(requestBody.messages)) {
    requestBody.messages.forEach((message, index) => {
      const basePath = `messages[${index}]`;
      
      // 检测消息内容
      const contentResults = detectClaudeMessageContent(message, basePath);
      results.push(...contentResults);
      
      // 检测工具调用
      const toolUseResults = detectClaudeToolUse(message, basePath);
      results.push(...toolUseResults);
      
      // 检测工具结果
      const toolResultResults = detectClaudeToolResult(message, basePath);
      results.push(...toolResultResults);
    });
  }

  // 检测 tools 定义
  if (Array.isArray(requestBody.tools) && requestBody.tools.length > 0) {
    results.push({
      type: 'tool_definition',
      count: requestBody.tools.length,
      tools: requestBody.tools.map(t => t.name || 'unknown'),
      path: 'tools'
    });
  }

  return results;
}

/**
 * 从 Gemini 请求体中检测内容
 * @param {Object} requestBody - Gemini 格式的请求体
 * @returns {Array} 检测结果数组
 */
export function detectGeminiRequestContent(requestBody) {
  const results = [];
  if (!requestBody || typeof requestBody !== 'object') return results;

  // 检测 systemInstruction 字段
  if (requestBody.systemInstruction) {
    const sysInstr = requestBody.systemInstruction;
    if (Array.isArray(sysInstr.parts)) {
      sysInstr.parts.forEach((part, index) => {
        const basePath = `systemInstruction.parts[${index}]`;
        if (part && part.text !== undefined) {
          const type = detectContentType(part.text);
          if (type !== ContentType.PLAIN_TEXT) {
            results.push({
              type,
              content: part.text,
              path: `${basePath}.text`
            });
          }
        }
      });
    }
  }

  // 检测 contents 数组中的内容
  if (Array.isArray(requestBody.contents)) {
    requestBody.contents.forEach((content, index) => {
      const basePath = `contents[${index}]`;
      
      // 检测消息内容
      const contentResults = detectGeminiMessageContent(content, basePath);
      results.push(...contentResults);
      
      // 检测函数调用
      const funcCallResults = detectGeminiFunctionCall(content, basePath);
      results.push(...funcCallResults);
      
      // 检测函数响应
      const funcResponseResults = detectGeminiFunctionResponse(content, basePath);
      results.push(...funcResponseResults);
    });
  }

  // 检测 tools 定义
  if (Array.isArray(requestBody.tools)) {
    let toolCount = 0;
    const toolNames = [];
    requestBody.tools.forEach(toolGroup => {
      if (Array.isArray(toolGroup.functionDeclarations)) {
        toolGroup.functionDeclarations.forEach(func => {
          toolCount++;
          toolNames.push(func.name || 'unknown');
        });
      }
    });
    if (toolCount > 0) {
      results.push({
        type: 'tool_definition',
        count: toolCount,
        tools: toolNames,
        path: 'tools'
      });
    }
  }

  return results;
}

/**
 * 检测请求体中的所有内容（统一入口）
 * 自动识别请求格式并调用对应的检测函数
 * @param {Object|string} requestBody - 请求体对象或 JSON 字符串
 * @returns {Object} 包含 format 和 items 的检测结果
 */
export function detectRequestContent(requestBody) {
  // 如果是字符串，尝试解析
  let parsedBody = requestBody;
  if (typeof requestBody === 'string') {
    try {
      parsedBody = JSON.parse(requestBody);
    } catch {
      return { format: RequestFormat.UNKNOWN, items: [] };
    }
  }

  const format = detectRequestFormat(parsedBody);
  let items = [];

  switch (format) {
    case RequestFormat.OPENAI:
      items = detectOpenAIRequestContent(parsedBody);
      break;
    case RequestFormat.CLAUDE:
      items = detectClaudeRequestContent(parsedBody);
      break;
    case RequestFormat.GEMINI:
      items = detectGeminiRequestContent(parsedBody);
      break;
    default:
      // 未知格式，使用通用检测
      items = detectContentTypes(parsedBody);
      break;
  }

  return { format, items };
}

// ============================================================
// 消息格式检测函数
// ============================================================

/**
 * 检测单条消息的格式类型
 * @param {Object} message - 消息对象
 * @returns {string} 消息格式类型 (MessageFormat)
 */
export function detectMessageFormat(message) {
  if (!message || typeof message !== 'object') {
    return MessageFormat.UNKNOWN;
  }

  // OpenAI 格式特征：role + content/tool_calls，或 role=tool
  if (message.role !== undefined) {
    // OpenAI 工具结果消息
    if (message.role === 'tool' && message.tool_call_id !== undefined) {
      return MessageFormat.OPENAI;
    }
    // OpenAI 助手消息带 tool_calls
    if (message.tool_calls !== undefined) {
      return MessageFormat.OPENAI;
    }
    // 检查 content 格式来区分 OpenAI 和 Claude
    if (Array.isArray(message.content)) {
      // 遍历所有 content 元素来检测格式
      for (const item of message.content) {
        if (!item || typeof item !== 'object') continue;
        
        // Claude 特有类型（可能出现在数组任意位置）
        if (item.type === 'tool_use' || item.type === 'tool_result' ||
            item.type === 'image' || item.type === 'document') {
          return MessageFormat.CLAUDE;
        }
        // OpenAI 特有类型
        if (item.type === 'image_url' || item.type === 'input_audio') {
          return MessageFormat.OPENAI;
        }
        // Claude 的 text 块可能有 cache_control
        if (item.type === 'text' && item.cache_control !== undefined) {
          return MessageFormat.CLAUDE;
        }
      }
    }
    // 默认认为是 OpenAI 格式（最常见）
    return MessageFormat.OPENAI;
  }

  // Gemini 格式特征：parts 数组
  if (Array.isArray(message.parts)) {
    return MessageFormat.GEMINI;
  }

  return MessageFormat.UNKNOWN;
}

/**
 * 检测消息数组的格式类型
 * @param {Array} messages - 消息数组
 * @returns {string} 消息格式类型 (MessageFormat)
 */
export function detectMessagesFormat(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return MessageFormat.UNKNOWN;
  }

  // 检测第一条消息的格式
  return detectMessageFormat(messages[0]);
}

// ============================================================
// OpenAI 消息内容检测
// ============================================================

/**
 * 检测 OpenAI 消息中的多媒体内容
 * @param {Object} message - OpenAI 格式的消息
 * @param {string} basePath - 基础路径
 * @returns {Array} 检测结果数组
 */
export function detectOpenAIMessageContent(message, basePath = '') {
  const results = [];
  if (!message || typeof message !== 'object') return results;

  const pathPrefix = basePath ? `${basePath}.` : '';

  // 如果是工具结果消息，不检测 content（由 detectOpenAIToolResult 处理）
  if (message.role === 'tool' && message.tool_call_id !== undefined) {
    return results;
  }

  // 处理 content 字段
  if (message.content !== undefined && message.content !== null) {
    if (typeof message.content === 'string') {
      // 纯字符串内容
      // 跳过空字符串
      if (message.content.trim() === '') {
        // 空字符串不识别为任何可预览类型
      } else if (isBase64Image(message.content)) {
        // 检测是否是图片类型
        results.push({
          type: ContentType.IMAGE_BASE64,
          content: message.content,
          path: `${pathPrefix}content`
        });
      } else if (isImageUrl(message.content)) {
        results.push({
          type: ContentType.IMAGE_URL,
          content: message.content,
          path: `${pathPrefix}content`
        });
      } else {
        // 非图片内容，直接识别为 Markdown（包括纯文本）
        // 这样用户消息和助手消息的纯字符串 content 都能被预览
        results.push({
          type: ContentType.MARKDOWN,
          content: message.content,
          path: `${pathPrefix}content`
        });
      }
    } else if (Array.isArray(message.content)) {
      // 多模态内容数组
      message.content.forEach((item, index) => {
        const itemPath = `${pathPrefix}content[${index}]`;
        
        if (typeof item === 'string') {
          // 纯字符串内容，使用启发式检测作为后备
          const type = detectContentTypeForAIResponse(item);
          if (type !== ContentType.PLAIN_TEXT) {
            results.push({ type, content: item, path: itemPath });
          }
        } else if (item && typeof item === 'object') {
          // 文本内容块
          // OpenAI 格式：type: "text" 直接识别为 Markdown
          if (item.type === 'text' && item.text) {
            results.push({ type: ContentType.MARKDOWN, content: item.text, path: `${itemPath}.text` });
          }
          // 图片 URL
          else if (item.type === 'image_url' && item.image_url?.url) {
            results.push({
              type: isBase64Image(item.image_url.url) ? ContentType.IMAGE_BASE64 : ContentType.IMAGE_URL,
              content: item.image_url.url,
              path: `${itemPath}.image_url.url`
            });
          }
          // 音频输入
          else if (item.type === 'input_audio' && item.input_audio) {
            results.push({
              type: ContentType.AUDIO,
              content: item.input_audio.data,
              format: item.input_audio.format,
              path: `${itemPath}.input_audio`
            });
          }
        }
      });
    }
  }

  return results;
}

/**
 * 检测 OpenAI 消息中的工具调用
 * @param {Object} message - OpenAI 格式的消息
 * @param {string} basePath - 基础路径
 * @returns {Array} 检测结果数组
 */
export function detectOpenAIToolCalls(message, basePath = '') {
  const results = [];
  if (!message || typeof message !== 'object') return results;

  const pathPrefix = basePath ? `${basePath}.` : '';

  // 检测 tool_calls 数组
  if (Array.isArray(message.tool_calls)) {
    message.tool_calls.forEach((toolCall, index) => {
      if (toolCall && toolCall.type === 'function' && toolCall.function) {
        results.push({
          type: ContentType.TOOL_CALL,
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          path: `${pathPrefix}tool_calls[${index}]`
        });
      }
    });
  }

  return results;
}

/**
 * 检测 OpenAI 工具结果消息
 * @param {Object} message - OpenAI 格式的消息
 * @param {string} basePath - 基础路径
 * @returns {Array} 检测结果数组
 */
export function detectOpenAIToolResult(message, basePath = '') {
  const results = [];
  if (!message || typeof message !== 'object') return results;

  const pathPrefix = basePath ? `${basePath}.` : '';

  // 检测 role=tool 的消息
  if (message.role === 'tool' && message.tool_call_id !== undefined) {
    results.push({
      type: ContentType.TOOL_RESULT,
      toolCallId: message.tool_call_id,
      content: message.content,
      path: `${pathPrefix}content`
    });
  }

  return results;
}

// ============================================================
// Claude 消息内容检测
// ============================================================

/**
 * 检测 Claude 消息中的多媒体内容
 * @param {Object} message - Claude 格式的消息
 * @param {string} basePath - 基础路径
 * @returns {Array} 检测结果数组
 */
export function detectClaudeMessageContent(message, basePath = '') {
  const results = [];
  if (!message || typeof message !== 'object') return results;

  const pathPrefix = basePath ? `${basePath}.` : '';

  // 处理 content 字段
  if (typeof message.content === 'string') {
    // 纯字符串内容
    // 跳过空字符串
    if (message.content.trim() === '') {
      // 空字符串不识别为任何可预览类型
    } else if (isBase64Image(message.content)) {
      // 检测是否是图片类型
      results.push({
        type: ContentType.IMAGE_BASE64,
        content: message.content,
        path: `${pathPrefix}content`
      });
    } else if (isImageUrl(message.content)) {
      results.push({
        type: ContentType.IMAGE_URL,
        content: message.content,
        path: `${pathPrefix}content`
      });
    } else {
      // 非图片内容，直接识别为 Markdown（包括纯文本）
      // 这样用户消息和助手消息的纯字符串 content 都能被预览
      results.push({
        type: ContentType.MARKDOWN,
        content: message.content,
        path: `${pathPrefix}content`
      });
    }
  } else if (Array.isArray(message.content)) {
    // 内容块数组
    message.content.forEach((item, index) => {
      const itemPath = `${pathPrefix}content[${index}]`;
      
      if (item && typeof item === 'object') {
        // 文本内容块
        // Claude 格式：type: "text" 直接识别为 Markdown
        if (item.type === 'text' && item.text) {
          results.push({ type: ContentType.MARKDOWN, content: item.text, path: `${itemPath}.text` });
        }
        // 图片内容块
        else if (item.type === 'image' && item.source) {
          if (item.source.type === 'base64' && item.source.data) {
            results.push({
              type: ContentType.IMAGE_BASE64,
              content: item.source.media_type
                ? `data:${item.source.media_type};base64,${item.source.data}`
                : item.source.data,
              mediaType: item.source.media_type,
              path: `${itemPath}.source.data`
            });
          } else if (item.source.type === 'url' && item.source.url) {
            results.push({
              type: ContentType.IMAGE_URL,
              content: item.source.url,
              path: `${itemPath}.source.url`
            });
          }
        }
        // 文档内容块
        else if (item.type === 'document' && item.source) {
          results.push({
            type: ContentType.DOCUMENT,
            source: item.source,
            path: `${itemPath}.source`
          });
        }
      }
    });
  }

  return results;
}

/**
 * 检测 Claude 消息中的工具调用
 * @param {Object} message - Claude 格式的消息
 * @param {string} basePath - 基础路径
 * @returns {Array} 检测结果数组
 */
export function detectClaudeToolUse(message, basePath = '') {
  const results = [];
  if (!message || typeof message !== 'object') return results;

  const pathPrefix = basePath ? `${basePath}.` : '';

  // 检测 content 数组中的 tool_use 块
  if (Array.isArray(message.content)) {
    message.content.forEach((item, index) => {
      if (item && item.type === 'tool_use') {
        results.push({
          type: ContentType.TOOL_CALL,
          id: item.id,
          name: item.name,
          input: item.input,
          path: `${pathPrefix}content[${index}]`
        });
      }
    });
  }

  return results;
}

/**
 * 检测 Claude 工具结果
 * @param {Object} message - Claude 格式的消息
 * @param {string} basePath - 基础路径
 * @returns {Array} 检测结果数组
 */
export function detectClaudeToolResult(message, basePath = '') {
  const results = [];
  if (!message || typeof message !== 'object') return results;

  const pathPrefix = basePath ? `${basePath}.` : '';

  // 检测 content 数组中的 tool_result 块
  if (Array.isArray(message.content)) {
    message.content.forEach((item, index) => {
      if (item && item.type === 'tool_result') {
        results.push({
          type: ContentType.TOOL_RESULT,
          toolUseId: item.tool_use_id,
          content: item.content,
          isError: item.is_error,
          path: `${pathPrefix}content[${index}]`
        });
      }
    });
  }

  return results;
}

// ============================================================
// Gemini 消息内容检测
// ============================================================

/**
 * 检测 Gemini 消息中的多媒体内容
 * @param {Object} message - Gemini 格式的消息
 * @param {string} basePath - 基础路径
 * @returns {Array} 检测结果数组
 */
export function detectGeminiMessageContent(message, basePath = '') {
  const results = [];
  if (!message || typeof message !== 'object') return results;

  const pathPrefix = basePath ? `${basePath}.` : '';

  // Gemini 使用 parts 数组
  if (Array.isArray(message.parts)) {
    message.parts.forEach((part, index) => {
      const partPath = `${pathPrefix}parts[${index}]`;
      
      if (part && typeof part === 'object') {
        // 文本内容
        // Gemini 格式：有 text 字段直接识别为 Markdown
        if (part.text !== undefined) {
          results.push({
            type: ContentType.MARKDOWN,
            content: part.text,
            path: `${partPath}.text`
          });
        }
        // 内联数据（图片、音频等）
        else if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || '';
          if (mimeType.startsWith('image/')) {
            results.push({
              type: ContentType.IMAGE_BASE64,
              content: `data:${mimeType};base64,${part.inlineData.data}`,
              mimeType,
              path: `${partPath}.inlineData`
            });
          } else if (mimeType.startsWith('audio/')) {
            results.push({
              type: ContentType.AUDIO,
              content: part.inlineData.data,
              mimeType,
              path: `${partPath}.inlineData`
            });
          } else {
            // 其他文件类型
            results.push({
              type: ContentType.FILE,
              content: part.inlineData.data,
              mimeType,
              path: `${partPath}.inlineData`
            });
          }
        }
        // 文件数据引用
        else if (part.fileData) {
          const mimeType = part.fileData.mimeType || '';
          if (mimeType.startsWith('image/')) {
            results.push({
              type: ContentType.IMAGE_URL,
              content: part.fileData.fileUri,
              mimeType,
              path: `${partPath}.fileData.fileUri`
            });
          } else if (mimeType.startsWith('audio/')) {
            results.push({
              type: ContentType.AUDIO,
              content: part.fileData.fileUri,
              mimeType,
              isUrl: true,
              path: `${partPath}.fileData.fileUri`
            });
          } else {
            // 其他文件类型
            results.push({
              type: ContentType.FILE,
              content: part.fileData.fileUri,
              mimeType,
              isUrl: true,
              path: `${partPath}.fileData.fileUri`
            });
          }
        }
      }
    });
  }

  return results;
}

/**
 * 检测 Gemini 消息中的函数调用
 * @param {Object} message - Gemini 格式的消息
 * @param {string} basePath - 基础路径
 * @returns {Array} 检测结果数组
 */
export function detectGeminiFunctionCall(message, basePath = '') {
  const results = [];
  if (!message || typeof message !== 'object') return results;

  const pathPrefix = basePath ? `${basePath}.` : '';

  // 检测 parts 中的 functionCall
  if (Array.isArray(message.parts)) {
    message.parts.forEach((part, index) => {
      if (part && part.functionCall) {
        results.push({
          type: ContentType.TOOL_CALL,
          name: part.functionCall.name,
          args: part.functionCall.args,
          path: `${pathPrefix}parts[${index}].functionCall`
        });
      }
    });
  }

  return results;
}

/**
 * 检测 Gemini 函数响应
 * @param {Object} message - Gemini 格式的消息
 * @param {string} basePath - 基础路径
 * @returns {Array} 检测结果数组
 */
export function detectGeminiFunctionResponse(message, basePath = '') {
  const results = [];
  if (!message || typeof message !== 'object') return results;

  const pathPrefix = basePath ? `${basePath}.` : '';

  // 检测 parts 中的 functionResponse
  if (Array.isArray(message.parts)) {
    message.parts.forEach((part, index) => {
      if (part && part.functionResponse) {
        results.push({
          type: ContentType.TOOL_RESULT,
          name: part.functionResponse.name,
          response: part.functionResponse.response,
          path: `${pathPrefix}parts[${index}].functionResponse`
        });
      }
    });
  }

  return results;
}

// ============================================================
// 统一消息检测接口
// ============================================================

/**
 * 检测消息中的所有内容（多媒体、工具调用等）
 * 自动识别消息格式并调用对应的检测函数
 * @param {Object} message - 消息对象
 * @param {string} basePath - 基础路径
 * @returns {Object} 包含 content、toolCalls、toolResults 的检测结果
 */
export function detectAllMessageContent(message, basePath = '') {
  const format = detectMessageFormat(message);
  
  let content = [];
  let toolCalls = [];
  let toolResults = [];

  switch (format) {
    case MessageFormat.OPENAI:
      content = detectOpenAIMessageContent(message, basePath);
      toolCalls = detectOpenAIToolCalls(message, basePath);
      toolResults = detectOpenAIToolResult(message, basePath);
      break;
    case MessageFormat.CLAUDE:
      content = detectClaudeMessageContent(message, basePath);
      toolCalls = detectClaudeToolUse(message, basePath);
      toolResults = detectClaudeToolResult(message, basePath);
      break;
    case MessageFormat.GEMINI:
      content = detectGeminiMessageContent(message, basePath);
      toolCalls = detectGeminiFunctionCall(message, basePath);
      toolResults = detectGeminiFunctionResponse(message, basePath);
      break;
    default:
      // 未知格式，尝试通用检测
      content = detectContentTypes(message, basePath);
      break;
  }

  return {
    format,
    content,
    toolCalls,
    toolResults,
    hasMultimedia: content.some(c =>
      c.type === ContentType.IMAGE_URL ||
      c.type === ContentType.IMAGE_BASE64 ||
      c.type === ContentType.AUDIO ||
      c.type === ContentType.DOCUMENT ||
      c.type === ContentType.FILE
    ),
    hasToolCalls: toolCalls.length > 0,
    hasToolResults: toolResults.length > 0
  };
}

/**
 * 批量检测消息数组中的内容
 * @param {Array} messages - 消息数组
 * @returns {Array} 每条消息的检测结果
 */
export function detectAllMessagesContent(messages) {
  if (!Array.isArray(messages)) return [];
  
  return messages.map((message, index) => ({
    index,
    ...detectAllMessageContent(message, `[${index}]`)
  }));
}

/**
 * 检测消息是否包含工具调用
 * @param {Object} message - 消息对象
 * @returns {boolean} 是否包含工具调用
 */
export function hasToolCall(message) {
  const format = detectMessageFormat(message);
  
  switch (format) {
    case MessageFormat.OPENAI:
      return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
    case MessageFormat.CLAUDE:
      return Array.isArray(message.content) &&
        message.content.some(c => c.type === 'tool_use');
    case MessageFormat.GEMINI:
      return Array.isArray(message.parts) &&
        message.parts.some(p => p.functionCall !== undefined);
    default:
      return false;
  }
}

/**
 * 检测消息是否是工具结果
 * @param {Object} message - 消息对象
 * @returns {boolean} 是否是工具结果
 */
export function isToolResult(message) {
  const format = detectMessageFormat(message);
  
  switch (format) {
    case MessageFormat.OPENAI:
      return message.role === 'tool';
    case MessageFormat.CLAUDE:
      return Array.isArray(message.content) &&
        message.content.some(c => c.type === 'tool_result');
    case MessageFormat.GEMINI:
      return Array.isArray(message.parts) &&
        message.parts.some(p => p.functionResponse !== undefined);
    default:
      return false;
  }
}

/**
 * 检测消息是否包含多媒体内容（图片、音频、文档等）
 * @param {Object} message - 消息对象
 * @returns {boolean} 是否包含多媒体内容
 */
export function hasMultimediaContent(message) {
  const format = detectMessageFormat(message);
  
  switch (format) {
    case MessageFormat.OPENAI:
      if (Array.isArray(message.content)) {
        return message.content.some(c =>
          c.type === 'image_url' || c.type === 'input_audio'
        );
      }
      return false;
    case MessageFormat.CLAUDE:
      if (Array.isArray(message.content)) {
        return message.content.some(c =>
          c.type === 'image' || c.type === 'document'
        );
      }
      return false;
    case MessageFormat.GEMINI:
      if (Array.isArray(message.parts)) {
        return message.parts.some(p =>
          p.inlineData !== undefined || p.fileData !== undefined
        );
      }
      return false;
    default:
      return false;
  }
}