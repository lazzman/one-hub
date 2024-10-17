import { parseSSEText } from './rawLogParser';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

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

const looksLikeSSE = (value) => {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  return trimmed.startsWith('data:') || trimmed.startsWith('event:') || trimmed.includes('\ndata:') || trimmed.includes('\nevent:');
};

const isConfirmedSSE = (value) => {
  if (typeof value !== 'string') return false;

  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized) return false;

  const blocks = normalized
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return false;

  return blocks.every((block) =>
    block
      .split('\n')
      .map((line) => line.trimEnd())
      .every(
        (line) =>
          !line ||
          line.startsWith(':') ||
          line.startsWith('data:') ||
          line.startsWith('event:') ||
          line.startsWith('id:') ||
          line.startsWith('retry:')
      )
  );
};

export const parsePreviewPayload = (content) => {
  const rawPayload = typeof content === 'string' ? content : '';
  const payloadResult = safeJsonParse(rawPayload);

  if (!payloadResult.ok || !isObject(payloadResult.value)) {
    return {
      ok: false,
      rawPayload,
      payload: null,
      request: { raw: '', parsed: null, bytes: 0, error: null },
      response: { raw: '', parsed: null, bytes: 0, type: '', error: null },
      events: [],
      error: payloadResult.error
    };
  }

  const payload = payloadResult.value;
  const requestRaw = typeof payload?.request?.raw === 'string' ? payload.request.raw : '';
  const responseRaw = typeof payload?.response?.raw === 'string' ? payload.response.raw : '';

  const requestResult = safeJsonParse(requestRaw);
  const responseResult = safeJsonParse(responseRaw);
  const shouldParseSSE = !responseResult.ok && (Boolean(payload?.source?.is_stream) || looksLikeSSE(responseRaw));
  const sseResult = shouldParseSSE ? parseSSEText(responseRaw) : { events: [], done: false, parseError: null };
  const hasSSE = sseResult.events.length > 0;
  const responseIsSSE = hasSSE && isConfirmedSSE(responseRaw);
  // Only suppress the JSON parse failure after the raw body is confirmed to follow SSE framing.
  const responseError = responseResult.ok || responseIsSSE ? null : responseResult.error;

  return {
    ok: true,
    rawPayload,
    payload,
    request: {
      raw: requestRaw,
      parsed: requestResult.ok ? requestResult.value : null,
      bytes: Number(payload?.request?.bytes || requestRaw.length || 0),
      error: requestResult.ok ? null : requestResult.error
    },
    response: {
      raw: responseRaw,
      parsed: responseResult.ok ? responseResult.value : null,
      bytes: Number(payload?.response?.bytes || responseRaw.length || 0),
      type: typeof payload?.response?.type === 'string' ? payload.response.type : '',
      error: responseError,
      isSSE: responseIsSSE,
      sseDone: responseIsSSE ? sseResult.done : false,
      sseError: responseIsSSE ? sseResult.parseError : null
    },
    events: responseIsSSE ? sseResult.events : [],
    error: null
  };
};
