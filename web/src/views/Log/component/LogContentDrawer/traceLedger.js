/**
 * Responses 轨迹对账
 * 将流式/非流式原始事件统一归并为 trace 结构
 */

import { TraceStatus } from './traceTypes';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const hasOwn = (obj, key) => isObject(obj) && Object.prototype.hasOwnProperty.call(obj, key);

const normalizeTypeString = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const normalizeId = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return text;
};

const normalizeToolName = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const toErrorString = (value) => {
  if (typeof value === 'string') return value.trim();
  if (!isObject(value)) return '';

  if (typeof value.message === 'string' && value.message.trim()) {
    return value.message.trim();
  }

  if (typeof value.error === 'string' && value.error.trim()) {
    return value.error.trim();
  }

  if (typeof value.code === 'string' && value.code.trim()) {
    return value.code.trim();
  }

  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? serialized : '';
  } catch {
    return '';
  }
};

const buildSyntheticEventFromOutputItem = (item, responseParsed, index) => ({
  event: 'response.output_item.done',
  index,
  synthetic: true,
  parsed: {
    type: 'response.output_item.done',
    item,
    status: item?.status ?? responseParsed?.status,
    created_at: item?.created_at ?? responseParsed?.created_at,
    response_id: responseParsed?.id
  }
});

const buildSyntheticEventFromResponseStatus = (responseParsed, index) => {
  const status = normalizeTypeString(responseParsed?.status);
  if (!status) return null;

  return {
    event: `response.${status}`,
    index,
    synthetic: true,
    parsed: {
      type: `response.${status}`,
      status,
      created_at: responseParsed?.created_at,
      response_id: responseParsed?.id,
      error: responseParsed?.error ?? null
    }
  };
};

/**
 * 构造用于对账的 Responses 事件序列（兼容流式 + 非流式）
 * @param {{events?: Array<any>, responseParsed?: any}} params
 * @returns {Array<any>}
 */
export const buildResponsesTraceEvents = ({ events, responseParsed }) => {
  const streamEvents = Array.isArray(events) ? events : [];
  const mergedEvents = [...streamEvents];

  if (!isObject(responseParsed)) return mergedEvents;

  const outputItems = Array.isArray(responseParsed.output) ? responseParsed.output : [];

  if (outputItems.length > 0) {
    outputItems.forEach((item, idx) => {
      mergedEvents.push(buildSyntheticEventFromOutputItem(item, responseParsed, streamEvents.length + idx));
    });
    return mergedEvents;
  }

  const statusEvent = buildSyntheticEventFromResponseStatus(responseParsed, streamEvents.length);
  if (statusEvent) {
    mergedEvents.push(statusEvent);
  }

  return mergedEvents;
};

const getParsedPayload = (sourceEvent) => {
  if (isObject(sourceEvent) && isObject(sourceEvent.parsed)) {
    return sourceEvent.parsed;
  }
  if (isObject(sourceEvent)) {
    return sourceEvent;
  }
  return null;
};

const getEventType = (sourceEvent, parsed) => normalizeTypeString(parsed?.type || sourceEvent?.event || sourceEvent?.type);

const getEventItem = (parsed) => {
  if (!isObject(parsed)) return null;
  if (isObject(parsed.item)) return parsed.item;
  if (isObject(parsed.output_item)) return parsed.output_item;
  if (isObject(parsed.outputItem)) return parsed.outputItem;
  return null;
};

const getEventTimestamp = (sourceEvent, parsed, fallbackIndex) => {
  const candidates = [
    sourceEvent?.timestamp,
    sourceEvent?.created_at,
    sourceEvent?.time,
    sourceEvent?.ts,
    parsed?.timestamp,
    parsed?.created_at,
    parsed?.time,
    parsed?.ts
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
  }

  return fallbackIndex;
};

const extractLifecycleStatus = (eventType, parsed, item) => {
  const normalizedStatusList = [normalizeTypeString(parsed?.status), normalizeTypeString(item?.status)].filter(Boolean);

  if (eventType.includes('cancel')) return TraceStatus.CANCELLED;
  if (eventType.includes('fail') || eventType.includes('error') || eventType.includes('incomplete')) return TraceStatus.FAILED;

  if (normalizedStatusList.some((status) => status.includes('cancel'))) return TraceStatus.CANCELLED;
  if (normalizedStatusList.some((status) => status.includes('fail') || status === 'error' || status === 'incomplete')) {
    return TraceStatus.FAILED;
  }

  if (eventType.includes('in_progress') || normalizedStatusList.includes('in_progress')) {
    return TraceStatus.IN_PROGRESS;
  }

  if (eventType.endsWith('.done') || eventType.endsWith('.completed') || normalizedStatusList.includes('completed')) {
    return TraceStatus.COMPLETED;
  }

  return '';
};

const isDoneLikeEvent = (eventType, lifecycleStatus) => {
  if (eventType.endsWith('.done') || eventType.endsWith('.completed')) return true;
  return lifecycleStatus === TraceStatus.COMPLETED;
};

const pickCallIdFromCall = (parsed, item) =>
  normalizeId(item?.call_id ?? item?.callId ?? item?.id ?? parsed?.call_id ?? parsed?.callId ?? parsed?.item_id ?? parsed?.id);

const pickCallIdFromResult = (parsed, item) =>
  normalizeId(
    item?.call_id ??
      item?.callId ??
      item?.tool_call_id ??
      item?.toolCallId ??
      item?.tool_use_id ??
      parsed?.call_id ??
      parsed?.callId ??
      parsed?.tool_call_id ??
      parsed?.toolCallId ??
      parsed?.tool_use_id ??
      item?.id ??
      parsed?.id
  );

const pickToolName = (parsed, item) =>
  normalizeToolName(item?.name ?? item?.tool_name ?? parsed?.name ?? parsed?.tool_name ?? parsed?.function?.name);

const pickCallArgs = (eventType, parsed, item) => {
  if (eventType.includes('function_call_arguments.delta')) {
    return {
      value: parsed?.delta ?? parsed?.arguments_delta ?? parsed?.arguments ?? '',
      append: true
    };
  }

  if (eventType.includes('function_call_arguments.done')) {
    return {
      value: parsed?.arguments ?? parsed?.delta ?? '',
      append: false
    };
  }

  if (hasOwn(item, 'arguments')) {
    return {
      value: item.arguments,
      append: false
    };
  }

  if (hasOwn(parsed, 'arguments')) {
    return {
      value: parsed.arguments,
      append: false
    };
  }

  if (hasOwn(item, 'input')) {
    return {
      value: item.input,
      append: false
    };
  }

  return {
    value: undefined,
    append: false
  };
};

const pickResultPayload = (parsed, item) => {
  if (hasOwn(item, 'output')) return item.output;
  if (hasOwn(item, 'result')) return item.result;
  if (hasOwn(item, 'response')) return item.response;
  if (hasOwn(item, 'content')) return item.content;
  if (hasOwn(item, 'output_text')) return item.output_text;
  if (hasOwn(item, 'text')) return item.text;

  if (hasOwn(parsed, 'output')) return parsed.output;
  if (hasOwn(parsed, 'result')) return parsed.result;
  if (hasOwn(parsed, 'response')) return parsed.response;
  if (hasOwn(parsed, 'content')) return parsed.content;
  if (hasOwn(parsed, 'output_text')) return parsed.output_text;
  if (hasOwn(parsed, 'text')) return parsed.text;

  return undefined;
};

const collectErrorMessages = (parsed, item, lifecycleStatus) => {
  const candidates = [parsed?.error, parsed?.last_error, item?.error, item?.last_error];
  const messages = candidates.map(toErrorString).filter(Boolean);

  if (messages.length > 0) return messages;

  if (lifecycleStatus === TraceStatus.FAILED) {
    return ['function_call_failed'];
  }

  if (lifecycleStatus === TraceStatus.CANCELLED) {
    return ['function_call_cancelled'];
  }

  return [];
};

const classifyCallEvent = (eventType, parsed, item) => {
  const itemType = normalizeTypeString(item?.type);
  const parsedType = normalizeTypeString(parsed?.type);

  const isFunctionCallItem = itemType === 'function_call';
  const isFunctionCallObject = parsedType === 'function_call';
  const isFunctionCallArgsEvent = eventType.includes('function_call_arguments');

  if (!isFunctionCallItem && !isFunctionCallObject && !isFunctionCallArgsEvent) {
    return null;
  }

  const args = pickCallArgs(eventType, parsed, item);

  return {
    callId: pickCallIdFromCall(parsed, item),
    toolName: pickToolName(parsed, item),
    args,
    resultFromCall: isFunctionCallItem || isFunctionCallObject ? pickResultPayload(parsed, item) : undefined,
    countAsRawCall: isFunctionCallItem || isFunctionCallObject,
    isUpdateOnly: isFunctionCallArgsEvent
  };
};

const classifyResultEvent = (eventType, parsed, item) => {
  const itemType = normalizeTypeString(item?.type);
  const parsedType = normalizeTypeString(parsed?.type);

  const isResultItem = itemType === 'function_call_output' || itemType === 'tool_result' || itemType === 'function_response';
  const isResultObject =
    parsedType === 'function_call_output' ||
    parsedType === 'tool_result' ||
    parsedType === 'function_response' ||
    eventType.includes('function_call_output');
  const hasFunctionCallLikeResultPayload =
    hasOwn(item, 'output') ||
    hasOwn(item, 'result') ||
    hasOwn(item, 'response') ||
    hasOwn(item, 'content') ||
    hasOwn(item, 'output_text') ||
    hasOwn(item, 'text') ||
    hasOwn(parsed, 'output') ||
    hasOwn(parsed, 'result') ||
    hasOwn(parsed, 'response') ||
    hasOwn(parsed, 'content') ||
    hasOwn(parsed, 'output_text') ||
    hasOwn(parsed, 'text');
  const isFunctionCallWithOutput = (itemType === 'function_call' || parsedType === 'function_call') && hasFunctionCallLikeResultPayload;

  if (!isResultItem && !isResultObject && !isFunctionCallWithOutput) {
    return null;
  }

  return {
    callId: pickCallIdFromResult(parsed, item),
    toolName: pickToolName(parsed, item),
    result: pickResultPayload(parsed, item)
  };
};

const createNode = (callId, toolName, firstIndex) => ({
  callId,
  toolName: toolName || '',
  status: TraceStatus.IN_PROGRESS,
  attempts: 0,
  eventCount: 0,
  args: null,
  result: null,
  startedAt: null,
  completedAt: null,
  errors: [],
  sourceEvents: [],
  _flags: {
    hasCall: false,
    hasResult: false,
    explicitFailed: false,
    explicitCancelled: false,
    explicitInProgress: false,
    seenDone: false
  },
  _firstIndex: firstIndex
});

const buildSourceEventRecord = ({ sourceEvent, index, eventType, kind, callId, toolName, timestamp }) => ({
  index,
  event: typeof sourceEvent?.event === 'string' ? sourceEvent.event : '',
  type: eventType,
  kind,
  callId: callId || '',
  toolName: toolName || '',
  timestamp,
  raw: isObject(sourceEvent) && sourceEvent.parsed !== undefined ? sourceEvent.parsed : sourceEvent
});

const getLinearPayloadRaw = (sourceEvent) => {
  if (isObject(sourceEvent) && sourceEvent.parsed !== undefined) {
    return sourceEvent.parsed;
  }
  return sourceEvent ?? null;
};

const createLinearTraceEntry = ({ kind, callId, toolName, timestamp, order, payload }) => ({
  kind,
  callId: callId || '',
  toolName: toolName || '',
  timestamp: timestamp === undefined ? null : timestamp,
  order,
  payload: payload ?? null
});

const REQUEST_TOOL_CALL_TYPES = new Set(['function_call', 'tool_call', 'tool_use']);
const REQUEST_TOOL_RESULT_TYPES = new Set(['function_call_output', 'tool_result', 'function_response']);

const getRequestInputItems = (requestParsed) => {
  if (!isObject(requestParsed)) return [];
  if (requestParsed.input === undefined || requestParsed.input === null) return [];
  return Array.isArray(requestParsed.input) ? requestParsed.input : [requestParsed.input];
};

const pickRequestCallIdFromCall = (item) =>
  normalizeId(item?.call_id ?? item?.callId ?? item?.id ?? item?.tool_call_id ?? item?.toolCallId ?? item?.tool_use_id ?? item?.toolUseId);

const pickRequestCallIdFromResult = (item) =>
  normalizeId(item?.call_id ?? item?.callId ?? item?.tool_call_id ?? item?.toolCallId ?? item?.tool_use_id ?? item?.toolUseId ?? item?.id);

const pickRequestToolName = (item) => normalizeToolName(item?.name ?? item?.tool_name ?? item?.toolName ?? item?.function?.name);

const pickRequestCallArgs = (item) => {
  if (!isObject(item)) return undefined;
  if (hasOwn(item, 'arguments')) return item.arguments;
  if (hasOwn(item, 'input')) return item.input;
  return undefined;
};

const pickRequestResultPayload = (item) => {
  if (!isObject(item)) return undefined;
  if (hasOwn(item, 'output')) return item.output;
  if (hasOwn(item, 'result')) return item.result;
  if (hasOwn(item, 'response')) return item.response;
  if (hasOwn(item, 'content')) return item.content;
  if (hasOwn(item, 'output_text')) return item.output_text;
  if (hasOwn(item, 'text')) return item.text;
  return undefined;
};

/**
 * 从 Responses request.input 提取线性工具轨迹（仅工具调用/结果）
 * @param {any} requestParsed
 * @returns {Array<any>}
 */
export const buildRequestLinearTrace = (requestParsed) => {
  const inputItems = getRequestInputItems(requestParsed);
  if (inputItems.length === 0) return [];

  const linearTrace = [];
  let order = 0;

  inputItems.forEach((item) => {
    if (!isObject(item)) return;

    const itemType = normalizeTypeString(item.type);
    if (!itemType) return;

    if (REQUEST_TOOL_CALL_TYPES.has(itemType)) {
      linearTrace.push(
        createLinearTraceEntry({
          kind: 'tool_call',
          callId: pickRequestCallIdFromCall(item),
          toolName: pickRequestToolName(item),
          timestamp: null,
          order,
          payload: {
            eventType: `request.input.${itemType}`,
            status: null,
            arguments: pickRequestCallArgs(item),
            raw: item
          }
        })
      );
      order += 1;
      return;
    }

    if (REQUEST_TOOL_RESULT_TYPES.has(itemType)) {
      const normalizedResult = pickRequestResultPayload(item);
      linearTrace.push(
        createLinearTraceEntry({
          kind: 'tool_result',
          callId: pickRequestCallIdFromResult(item),
          toolName: pickRequestToolName(item),
          timestamp: null,
          order,
          payload: {
            eventType: `request.input.${itemType}`,
            status: null,
            result: normalizedResult === undefined ? null : normalizedResult,
            raw: item
          }
        })
      );
      order += 1;
    }
  });

  return linearTrace;
};

const buildLinearCallEntryKey = ({ callId, nodeKey }) => {
  if (callId) return `call_id:${callId}`;
  if (nodeKey) return `node:${nodeKey}`;
  return '';
};

const buildLinearCallPayload = ({ eventType, lifecycleStatus, args, sourceEvent }) => {
  const payload = {
    eventType,
    status: lifecycleStatus || null,
    raw: getLinearPayloadRaw(sourceEvent)
  };

  if (args !== undefined) {
    payload.arguments = args;
  }

  return payload;
};

const buildLinearResultPayload = ({ eventType, lifecycleStatus, result, sourceEvent }) => ({
  eventType,
  status: lifecycleStatus || null,
  result,
  raw: getLinearPayloadRaw(sourceEvent)
});

const mergeArgsValue = (currentArgs, incomingArgs, append) => {
  if (incomingArgs === undefined) return currentArgs;

  if (!append) {
    return incomingArgs;
  }

  if (typeof incomingArgs === 'string') {
    if (typeof currentArgs === 'string') {
      return `${currentArgs}${incomingArgs}`;
    }
    if (currentArgs === null || currentArgs === undefined || currentArgs === '') {
      return incomingArgs;
    }
  }

  return incomingArgs;
};

const applyLifecycleStatus = (node, lifecycleStatus) => {
  if (lifecycleStatus === TraceStatus.CANCELLED) {
    node._flags.explicitCancelled = true;
  } else if (lifecycleStatus === TraceStatus.FAILED) {
    node._flags.explicitFailed = true;
  } else if (lifecycleStatus === TraceStatus.IN_PROGRESS) {
    node._flags.explicitInProgress = true;
  }
};

const findUnmatchedCallNodeKey = (nodes, toolName) => {
  const entries = [...nodes.entries()].reverse();

  for (let i = 0; i < entries.length; i += 1) {
    const [key, node] = entries[i];
    if (!node?._flags?.hasCall || node?._flags?.hasResult) continue;

    if (toolName && node.toolName && node.toolName !== toolName) {
      continue;
    }

    return key;
  }

  return '';
};

const pickNodeKeyFromCallId = (nodes, callId) => {
  if (!callId) return '';
  const key = `call:${callId}`;
  if (!nodes.has(key)) return '';
  return key;
};

const finalizeNodeStatus = (node, hasGlobalCompletion) => {
  if (!node._flags.hasCall && node._flags.hasResult) {
    return TraceStatus.ORPHAN_RESULT;
  }

  if (node._flags.explicitCancelled) {
    return TraceStatus.CANCELLED;
  }

  if (node._flags.explicitFailed || (Array.isArray(node.errors) && node.errors.length > 0 && !node._flags.hasResult)) {
    return TraceStatus.FAILED;
  }

  if (node._flags.hasResult) {
    return TraceStatus.COMPLETED;
  }

  if (node._flags.seenDone || hasGlobalCompletion) {
    return TraceStatus.MISSING_RESULT;
  }

  return TraceStatus.IN_PROGRESS;
};

export const createEmptyTraceDiagnostics = () => ({
  rawEvents: 0,
  rawCalls: 0,
  uniqueCalls: 0,
  completedResults: 0,
  unmatchedCalls: 0,
  orphanResults: 0
});

export const createEmptyTraceResult = () => ({
  traceNodes: [],
  diagnostics: createEmptyTraceDiagnostics(),
  linearTrace: []
});

/**
 * 对账归并：将 Responses 原始事件归并为统一 trace 节点
 * @param {Array<any>} sourceEvents
 * @returns {{traceNodes: Array<any>, diagnostics: {rawEvents:number,rawCalls:number,uniqueCalls:number,completedResults:number,unmatchedCalls:number,orphanResults:number}, linearTrace: Array<any>}}
 */
export const reconcileResponsesTrace = (sourceEvents) => {
  const events = Array.isArray(sourceEvents) ? sourceEvents : [];
  if (events.length === 0) {
    return createEmptyTraceResult();
  }

  const nodes = new Map();
  const linearTrace = [];
  const linearCallEntryIndexByKey = new Map();

  let rawCalls = 0;
  let completedResults = 0;
  let orphanResults = 0;
  let fallbackCallSeq = 0;
  let orphanSeq = 0;
  let linearOrder = 0;
  let hasGlobalCompletion = false;

  const ensureNode = (key, callId, toolName, firstIndex) => {
    if (!nodes.has(key)) {
      nodes.set(key, createNode(callId || key, toolName, firstIndex));
    }
    const node = nodes.get(key);

    if (!node.toolName && toolName) {
      node.toolName = toolName;
    }

    return node;
  };

  const resolveCallNodeKey = ({ callId, toolName, allowUnmatchedReuse }) => {
    if (callId) {
      return `call:${callId}`;
    }

    const fallbackToolName = toolName || 'unknown_tool';

    if (allowUnmatchedReuse) {
      const unmatchedKey = findUnmatchedCallNodeKey(nodes, fallbackToolName);
      if (unmatchedKey) {
        return unmatchedKey;
      }
    }

    const fallbackKey = `fallback_call:${fallbackToolName}:${fallbackCallSeq}`;
    fallbackCallSeq += 1;
    return fallbackKey;
  };

  const pushLinearEntry = ({ kind, callId, toolName, timestamp, payload }) => {
    linearTrace.push(
      createLinearTraceEntry({
        kind,
        callId,
        toolName,
        timestamp,
        order: linearOrder,
        payload
      })
    );
    linearOrder += 1;
  };

  const upsertLinearToolCallEntry = ({ mode = 'merge', dedupeKey, callId, toolName, timestamp, payload }) => {
    const shouldAppendDirectly = mode === 'append' || !dedupeKey;
    const existingIndex = shouldAppendDirectly ? undefined : linearCallEntryIndexByKey.get(dedupeKey);

    if (shouldAppendDirectly || existingIndex === undefined) {
      pushLinearEntry({
        kind: 'tool_call',
        callId,
        toolName,
        timestamp,
        payload
      });
      if (dedupeKey) {
        linearCallEntryIndexByKey.set(dedupeKey, linearTrace.length - 1);
      }
      return;
    }

    const existingEntry = linearTrace[existingIndex];
    const mergedPayload = {
      ...(isObject(existingEntry?.payload) ? existingEntry.payload : {}),
      ...(isObject(payload) ? payload : {})
    };

    linearTrace[existingIndex] = {
      ...existingEntry,
      callId: existingEntry.callId || callId || '',
      toolName: existingEntry.toolName || toolName || '',
      timestamp:
        existingEntry.timestamp !== null && existingEntry.timestamp !== undefined
          ? existingEntry.timestamp
          : timestamp === undefined
            ? null
            : timestamp,
      payload: mergedPayload
    };
  };

  events.forEach((sourceEvent, eventIndex) => {
    const parsed = getParsedPayload(sourceEvent);
    if (!isObject(parsed)) return;

    const eventType = getEventType(sourceEvent, parsed);
    const item = getEventItem(parsed);
    const lifecycleStatus = extractLifecycleStatus(eventType, parsed, item);
    const timestamp = getEventTimestamp(sourceEvent, parsed, eventIndex);

    if (eventType === 'response.completed' || eventType === 'response.done') {
      hasGlobalCompletion = true;
    }

    const callSignal = classifyCallEvent(eventType, parsed, item);
    const resultSignal = classifyResultEvent(eventType, parsed, item);
    const errorMessages = collectErrorMessages(parsed, item, lifecycleStatus);

    let callNodeKey = '';

    if (callSignal) {
      const allowUnmatchedReuse = callSignal.isUpdateOnly || !callSignal.countAsRawCall;
      callNodeKey = resolveCallNodeKey({
        callId: callSignal.callId,
        toolName: callSignal.toolName,
        allowUnmatchedReuse
      });
      const callNode = ensureNode(callNodeKey, callSignal.callId || callNodeKey, callSignal.toolName, eventIndex);

      callNode._flags.hasCall = true;
      callNode.eventCount += 1;
      callNode.sourceEvents.push(
        buildSourceEventRecord({
          sourceEvent,
          index: eventIndex,
          eventType,
          kind: callSignal.isUpdateOnly ? 'call_update' : 'call',
          callId: callSignal.callId || callNode.callId,
          toolName: callSignal.toolName || callNode.toolName,
          timestamp
        })
      );

      if (callSignal.countAsRawCall) {
        rawCalls += 1;
        callNode.attempts += 1;
      }

      if (callNode.startedAt === null || callNode.startedAt === undefined) {
        callNode.startedAt = timestamp;
      }

      callNode.args = mergeArgsValue(callNode.args, callSignal.args.value, callSignal.args.append);

      if (callSignal.resultFromCall !== undefined) {
        callNode.result = callSignal.resultFromCall;
        callNode._flags.hasResult = true;
      }

      if (isDoneLikeEvent(eventType, lifecycleStatus)) {
        callNode._flags.seenDone = true;
        callNode.completedAt = timestamp;
      }

      applyLifecycleStatus(callNode, lifecycleStatus);

      if (errorMessages.length > 0) {
        callNode.errors = [...new Set([...callNode.errors, ...errorMessages])];
      }

      if (callSignal.countAsRawCall) {
        const linearCallId = callSignal.callId || callNode.callId || callNodeKey;
        const linearToolName = callSignal.toolName || callNode.toolName;
        const hasStableCallId = Boolean(callSignal.callId);
        // 无 call_id 的 function_call 默认按新调用 append，避免后续调用覆盖前序线性轨迹。
        const linearMode = hasStableCallId ? 'merge' : 'append';
        const linearCallKey = buildLinearCallEntryKey({
          callId: hasStableCallId ? callSignal.callId : '',
          nodeKey: callNodeKey
        });

        upsertLinearToolCallEntry({
          mode: linearMode,
          dedupeKey: linearCallKey,
          callId: linearCallId,
          toolName: linearToolName,
          timestamp,
          payload: buildLinearCallPayload({
            eventType,
            lifecycleStatus,
            args: callNode.args,
            sourceEvent
          })
        });
      }
    }

    let resultNodeKey = '';

    if (resultSignal) {
      completedResults += 1;

      if (resultSignal.callId) {
        resultNodeKey = `call:${resultSignal.callId}`;
      } else {
        resultNodeKey = findUnmatchedCallNodeKey(nodes, resultSignal.toolName);
      }

      if (!resultNodeKey) {
        resultNodeKey = `orphan_result:${orphanSeq}`;
        orphanSeq += 1;
        orphanResults += 1;
      }

      const normalizedResult = resultSignal.result === undefined ? null : resultSignal.result;
      const resultNode = ensureNode(resultNodeKey, resultSignal.callId || resultNodeKey, resultSignal.toolName, eventIndex);

      resultNode.eventCount += 1;
      resultNode.result = normalizedResult;
      resultNode._flags.hasResult = true;

      if (resultNode.startedAt === null || resultNode.startedAt === undefined) {
        resultNode.startedAt = timestamp;
      }
      resultNode.completedAt = timestamp;

      resultNode.sourceEvents.push(
        buildSourceEventRecord({
          sourceEvent,
          index: eventIndex,
          eventType,
          kind: 'result',
          callId: resultSignal.callId || resultNode.callId,
          toolName: resultSignal.toolName || resultNode.toolName,
          timestamp
        })
      );

      applyLifecycleStatus(resultNode, lifecycleStatus);

      if (errorMessages.length > 0) {
        resultNode.errors = [...new Set([...resultNode.errors, ...errorMessages])];
      }

      pushLinearEntry({
        kind: 'tool_result',
        callId: resultSignal.callId || resultNode.callId || resultNodeKey,
        toolName: resultSignal.toolName || resultNode.toolName,
        timestamp,
        payload: buildLinearResultPayload({
          eventType,
          lifecycleStatus,
          result: normalizedResult,
          sourceEvent
        })
      });
    }

    if (!callSignal && !resultSignal && lifecycleStatus) {
      const lifecycleCallId = pickCallIdFromResult(parsed, item);
      const lifecycleToolName = pickToolName(parsed, item);
      const lifecycleKey = pickNodeKeyFromCallId(nodes, lifecycleCallId) || (lifecycleCallId ? `call:${lifecycleCallId}` : '');

      if (lifecycleKey) {
        const lifecycleNode = ensureNode(lifecycleKey, lifecycleCallId || lifecycleKey, lifecycleToolName, eventIndex);
        lifecycleNode.eventCount += 1;
        lifecycleNode.sourceEvents.push(
          buildSourceEventRecord({
            sourceEvent,
            index: eventIndex,
            eventType,
            kind: 'status',
            callId: lifecycleCallId || lifecycleNode.callId,
            toolName: lifecycleToolName || lifecycleNode.toolName,
            timestamp
          })
        );

        if (isDoneLikeEvent(eventType, lifecycleStatus)) {
          lifecycleNode._flags.seenDone = true;
          lifecycleNode.completedAt = timestamp;
        }

        applyLifecycleStatus(lifecycleNode, lifecycleStatus);

        if (errorMessages.length > 0) {
          lifecycleNode.errors = [...new Set([...lifecycleNode.errors, ...errorMessages])];
        }
      }
    }
  });

  const traceNodes = [...nodes.values()]
    .sort((a, b) => a._firstIndex - b._firstIndex)
    .map((node) => {
      const status = finalizeNodeStatus(node, hasGlobalCompletion);
      const uniqueErrors = [...new Set((Array.isArray(node.errors) ? node.errors : []).map((item) => String(item).trim()).filter(Boolean))];

      if (node._flags.hasCall && node.attempts <= 0) {
        node.attempts = 1;
      }

      return {
        callId: node.callId,
        toolName: node.toolName,
        status,
        attempts: node.attempts,
        eventCount: node.eventCount,
        args: node.args,
        result: node.result,
        startedAt: node.startedAt,
        completedAt: node.completedAt,
        errors: uniqueErrors,
        sourceEvents: node.sourceEvents
      };
    });

  const uniqueCalls = [...nodes.values()].filter((node) => node._flags.hasCall).length;
  const unmatchedCalls = [...nodes.values()].filter((node) => node._flags.hasCall && !node._flags.hasResult).length;

  return {
    traceNodes,
    diagnostics: {
      rawEvents: events.length,
      rawCalls,
      uniqueCalls,
      completedResults,
      unmatchedCalls,
      orphanResults
    },
    linearTrace
  };
};
