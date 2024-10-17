/* eslint-env jest */
import { convertToClaude, convertToGemini, convertToOpenAI, convertToResponses, getToolConversionMeta } from './formatConverters';
import { RequestFormat } from './utils';

const buildNormalizedRequest = (tools) => ({
  format: RequestFormat.OPENAI,
  model: 'gpt-4.1',
  systemText: null,
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: 'hello' }]
    }
  ],
  params: {},
  tools,
  toolChoice: null
});

describe('formatConverters tool conversion', () => {
  it('keeps function tools convertible without warnings', () => {
    const normalized = buildNormalizedRequest([
      {
        type: 'function',
        function: {
          name: 'search_docs',
          description: 'Search docs',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            },
            required: ['query']
          }
        }
      }
    ]);

    const openaiRequest = convertToOpenAI(normalized);
    const conversionMeta = getToolConversionMeta(openaiRequest);

    expect(openaiRequest.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'search_docs',
          description: 'Search docs',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            },
            required: ['query']
          }
        }
      }
    ]);
    expect(conversionMeta.hasOmittedTools).toBe(false);
    expect(conversionMeta.omittedTools).toEqual([]);
  });

  it('omits non-function tools and exposes warning metadata across target protocols', () => {
    const normalized = buildNormalizedRequest([
      {
        type: 'function',
        function: {
          name: 'search_docs',
          description: 'Search docs',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            }
          }
        }
      },
      {
        type: 'tool_search',
        description: 'Search built-in tool'
      },
      {
        type: 'namespace',
        name: 'workspace_tools',
        tools: [{ type: 'function', function: { name: 'lookup_doc' } }]
      }
    ]);

    const responsesRequest = convertToResponses(normalized);
    const claudeRequest = convertToClaude(normalized);
    const geminiRequest = convertToGemini(normalized);

    expect(responsesRequest.tools).toHaveLength(1);
    expect(claudeRequest.tools).toHaveLength(1);
    expect(geminiRequest.tools[0].functionDeclarations).toHaveLength(1);

    [responsesRequest, claudeRequest, geminiRequest].forEach((convertedRequest) => {
      const conversionMeta = getToolConversionMeta(convertedRequest);
      expect(conversionMeta.hasOmittedTools).toBe(true);
      expect(conversionMeta.omittedTools.map((tool) => tool.displayName)).toEqual(['tool_search', 'workspace_tools']);
      expect(conversionMeta.warnings[0]).toContain('部分工具不可跨协议转换');
    });
  });
});
