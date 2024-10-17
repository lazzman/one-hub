/* eslint-env jest */
import { buildPreviewChipModel } from './buildPreviewChipModel';

describe('buildPreviewChipModel', () => {
  it('dedupes matching items and disables chips without handlers', () => {
    const chips = buildPreviewChipModel({
      detectedItems: [
        { type: 'tool_call', id: 'call_1', name: 'search', arguments: '{}', path: 'a' },
        { type: 'tool_call', id: 'call_1', name: 'search', arguments: '{}', path: 'a' },
        { type: 'audio', content: 'abc', path: 'audio' }
      ],
      handlers: {
        onPreviewToolCalls: () => {}
      }
    });

    const toolChip = chips.find((chip) => chip.type === 'tool_call');
    const audioChip = chips.find((chip) => chip.type === 'audio');

    expect(toolChip.count).toBe(1);
    expect(toolChip.enabled).toBe(true);
    expect(audioChip.enabled).toBe(false);
    expect(audioChip.previewKind).toBe('static');
  });

  it('does not make markdown clickable without a preview handler', () => {
    const chips = buildPreviewChipModel({
      detectedItems: [{ type: 'markdown', content: '# title', path: 'message.content' }]
    });

    expect(chips[0].type).toBe('markdown');
    expect(chips[0].enabled).toBe(false);
  });
});
