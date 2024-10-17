/* eslint-env jest */
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import RequestSection from './RequestSection';

const renderRequestSection = (props) =>
  ReactDOMServer.renderToStaticMarkup(
    <ThemeProvider theme={createTheme()}>
      <RequestSection {...props} />
    </ThemeProvider>
  );

describe('RequestSection', () => {
  it('renders cross-protocol omitted-tool warnings for non-function tools', () => {
    const tools = [
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
    ];

    const html = renderRequestSection({
      protocol: 'openai',
      sourceDisplay: {
        schema: { key: 'openai', label: 'OpenAI' }
      },
      viewModel: {
        source: {},
        messages: [],
        request: {
          parsed: { tools },
          normalized: {
            format: 'openai',
            model: 'gpt-4.1',
            systemText: null,
            messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
            params: {},
            tools,
            toolChoice: null
          },
          convertTargets: ['responses', 'claude']
        }
      },
      request: {
        parsed: { tools },
        raw: ''
      },
      requestProps: {},
      rawRequestBody: '',
      onCopyRequestBody: () => {}
    });

    expect(html).toContain('部分工具不可跨协议转换');
    expect(html).toContain('Responses');
    expect(html).toContain('Claude');
    expect(html).toContain('tool_search · tool_search');
    expect(html).toContain('workspace_tools · namespace');
  });

  it('keeps JSON navigation scoped to the raw request panel', () => {
    const requestPayload = {
      model: 'gpt-4.1',
      metadata: {
        attempts: [1, 2]
      },
      messages: [
        {
          role: 'user',
          content: 'hello'
        }
      ]
    };

    const html = renderRequestSection({
      protocol: 'openai',
      sourceDisplay: {
        schema: { key: 'openai', label: 'OpenAI' }
      },
      viewModel: {
        source: {},
        messages: requestPayload.messages,
        request: {
          parsed: requestPayload,
          normalized: null,
          convertTargets: []
        }
      },
      request: {
        parsed: requestPayload,
        raw: JSON.stringify(requestPayload)
      },
      requestProps: {},
      rawRequestBody: JSON.stringify(requestPayload),
      sectionRefs: { current: {} },
      onCopyRequestBody: () => {}
    });

    expect(html).toContain('完整参数视图');
    expect(html).toContain('原始请求');
    expect((html.match(/Path-aware JSON view/g) || []).length).toBe(1);
    expect(html).toContain('$.messages[0].content');
  });
});
