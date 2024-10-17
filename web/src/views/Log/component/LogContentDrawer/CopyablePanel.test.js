/* eslint-env jest */
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CopyablePanel from './CopyablePanel';

const renderCopyablePanel = (props) =>
  ReactDOMServer.renderToStaticMarkup(
    <ThemeProvider theme={createTheme()}>
      <CopyablePanel {...props} />
    </ThemeProvider>
  );

describe('CopyablePanel', () => {
  it('renders the path-aware navigator for object and array JSON payloads', () => {
    const html = renderCopyablePanel({
      title: 'Raw payload',
      content: { metadata: { attempts: [1, 2] } },
      rawContent: JSON.stringify({ metadata: { attempts: [1, 2] } }),
      enableJsonNavigation: true,
      visibleChipTypes: []
    });

    expect(html).toContain('Path-aware JSON view');
    expect(html).toContain('JSON Navigator');
    expect(html).toContain('$.metadata.attempts[0]');
    expect(html).toContain('Search path or key');
  });

  it('falls back to the legacy preformatted block for non-object JSON content', () => {
    const html = renderCopyablePanel({
      title: 'Raw payload',
      content: 'plain text',
      rawContent: 'plain text',
      enableJsonNavigation: true,
      visibleChipTypes: []
    });

    expect(html).not.toContain('Path-aware JSON view');
    expect(html).toContain('plain text');
    expect(html).toContain('<pre');
  });

  it('falls back to the legacy preformatted block for valid primitive JSON values', () => {
    const html = renderCopyablePanel({
      title: 'Raw payload',
      content: 123,
      rawContent: '123',
      enableJsonNavigation: true,
      visibleChipTypes: []
    });

    expect(html).not.toContain('Path-aware JSON view');
    expect(html).toContain('123');
    expect(html).toContain('<pre');
  });
});
