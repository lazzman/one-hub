/* eslint-env jest */
import { buildRequestAuditModel, extractToolDefinitions } from './auditModel';

describe('auditModel', () => {
  it('extracts enterprise audit highlights without mutating nested config groups', () => {
    const model = buildRequestAuditModel({
      model: 'gpt-4.1',
      store: true,
      service_tier: 'priority',
      include: ['reasoning.encrypted_content'],
      temperature: 0.2,
      max_output_tokens: 2048,
      top_p: 0.95,
      top_k: 20,
      stop: ['END'],
      response_format: { type: 'json_schema' },
      metadata: { ticket: 'INC-42' },
      reasoning: { effort: 'high' },
      generationConfig: {
        candidateCount: 2,
        responseMimeType: 'application/json'
      },
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY'
        }
      },
      messages: [{ role: 'user', content: 'hello' }]
    });

    expect(model.params.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        '模型',
        '存储',
        '服务层级',
        '附加字段',
        '温度',
        '最大输出',
        'Top P',
        'Top K',
        '停止序列',
        '推理过程',
        '响应格式',
        '元数据'
      ])
    );
    expect(model.params.find((item) => item.label === '响应格式').path).toBe('response_format.type');
    expect(model.remaining.generationConfig).toEqual({
      candidateCount: 2,
      responseMimeType: 'application/json'
    });
    expect(model.remaining.toolConfig).toEqual({
      functionCallingConfig: {
        mode: 'ANY'
      }
    });
    expect(model.remaining.messages).toBeUndefined();
    expect(model.nonConversation).toBeNull();
  });

  it('normalizes function, builtin, namespace and unknown tool definitions', () => {
    const tools = extractToolDefinitions({
      tools: [
        {
          type: 'function',
          function: {
            name: 'search_docs',
            description: 'Search documentation',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                limit: { type: 'integer' }
              },
              required: ['query']
            }
          }
        },
        {
          type: 'tool_search',
          description: 'Search across tools'
        },
        {
          type: 'web_search',
          name: 'web_lookup',
          description: 'Search the web'
        },
        {
          type: 'namespace',
          name: 'knowledge_base',
          description: 'Knowledge namespace',
          tools: [
            { type: 'function', function: { name: 'lookup_doc' } },
            { type: 'function', function: { name: 'list_doc' } }
          ]
        },
        {
          type: 'custom_runtime_tool',
          description: 'Custom runtime tool'
        },
        {
          functionDeclarations: [
            {
              name: 'lookup_weather',
              description: 'Get weather',
              parameters: {
                type: 'object',
                properties: {
                  city: { type: 'string' }
                },
                required: ['city']
              }
            }
          ]
        }
      ]
    });

    expect(tools).toHaveLength(6);
    expect(tools[0]).toMatchObject({
      displayName: 'search_docs',
      path: 'tools[0].function',
      toolType: 'function',
      kind: 'function',
      schemaType: 'object',
      requiredFields: ['query']
    });
    expect(tools[0].schemaSummary).toContain('2 个字段');
    expect(tools[1]).toMatchObject({
      displayName: 'tool_search',
      toolType: 'tool_search',
      kind: 'builtin',
      convertibility: {
        convertible: false,
        reason: 'tool_search 工具当前无法跨协议等价转换'
      }
    });
    expect(tools[2]).toMatchObject({
      displayName: 'web_lookup',
      toolType: 'web_search',
      kind: 'builtin'
    });
    expect(tools[3]).toMatchObject({
      displayName: 'knowledge_base',
      toolType: 'namespace',
      kind: 'namespace',
      namespaceChildCount: 2
    });
    expect(tools[4]).toMatchObject({
      displayName: 'custom_runtime_tool',
      toolType: 'custom_runtime_tool',
      kind: 'unknown'
    });
    expect(tools[5]).toMatchObject({
      name: 'lookup_weather',
      path: 'tools[5].functionDeclarations[0]',
      requiredFields: ['city']
    });
  });

  it('does not misclassify conversation requests as non-conversation summaries', () => {
    const chatModel = buildRequestAuditModel(
      {
        messages: [{ role: 'user', content: 'hello' }],
        response_format: { type: 'json_schema' }
      },
      { schemaKey: 'openai-chat' }
    );
    const responsesModel = buildRequestAuditModel(
      {
        model: 'gpt-4.1',
        input: 'hello world'
      },
      { schemaKey: 'openai-responses' }
    );

    expect(chatModel.nonConversation).toBeNull();
    expect(responsesModel.nonConversation).toBeNull();
  });

  it('keeps non-conversation summaries for explicit embedding schemas', () => {
    const model = buildRequestAuditModel(
      {
        input: 'hello world',
        encoding_format: 'float'
      },
      { schemaKey: 'openai-embeddings' }
    );

    expect(model.nonConversation).toMatchObject({
      kind: 'embeddings'
    });
  });
});
