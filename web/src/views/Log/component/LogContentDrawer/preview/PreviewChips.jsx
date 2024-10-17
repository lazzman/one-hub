import React from 'react';
import { Box, Chip, Tooltip, useTheme } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import BuildIcon from '@mui/icons-material/Build';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SettingsIcon from '@mui/icons-material/Settings';
import TimelineIcon from '@mui/icons-material/Timeline';
import { ContentType, getAllImages } from './contentDetector';
import ResponsesEventPreview from './ResponsesEventPreview';

/**
 * 扩展的分组函数，包含所有内容类型
 * @param {Array} detectedItems - 检测到的内容项数组
 * @returns {Object} 按类型分组的结果
 */
function groupByTypeExtended(detectedItems) {
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
    'tool_definition': []
  };

  for (const item of detectedItems) {
    if (grouped[item.type] !== undefined) {
      grouped[item.type].push(item);
    }
  }

  return grouped;
}

const toNormalizedString = (value) => (typeof value === 'string' ? value.trim() : '');

const toKeySafeText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildToolCallDedupeKey = (toolCall, index) => {
  const callId = toNormalizedString(toolCall?.id || toolCall?.call_id || toolCall?.toolCallId || toolCall?.tool_call_id);
  if (callId) return `call_id:${callId}`;

  const toolUseId = toNormalizedString(toolCall?.toolUseId || toolCall?.tool_use_id);
  if (toolUseId) return `tool_use_id:${toolUseId}`;

  const path = toNormalizedString(toolCall?.path);
  if (path) return `path:${path}`;

  const name = toNormalizedString(toolCall?.name) || 'unknown';
  const argumentsSignature = toKeySafeText(toolCall?.arguments ?? toolCall?.args ?? toolCall?.input ?? '');

  if (argumentsSignature) {
    return `fallback:${name}:arguments:${argumentsSignature}`;
  }

  return `fallback:${name}:index:${index}`;
};

const getDedupedToolCalls = (toolCalls) => {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return [];

  const dedupedMap = new Map();
  toolCalls.forEach((toolCall, index) => {
    const dedupeKey = buildToolCallDedupeKey(toolCall, index);
    if (!dedupedMap.has(dedupeKey)) {
      dedupedMap.set(dedupeKey, toolCall);
    }
  });

  return Array.from(dedupedMap.values());
};

/**
 * 预览芯片组件
 * 显示检测到的内容类型，提供预览按钮
 * @param {Object} props
 * @param {Array} props.detectedItems - 检测到的内容项数组
 * @param {Function} props.onPreviewMarkdown - Markdown 预览回调
 * @param {Function} props.onPreviewImages - 图片预览回调
 * @param {Function} props.onPreviewToolCalls - 工具调用预览回调
 * @param {Function} props.onPreviewToolResults - 工具结果预览回调
 * @param {Function} props.onPreviewAudio - 音频预览回调
 * @param {Function} props.onPreviewFiles - 文件预览回调
 */
const PreviewChips = ({
  detectedItems,
  visibleTypes = null,
  onPreviewMarkdown,
  onPreviewImages,
  onPreviewToolCalls,
  onPreviewToolResults,
  onPreviewAudio,
  onPreviewFiles,
  onPreviewToolDefinitions
}) => {
  const theme = useTheme();
  const [eventPreviewOpen, setEventPreviewOpen] = React.useState(false);
  const [previewEvents, setPreviewEvents] = React.useState([]);

  if (!detectedItems || detectedItems.length === 0) {
    return null;
  }

  const normalizedVisibleTypes = Array.isArray(visibleTypes)
    ? new Set(visibleTypes.map((type) => toNormalizedString(type)).filter(Boolean))
    : null;

  const visibleDetectedItems = normalizedVisibleTypes
    ? detectedItems.filter((item) => normalizedVisibleTypes.has(toNormalizedString(item?.type)))
    : detectedItems;

  if (visibleDetectedItems.length === 0) {
    return null;
  }

  // 按类型分组（使用扩展的分组函数）
  const grouped = groupByTypeExtended(visibleDetectedItems);
  const markdownItems = grouped[ContentType.MARKDOWN];
  const allImages = getAllImages(grouped);
  const toolCallItems = grouped[ContentType.TOOL_CALL];
  const toolResultItems = grouped[ContentType.TOOL_RESULT];
  const audioItems = grouped[ContentType.AUDIO];
  const documentItems = grouped[ContentType.DOCUMENT];
  const fileItems = grouped[ContentType.FILE];
  const reasoningItems = grouped[ContentType.REASONING];
  const eventItems = grouped[ContentType.EVENT];
  const toolDefinitionItems = grouped['tool_definition'];
  const dedupedToolCallItems = getDedupedToolCalls(toolCallItems);

  const hasMarkdown = markdownItems.length > 0;
  const hasImages = allImages.length > 0;
  const hasToolCalls = dedupedToolCallItems.length > 0;
  const hasToolResults = toolResultItems.length > 0;
  const hasAudio = audioItems.length > 0;
  const hasDocuments = documentItems.length > 0;
  const hasFiles = fileItems.length > 0;
  const hasReasoning = reasoningItems.length > 0;
  const hasEvents = eventItems.length > 0;
  const hasToolDefinitions = toolDefinitionItems.length > 0;

  const handlePreviewEvents = () => {
    setPreviewEvents(eventItems);
    setEventPreviewOpen(true);
  };

  // 如果没有任何可预览的内容，返回 null
  if (!hasMarkdown && !hasImages && !hasToolCalls && !hasToolResults && !hasAudio && !hasDocuments && !hasFiles && !hasReasoning && !hasEvents && !hasToolDefinitions) {
    return null;
  }

  // 图标颜色：暗色主题用浅色，明色主题用深色
  const iconColor = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)';

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        flexWrap: 'wrap',
        mb: 1.5,
        p: 1,
        borderRadius: 1,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: '1px dashed',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
      }}
    >
      {/* Markdown 预览芯片 */}
      {hasMarkdown && (
        <Tooltip title="点击预览 Markdown 渲染效果" arrow>
          <Chip
            icon={<DescriptionIcon sx={{ fontSize: '1rem !important' }} />}
            label={markdownItems.length > 1 ? `Markdown ×${markdownItems.length}` : 'Markdown'}
            onClick={() => onPreviewMarkdown(markdownItems)}
            size="small"
            color="primary"
            variant="outlined"
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '& .MuiChip-icon': { color: iconColor },
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.15)' : 'rgba(25, 118, 210, 0.08)',
                transform: 'translateY(-1px)'
              }
            }}
          />
        </Tooltip>
      )}

      {/* 推理片段预览芯片 */}
      {hasReasoning && (
        <Tooltip title="点击查看推理片段" arrow>
          <Chip
            icon={<DescriptionIcon sx={{ fontSize: '1rem !important' }} />}
            label={reasoningItems.length > 1 ? `推理 ×${reasoningItems.length}` : '推理'}
            onClick={() => onPreviewMarkdown && onPreviewMarkdown(reasoningItems)}
            size="small"
            color="info"
            variant="outlined"
            sx={{
              cursor: onPreviewMarkdown ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              '& .MuiChip-icon': { color: iconColor },
              '&:hover': onPreviewMarkdown ? {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(3, 169, 244, 0.15)' : 'rgba(3, 169, 244, 0.08)',
                transform: 'translateY(-1px)'
              } : {}
            }}
          />
        </Tooltip>
      )}

      {/* 图片预览芯片 */}
      {hasImages && (
        <Tooltip title="点击预览图片" arrow>
          <Chip
            icon={<ImageIcon sx={{ fontSize: '1rem !important' }} />}
            label={allImages.length > 1 ? `图片 ×${allImages.length}` : '图片'}
            onClick={() => onPreviewImages(allImages)}
            size="small"
            color="secondary"
            variant="outlined"
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '& .MuiChip-icon': { color: iconColor },
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(156, 39, 176, 0.15)' : 'rgba(156, 39, 176, 0.08)',
                transform: 'translateY(-1px)'
              }
            }}
          />
        </Tooltip>
      )}

      {/* 工具调用预览芯片 */}
      {hasToolCalls && (
        <Tooltip title="点击查看工具调用详情" arrow>
          <Chip
            icon={<BuildIcon sx={{ fontSize: '1rem !important' }} />}
            label={dedupedToolCallItems.length > 1 ? `工具调用 ×${dedupedToolCallItems.length}` : '工具调用'}
            onClick={() => onPreviewToolCalls && onPreviewToolCalls(dedupedToolCallItems)}
            size="small"
            color="warning"
            variant="outlined"
            sx={{
              cursor: onPreviewToolCalls ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              '& .MuiChip-icon': { color: iconColor },
              '&:hover': onPreviewToolCalls ? {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 152, 0, 0.08)',
                transform: 'translateY(-1px)'
              } : {}
            }}
          />
        </Tooltip>
      )}

      {/* 工具结果预览芯片 */}
      {hasToolResults && (
        <Tooltip title="点击查看工具执行结果" arrow>
          <Chip
            icon={<AssignmentTurnedInIcon sx={{ fontSize: '1rem !important' }} />}
            label={toolResultItems.length > 1 ? `工具结果 ×${toolResultItems.length}` : '工具结果'}
            onClick={() => onPreviewToolResults && onPreviewToolResults(toolResultItems)}
            size="small"
            color="success"
            variant="outlined"
            sx={{
              cursor: onPreviewToolResults ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              '& .MuiChip-icon': { color: iconColor },
              '&:hover': onPreviewToolResults ? {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.08)',
                transform: 'translateY(-1px)'
              } : {}
            }}
          />
        </Tooltip>
      )}

      {/* 音频预览芯片 */}
      {hasAudio && (
        <Tooltip title="检测到音频内容" arrow>
          <Chip
            icon={<AudiotrackIcon sx={{ fontSize: '1rem !important' }} />}
            label={audioItems.length > 1 ? `音频 ×${audioItems.length}` : '音频'}
            onClick={() => onPreviewAudio && onPreviewAudio(audioItems)}
            size="small"
            color="info"
            variant="outlined"
            sx={{
              cursor: onPreviewAudio ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              '& .MuiChip-icon': { color: iconColor },
              '&:hover': onPreviewAudio ? {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(3, 169, 244, 0.15)' : 'rgba(3, 169, 244, 0.08)',
                transform: 'translateY(-1px)'
              } : {}
            }}
          />
        </Tooltip>
      )}

      {/* 文档/文件预览芯片 */}
      {(hasDocuments || hasFiles) && (
        <Tooltip title="检测到文档/文件内容" arrow>
          <Chip
            icon={<InsertDriveFileIcon sx={{ fontSize: '1rem !important' }} />}
            label={
              (documentItems.length + fileItems.length) > 1
                ? `文件 ×${documentItems.length + fileItems.length}`
                : '文件'
            }
            onClick={() => onPreviewFiles && onPreviewFiles([...documentItems, ...fileItems])}
            size="small"
            variant="outlined"
            sx={{
              cursor: onPreviewFiles ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
              '& .MuiChip-icon': { color: iconColor },
              '&:hover': onPreviewFiles ? {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                transform: 'translateY(-1px)'
              } : {}
            }}
          />
        </Tooltip>
      )}

      {/* SSE 事件预览芯片 */}
      {hasEvents && (
        <Tooltip title="点击查看 SSE 事件列表" arrow>
          <Chip
            icon={<TimelineIcon sx={{ fontSize: '1rem !important' }} />}
            label={eventItems.length > 1 ? `事件 ×${eventItems.length}` : '事件'}
            onClick={handlePreviewEvents}
            size="small"
            variant="outlined"
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)',
              '& .MuiChip-icon': { color: iconColor },
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                transform: 'translateY(-1px)'
              }
            }}
          />
        </Tooltip>
      )}

      {/* 工具定义芯片 */}
      {hasToolDefinitions && (
        <Tooltip
          title={
            onPreviewToolDefinitions
              ? "点击查看工具定义详情"
              : (
                <Box>
                  <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>已定义的工具:</Box>
                  {toolDefinitionItems.map((item, idx) => (
                    <Box key={idx}>
                      {item.tools && item.tools.length > 0
                        ? item.tools.slice(0, 5).join(', ') + (item.tools.length > 5 ? ` 等 ${item.tools.length} 个` : '')
                        : `${item.count} 个工具`
                      }
                    </Box>
                  ))}
                </Box>
              )
          }
          arrow
        >
          <Chip
            icon={<SettingsIcon sx={{ fontSize: '1rem !important' }} />}
            label={
              toolDefinitionItems.reduce((sum, item) => sum + (item.count || 0), 0) > 1
                ? `工具定义 ×${toolDefinitionItems.reduce((sum, item) => sum + (item.count || 0), 0)}`
                : '工具定义'
            }
            onClick={() => onPreviewToolDefinitions && onPreviewToolDefinitions(toolDefinitionItems)}
            size="small"
            variant="outlined"
            sx={{
              cursor: onPreviewToolDefinitions ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              borderColor: theme.palette.mode === 'dark' ? 'rgba(156, 39, 176, 0.5)' : 'rgba(156, 39, 176, 0.5)',
              color: theme.palette.mode === 'dark' ? 'rgba(206, 147, 216, 1)' : 'rgba(156, 39, 176, 1)',
              '& .MuiChip-icon': { color: iconColor },
              '&:hover': onPreviewToolDefinitions ? {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(156, 39, 176, 0.15)' : 'rgba(156, 39, 176, 0.08)',
                transform: 'translateY(-1px)'
              } : {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(156, 39, 176, 0.15)' : 'rgba(156, 39, 176, 0.08)'
              }
            }}
          />
        </Tooltip>
      )}

      <ResponsesEventPreview
        events={previewEvents}
        open={eventPreviewOpen}
        onClose={() => setEventPreviewOpen(false)}
      />
    </Box>
  );
};

export default PreviewChips;
