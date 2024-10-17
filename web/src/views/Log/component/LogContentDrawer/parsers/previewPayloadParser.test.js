/* eslint-env jest */
import { parsePreviewPayload } from './previewPayloadParser';

describe('parsePreviewPayload', () => {
  it('clears response JSON errors when the raw response is valid SSE text', () => {
    const payload = JSON.stringify({
      source: { is_stream: true },
      request: { raw: '{"model":"gpt-4.1"}' },
      response: {
        raw: 'event: response.output_text.delta\ndata: {"delta":"hello"}\n\ndata: [DONE]'
      }
    });

    const result = parsePreviewPayload(payload);

    expect(result.ok).toBe(true);
    expect(result.response.isSSE).toBe(true);
    expect(result.response.error).toBeNull();
    expect(result.response.sseError).toBeNull();
  });

  it('keeps response JSON errors for non-SSE non-JSON text', () => {
    const payload = JSON.stringify({
      source: { is_stream: false },
      request: { raw: '{"model":"gpt-4.1"}' },
      response: {
        raw: 'plain text response that is neither json nor sse'
      }
    });

    const result = parsePreviewPayload(payload);

    expect(result.ok).toBe(true);
    expect(result.response.isSSE).toBe(false);
    expect(result.response.error).toBeInstanceOf(SyntaxError);
  });

  it('does not suppress response JSON errors for multiline text that only incidentally contains SSE markers', () => {
    const payload = JSON.stringify({
      source: { is_stream: false },
      request: { raw: '{"model":"gpt-4.1"}' },
      response: {
        raw: 'status line\ndata: plain text that is not json'
      }
    });

    const result = parsePreviewPayload(payload);

    expect(result.ok).toBe(true);
    expect(result.response.isSSE).toBe(false);
    expect(result.response.error).toBeInstanceOf(SyntaxError);
    expect(result.response.sseError).toBeNull();
    expect(result.events).toHaveLength(0);
  });

  it('preserves sseError for malformed SSE event payloads while clearing response JSON errors', () => {
    const payload = JSON.stringify({
      source: { is_stream: true },
      request: { raw: '{"model":"gpt-4.1"}' },
      response: {
        raw: 'event: response.output_text.delta\ndata: plain text non-json\n\ndata: [DONE]'
      }
    });

    const result = parsePreviewPayload(payload);

    expect(result.ok).toBe(true);
    expect(result.response.isSSE).toBe(true);
    expect(result.response.error).toBeNull();
    expect(result.response.sseError).toBeInstanceOf(SyntaxError);
    expect(result.response.sseDone).toBe(true);
  });
});
