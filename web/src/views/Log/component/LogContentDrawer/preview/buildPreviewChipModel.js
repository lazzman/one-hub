import { ContentType, getAllImages } from './contentDetector';

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const stableText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const fingerprint = (item) =>
  [item?.type, item?.path, item?.id, item?.toolCallId, item?.name, stableText(item?.content || item?.arguments)].join('|');

const dedupeItems = (items) => {
  const map = new Map();
  items.forEach((item) => {
    const key = fingerprint(item);
    if (!map.has(key)) map.set(key, item);
  });
  return Array.from(map.values());
};

const groupByType = (items) => {
  const grouped = {
    [ContentType.MARKDOWN]: [],
    [ContentType.IMAGE_URL]: [],
    [ContentType.IMAGE_BASE64]: [],
    [ContentType.AUDIO]: [],
    [ContentType.DOCUMENT]: [],
    [ContentType.FILE]: [],
    [ContentType.TOOL_CALL]: [],
    [ContentType.TOOL_RESULT]: [],
    [ContentType.REASONING]: [],
    [ContentType.EVENT]: [],
    tool_definition: []
  };

  items.forEach((item) => {
    if (grouped[item?.type]) grouped[item.type].push(item);
  });
  return grouped;
};

const makeChip = ({ type, label, items, previewKind, handler, color = 'default', staticOnly = false }) => {
  const normalizedItems = dedupeItems(items);
  const enabled = !staticOnly && typeof handler === 'function' && normalizedItems.length > 0;
  return {
    type,
    label: normalizedItems.length > 1 ? `${label} ×${normalizedItems.length}` : label,
    count: normalizedItems.length,
    items: normalizedItems,
    previewKind,
    enabled,
    disabledReason: enabled ? '' : 'No preview handler',
    key: `${type}:${normalizedItems.map(fingerprint).join('::')}`,
    color
  };
};

export const buildPreviewChipModel = ({ detectedItems = [], visibleTypes = null, handlers = {} } = {}) => {
  const visibleTypeSet = Array.isArray(visibleTypes) ? new Set(visibleTypes.map((type) => normalizeText(type)).filter(Boolean)) : null;
  const visibleItems = visibleTypeSet ? detectedItems.filter((item) => visibleTypeSet.has(normalizeText(item?.type))) : detectedItems;
  const grouped = groupByType(dedupeItems(visibleItems));
  const imageItems = getAllImages(grouped);
  const fileItems = [...grouped[ContentType.DOCUMENT], ...grouped[ContentType.FILE]];
  const chips = [
    makeChip({
      type: ContentType.MARKDOWN,
      label: 'Markdown 内容',
      items: grouped[ContentType.MARKDOWN],
      previewKind: 'markdown',
      handler: handlers.onPreviewMarkdown,
      color: 'primary'
    }),
    makeChip({
      type: ContentType.REASONING,
      label: '推理',
      items: grouped[ContentType.REASONING],
      previewKind: 'markdown',
      handler: handlers.onPreviewMarkdown,
      color: 'info'
    }),
    makeChip({
      type: 'image',
      label: '图片',
      items: imageItems,
      previewKind: 'image',
      handler: handlers.onPreviewImages,
      color: 'secondary'
    }),
    makeChip({
      type: ContentType.TOOL_CALL,
      label: '工具调用',
      items: grouped[ContentType.TOOL_CALL],
      previewKind: 'tool_call',
      handler: handlers.onPreviewToolCalls,
      color: 'warning'
    }),
    makeChip({
      type: ContentType.TOOL_RESULT,
      label: '工具结果',
      items: grouped[ContentType.TOOL_RESULT],
      previewKind: 'tool_result',
      handler: handlers.onPreviewToolResults,
      color: 'success'
    }),
    makeChip({
      type: ContentType.EVENT,
      label: '事件',
      items: grouped[ContentType.EVENT],
      previewKind: 'event',
      handler: handlers.onPreviewEvents
    }),
    makeChip({
      type: 'tool_definition',
      label: '工具定义',
      items: grouped.tool_definition,
      previewKind: 'tool_definition',
      handler: handlers.onPreviewToolDefinitions,
      color: 'secondary'
    }),
    makeChip({
      type: ContentType.AUDIO,
      label: '音频',
      items: grouped[ContentType.AUDIO],
      previewKind: 'static',
      staticOnly: true,
      color: 'info'
    }),
    makeChip({
      type: 'file',
      label: '文件',
      items: fileItems,
      previewKind: 'static',
      staticOnly: true
    })
  ];

  return chips.filter((chip) => chip.count > 0);
};
