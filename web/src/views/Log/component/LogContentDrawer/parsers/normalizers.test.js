/* eslint-env node */
const test = require('node:test');
const assert = require('node:assert/strict');

require('sucrase/register');

const { extractRequestConversationMessages } = require('./normalizers.js');
const { buildPreviewModel } = require('./previewModel/buildPreviewModel.js');
const { getConversationMessageMeta } = require('../ConversationSection.jsx');

const summarizeConversation = (messages) =>
  messages.map((message, index) => {
    const meta = getConversationMessageMeta(message, index);

    return {
      kind: meta.kind,
      navTitle: meta.navTitle,
      text: message?.text || '',
      rawType: message?.raw?.type || message?.raw?.role || ''
    };
  });

test('Responses request.input keeps messages and tool items fully interleaved in original order', () => {
  const requestParsed = {
    instructions: 'Follow the system plan.',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Find the Responses docs.' }]
      },
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'I will search the docs first.' }]
      },
      {
        type: 'function_call',
        id: 'fc_1',
        call_id: 'call_1',
        name: 'search_docs',
        arguments: '{"query":"responses request input ordering"}'
      },
      {
        type: 'function_call_output',
        id: 'fo_1',
        call_id: 'call_1',
        name: 'search_docs',
        output: {
          hits: [{ title: 'API Reference' }]
        }
      },
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Use the latest hit.' }]
      }
    ]
  };

  const responseParsed = {
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Here is the final answer.' }]
      }
    ]
  };

  const previewModel = buildPreviewModel({
    ok: true,
    rawPayload: '',
    payload: {
      source: {
        protocol_hint: 'responses',
        provider: 'openai'
      }
    },
    request: {
      raw: JSON.stringify(requestParsed),
      parsed: requestParsed,
      bytes: 0
    },
    response: {
      raw: JSON.stringify(responseParsed),
      parsed: responseParsed,
      type: 'json',
      bytes: 0
    },
    events: []
  });

  assert.deepEqual(summarizeConversation(previewModel.conversation), [
    {
      kind: 'system',
      navTitle: '预设提示词 · Follow the system plan.',
      text: 'Follow the system plan.',
      rawType: ''
    },
    {
      kind: 'user',
      navTitle: '用户消息 · Find the Responses docs.',
      text: 'Find the Responses docs.',
      rawType: 'message'
    },
    {
      kind: 'assistant',
      navTitle: 'AI助手消息 · I will search the docs fi…',
      text: 'I will search the docs first.',
      rawType: 'message'
    },
    {
      kind: 'tool_call',
      navTitle: '工具调用 · search_docs',
      text: '',
      rawType: 'function_call'
    },
    {
      kind: 'tool_result',
      navTitle: '工具结果 · search_docs',
      text: '',
      rawType: 'function_call_output'
    },
    {
      kind: 'user',
      navTitle: '用户消息 · Use the latest hit.',
      text: 'Use the latest hit.',
      rawType: 'message'
    }
  ]);
  assert.equal(previewModel.response.finalText, 'Here is the final answer.');
  assert.equal(
    previewModel.conversation.some((message) => message?.text === 'Here is the final answer.'),
    false
  );
});

test('non-Responses request extraction stays unchanged', () => {
  const messages = extractRequestConversationMessages({
    protocol: 'openai-chat',
    requestParsed: {
      messages: [
        { role: 'system', content: 'You are concise.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ]
    }
  });

  assert.deepEqual(summarizeConversation(messages), [
    {
      kind: 'system',
      navTitle: '预设提示词 · You are concise.',
      text: 'You are concise.',
      rawType: 'system'
    },
    {
      kind: 'user',
      navTitle: '用户消息 · Hello',
      text: 'Hello',
      rawType: 'user'
    },
    {
      kind: 'assistant',
      navTitle: 'AI助手消息 · Hi there',
      text: 'Hi there',
      rawType: 'assistant'
    }
  ]);
});
