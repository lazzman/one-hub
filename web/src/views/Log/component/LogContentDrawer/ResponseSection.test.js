/* eslint-env jest */
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ResponseSection from './ResponseSection';

const renderResponseSection = (props) =>
  ReactDOMServer.renderToStaticMarkup(
    <ThemeProvider theme={createTheme()}>
      <ResponseSection {...props} />
    </ThemeProvider>
  );

describe('ResponseSection', () => {
  it('keeps JSON navigation scoped to the raw response panel', () => {
    const responsePayload = {
      metadata: {
        attempts: [1, 2]
      },
      choices: [
        {
          message: {
            content: 'Answer'
          }
        }
      ]
    };

    const html = renderResponseSection({
      protocol: 'openai',
      viewModel: {
        protocol: 'openai',
        capabilities: {
          finalAnswer: true,
          rawResponse: true
        },
        request: {
          raw: '',
          parsed: null
        },
        response: {
          raw: JSON.stringify(responsePayload),
          parsed: responsePayload
        },
        source: {
          display: {
            schema: {
              key: 'openai'
            }
          }
        }
      },
      response: responsePayload,
      rawResponseBody: JSON.stringify(responsePayload),
      finalAssistantText: 'Answer',
      toolCalls: [],
      reasoning: [],
      media: [],
      linearTrace: [],
      sectionRefs: { current: {} }
    });

    expect(html).toContain('最终回复');
    expect(html).toContain('原始响应');
    expect((html.match(/Path-aware JSON view/g) || []).length).toBe(1);
    expect(html).toContain('$.metadata.attempts[0]');
  });
});
