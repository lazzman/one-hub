/**
 * 通用标准化工具
 * 将四类协议请求/响应整理为统一 ViewModel 字段
 */

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const toStringSafe = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const parseJsonIfNeeded = (value) => {
  if (isObject(value) || Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const parseObjectJsonSafe = (value) => {
  if (isObject(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = parseJsonIfNeeded(value);
  return isObject(parsed) ? parsed : null;
};

const extractVisibleResultFromFunctionArguments = (argumentsValue) => {
  const parsedArguments = parseObjectJsonSafe(argumentsValue);
  if (!isObject(parsedArguments)) return '';

  const result = parsedArguments.result;
  if (result === null || result === undefined) return '';

  return toStringSafe(result).trim();
};

const normalizeTypeString = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const isReasoningLikeType = (value) => {
  const normalizedType = normalizeTypeString(value);
  if (!normalizedType) return false;
  return normalizedType.includes('reasoning') || normalizedType.includes('summary');
};

const isVisibleResponsesTextType = (value) => {
  const normalizedType = normalizeTypeString(value);
  return !normalizedType || normalizedType === 'text' || normalizedType === 'output_text';
};

const extractTextFromOpenAIContent = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!isObject(item)) return '';
      if (typeof item.text === 'string') return item.text;
      if (item.type === 'text') return item.text || '';
      if (item.type === 'input_text') return item.text || '';
      if (item.type === 'output_text') return item.text || '';
      return '';
    })
    .filter(Boolean)
    .join('\n');
};

const collectOpenAIContentMedia = (content, collector) => {
  const contentArray = Array.isArray(content) ? content : [];

  contentArray.forEach((item) => {
    if (!isObject(item)) return;

    if (item.type === 'image_url') {
      collector.media.push(
        normalizeMedia({
          type: 'image',
          mimeType: '',
          url: item.image_url?.url || '',
          data: '',
          raw: item
        })
      );
      return;
    }

    if (item.type === 'input_audio') {
      collector.media.push(
        normalizeMedia({
          type: 'audio',
          mimeType: item.input_audio?.format || '',
          url: '',
          data: item.input_audio?.data || '',
          raw: item
        })
      );
      return;
    }

    if (item.type === 'file' && isObject(item.file)) {
      collector.media.push(
        normalizeMedia({
          type: 'file',
          mimeType: '',
          url: '',
          data: item.file.file_data || '',
          raw: item
        })
      );
    }
  });
};

const collectOpenAIMessageMedia = (message, collector) => {
  if (!isObject(message)) return;

  collectOpenAIContentMedia(message.content, collector);

  if (Array.isArray(message.images)) {
    collectOpenAIContentMedia(message.images, collector);
  }

  if (Array.isArray(message.image)) {
    message.image.forEach((item) => {
      if (!isObject(item) || typeof item.data !== 'string' || !item.data.trim()) return;
      collector.media.push(
        normalizeMedia({
          type: 'image',
          mimeType: '',
          url: '',
          data: item.data,
          raw: item
        })
      );
    });
  }

  if (isObject(message.audio) && typeof message.audio.data === 'string' && message.audio.data.trim()) {
    collector.media.push(
      normalizeMedia({
        type: 'audio',
        mimeType: message.audio.format || message.audio.mime_type || '',
        url: '',
        data: message.audio.data,
        raw: message.audio
      })
    );
  }
};

export const extractAssistantTextFromCollector = (collector) => {
  const assistantTexts = Array.isArray(collector?.messages)
    ? collector.messages
        .filter((item) => item?.role === 'assistant' && typeof item?.text === 'string' && item.text.trim())
        .map((item) => item.text.trim())
        .filter((value, index, array) => array.indexOf(value) === index)
    : [];

  return assistantTexts.join('\n\n').trim();
};

const normalizeMessage = ({ role, text, raw }) => ({
  role: role || 'unknown',
  text: text || '',
  raw: raw ?? null
});

const normalizeToolCall = ({ id, name, argumentsValue, result }) => ({
  id: id || '',
  name: name || '',
  arguments: argumentsValue || '',
  result: result ?? null
});

const normalizeReasoning = ({ type, text, raw }) => ({
  type: type || 'reasoning',
  text: text || '',
  raw: raw ?? null
});

const extractTextFromReasoningSummaryValue = (value) => {
  if (typeof value === 'string') return value.trim();

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!isObject(item)) return '';
        if (typeof item.text === 'string') return item.text;
        if (typeof item.summary_text === 'string') return item.summary_text;
        if (typeof item.summary === 'string') return item.summary;
        return '';
      })
      .filter((item) => typeof item === 'string' && item.trim())
      .join('\n')
      .trim();
  }

  if (isObject(value)) {
    if (typeof value.text === 'string') return value.text.trim();
    if (typeof value.summary_text === 'string') return value.summary_text.trim();
    if (typeof value.summary === 'string') return value.summary.trim();
  }

  return '';
};

const isDoneLikeEventType = (value) => {
  const normalizedType = normalizeTypeString(value);
  return normalizedType.endsWith('.done') || normalizedType.endsWith('.completed');
};

const extractCompletedReasoningFromSSEEvent = (parsed) => {
  if (!isObject(parsed) || typeof parsed.type !== 'string') return '';

  const eventType = normalizeTypeString(parsed.type);
  const isOutputItemDoneEvent = eventType === 'response.output_item.done';

  if (!eventType.includes('reasoning') && !isOutputItemDoneEvent) {
    return '';
  }

  if (!isDoneLikeEventType(eventType) && !isOutputItemDoneEvent) {
    return '';
  }

  if (eventType.includes('.delta')) {
    return '';
  }

  if (isOutputItemDoneEvent && isObject(parsed.item) && isReasoningLikeType(parsed.item.type)) {
    return extractTextFromReasoningSummaryValue(
      parsed.item.summary ?? parsed.item.summary_text ?? parsed.item.text ?? parsed.item.reasoning
    );
  }

  return (
    extractTextFromReasoningSummaryValue(parsed.summary ?? parsed.summary_text) ||
    extractTextFromReasoningSummaryValue(parsed.reasoning) ||
    extractTextFromReasoningSummaryValue(parsed.text) ||
    (isObject(parsed.item) && isReasoningLikeType(parsed.item.type)
      ? extractTextFromReasoningSummaryValue(parsed.item.summary ?? parsed.item.summary_text ?? parsed.item.text ?? parsed.item.reasoning)
      : '')
  );
};

const normalizeMedia = ({ type, mimeType, url, data, raw }) => ({
  type: type || 'unknown',
  mimeType: mimeType || '',
  url: url || '',
  data: data || '',
  raw: raw ?? null
});

const DISPLAYABLE_MESSAGE_RAW_TYPES = new Set([
  'message',
  'function_call',
  'function_call_output',
  'tool_call',
  'tool_result',
  'reasoning',
  'thinking',
  'tool_use',
  'image',
  'document'
]);

const hasDisplayableStructuredPart = (value) => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (!isObject(value)) return value !== null && value !== undefined;

  const itemType = normalizeTypeString(value.type);
  return Boolean(
    (typeof value.text === 'string' && value.text.trim()) ||
      (typeof value.content === 'string' && value.content.trim()) ||
      DISPLAYABLE_MESSAGE_RAW_TYPES.has(itemType) ||
      value.image_url ||
      value.source?.data ||
      value.source?.url ||
      value.inlineData?.data ||
      value.fileData?.fileUri ||
      value.functionCall ||
      value.functionResponse ||
      value.executableCode ||
      value.codeExecutionResult ||
      (Array.isArray(value.tool_calls) && value.tool_calls.length > 0)
  );
};

const hasDisplayableMessageRaw = (raw) => {
  if (typeof raw === 'string') return raw.trim().length > 0;
  if (!isObject(raw)) return false;

  if (Array.isArray(raw.content) && raw.content.some(hasDisplayableStructuredPart)) {
    return true;
  }

  if (Array.isArray(raw.parts) && raw.parts.some(hasDisplayableStructuredPart)) {
    return true;
  }

  const rawType = normalizeTypeString(raw.type);
  return Boolean(
    (typeof raw.text === 'string' && raw.text.trim()) ||
      (typeof raw.content === 'string' && raw.content.trim()) ||
      DISPLAYABLE_MESSAGE_RAW_TYPES.has(rawType) ||
      (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) ||
      (typeof raw.reasoning_content === 'string' && raw.reasoning_content.trim())
  );
};

const pushMessageIfDisplayable = (target, role, text, raw) => {
  const finalText = toStringSafe(text).trim();
  if (!finalText && !hasDisplayableMessageRaw(raw)) return;
  target.push(normalizeMessage({ role, text: finalText, raw }));
};

const pushMessageIfText = (target, role, text, raw) => {
  const finalText = toStringSafe(text).trim();
  if (!finalText) return;
  target.push(normalizeMessage({ role, text: finalText, raw }));
};

/**
 * 解析 OpenAI Chat 请求消息
 */
export const collectOpenAIChatRequestMessages = (requestParsed, collector) => {
  if (!isObject(requestParsed) || !Array.isArray(requestParsed.messages)) return;

  requestParsed.messages.forEach((message) => {
    if (!isObject(message)) return;

    pushMessageIfDisplayable(collector.messages, message.role, extractTextFromOpenAIContent(message.content), message);

    if (Array.isArray(message.tool_calls)) {
      message.tool_calls.forEach((toolCall) => {
        const fn = toolCall?.function;
        collector.toolCalls.push(
          normalizeToolCall({
            id: toolCall?.id,
            name: fn?.name,
            argumentsValue: fn?.arguments,
            result: null
          })
        );
      });
    }

    if (message.role === 'tool') {
      collector.toolCalls.push(
        normalizeToolCall({
          id: message.tool_call_id,
          name: message.name,
          argumentsValue: '',
          result: extractTextFromOpenAIContent(message.content)
        })
      );
    }

    collectOpenAIMessageMedia(message, collector);
  });
};

/**
 * 解析 OpenAI Chat 响应
 */
export const collectOpenAIChatResponse = (responseParsed, collector) => {
  if (!isObject(responseParsed) || !Array.isArray(responseParsed.choices)) return;

  responseParsed.choices.forEach((choice) => {
    const message = choice?.message;
    if (!isObject(message)) return;

    pushMessageIfText(collector.messages, message.role || 'assistant', extractTextFromOpenAIContent(message.content), message);

    if (Array.isArray(message.tool_calls)) {
      message.tool_calls.forEach((toolCall) => {
        const fn = toolCall?.function;
        collector.toolCalls.push(
          normalizeToolCall({
            id: toolCall?.id,
            name: fn?.name,
            argumentsValue: fn?.arguments,
            result: null
          })
        );
      });
    }

    if (message.function_call && isObject(message.function_call)) {
      collector.toolCalls.push(
        normalizeToolCall({
          id: message.tool_call_id || message.name,
          name: message.function_call.name,
          argumentsValue: message.function_call.arguments,
          result: null
        })
      );
    }

    if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
      collector.reasoning.push(normalizeReasoning({ type: 'reasoning', text: message.reasoning_content, raw: message }));
    }

    collectOpenAIMessageMedia(message, collector);
  });
};

/**
 * 解析 OpenAI Responses 请求
 */
export const collectOpenAIResponsesRequest = (requestParsed, collector) => {
  if (!isObject(requestParsed)) return;

  const { input, instructions } = requestParsed;

  if (typeof instructions === 'string' && instructions.trim()) {
    collector.messages.push(normalizeMessage({ role: 'system', text: instructions, raw: instructions }));
  }

  const normalizedInput = Array.isArray(input) ? input : input !== undefined ? [input] : [];

  normalizedInput.forEach((item) => {
    if (typeof item === 'string') {
      pushMessageIfText(collector.messages, 'user', item, item);
      return;
    }

    if (!isObject(item)) return;

    if (item.type === 'message') {
      const parts = Array.isArray(item.content) ? item.content : [item.content];
      const text = parts
        .map((part) => {
          if (typeof part === 'string') return part;
          if (!isObject(part)) return '';
          if (typeof part.text === 'string') return part.text;
          if (part.type === 'input_text' || part.type === 'text' || part.type === 'output_text') return part.text || '';
          if (part.type === 'input_image' || part.type === 'image') {
            collector.media.push(
              normalizeMedia({
                type: 'image',
                mimeType: part.mime_type || '',
                url: part.image_url || part.url || '',
                data: part.image_base64 || '',
                raw: part
              })
            );
          }
          if (part.type === 'input_audio' || part.type === 'audio') {
            collector.media.push(
              normalizeMedia({
                type: 'audio',
                mimeType: part.format || part.mime_type || '',
                url: '',
                data: part.audio || part.data || '',
                raw: part
              })
            );
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      pushMessageIfDisplayable(collector.messages, item.role || 'user', text, item);
      return;
    }

    if (item.type === 'function_call_output') {
      collector.toolCalls.push(
        normalizeToolCall({
          id: item.call_id || item.id,
          name: item.name,
          argumentsValue: '',
          result: item.output ?? null
        })
      );
      return;
    }

    if (item.type === 'function_call') {
      collector.toolCalls.push(
        normalizeToolCall({
          id: item.call_id || item.id,
          name: item.name,
          argumentsValue: item.arguments,
          result: null
        })
      );
      return;
    }

    if (item.role || item.content) {
      pushMessageIfText(collector.messages, item.role || 'user', extractTextFromOpenAIContent(item.content), item);
    }
  });
};

/**
 * 解析 OpenAI Responses 响应
 */
export const collectOpenAIResponsesResponse = (responseParsed, collector) => {
  if (!isObject(responseParsed)) return;

  const finalVisibleText = extractFinalTextFromResponsesResponseObject(responseParsed);
  if (finalVisibleText) {
    collector.messages.push(normalizeMessage({ role: 'assistant', text: finalVisibleText, raw: responseParsed }));
  }

  if (!Array.isArray(responseParsed.output)) return;

  responseParsed.output.forEach((outputItem) => {
    if (!isObject(outputItem)) return;

    if (outputItem.type === 'message') {
      const content = Array.isArray(outputItem.content) ? outputItem.content : [outputItem.content];
      const text = content
        .map((part) => {
          if (!isObject(part)) return typeof part === 'string' ? part : '';
          if (part.type === 'output_text' || part.type === 'text') return part.text || '';
          if (part.type === 'reasoning') {
            const reasoningText = extractTextFromReasoningSummaryValue(part.summary ?? part.summary_text ?? part.text);
            if (reasoningText) {
              collector.reasoning.push(normalizeReasoning({ type: 'reasoning', text: reasoningText, raw: part }));
            }
          }
          if (part.type === 'output_image' || part.type === 'image') {
            collector.media.push(
              normalizeMedia({
                type: 'image',
                mimeType: part.mime_type || '',
                url: part.image_url || part.url || '',
                data: part.image_base64 || '',
                raw: part
              })
            );
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');

      pushMessageIfText(collector.messages, outputItem.role || 'assistant', text, outputItem);
      return;
    }

    if (outputItem.type === 'function_call' || outputItem.type === 'tool_call') {
      collector.toolCalls.push(
        normalizeToolCall({
          id: outputItem.call_id || outputItem.id,
          name: outputItem.name,
          argumentsValue: outputItem.arguments,
          result: null
        })
      );
      return;
    }

    if (outputItem.type === 'function_call_output') {
      collector.toolCalls.push(
        normalizeToolCall({
          id: outputItem.call_id || outputItem.id,
          name: outputItem.name,
          argumentsValue: '',
          result: outputItem.output ?? outputItem.content ?? null
        })
      );
      return;
    }

    if (outputItem.type === 'reasoning') {
      const reasoningText = extractTextFromReasoningSummaryValue(
        outputItem.summary ?? outputItem.summary_text ?? outputItem.text ?? outputItem.reasoning
      );
      if (reasoningText) {
        collector.reasoning.push(normalizeReasoning({ type: 'reasoning', text: reasoningText, raw: outputItem }));
      }
    }
  });
};

/**
 * 解析 Claude 请求
 */
export const collectClaudeRequest = (requestParsed, collector) => {
  if (!isObject(requestParsed)) return;

  if (typeof requestParsed.system === 'string' && requestParsed.system.trim()) {
    collector.messages.push(normalizeMessage({ role: 'system', text: requestParsed.system, raw: requestParsed.system }));
  }

  if (Array.isArray(requestParsed.system)) {
    requestParsed.system.forEach((item) => {
      if (typeof item === 'string') {
        pushMessageIfText(collector.messages, 'system', item, item);
        return;
      }

      if (!isObject(item)) return;

      if (item.type === 'thinking') {
        collector.reasoning.push(normalizeReasoning({ type: 'thinking', text: item.thinking || item.text || '', raw: item }));
      }

      pushMessageIfDisplayable(collector.messages, 'system', item.text || item.content || item.thinking || '', item);
    });
  }

  if (!Array.isArray(requestParsed.messages)) return;

  requestParsed.messages.forEach((message) => {
    if (!isObject(message)) return;

    if (typeof message.content === 'string') {
      pushMessageIfDisplayable(collector.messages, message.role, message.content, message);
      return;
    }

    if (!Array.isArray(message.content)) return;

    const textParts = [];

    message.content.forEach((item) => {
      if (typeof item === 'string') {
        textParts.push(item);
        return;
      }
      if (!isObject(item)) return;

      if (item.type === 'text') {
        textParts.push(item.text || '');
        return;
      }

      if (item.type === 'thinking') {
        collector.reasoning.push(normalizeReasoning({ type: 'thinking', text: item.thinking || item.text || '', raw: item }));
        return;
      }

      if (item.type === 'tool_use') {
        collector.toolCalls.push(
          normalizeToolCall({
            id: item.id,
            name: item.name,
            argumentsValue: item.input ? toStringSafe(item.input) : '',
            result: null
          })
        );
        return;
      }

      if (item.type === 'tool_result') {
        collector.toolCalls.push(
          normalizeToolCall({
            id: item.tool_use_id,
            name: '',
            argumentsValue: '',
            result: item.content ?? null
          })
        );
        return;
      }

      if (item.type === 'image') {
        collector.media.push(
          normalizeMedia({
            type: 'image',
            mimeType: item.source?.media_type || '',
            url: item.source?.url || '',
            data: item.source?.data || '',
            raw: item
          })
        );
        return;
      }

      if (item.type === 'document') {
        collector.media.push(
          normalizeMedia({
            type: 'file',
            mimeType: item.source?.media_type || '',
            url: item.source?.url || '',
            data: item.source?.data || '',
            raw: item
          })
        );
      }
    });

    pushMessageIfDisplayable(collector.messages, message.role, textParts.join('\n'), message);
  });
};

/**
 * 解析 Claude 响应
 */
export const collectClaudeResponse = (responseParsed, collector) => {
  if (!isObject(responseParsed) || !Array.isArray(responseParsed.content)) return;

  const textParts = [];

  responseParsed.content.forEach((item) => {
    if (!isObject(item)) {
      if (typeof item === 'string') textParts.push(item);
      return;
    }

    if (item.type === 'text') {
      textParts.push(item.text || '');
      return;
    }

    if (item.type === 'thinking') {
      collector.reasoning.push(normalizeReasoning({ type: 'thinking', text: item.thinking || item.text || '', raw: item }));
      return;
    }

    if (item.type === 'tool_use') {
      collector.toolCalls.push(
        normalizeToolCall({
          id: item.id,
          name: item.name,
          argumentsValue: item.input ? toStringSafe(item.input) : '',
          result: null
        })
      );
      return;
    }

    if (item.type === 'tool_result') {
      collector.toolCalls.push(
        normalizeToolCall({
          id: item.tool_use_id,
          name: '',
          argumentsValue: '',
          result: item.content ?? null
        })
      );
      return;
    }

    if (item.type === 'image') {
      collector.media.push(
        normalizeMedia({
          type: 'image',
          mimeType: item.source?.media_type || '',
          url: item.source?.url || '',
          data: item.source?.data || '',
          raw: item
        })
      );
      return;
    }

    if (item.type === 'document') {
      collector.media.push(
        normalizeMedia({
          type: 'file',
          mimeType: item.source?.media_type || '',
          url: item.source?.url || '',
          data: item.source?.data || '',
          raw: item
        })
      );
    }
  });

  pushMessageIfText(collector.messages, 'assistant', textParts.join('\n'), responseParsed);
};

const collectGeminiParts = (parts, role, rawContainer, collector) => {
  if (!Array.isArray(parts)) return;

  const textParts = [];

  parts.forEach((part) => {
    if (!isObject(part)) {
      if (typeof part === 'string') textParts.push(part);
      return;
    }

    if (typeof part.text === 'string' && part.text.trim()) {
      if (part.thought) {
        collector.reasoning.push(normalizeReasoning({ type: 'thought', text: part.text, raw: part }));
      } else {
        textParts.push(part.text);
      }
    }

    if (part.functionCall) {
      collector.toolCalls.push(
        normalizeToolCall({
          id: part.functionCall.id || '',
          name: part.functionCall.name,
          argumentsValue: part.functionCall.args ? toStringSafe(part.functionCall.args) : '',
          result: null
        })
      );
    }

    if (part.functionResponse) {
      collector.toolCalls.push(
        normalizeToolCall({
          id: part.functionResponse.id || '',
          name: part.functionResponse.name,
          argumentsValue: '',
          result: part.functionResponse.response ?? null
        })
      );
    }

    if (part.inlineData) {
      collector.media.push(
        normalizeMedia({
          type: part.inlineData.mimeType?.startsWith('audio/') ? 'audio' : 'image',
          mimeType: part.inlineData.mimeType || '',
          url: '',
          data: part.inlineData.data || '',
          raw: part
        })
      );
    }

    if (part.fileData) {
      collector.media.push(
        normalizeMedia({
          type: 'file',
          mimeType: part.fileData.mimeType || '',
          url: part.fileData.fileUri || '',
          data: '',
          raw: part
        })
      );
    }

    if (part.executableCode) {
      collector.reasoning.push(
        normalizeReasoning({
          type: 'executable_code',
          text: `\`\`\`${part.executableCode.language || ''}\n${part.executableCode.code || ''}\n\`\`\``,
          raw: part
        })
      );
    }

    if (part.codeExecutionResult) {
      collector.reasoning.push(
        normalizeReasoning({
          type: 'code_execution_result',
          text: `\`\`\`output\n${part.codeExecutionResult.output || ''}\n\`\`\``,
          raw: part
        })
      );
    }
  });

  pushMessageIfDisplayable(collector.messages, role, textParts.join('\n'), rawContainer);
};

/**
 * 解析 Gemini 请求
 */
export const collectGeminiRequest = (requestParsed, collector) => {
  if (!isObject(requestParsed)) return;

  if (typeof requestParsed.systemInstruction === 'string' && requestParsed.systemInstruction.trim()) {
    collector.messages.push(
      normalizeMessage({ role: 'system', text: requestParsed.systemInstruction, raw: requestParsed.systemInstruction })
    );
  }

  if (isObject(requestParsed.systemInstruction)) {
    collectGeminiParts(requestParsed.systemInstruction.parts, 'system', requestParsed.systemInstruction, collector);
  }

  if (Array.isArray(requestParsed.contents)) {
    requestParsed.contents.forEach((contentItem) => {
      if (!isObject(contentItem)) return;
      const role = contentItem.role === 'model' ? 'assistant' : contentItem.role || 'user';
      collectGeminiParts(contentItem.parts, role, contentItem, collector);
    });
  }
};

/**
 * 解析 Gemini 响应
 */
export const collectGeminiResponse = (responseParsed, collector) => {
  if (!isObject(responseParsed) || !Array.isArray(responseParsed.candidates)) return;

  responseParsed.candidates.forEach((candidate) => {
    if (!isObject(candidate)) return;
    collectGeminiParts(candidate?.content?.parts, 'assistant', candidate, collector);
  });
};

/**
 * 从 Responses API output item 中提取文本
 */
const extractTextFromResponsesOutputItem = (item) => {
  if (!isObject(item)) return '';

  const itemType = normalizeTypeString(item.type);
  if (isReasoningLikeType(itemType)) return '';

  if (itemType === 'message') {
    const parts = Array.isArray(item.content) ? item.content : [item.content];
    return parts
      .map((part) => {
        if (typeof part === 'string') return part;
        if (!isObject(part)) return '';

        const partType = normalizeTypeString(part.type);
        if (isReasoningLikeType(partType)) return '';
        if (!isVisibleResponsesTextType(partType)) return '';

        if (typeof part.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('');
  }

  if (!isVisibleResponsesTextType(itemType)) return '';

  if (typeof item.text === 'string') return item.text;

  return '';
};

export const extractFinalTextFromResponsesResponseObject = (responseParsed) => {
  if (!isObject(responseParsed)) return '';

  if (typeof responseParsed.output_text === 'string' && responseParsed.output_text.trim()) {
    return responseParsed.output_text.trim();
  }

  let finalVisibleTextFromMessages = '';
  let finalVisibleTextFromAttemptCompletion = '';
  const outputItems = Array.isArray(responseParsed.output) ? responseParsed.output : [];

  outputItems.forEach((outputItem) => {
    if (!isObject(outputItem)) return;

    const outputType = normalizeTypeString(outputItem.type);

    // Responses 协议下最终用户可见文本优先取 attempt_completion.arguments.result
    // function_call_output 及其他工具输出均不应进入 AI 响应主文本
    if (outputType === 'function_call') {
      const toolName = typeof outputItem.name === 'string' ? outputItem.name.trim() : '';
      if (toolName !== 'attempt_completion') {
        return;
      }

      const fromArguments = extractVisibleResultFromFunctionArguments(outputItem.arguments);
      if (fromArguments) {
        finalVisibleTextFromAttemptCompletion = fromArguments;
      }
      return;
    }

    if (outputType === 'message') {
      const messageText = extractTextFromResponsesOutputItem(outputItem).trim();
      if (messageText) {
        finalVisibleTextFromMessages = messageText;
      }
      return;
    }

    if (isReasoningLikeType(outputType) || !isVisibleResponsesTextType(outputType)) {
      return;
    }

    const directText = typeof outputItem.text === 'string' ? outputItem.text.trim() : '';
    if (directText) {
      finalVisibleTextFromMessages = directText;
    }
  });

  return (finalVisibleTextFromAttemptCompletion || finalVisibleTextFromMessages).trim();
};

/**
 * 从单个 SSE 事件中提取 assistant 文本（delta/final）
 */
const extractAssistantTextFromSSEEvent = (eventItem) => {
  const parsed = eventItem?.parsed;
  if (!isObject(parsed)) {
    return { delta: '', final: '' };
  }

  let deltaText = '';
  let finalText = '';

  // OpenAI Chat Completion 流：choices[].delta.content
  if (Array.isArray(parsed.choices)) {
    parsed.choices.forEach((choice) => {
      const delta = choice?.delta;
      if (typeof delta === 'string') {
        deltaText += delta;
      } else if (isObject(delta)) {
        if (typeof delta.content === 'string') {
          deltaText += delta.content;
        }
        if (Array.isArray(delta.content)) {
          deltaText += delta.content
            .map((item) => {
              if (typeof item === 'string') return item;
              if (isObject(item) && typeof item.text === 'string') return item.text;
              return '';
            })
            .join('');
        }
      }

      const messageText = extractTextFromOpenAIContent(choice?.message?.content);
      if (messageText.trim()) {
        finalText = messageText;
      }
    });
  }

  // Responses / Claude 等流式常见字段
  if (typeof parsed.delta === 'string') {
    deltaText += parsed.delta;
  } else if (isObject(parsed.delta)) {
    if (typeof parsed.delta.text === 'string') {
      deltaText += parsed.delta.text;
    }
    if (typeof parsed.delta.content === 'string') {
      deltaText += parsed.delta.content;
    }
  }

  const parsedType = normalizeTypeString(parsed.type);
  if (typeof parsed.text === 'string' && parsed.text.trim() && !isReasoningLikeType(parsedType)) {
    if (typeof parsed.type === 'string' && parsed.type.endsWith('.done')) {
      finalText = parsed.text;
    } else {
      deltaText += parsed.text;
    }
  }

  if (typeof parsed.output_text === 'string' && parsed.output_text.trim()) {
    finalText = parsed.output_text;
  }

  if (isObject(parsed.item)) {
    const itemText = extractTextFromResponsesOutputItem(parsed.item);
    if (itemText.trim()) {
      if (typeof parsed.type === 'string' && parsed.type.endsWith('.done')) {
        finalText = itemText;
      } else {
        deltaText += itemText;
      }
    }
  }

  // Gemini 流式：candidates[].content.parts[].text
  if (Array.isArray(parsed.candidates)) {
    parsed.candidates.forEach((candidate) => {
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      const partText = parts
        .map((part) => (isObject(part) && typeof part.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('');

      if (!partText.trim()) return;

      if (candidate?.finishReason || parsed?.done) {
        finalText = partText;
      } else {
        deltaText += partText;
      }
    });
  }

  return {
    delta: deltaText,
    final: finalText
  };
};

const getNonEmptyString = (value) => (typeof value === 'string' ? value.trim() : '');

const pickPreferredToolCallValue = ({ existingValue, incomingValue, preferIncoming }) => {
  const normalizedExisting = getNonEmptyString(existingValue);
  const normalizedIncoming = getNonEmptyString(incomingValue);

  if (preferIncoming) {
    return normalizedIncoming || normalizedExisting;
  }

  return normalizedExisting || normalizedIncoming;
};

const buildSSEFunctionCallKey = ({ parsed, item, fallbackIndex }) => {
  const contentBlockIndex = parsed?.index;
  if (contentBlockIndex !== undefined && contentBlockIndex !== null && `${contentBlockIndex}`.trim() !== '') {
    return `content_block_index:${String(contentBlockIndex)}`;
  }

  const callId = getNonEmptyString(item?.call_id);
  if (callId) return `call_id:${callId}`;

  const id = getNonEmptyString(item?.id);
  if (id) return `id:${id}`;

  const outputIndex = parsed?.output_index;
  if (outputIndex !== undefined && outputIndex !== null && `${outputIndex}`.trim() !== '') {
    return `output_index:${String(outputIndex)}`;
  }

  const itemIndex = parsed?.item_index;
  if (itemIndex !== undefined && itemIndex !== null && `${itemIndex}`.trim() !== '') {
    return `item_index:${String(itemIndex)}`;
  }

  const name = getNonEmptyString(item?.name) || 'unknown';
  const argumentsSignature = toStringSafe(item?.arguments ?? item?.input ?? '').trim();
  if (argumentsSignature) {
    return `fallback:${name}:arguments:${argumentsSignature}`;
  }

  return `fallback:${name}:event_index:${String(fallbackIndex ?? '')}`;
};

const mergeSSEFunctionCallRecord = ({ existingRecord, incomingToolCall, incomingRank }) => {
  if (!existingRecord) {
    return {
      toolCall: incomingToolCall,
      rank: incomingRank
    };
  }

  const preferIncoming = incomingRank >= existingRecord.rank;

  return {
    toolCall: {
      id: pickPreferredToolCallValue({
        existingValue: existingRecord.toolCall.id,
        incomingValue: incomingToolCall.id,
        preferIncoming
      }),
      name: pickPreferredToolCallValue({
        existingValue: existingRecord.toolCall.name,
        incomingValue: incomingToolCall.name,
        preferIncoming
      }),
      arguments: pickPreferredToolCallValue({
        existingValue: existingRecord.toolCall.arguments,
        incomingValue: incomingToolCall.arguments,
        preferIncoming
      }),
      result: preferIncoming ? incomingToolCall.result : existingRecord.toolCall.result
    },
    rank: preferIncoming ? incomingRank : existingRecord.rank
  };
};

const buildOpenAIChatSSEToolCallKey = ({ choice, toolCall, fallbackIndex }) => {
  const choiceIndex = choice?.index;
  const hasChoiceIndex = choiceIndex !== undefined && choiceIndex !== null && `${choiceIndex}`.trim() !== '';
  const toolIndex = toolCall?.index;
  const hasToolIndex = toolIndex !== undefined && toolIndex !== null && `${toolIndex}`.trim() !== '';

  if (hasChoiceIndex && hasToolIndex) {
    return `choice:${String(choiceIndex)}:tool_index:${String(toolIndex)}`;
  }

  const callId = getNonEmptyString(toolCall?.id);
  if (callId) {
    return hasChoiceIndex ? `choice:${String(choiceIndex)}:call_id:${callId}` : `call_id:${callId}`;
  }

  const name = getNonEmptyString(toolCall?.function?.name) || 'unknown';
  if (hasChoiceIndex) {
    return `choice:${String(choiceIndex)}:fallback:${name}:event_index:${String(fallbackIndex ?? '')}`;
  }

  return `fallback:${name}:event_index:${String(fallbackIndex ?? '')}`;
};

const mergeOpenAIChatSSEToolCalls = ({ parsed, eventItem, sseFunctionCallMap }) => {
  if (!Array.isArray(parsed?.choices)) return;

  parsed.choices.forEach((choice, choiceOffset) => {
    const delta = isObject(choice?.delta) ? choice.delta : null;
    const toolCalls = Array.isArray(delta?.tool_calls) ? delta.tool_calls : [];
    if (toolCalls.length === 0) return;

    toolCalls.forEach((toolCall, toolOffset) => {
      if (!isObject(toolCall)) return;

      const dedupeKey = buildOpenAIChatSSEToolCallKey({
        choice,
        toolCall,
        fallbackIndex: `${String(eventItem?.index ?? '')}:${choiceOffset}:${toolOffset}`
      });

      const existingRecord = sseFunctionCallMap.get(dedupeKey);
      const functionPayload = isObject(toolCall.function) ? toolCall.function : {};
      const existingArguments = existingRecord?.toolCall?.arguments || '';
      const incrementalArguments = typeof functionPayload.arguments === 'string' ? functionPayload.arguments : '';

      const incomingToolCall = normalizeToolCall({
        id: toolCall.id || existingRecord?.toolCall?.id,
        name: functionPayload.name || existingRecord?.toolCall?.name,
        argumentsValue: incrementalArguments ? `${existingArguments}${incrementalArguments}` : existingArguments,
        result: null
      });

      const mergedRecord = mergeSSEFunctionCallRecord({
        existingRecord,
        incomingToolCall,
        incomingRank: 1
      });

      sseFunctionCallMap.set(dedupeKey, mergedRecord);
    });
  });
};

const buildGeminiSSEToolCallKey = ({ choice, toolCall, fallbackIndex }) => {
  const choiceIndex = choice?.index;
  const hasChoiceIndex = choiceIndex !== undefined && choiceIndex !== null && `${choiceIndex}`.trim() !== '';
  const toolIndex = toolCall?.index;
  const hasToolIndex = toolIndex !== undefined && toolIndex !== null && `${toolIndex}`.trim() !== '';

  if (hasChoiceIndex && hasToolIndex) {
    return `gemini:choice:${String(choiceIndex)}:tool_index:${String(toolIndex)}`;
  }

  const callId = getNonEmptyString(toolCall?.id);
  if (callId) {
    return hasChoiceIndex ? `gemini:choice:${String(choiceIndex)}:call_id:${callId}` : `gemini:call_id:${callId}`;
  }

  const name = getNonEmptyString(toolCall?.function?.name) || 'unknown';
  if (hasChoiceIndex) {
    return `gemini:choice:${String(choiceIndex)}:fallback:${name}:event_index:${String(fallbackIndex ?? '')}`;
  }

  return `gemini:fallback:${name}:event_index:${String(fallbackIndex ?? '')}`;
};

const mergeGeminiSSEToolCalls = ({ parsed, eventItem, sseFunctionCallMap, collector, collectedReasoningTexts }) => {
  if (!Array.isArray(parsed?.choices)) return;

  parsed.choices.forEach((choice, choiceOffset) => {
    const delta = isObject(choice?.delta) ? choice.delta : null;

    if (typeof delta?.reasoning_content === 'string' && delta.reasoning_content.trim()) {
      const reasoningText = delta.reasoning_content.trim();
      if (!collectedReasoningTexts.has(reasoningText)) {
        collector.reasoning.push(normalizeReasoning({ type: 'reasoning', text: reasoningText, raw: delta }));
        collectedReasoningTexts.add(reasoningText);
      }
    }

    const toolCalls = Array.isArray(delta?.tool_calls) ? delta.tool_calls : [];
    toolCalls.forEach((toolCall, toolOffset) => {
      if (!isObject(toolCall)) return;

      const dedupeKey = buildGeminiSSEToolCallKey({
        choice,
        toolCall,
        fallbackIndex: `${String(eventItem?.index ?? '')}:${choiceOffset}:${toolOffset}`
      });

      const existingRecord = sseFunctionCallMap.get(dedupeKey);
      const functionPayload = isObject(toolCall.function) ? toolCall.function : {};
      const existingArguments = existingRecord?.toolCall?.arguments || '';
      const incrementalArguments = typeof functionPayload.arguments === 'string' ? functionPayload.arguments : '';

      const incomingToolCall = normalizeToolCall({
        id: toolCall.id || existingRecord?.toolCall?.id,
        name: functionPayload.name || existingRecord?.toolCall?.name,
        argumentsValue: incrementalArguments ? `${existingArguments}${incrementalArguments}` : existingArguments,
        result: null
      });

      const mergedRecord = mergeSSEFunctionCallRecord({
        existingRecord,
        incomingToolCall,
        incomingRank: 1
      });

      sseFunctionCallMap.set(dedupeKey, mergedRecord);
    });

    const images = Array.isArray(delta?.image) ? delta.image : [];
    images.forEach((image) => {
      if (!isObject(image) || typeof image.data !== 'string' || !image.data.trim()) return;
      collector.media.push(
        normalizeMedia({
          type: 'image',
          mimeType: '',
          url: '',
          data: image.data,
          raw: image
        })
      );
    });
  });
};

/**
 * 从 SSE 事件中补充通用信息
 */
export const collectFromSSEEvents = (events, collector) => {
  if (!Array.isArray(events)) return;

  let accumulatedAssistantText = '';
  let finalizedAssistantText = '';
  const collectedReasoningTexts = new Set(
    (Array.isArray(collector.reasoning) ? collector.reasoning : [])
      .map((item) => (typeof item?.text === 'string' ? item.text.trim() : ''))
      .filter(Boolean)
  );
  const sseFunctionCallMap = new Map();

  events.forEach((eventItem) => {
    const { delta, final } = extractAssistantTextFromSSEEvent(eventItem);
    if (delta) {
      accumulatedAssistantText += delta;
    }
    if (final) {
      finalizedAssistantText = final;
    }

    const parsed = eventItem?.parsed;
    if (!isObject(parsed)) return;

    mergeOpenAIChatSSEToolCalls({
      parsed,
      eventItem,
      sseFunctionCallMap
    });

    mergeGeminiSSEToolCalls({
      parsed,
      eventItem,
      sseFunctionCallMap,
      collector,
      collectedReasoningTexts
    });

    const completedReasoningText = extractCompletedReasoningFromSSEEvent(parsed);
    if (completedReasoningText && !collectedReasoningTexts.has(completedReasoningText)) {
      collector.reasoning.push(normalizeReasoning({ type: 'reasoning', text: completedReasoningText, raw: null }));
      collectedReasoningTexts.add(completedReasoningText);
    }

    const parsedType = normalizeTypeString(parsed.type);
    const claudeContentBlock = isObject(parsed.content_block) ? parsed.content_block : null;
    const isResponsesFunctionCallItem =
      isObject(parsed.item) &&
      (parsed.item.type === 'function_call' || parsed.item.type === 'tool_call' || parsed.item.type === 'function_call_output');
    const isClaudeToolUseEvent = parsedType === 'content_block_start' && claudeContentBlock?.type === 'tool_use';
    const isClaudeToolUseDeltaEvent = parsedType === 'content_block_delta' && parsed?.delta?.type === 'input_json_delta';

    if (!isResponsesFunctionCallItem && !isClaudeToolUseEvent && !isClaudeToolUseDeltaEvent) {
      return;
    }

    if (isResponsesFunctionCallItem && parsedType !== 'response.output_item.added' && parsedType !== 'response.output_item.done') {
      return;
    }

    const toolCallSourceItem = isResponsesFunctionCallItem ? parsed.item : claudeContentBlock || {};

    const dedupeKey = buildSSEFunctionCallKey({
      parsed,
      item: toolCallSourceItem,
      fallbackIndex: eventItem?.index
    });

    const existingRecord = sseFunctionCallMap.get(dedupeKey);
    const existingArguments = existingRecord?.toolCall?.arguments || '';
    const partialJson = isClaudeToolUseDeltaEvent && typeof parsed?.delta?.partial_json === 'string' ? parsed.delta.partial_json : '';

    const incomingToolCall = normalizeToolCall({
      id: toolCallSourceItem.call_id || toolCallSourceItem.id || existingRecord?.toolCall?.id,
      name: toolCallSourceItem.name || existingRecord?.toolCall?.name,
      argumentsValue:
        isClaudeToolUseDeltaEvent && partialJson
          ? `${existingArguments}${partialJson}`
          : toolCallSourceItem.arguments ?? toolCallSourceItem.input,
      result:
        isResponsesFunctionCallItem && parsedType === 'response.output_item.done'
          ? toolCallSourceItem.output ?? toolCallSourceItem.content ?? null
          : null
    });

    const incomingRank = isResponsesFunctionCallItem && parsedType === 'response.output_item.done' ? 2 : 1;

    const mergedRecord = mergeSSEFunctionCallRecord({
      existingRecord,
      incomingToolCall,
      incomingRank
    });

    sseFunctionCallMap.set(dedupeKey, mergedRecord);
  });

  if (sseFunctionCallMap.size > 0) {
    collector.toolCalls.push(...Array.from(sseFunctionCallMap.values()).map((record) => record.toolCall));
  }

  const finalAssistantText = toStringSafe(finalizedAssistantText || accumulatedAssistantText).trim();
  if (finalAssistantText) {
    collector.messages.push(
      normalizeMessage({
        role: 'assistant',
        text: finalAssistantText,
        raw: { source: 'sse_aggregated' }
      })
    );
  }
};

/**
 * 根据协议提取请求侧会话消息
 */
export const extractRequestConversationMessages = ({ requestParsed, protocol } = {}) => {
  if (!isObject(requestParsed)) return [];

  const collector = createCollector();
  const normalizedProtocol = normalizeTypeString(protocol);

  if (normalizedProtocol === 'responses' || requestParsed.instructions !== undefined || requestParsed.input !== undefined) {
    collectOpenAIResponsesRequest(requestParsed, collector);
    return collector.messages;
  }

  if (normalizedProtocol === 'claude' || requestParsed.anthropic_version || requestParsed.system !== undefined) {
    collectClaudeRequest(requestParsed, collector);
    return collector.messages;
  }

  if (normalizedProtocol === 'gemini' || requestParsed.systemInstruction !== undefined || Array.isArray(requestParsed.contents)) {
    collectGeminiRequest(requestParsed, collector);
    return collector.messages;
  }

  if (normalizedProtocol === 'openai-chat' || normalizedProtocol === 'openai-compatible' || Array.isArray(requestParsed.messages)) {
    collectOpenAIChatRequestMessages(requestParsed, collector);
    return collector.messages;
  }

  return [];
};

/**
 * 生成统一 collector
 */
export const createCollector = () => ({
  messages: [],
  toolCalls: [],
  reasoning: [],
  media: []
});

/**
 * 尝试将字符串 JSON 化
 */
export const parseMaybeJsonString = parseJsonIfNeeded;
