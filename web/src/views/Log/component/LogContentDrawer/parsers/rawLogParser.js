/**
 * 原始日志解析器
 * 从日志文本中提取 request/response，并构建统一 view model
 */

import { ProtocolKind, detectProtocol } from './protocolDetector';
import {
  collectClaudeRequest,
  collectClaudeResponse,
  collectFromSSEEvents,
  collectGeminiRequest,
  collectGeminiResponse,
  collectOpenAIChatRequestMessages,
  collectOpenAIChatResponse,
  collectOpenAIResponsesRequest,
  collectOpenAIResponsesResponse,
  createCollector,
  extractFinalTextFromResponsesResponseObject,
  parseMaybeJsonString
} from './normalizers';
import { buildRequestLinearTrace, buildResponsesTraceEvents, createEmptyTraceResult, reconcileResponsesTrace } from '../traceLedger';

const RESPONSE_MARKER = '【Response Body】:';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeTypeString = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const isReasoningLikeType = (value) => {
  const normalizedType = normalizeTypeString(value);
  if (!normalizedType) return false;
  return normalizedType.includes('reasoning') || normalizedType.includes('summary');
};

const toPrettyString = (value) => {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
};

const safeJsonParse = (value) => {
  if (typeof value !== 'string') {
    return { ok: true, value };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, value: null, error: 'empty' };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (error) {
    return { ok: false, value: null, error };
  }
};

/**
 * 从完整日志中分离 request/response 原文
 * @param {string} content
 * @returns {{requestPart: string, responsePart: string, requestRaw: string, responseRaw: string}}
 */
export const splitRawLogSections = (content) => {
  const safeContent = typeof content === 'string' ? content : '';
  const responseIndex = safeContent.lastIndexOf(RESPONSE_MARKER);

  const requestPart = responseIndex >= 0 ? safeContent.slice(0, responseIndex) : safeContent;
  const responsePart = responseIndex >= 0 ? safeContent.slice(responseIndex + RESPONSE_MARKER.length) : '';

  const requestMatch = requestPart.match(/【Request Body】:([\s\S]*)/);
  const requestRaw = requestMatch?.[1]?.trim() || '';
  const responseRaw = responsePart.trim();

  return {
    requestPart,
    responsePart,
    requestRaw,
    responseRaw
  };
};

/**
 * 解析日志中响应外层包装（如 {type, content}）
 * @param {string} responseRaw
 * @returns {{raw: string, parsed: any, wrapperType: string, parseError: any}}
 */
export const parseResponseWrapper = (responseRaw) => {
  const jsonResult = safeJsonParse(responseRaw);

  if (!jsonResult.ok) {
    return {
      raw: responseRaw,
      parsed: null,
      wrapperType: '',
      parseError: jsonResult.error
    };
  }

  const parsed = jsonResult.value;

  if (isObject(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'type') && Object.prototype.hasOwnProperty.call(parsed, 'content')) {
    const wrapperType = typeof parsed.type === 'string' ? parsed.type : '';
    const innerContent = parsed.content;

    if (typeof innerContent === 'string') {
      const innerJsonResult = safeJsonParse(innerContent);
      return {
        raw: innerContent,
        parsed: innerJsonResult.ok ? innerJsonResult.value : null,
        wrapperType,
        parseError: innerJsonResult.ok ? null : innerJsonResult.error
      };
    }

    return {
      raw: toPrettyString(innerContent),
      parsed: innerContent,
      wrapperType,
      parseError: null
    };
  }

  return {
    raw: responseRaw,
    parsed,
    wrapperType: '',
    parseError: null
  };
};

/**
 * 解析 SSE 文本
 * @param {string} sseText
 * @returns {{events: Array, done: boolean, parseError: any}}
 */
export const parseSSEText = (sseText) => {
  const text = typeof sseText === 'string' ? sseText : '';
  if (!text.trim()) {
    return { events: [], done: false, parseError: null };
  }

  const normalized = text.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const events = [];
  let hasDone = false;
  let parseError = null;

  blocks.forEach((block, blockIndex) => {
    const rawBlock = block.trim();
    if (!rawBlock) return;

    const lines = rawBlock.split('\n');
    let eventName = '';
    const dataLines = [];

    lines.forEach((line) => {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
        return;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    });

    const dataText = dataLines.join('\n').trim();
    if (!dataText) {
      events.push({ event: eventName, data: '', parsed: null, done: false, raw: rawBlock, index: blockIndex });
      return;
    }

    if (dataText === '[DONE]') {
      hasDone = true;
      events.push({ event: eventName || 'done', data: dataText, parsed: null, done: true, raw: rawBlock, index: blockIndex });
      return;
    }

    const dataJson = safeJsonParse(dataText);
    if (!dataJson.ok && !parseError) {
      parseError = dataJson.error;
    }

    events.push({
      event: eventName,
      data: dataText,
      parsed: dataJson.ok ? dataJson.value : null,
      done: false,
      raw: rawBlock,
      index: blockIndex
    });
  });

  return { events, done: hasDone, parseError };
};

const buildMessagesForLegacyUI = (requestParsed, protocol) => {
  if (!isObject(requestParsed)) return [];

  if (protocol === ProtocolKind.GEMINI) {
    const list = [];

    if (isObject(requestParsed.systemInstruction) && Array.isArray(requestParsed.systemInstruction.parts)) {
      list.push({
        role: 'system',
        rawContent: requestParsed.systemInstruction,
        content: requestParsed.systemInstruction.parts.map((part) => {
          if (part?.text !== undefined) return { type: 'text', text: part.text };
          if (part?.inlineData)
            return {
              type: 'image',
              url: `data:${part.inlineData.mimeType || 'application/octet-stream'};base64,${part.inlineData.data || ''}`
            };
          if (part?.fileData) return { type: 'image', url: part.fileData.fileUri || '' };
          return { type: 'text', text: JSON.stringify(part) };
        })
      });
    }

    if (Array.isArray(requestParsed.contents)) {
      requestParsed.contents.forEach((item) => {
        const role = item?.role === 'model' ? 'assistant' : item?.role || 'user';
        const parts = Array.isArray(item?.parts) ? item.parts : [];
        list.push({
          role,
          rawContent: item,
          content: parts.map((part) => {
            if (part?.text !== undefined) return { type: 'text', text: part.text };
            if (part?.inlineData)
              return {
                type: 'image',
                url: `data:${part.inlineData.mimeType || 'application/octet-stream'};base64,${part.inlineData.data || ''}`
              };
            if (part?.fileData) return { type: 'image', url: part.fileData.fileUri || '' };
            return { type: 'text', text: JSON.stringify(part) };
          })
        });
      });
    }

    return list;
  }

  if (protocol === ProtocolKind.CLAUDE) {
    const list = [];

    if (typeof requestParsed.system === 'string' && requestParsed.system.trim()) {
      list.push({ role: 'system', rawContent: requestParsed.system, content: [{ type: 'text', text: requestParsed.system }] });
    }

    if (Array.isArray(requestParsed.messages)) {
      requestParsed.messages.forEach((item) => {
        const role = item?.role || 'user';
        const content = Array.isArray(item?.content)
          ? item.content.map((part) => {
              if (part?.type === 'text') return { type: 'text', text: part.text || '' };
              if (part?.type === 'image') {
                const url =
                  part?.source?.url ||
                  (part?.source?.data ? `data:${part?.source?.media_type || 'application/octet-stream'};base64,${part.source.data}` : '');
                return { type: 'image', url };
              }
              return { type: 'text', text: JSON.stringify(part) };
            })
          : [{ type: 'text', text: typeof item?.content === 'string' ? item.content : '' }];

        list.push({ role, rawContent: item, content });
      });
    }

    return list;
  }

  if (Array.isArray(requestParsed.messages)) {
    return requestParsed.messages.map((message) => {
      const rawContent = message;
      const role = message?.role || 'user';

      let contentList = [];
      const content = message?.content;

      if (typeof content === 'string') {
        contentList = [{ type: 'text', text: content }];
      } else if (Array.isArray(content)) {
        contentList = content.map((item) => {
          if (typeof item === 'string') return { type: 'text', text: item };
          if (!isObject(item)) return { type: 'text', text: String(item ?? '') };

          if (item.type === 'text') return { type: 'text', text: item.text || '' };
          if (item.type === 'image_url') return { type: 'image', url: item.image_url?.url || '' };
          if (item.type === 'image') return { type: 'image', url: item.url || '' };

          return { type: 'text', text: JSON.stringify(item) };
        });
      } else {
        contentList = [{ type: 'text', text: '' }];
      }

      return {
        role,
        content: contentList,
        rawContent
      };
    });
  }

  return [];
};

const buildRequestPropsForLegacyUI = (requestParsed, protocol) => {
  if (!isObject(requestParsed)) return {};

  if (protocol === ProtocolKind.GEMINI) {
    const rest = { ...requestParsed };
    delete rest.contents;
    delete rest.systemInstruction;
    return rest;
  }

  if (protocol === ProtocolKind.CLAUDE) {
    const rest = { ...requestParsed };
    delete rest.messages;
    delete rest.system;
    return rest;
  }

  if (protocol === ProtocolKind.RESPONSES) {
    const rest = { ...requestParsed };
    delete rest.input;
    delete rest.instructions;
    return rest;
  }

  const rest = { ...requestParsed };
  delete rest.messages;
  return rest;
};

const mergeResponseForLegacyUI = (responseParsed, collector) => {
  const base = isObject(responseParsed) ? responseParsed : {};
  const thinkingText = collector.reasoning
    .map((item) => item.text)
    .filter(Boolean)
    .join('\n');

  if (!thinkingText) return base;

  if (typeof base.thinking === 'string' && base.thinking.trim()) {
    return base;
  }

  return {
    ...base,
    thinking: thinkingText
  };
};

const extractFinalTextFromResponsesEvents = (events) => {
  if (!Array.isArray(events)) return '';

  let finalVisibleText = '';

  events.forEach((eventItem) => {
    const parsed = eventItem?.parsed;
    if (!isObject(parsed)) return;

    const fromParsedObject = extractFinalTextFromResponsesResponseObject(parsed);
    if (fromParsedObject) {
      finalVisibleText = fromParsedObject;
    }

    if (isObject(parsed.response)) {
      const fromResponseObject = extractFinalTextFromResponsesResponseObject(parsed.response);
      if (fromResponseObject) {
        finalVisibleText = fromResponseObject;
      }
    }

    if (isObject(parsed.item)) {
      const fromSingleItem = extractFinalTextFromResponsesResponseObject({ output: [parsed.item] });
      if (fromSingleItem) {
        finalVisibleText = fromSingleItem;
      }
    }

    const parsedType = normalizeTypeString(parsed.type);
    if (
      typeof parsed.type === 'string' &&
      parsed.type.endsWith('.done') &&
      parsedType.includes('output_text') &&
      !isReasoningLikeType(parsedType) &&
      typeof parsed.text === 'string' &&
      parsed.text.trim()
    ) {
      finalVisibleText = parsed.text.trim();
    }
  });

  return finalVisibleText;
};

const collectByProtocol = ({ protocol, requestParsed, responseParsed, events, collector }) => {
  switch (protocol) {
    case ProtocolKind.RESPONSES:
      collectOpenAIResponsesRequest(requestParsed, collector);
      collectOpenAIResponsesResponse(responseParsed, collector);
      break;
    case ProtocolKind.OPENAI_CHAT:
      collectOpenAIChatRequestMessages(requestParsed, collector);
      collectOpenAIChatResponse(responseParsed, collector);
      break;
    case ProtocolKind.CLAUDE:
      collectClaudeRequest(requestParsed, collector);
      collectClaudeResponse(responseParsed, collector);
      break;
    case ProtocolKind.GEMINI:
      collectGeminiRequest(requestParsed, collector);
      collectGeminiResponse(responseParsed, collector);
      break;
    default:
      break;
  }

  collectFromSSEEvents(events, collector);
};

/**
 * 统一解析入口
 * @param {string} content
 * @returns {{
 *  protocol: string,
 *  request: {raw: string, parsed: any},
 *  response: {raw: string, parsed: any},
 *  events: Array,
 *  messages: Array,
 *  toolCalls: Array,
 *  reasoning: Array,
 *  media: Array,
 *  requestProps: Object,
 *  rawRequestBody: string,
 *  rawResponseBody: string,
 *  responseForUI: any,
 *  messagesForUI: Array,
 *  normalizedRequest: Object,
 *  errors: {request?: any, response?: any, sse?: any},
 *  traceNodes: Array,
 *  diagnostics: {rawEvents:number, rawCalls:number, uniqueCalls:number, completedResults:number, unmatchedCalls:number, orphanResults:number},
 *  linearTrace: Array<{kind:'tool_call'|'tool_result'|'reasoning', callId:string, toolName:string, timestamp:string|number|null, order:number, payload:any}>
 * }}
 */
const reindexLinearTrace = (traceItems) => {
  if (!Array.isArray(traceItems) || traceItems.length === 0) return [];

  return traceItems.map((item, index) => {
    if (!isObject(item)) {
      return {
        kind: 'tool_call',
        callId: '',
        toolName: '',
        timestamp: null,
        order: index,
        payload: item ?? null
      };
    }

    return {
      ...item,
      order: index
    };
  });
};

export const parseRawLogContent = (content) => {
  const sections = splitRawLogSections(content);

  const requestRaw = sections.requestRaw;
  const requestJsonResult = safeJsonParse(requestRaw);
  const requestParsed = requestJsonResult.ok ? requestJsonResult.value : null;

  const responseWrapper = parseResponseWrapper(sections.responseRaw);
  const responseRaw = responseWrapper.raw;

  const sseResult = parseSSEText(responseRaw);
  const hasSSE = sseResult.events.length > 0;

  const responseParsed = responseWrapper.parsed || (hasSSE ? null : parseMaybeJsonString(responseRaw));

  const protocol = detectProtocol({
    requestParsed,
    responseParsed,
    events: sseResult.events
  });

  const collector = createCollector();
  collectByProtocol({
    protocol,
    requestParsed,
    responseParsed,
    events: sseResult.events,
    collector
  });

  let conversationMessages = collector.messages;
  let responsesFinalText = '';

  const emptyTraceResult = createEmptyTraceResult();
  let traceNodes = emptyTraceResult.traceNodes;
  let diagnostics = emptyTraceResult.diagnostics;
  let linearTrace = emptyTraceResult.linearTrace;

  if (protocol === ProtocolKind.RESPONSES) {
    const requestLinearTrace = buildRequestLinearTrace(requestParsed);

    const requestCollector = createCollector();
    collectOpenAIResponsesRequest(requestParsed, requestCollector);
    conversationMessages = requestCollector.messages;

    const objectFinalText = extractFinalTextFromResponsesResponseObject(responseParsed);
    const sseFinalText = extractFinalTextFromResponsesEvents(sseResult.events);
    responsesFinalText = objectFinalText || sseFinalText;

    const traceEvents = buildResponsesTraceEvents({
      events: sseResult.events,
      responseParsed
    });
    const traceResult = reconcileResponsesTrace(traceEvents);
    traceNodes = traceResult.traceNodes;
    diagnostics = traceResult.diagnostics;

    const responseLinearTrace = Array.isArray(traceResult.linearTrace) ? traceResult.linearTrace : [];
    linearTrace = reindexLinearTrace([...requestLinearTrace, ...responseLinearTrace]);
  }

  const responseForUI = mergeResponseForLegacyUI(responseParsed, collector);
  const requestProps = buildRequestPropsForLegacyUI(requestParsed, protocol);
  const messagesForUI = buildMessagesForLegacyUI(requestParsed, protocol);

  return {
    protocol,
    request: {
      raw: requestRaw,
      parsed: requestParsed
    },
    response: {
      raw: responseRaw,
      parsed: responseParsed
    },
    events: sseResult.events,
    messages: conversationMessages,
    toolCalls: collector.toolCalls,
    reasoning: collector.reasoning,
    media: collector.media,
    requestProps,
    rawRequestBody: requestRaw,
    rawResponseBody: responseRaw,
    responseForUI,
    messagesForUI,
    normalizedRequest: requestParsed,
    responsesFinalText,
    errors: {
      request: requestJsonResult.ok ? null : requestJsonResult.error,
      response: responseWrapper.parseError,
      sse: sseResult.parseError
    },
    traceNodes,
    diagnostics,
    linearTrace
  };
};

/**
 * 兜底空模型
 */
export const createEmptyParsedModel = () => {
  const emptyTraceResult = createEmptyTraceResult();

  return {
    protocol: ProtocolKind.UNKNOWN,
    request: { raw: '', parsed: null },
    response: { raw: '', parsed: null },
    events: [],
    messages: [],
    toolCalls: [],
    reasoning: [],
    media: [],
    requestProps: {},
    rawRequestBody: '',
    rawResponseBody: '',
    responseForUI: {},
    messagesForUI: [],
    normalizedRequest: {},
    responsesFinalText: '',
    errors: {
      request: null,
      response: null,
      sse: null
    },
    traceNodes: emptyTraceResult.traceNodes,
    diagnostics: emptyTraceResult.diagnostics,
    linearTrace: emptyTraceResult.linearTrace
  };
};

export { ProtocolKind };
