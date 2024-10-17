/* eslint-env jest */
import { buildSourceDisplayModel, getPreferredCurlTarget } from './sourceDisplayModel';

describe('buildSourceDisplayModel', () => {
  it('separates OpenRouter provider from OpenAI-compatible chat schema', () => {
    const model = buildSourceDisplayModel({
      source: {
        provider: 'openrouter',
        protocol_hint: 'openai-chat',
        endpoint_path: '/v1/chat/completions',
        is_stream: true
      }
    });

    expect(model.provider.label).toBe('OpenRouter');
    expect(model.schema.label).toBe('OpenAI-compatible Chat');
    expect(model.endpoint.key).toBe('chat-completions');
    expect(model.transport.label).toBe('流式');
    expect(getPreferredCurlTarget(model)).toBe('openai');
  });

  it('uses api schema fields when available', () => {
    const model = buildSourceDisplayModel({
      source: {
        api_provider: 'vertex-ai',
        api_schema: 'claude-messages',
        api_endpoint: 'vertex-claude-messages',
        api_transport: 'non-stream'
      }
    });

    expect(model.provider.label).toBe('Vertex AI');
    expect(model.schema.label).toBe('Claude Messages');
    expect(model.endpoint.key).toBe('vertex-claude-messages');
    expect(getPreferredCurlTarget(model)).toBe('claude');
  });

  it('preserves explicit openai-compatible schema from new logs', () => {
    const model = buildSourceDisplayModel({
      source: {
        api_provider: 'openrouter',
        api_schema: 'openai-compatible',
        api_endpoint: 'chat-completions',
        api_transport: 'stream'
      }
    });

    expect(model.provider.label).toBe('OpenRouter');
    expect(model.schema.label).toBe('OpenAI-compatible Chat');
    expect(model.transport.label).toBe('流式');
  });
});
