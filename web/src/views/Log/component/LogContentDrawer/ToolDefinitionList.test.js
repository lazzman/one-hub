/* eslint-env jest */
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ToolDefinitionList from './ToolDefinitionList';

const renderToolList = (tools) =>
  ReactDOMServer.renderToStaticMarkup(
    <ThemeProvider theme={createTheme()}>
      <ToolDefinitionList tools={tools} />
    </ThemeProvider>
  );

describe('ToolDefinitionList', () => {
  it('renders non-schema tools and namespace summaries', () => {
    const html = renderToolList([
      {
        displayName: 'tool_search',
        name: 'tool_search',
        description: 'Search built-in tool',
        schema: null,
        raw: { type: 'tool_search', description: 'Search built-in tool' },
        path: 'tools[0]',
        toolType: 'tool_search',
        kind: 'builtin',
        convertibility: { convertible: false, reason: 'tool_search 工具当前无法跨协议等价转换' },
        namespaceChildCount: 0,
        schemaSummary: '未提供 Schema',
        schemaPropertyNames: [],
        requiredFields: []
      },
      {
        displayName: 'workspace_tools',
        name: 'workspace_tools',
        description: 'Namespace container',
        schema: null,
        raw: { type: 'namespace', name: 'workspace_tools', tools: [{}, {}] },
        path: 'tools[1]',
        toolType: 'namespace',
        kind: 'namespace',
        convertibility: { convertible: false, reason: 'namespace 容器工具当前无法跨协议等价转换' },
        namespaceChildCount: 2,
        schemaSummary: '未提供 Schema',
        schemaPropertyNames: [],
        requiredFields: []
      }
    ]);

    expect(html).toContain('tool_search');
    expect(html).toContain('workspace_tools');
    expect(html).toContain('类型：tool_search');
    expect(html).toContain('子工具：2');
    expect(html).toContain('原始工具定义');
  });
});
