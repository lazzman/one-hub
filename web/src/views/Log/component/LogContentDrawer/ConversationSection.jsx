import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Card, CardContent, Alert } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import BuildIcon from '@mui/icons-material/Build';
import CopyablePanel from './CopyablePanel';
import { ContentType, ImagePreview, detectAllMessageContent } from './preview';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeType = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const normalizeInlineText = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

const truncateLabel = (value, maxLength = 28) => {
  const normalized = normalizeInlineText(value);
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
};

const safeJsonParse = (value) => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

function normalizeMessageText(message) {
  if (!message || typeof message !== 'object') return '';

  if (typeof message.text === 'string' && message.text.trim()) {
    return message.text.trim();
  }

  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          if (typeof item.text === 'string') return item.text;
          if (typeof item.content === 'string') return item.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();

    if (text) return text;
  }

  return '';
}

const dedupeStructuredItems = (items) => {
  const seen = new Set();

  return items.filter((item) => {
    const key = [item.type, item.id || item.toolCallId || '', item.name || '', item.path || ''].join('::');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const collectStructuredMessageItems = (message) => {
  const rawMessage = message?.raw;
  if (!isObject(rawMessage)) return [];

  const items = [];
  const rawType = normalizeType(rawMessage.type);

  if (rawType === 'function_call') {
    items.push({
      type: 'tool_call',
      id: rawMessage.call_id || rawMessage.id || '',
      name: rawMessage.name || '',
      arguments: rawMessage.arguments ?? rawMessage.input ?? '',
      path: 'message.raw'
    });
  }

  if (rawType === 'function_call_output' || rawType === 'tool_result') {
    items.push({
      type: 'tool_result',
      toolCallId: rawMessage.call_id || rawMessage.tool_call_id || rawMessage.tool_use_id || rawMessage.id || '',
      name: rawMessage.name || '',
      content: safeJsonParse(rawMessage.output ?? rawMessage.content ?? rawMessage.result ?? ''),
      isError: Boolean(rawMessage.is_error || rawMessage.isError),
      path: 'message.raw'
    });
  }

  if (rawType === 'reasoning' || rawType === 'thinking' || rawType.includes('reasoning') || rawType.includes('thinking')) {
    items.push({
      type: 'reasoning',
      content:
        message?.text ||
        rawMessage.text ||
        rawMessage.summary ||
        rawMessage.summary_text ||
        rawMessage.content ||
        rawMessage.reasoning ||
        '',
      reasoningType: rawType || 'reasoning',
      path: 'message.raw'
    });
  }

  if (typeof rawMessage.reasoning_content === 'string' && rawMessage.reasoning_content.trim()) {
    items.push({
      type: 'reasoning',
      content: rawMessage.reasoning_content,
      reasoningType: 'reasoning_content',
      path: 'message.raw.reasoning_content'
    });
  }

  if (Array.isArray(rawMessage.tool_calls)) {
    rawMessage.tool_calls.forEach((toolCall, index) => {
      if (!isObject(toolCall)) return;
      const fn = isObject(toolCall.function) ? toolCall.function : {};
      items.push({
        type: 'tool_call',
        id: toolCall.id || '',
        name: typeof fn.name === 'string' ? fn.name : '',
        arguments: fn.arguments ?? '',
        path: `message.raw.tool_calls[${index}]`
      });
    });
  }

  if (normalizeType(rawMessage.role) === 'tool') {
    items.push({
      type: 'tool_result',
      toolCallId: rawMessage.tool_call_id || rawMessage.call_id || rawMessage.id || '',
      name: rawMessage.name || '',
      content: safeJsonParse(rawMessage.content ?? rawMessage.output ?? rawMessage.result ?? ''),
      isError: Boolean(rawMessage.is_error || rawMessage.isError),
      path: 'message.raw'
    });
  }

  const contentItems = Array.isArray(rawMessage.content) ? rawMessage.content : [];
  contentItems.forEach((part, index) => {
    if (!isObject(part)) return;

    const partType = normalizeType(part.type);

    if (partType === 'tool_use') {
      items.push({
        type: 'tool_call',
        id: part.id || '',
        name: part.name || '',
        arguments: part.input ?? '',
        path: `message.raw.content[${index}]`
      });
    }

    if (partType === 'tool_result') {
      items.push({
        type: 'tool_result',
        toolCallId: part.tool_use_id || part.tool_call_id || part.id || '',
        name: part.name || rawMessage.name || '',
        content: safeJsonParse(part.content ?? part.output ?? part.result ?? ''),
        isError: Boolean(part.is_error || part.isError),
        path: `message.raw.content[${index}]`
      });
    }

    if (partType === 'thinking' || partType.includes('reasoning')) {
      items.push({
        type: 'reasoning',
        content: part.thinking || part.text || part.summary || part.summary_text || part.reasoning || '',
        reasoningType: partType || 'reasoning',
        path: `message.raw.content[${index}]`
      });
    }
  });

  const geminiParts = Array.isArray(rawMessage.parts)
    ? rawMessage.parts
    : Array.isArray(rawMessage?.content?.parts)
      ? rawMessage.content.parts
      : [];

  geminiParts.forEach((part, index) => {
    if (!isObject(part)) return;

    if (isObject(part.functionCall)) {
      items.push({
        type: 'tool_call',
        id: '',
        name: part.functionCall.name || '',
        arguments: part.functionCall.args ?? '',
        path: `message.raw.parts[${index}]`
      });
    }

    if (isObject(part.functionResponse)) {
      items.push({
        type: 'tool_result',
        toolCallId: '',
        name: part.functionResponse.name || '',
        content: safeJsonParse(part.functionResponse.response ?? ''),
        isError: Boolean(part.functionResponse.is_error || part.functionResponse.isError),
        path: `message.raw.parts[${index}]`
      });
    }

    if (typeof part.thought === 'string' && part.thought.trim()) {
      items.push({
        type: 'reasoning',
        content: part.thought,
        reasoningType: 'thought',
        path: `message.raw.parts[${index}]`
      });
    }
  });

  return dedupeStructuredItems(items);
};

const formatStructuredName = (items) => {
  const names = Array.from(new Set(items.map((item) => normalizeInlineText(item.name)).filter(Boolean)));

  if (names.length === 0) return '';
  if (names.length === 1) return truncateLabel(names[0], 36);
  return `${truncateLabel(names[0], 20)} 等 ${names.length} 项`;
};

export const getConversationMessageMeta = (message, index = 0) => {
  const structuredItems = collectStructuredMessageItems(message);
  const structuredTypes = new Set(structuredItems.map((item) => item.type));
  const textPreview = truncateLabel(normalizeMessageText(message), 26);
  const rawRole = normalizeType(message?.role || message?.raw?.role);

  let kind = 'assistant';
  if (structuredTypes.has('tool_result')) {
    kind = 'tool_result';
  } else if (structuredTypes.has('tool_call')) {
    kind = 'tool_call';
  } else if (structuredTypes.has('reasoning')) {
    kind = 'reasoning';
  } else if (rawRole === 'system') {
    kind = 'system';
  } else if (rawRole === 'developer') {
    kind = 'developer';
  } else if (rawRole === 'user') {
    kind = 'user';
  } else if (rawRole === 'tool') {
    kind = 'tool_result';
  }

  const role =
    kind === 'system'
      ? 'system'
      : kind === 'developer'
        ? 'developer'
        : kind === 'user'
          ? 'user'
          : kind === 'tool_result'
            ? 'tool'
            : 'assistant';
  const toolCallName = formatStructuredName(structuredItems.filter((item) => item.type === 'tool_call'));
  const toolResultName = formatStructuredName(structuredItems.filter((item) => item.type === 'tool_result'));
  const reasoningPreview = truncateLabel(
    structuredItems
      .filter((item) => item.type === 'reasoning')
      .map((item) => (typeof item.content === 'string' ? item.content : ''))
      .find(Boolean) || '',
    22
  );

  let headerTitle = 'AI助手消息';
  let navTitle = textPreview ? `AI助手消息 · ${textPreview}` : `AI助手消息 ${index + 1}`;
  let panelTitle = '内容';
  let iconType = 'assistant';
  let color = 'secondary.dark';

  switch (kind) {
    case 'system':
      headerTitle = '预设提示词';
      navTitle = textPreview ? `预设提示词 · ${textPreview}` : `预设提示词 ${index + 1}`;
      panelTitle = '内容';
      iconType = 'system';
      color = 'info.dark';
      break;
    case 'developer':
      headerTitle = '开发者提示词';
      navTitle = textPreview ? `开发者提示词 · ${textPreview}` : `开发者提示词 ${index + 1}`;
      panelTitle = '内容';
      iconType = 'developer';
      color = 'success.dark';
      break;
    case 'user':
      headerTitle = '用户消息';
      navTitle = textPreview ? `用户消息 · ${textPreview}` : `用户消息 ${index + 1}`;
      panelTitle = '内容';
      iconType = 'user';
      color = 'primary.dark';
      break;
    case 'tool_call': {
      const displayTitle = toolCallName ? `工具调用 · ${toolCallName}` : '工具调用';
      headerTitle = displayTitle;
      navTitle = displayTitle;
      panelTitle = '工具调用';
      iconType = 'tool_call';
      color = 'warning.dark';
      break;
    }
    case 'tool_result': {
      const detail = toolResultName || textPreview;
      const displayTitle = detail ? `工具结果 · ${detail}` : '工具结果';
      headerTitle = displayTitle;
      navTitle = displayTitle;
      panelTitle = '工具结果';
      iconType = 'tool_result';
      color = 'warning.dark';
      break;
    }
    case 'reasoning': {
      const displayTitle = reasoningPreview ? `推理片段 · ${reasoningPreview}` : '推理片段';
      headerTitle = '推理片段';
      navTitle = displayTitle;
      panelTitle = '推理片段';
      iconType = 'reasoning';
      color = 'secondary.dark';
      break;
    }
    default:
      break;
  }

  const visibleChipTypes = Array.from(
    new Set(
      [
        ...['tool_call', 'tool_result', 'reasoning'].filter((type) => structuredTypes.has(type)),
        ...structuredItems.map((item) => item?.type).filter(Boolean)
      ].filter(Boolean)
    )
  );

  return {
    role,
    kind,
    headerTitle,
    navTitle,
    panelTitle,
    iconType,
    color,
    detectedItems: structuredItems.length > 0 ? structuredItems : null,
    visibleChipTypes: visibleChipTypes.length > 0 ? visibleChipTypes : null
  };
};

const mergeDetectedItems = (primaryItems = [], secondaryItems = []) => {
  const seen = new Set();
  const merged = [];

  [...primaryItems, ...secondaryItems].forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const key = [item.type || '', item.id || item.toolCallId || '', item.name || '', item.path || '', index].join('::');
    const stableKey = [item.type || '', item.id || item.toolCallId || '', item.name || '', item.path || ''].join('::');
    const finalKey = stableKey === '::::' ? key : stableKey;
    if (seen.has(finalKey)) return;
    seen.add(finalKey);
    merged.push(item);
  });

  return merged;
};

const buildDetectedItemsForMessage = (message) => {
  const messageMeta = getConversationMessageMeta(message);
  const metaDetectedItems = messageMeta.detectedItems;
  const messageDetection = detectAllMessageContent(message?.raw || message);
  const contentItems = Array.isArray(messageDetection?.content) ? messageDetection.content : [];

  if (metaDetectedItems?.length && contentItems.length) {
    return mergeDetectedItems(metaDetectedItems, contentItems);
  }

  return metaDetectedItems?.length ? metaDetectedItems : contentItems;
};

const toDisplayText = (value) => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const normalizeMessageBlocks = (message) => {
  const rawMessage = message?.raw;
  const rawContent = Array.isArray(rawMessage?.content)
    ? rawMessage.content
    : Array.isArray(rawMessage?.parts)
      ? rawMessage.parts
      : Array.isArray(message?.content)
        ? message.content
        : null;

  if (Array.isArray(rawContent) && rawContent.length > 0) {
    return rawContent
      .map((item, index) => {
        if (typeof item === 'string') {
          return { type: 'text', content: item, key: `text-${index}` };
        }

        if (!isObject(item)) {
          return { type: 'text', content: toDisplayText(item), key: `text-${index}` };
        }

        if (typeof item.text === 'string' && item.text.trim()) {
          return { type: 'text', content: item.text, key: `text-${index}` };
        }

        if (typeof item.content === 'string' && item.content.trim()) {
          return { type: 'text', content: item.content, key: `content-${index}` };
        }

        if (item.type === 'image_url' && item.image_url?.url) {
          return { type: 'image', content: item.image_url.url, key: itemPathKey(item, index) };
        }

        if (item.type === 'input_image' && item.image_url) {
          return { type: 'image', content: item.image_url, key: itemPathKey(item, index) };
        }

        if (item.type === 'image' && item.source?.type === 'base64' && item.source?.data) {
          return {
            type: 'image',
            content: item.source.media_type ? `data:${item.source.media_type};base64,${item.source.data}` : item.source.data,
            key: itemPathKey(item, index)
          };
        }

        if (item.type === 'image' && item.source?.type === 'url' && item.source?.url) {
          return { type: 'image', content: item.source.url, key: itemPathKey(item, index) };
        }

        if (item.inlineData?.data) {
          return {
            type: 'image',
            content: `data:${item.inlineData.mimeType || 'image/jpeg'};base64,${item.inlineData.data}`,
            key: itemPathKey(item, index)
          };
        }

        if (item.fileData?.fileUri) {
          return { type: 'image', content: item.fileData.fileUri, key: itemPathKey(item, index) };
        }

        if (typeof item.thinking === 'string' && item.thinking.trim()) {
          return { type: 'text', content: item.thinking, key: `thinking-${index}` };
        }

        return null;
      })
      .filter(Boolean);
  }

  if (typeof message?.text === 'string' && message.text.trim()) {
    return [{ type: 'text', content: message.text, key: 'text' }];
  }

  return [];
};

const itemPathKey = (item, index) => item?.path || item?.id || `image-${index}`;

const MessageInlineContent = ({ blocks, onPreviewImage }) => {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {blocks.map((block, index) =>
        block.type === 'image' ? (
          <Box
            key={block.key || `image-${index}`}
            onClick={() => onPreviewImage(index)}
            sx={{
              width: 'fit-content',
              maxWidth: 'min(100%, 420px)',
              borderRadius: 2,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'zoom-in',
              bgcolor: 'background.paper',
              boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 2px 6px rgba(0,0,0,0.25)' : '0 2px 6px rgba(15,23,42,0.08)'),
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 6px 16px rgba(0,0,0,0.35)' : '0 8px 20px rgba(15,23,42,0.12)')
              }
            }}
          >
            <Box
              component="img"
              src={block.content}
              alt={`消息图片 ${index + 1}`}
              sx={{
                width: '100%',
                maxWidth: '420px',
                maxHeight: '320px',
                objectFit: 'contain',
                display: 'block',
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)')
              }}
            />
          </Box>
        ) : (
          <Typography
            key={block.key || `text-${index}`}
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7 }}
          >
            {block.content}
          </Typography>
        )
      )}
    </Box>
  );
};

MessageInlineContent.propTypes = {
  blocks: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.oneOf(['text', 'image']),
      content: PropTypes.string,
      key: PropTypes.string
    })
  ),
  onPreviewImage: PropTypes.func
};

/**
 * 消息卡片组件
 * 展示单条消息
 */
const MessageCard = React.forwardRef(({ message, index }, ref) => {
  const messageMeta = getConversationMessageMeta(message, index);
  const role = messageMeta.role;
  const text = typeof message?.text === 'string' ? message.text : '';
  const hasText = text.trim().length > 0;
  const rawMessage = message?.raw ?? null;
  const panelContent = hasText ? text : rawMessage;
  const detectedItems = useMemo(() => buildDetectedItemsForMessage(message) || [], [message]);
  const visibleChipTypes = useMemo(() => {
    const detectedTypes = detectedItems.map((item) => item?.type).filter(Boolean);
    if (!Array.isArray(messageMeta.visibleChipTypes) || messageMeta.visibleChipTypes.length === 0) {
      return null;
    }
    return Array.from(new Set([...messageMeta.visibleChipTypes, ...detectedTypes]));
  }, [detectedItems, messageMeta.visibleChipTypes]);
  const contentBlocks = useMemo(() => normalizeMessageBlocks(message), [message]);
  const hasInlineContentBlocks = contentBlocks.length > 0;
  const imageItems = useMemo(
    () => detectedItems.filter((item) => item?.type === ContentType.IMAGE_URL || item?.type === ContentType.IMAGE_BASE64),
    [detectedItems]
  );
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const getRoleIcon = () => {
    switch (messageMeta.iconType) {
      case 'system':
        return <MenuBookIcon sx={{ mr: 1 }} color="info" />;
      case 'developer':
        return <MenuBookIcon sx={{ mr: 1 }} color="success" />;
      case 'user':
        return <PersonIcon sx={{ mr: 1 }} color="primary" />;
      case 'tool_call':
      case 'tool_result':
        return <BuildIcon sx={{ mr: 1 }} color="warning" />;
      default:
        return <SmartToyIcon sx={{ mr: 1 }} color="secondary" />;
    }
  };

  const getCardBgColor = (theme) => {
    if (theme.palette.mode === 'dark') {
      return role === 'user'
        ? 'rgba(59, 130, 246, 0.15)'
        : role === 'system'
          ? 'rgba(14, 165, 233, 0.15)'
          : role === 'developer'
            ? 'rgba(34, 197, 94, 0.15)'
            : role === 'tool'
              ? 'rgba(250, 204, 21, 0.15)'
              : 'rgba(168, 85, 247, 0.15)';
    }
    return role === 'user'
      ? 'rgba(59, 130, 246, 0.08)'
      : role === 'system'
        ? 'rgba(14, 165, 233, 0.08)'
        : role === 'developer'
          ? 'rgba(34, 197, 94, 0.08)'
          : role === 'tool'
            ? 'rgba(250, 204, 21, 0.08)'
            : 'rgba(168, 85, 247, 0.08)';
  };

  const handleOpenImagePreview = (targetIndex) => {
    setActiveImageIndex(targetIndex);
    setImagePreviewOpen(true);
  };

  const handleOpenInlineImagePreview = (targetIndex) => {
    if (!Array.isArray(contentBlocks) || contentBlocks.length === 0) {
      handleOpenImagePreview(targetIndex);
      return;
    }

    const imageBlockIndexes = contentBlocks.reduce((indexes, block, index) => {
      if (block.type === 'image') {
        indexes.push(index);
      }
      return indexes;
    }, []);

    const targetBlockIndex = imageBlockIndexes[targetIndex];
    const previewIndex = imageItems.findIndex((item) => (item?.content || '') === (contentBlocks[targetBlockIndex]?.content || ''));
    handleOpenImagePreview(previewIndex >= 0 ? previewIndex : targetIndex);
  };

  return (
    <Box id={`message-${index}`} ref={ref}>
      <Card
        sx={{
          bgcolor: getCardBgColor,
          borderRadius: '12px',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark' ? '0 6px 8px rgba(0,0,0,0.3)' : '0 6px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.12)'
          },
          mb: 2
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            {getRoleIcon()}
            <Typography variant="h6" fontWeight="bold" color={messageMeta.color}>
              {messageMeta.headerTitle}
            </Typography>
          </Box>

          {panelContent ? (
            <CopyablePanel
              title={messageMeta.panelTitle}
              content={panelContent}
              rawContent={hasText ? text : undefined}
              detectedItemsOverride={detectedItems}
              visibleChipTypes={visibleChipTypes}
              sx={{
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255, 255, 255, 0.7)'),
                boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none')
              }}
            >
              {hasInlineContentBlocks ? (
                <MessageInlineContent blocks={contentBlocks} onPreviewImage={handleOpenInlineImagePreview} />
              ) : undefined}
            </CopyablePanel>
          ) : (
            <Typography variant="body2" color="text.secondary">
              该消息无可展示文本内容
            </Typography>
          )}

          <ImagePreview
            images={imageItems}
            initialIndex={activeImageIndex}
            open={imagePreviewOpen}
            onClose={() => setImagePreviewOpen(false)}
          />
        </CardContent>
      </Card>
    </Box>
  );
});

MessageCard.displayName = 'MessageCard';

MessageCard.propTypes = {
  message: PropTypes.shape({
    role: PropTypes.string,
    text: PropTypes.string,
    content: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(
        PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.shape({
            text: PropTypes.string,
            content: PropTypes.string
          })
        ])
      )
    ]),
    raw: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
  }),
  index: PropTypes.number
};

/**
 * 输入消息部分组件
 * 展示所有请求侧消息
 */
const ConversationSection = React.forwardRef(({ messages, fallbackRaw, sectionRefs }, ref) => {
  const normalizedMessages = Array.isArray(messages)
    ? messages
        .map((message) => {
          const text = normalizeMessageText(message);
          if (text) {
            return {
              ...message,
              text
            };
          }

          if (message?.raw !== undefined && message?.raw !== null) {
            return {
              ...message,
              text: ''
            };
          }

          return null;
        })
        .filter(Boolean)
    : [];

  const hasStructuredMessages = normalizedMessages.length > 0;
  const fallbackContent = typeof fallbackRaw === 'string' ? fallbackRaw : '';

  return (
    <Box id="conversation" ref={ref}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <ChatIcon sx={{ mr: 1 }} color="primary" />
        <Typography variant="h5" fontWeight="bold" color="primary">
          输入消息
        </Typography>
      </Box>

      {!hasStructuredMessages ? (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            未解析到结构化输入消息，已降级展示原始请求内容。
          </Alert>
          <CopyablePanel
            title="原始请求内容"
            content={fallbackContent}
            rawContent={fallbackContent}
            sx={{
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
              borderRadius: '12px',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)'
            }}
          />
        </Box>
      ) : (
        normalizedMessages.map((message, index) => (
          <MessageCard
            key={`${message?.role || 'unknown'}-${index}`}
            message={message}
            index={index}
            ref={(el) => {
              if (sectionRefs) {
                sectionRefs.current[`message-${index}`] = el;
              }
            }}
          />
        ))
      )}
    </Box>
  );
});

ConversationSection.displayName = 'ConversationSection';

ConversationSection.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      role: PropTypes.string,
      text: PropTypes.string,
      content: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.arrayOf(
          PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.shape({
              text: PropTypes.string,
              content: PropTypes.string
            })
          ])
        )
      ]),
      raw: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
    })
  ),
  fallbackRaw: PropTypes.string,
  sectionRefs: PropTypes.shape({
    current: PropTypes.object
  })
};

export default ConversationSection;
