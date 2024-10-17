import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Box, IconButton, Tooltip, Typography, Chip, useTheme, Tabs, Tab, Divider, Stack } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import BuildIcon from '@mui/icons-material/Build';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import PreviewModal from './PreviewModal';

/**
 * 格式化 JSON 内容
 * @param {any} content - 要格式化的内容
 * @returns {string} 格式化后的 JSON 字符串
 */
function formatContent(content) {
  if (content === undefined || content === null) {
    return 'null';
  }

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  return JSON.stringify(content, null, 2);
}

const isObjectLike = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const parsePossiblyJson = (value) => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const unwrapToolResultEnvelope = (value) => {
  const parsedValue = parsePossiblyJson(value);

  if (!isObjectLike(parsedValue)) {
    return parsedValue;
  }

  const hasInputPayload = ['input', 'arguments', 'args'].some((key) => Object.prototype.hasOwnProperty.call(parsedValue, key));
  const hasCallIdentity = ['toolCallId', 'tool_call_id', 'toolUseId', 'tool_use_id', 'call_id', 'callId'].some((key) =>
    Object.prototype.hasOwnProperty.call(parsedValue, key)
  );

  if (Object.prototype.hasOwnProperty.call(parsedValue, 'output') && (hasInputPayload || hasCallIdentity)) {
    return unwrapToolResultEnvelope(parsedValue.output);
  }

  if (Object.prototype.hasOwnProperty.call(parsedValue, 'response') && (hasInputPayload || hasCallIdentity)) {
    return unwrapToolResultEnvelope(parsedValue.response);
  }

  if (Object.prototype.hasOwnProperty.call(parsedValue, 'result') && (hasInputPayload || hasCallIdentity)) {
    return unwrapToolResultEnvelope(parsedValue.result);
  }

  if (Object.prototype.hasOwnProperty.call(parsedValue, 'content') && hasCallIdentity) {
    return unwrapToolResultEnvelope(parsedValue.content);
  }

  return parsedValue;
};

const extractTextFromToolResultValue = (value) => {
  const parsedValue = parsePossiblyJson(value);

  if (typeof parsedValue === 'string') {
    return parsedValue.trim();
  }

  if (Array.isArray(parsedValue)) {
    const textParts = parsedValue
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (!isObjectLike(item)) return '';
        if (typeof item.text === 'string') return item.text.trim();
        if (typeof item.content === 'string') return item.content.trim();
        return '';
      })
      .filter(Boolean);

    return textParts.length > 0 ? textParts.join('\n') : '';
  }

  if (!isObjectLike(parsedValue)) {
    return '';
  }

  if (Array.isArray(parsedValue.content)) {
    const contentText = extractTextFromToolResultValue(parsedValue.content);
    if (contentText) return contentText;
  }

  if (typeof parsedValue.text === 'string' && parsedValue.text.trim()) {
    return parsedValue.text.trim();
  }

  if (typeof parsedValue.content === 'string' && parsedValue.content.trim()) {
    return parsedValue.content.trim();
  }

  return '';
};

const getToolResultDisplayValue = (toolResult) => {
  const sourceValue = toolResult.content ?? toolResult.response ?? toolResult.output;
  const unwrappedValue = unwrapToolResultEnvelope(sourceValue);
  const extractedText = extractTextFromToolResultValue(unwrappedValue);

  return extractedText || unwrappedValue;
};

const getDisplayId = (value) => {
  if (!value) return '未关联';
  const stringValue = String(value);
  return stringValue.length > 42 ? `${stringValue.slice(0, 20)}...${stringValue.slice(-10)}` : stringValue;
};

const getDisplayName = (value, fallback) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
};

const themeShape = PropTypes.shape({
  palette: PropTypes.shape({
    mode: PropTypes.string
  })
});

const JsonBlock = ({ content, theme, maxHeight = 460 }) => (
  <Box
    component="pre"
    sx={{
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      overflow: 'auto',
      p: 2,
      bgcolor: theme.palette.mode === 'dark' ? 'rgba(2,6,23,0.72)' : 'rgba(248,250,252,0.95)',
      color: 'text.primary',
      border: '1px solid',
      borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
      borderRadius: 2,
      maxHeight,
      fontSize: '0.84rem',
      lineHeight: 1.65,
      fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
      m: 0,
      '&::-webkit-scrollbar': {
        width: '10px',
        height: '10px'
      },
      '&::-webkit-scrollbar-thumb': {
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.16)',
        borderRadius: '999px'
      }
    }}
  >
    {content}
  </Box>
);

JsonBlock.propTypes = {
  content: PropTypes.string,
  theme: themeShape,
  maxHeight: PropTypes.number
};

const MetaItem = ({ label, value }) => {
  if (!value) return null;

  return (
    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Chip
        label={value}
        size="small"
        variant="outlined"
        sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
      />
    </Stack>
  );
};

MetaItem.propTypes = {
  label: PropTypes.string,
  value: PropTypes.string
};

const toolCallShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  call_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  toolCallId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tool_use_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  toolUseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  name: PropTypes.string,
  arguments: PropTypes.any,
  input: PropTypes.any,
  args: PropTypes.any
});

const toolResultShape = PropTypes.shape({
  content: PropTypes.any,
  response: PropTypes.any,
  output: PropTypes.any,
  toolCallId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  toolUseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  call_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  name: PropTypes.string,
  isError: PropTypes.bool,
  is_error: PropTypes.bool
});

/**
 * 工具调用内容组件
 */
const ToolCallContent = ({ toolCall, theme }) => {
  const [copied, setCopied] = useState(false);

  const toolId = toolCall.id || toolCall.call_id || toolCall.toolCallId || toolCall.tool_use_id || toolCall.toolUseId || '';
  const toolName = getDisplayName(toolCall.name, '未命名工具');

  const formattedArgs = useMemo(() => {
    const args = toolCall.arguments || toolCall.input || toolCall.args;
    return formatContent(args);
  }, [toolCall]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedArgs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.06)' : 'rgba(255, 152, 0, 0.03)',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.18)' : 'rgba(255, 152, 0, 0.14)',
        borderRadius: 3,
        p: 2.5
      }}
    >
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} color="warning.main">
          {toolName}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip icon={<BuildIcon />} label="工具调用" size="small" color="warning" />
          <MetaItem label="调用 ID" value={getDisplayId(toolId)} />
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">调用参数</Typography>
          <Tooltip title={copied ? '已复制' : '复制参数'}>
            <IconButton size="small" onClick={handleCopy}>
              {copied ? <CheckIcon color="success" fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        <JsonBlock content={formattedArgs} theme={theme} />
      </Box>
    </Box>
  );
};

ToolCallContent.propTypes = {
  toolCall: toolCallShape,
  theme: themeShape
};

/**
 * 工具结果内容组件
 */
const ToolResultContent = ({ toolResult, theme }) => {
  const [copied, setCopied] = useState(false);

  const formattedContent = useMemo(() => {
    return formatContent(getToolResultDisplayValue(toolResult));
  }, [toolResult]);

  const toolId = toolResult.toolCallId || toolResult.toolUseId || toolResult.call_id || toolResult.id || '';
  const toolName = getDisplayName(toolResult.name, '工具执行结果');
  const isError = Boolean(toolResult.isError || toolResult.is_error);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: isError
          ? theme.palette.mode === 'dark'
            ? 'rgba(244, 67, 54, 0.08)'
            : 'rgba(244, 67, 54, 0.03)'
          : theme.palette.mode === 'dark'
            ? 'rgba(76, 175, 80, 0.08)'
            : 'rgba(76, 175, 80, 0.03)',
        border: '1px solid',
        borderColor: isError
          ? theme.palette.mode === 'dark'
            ? 'rgba(244, 67, 54, 0.22)'
            : 'rgba(244, 67, 54, 0.15)'
          : theme.palette.mode === 'dark'
            ? 'rgba(76, 175, 80, 0.22)'
            : 'rgba(76, 175, 80, 0.15)',
        borderRadius: 3,
        p: 2.5
      }}
    >
      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700} color={isError ? 'error.main' : 'success.main'}>
          {toolName}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip
            icon={<AssignmentTurnedInIcon />}
            label={isError ? '工具错误结果' : '工具结果'}
            size="small"
            color={isError ? 'error' : 'success'}
          />
          <MetaItem label="调用 ID" value={getDisplayId(toolId)} />
        </Stack>
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">执行输出</Typography>
          <Tooltip title={copied ? '已复制' : '复制结果'}>
            <IconButton size="small" onClick={handleCopy}>
              {copied ? <CheckIcon color="success" fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        <JsonBlock content={formattedContent} theme={theme} maxHeight={520} />
      </Box>
    </Box>
  );
};

ToolResultContent.propTypes = {
  toolResult: toolResultShape,
  theme: themeShape
};

/**
 * 工具调用预览组件
 */
const ToolCallPreview = ({ toolCalls = [], toolResults = [], open, onClose, mode = 'both' }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);

  const showCalls = mode === 'calls' || mode === 'both';
  const showResults = mode === 'results' || mode === 'both';

  const title = useMemo(() => {
    if (mode === 'calls') return `工具调用 (${toolCalls.length})`;
    if (mode === 'results') return `工具结果 (${toolResults.length})`;
    return '工具调用与工具结果';
  }, [mode, toolCalls.length, toolResults.length]);

  const subtitle = useMemo(() => {
    if (mode === 'calls') return '查看模型发起的工具调用参数与调用标识。';
    if (mode === 'results') return '查看工具执行返回的原始结果，适合排查输出结构、错误信息和字段内容。';
    return '按标签切换查看调用参数与执行结果。';
  }, [mode]);

  const tabItems = useMemo(() => {
    const items = [];

    if (showCalls && toolCalls.length > 0) {
      toolCalls.forEach((toolCall, index) => {
        items.push({
          type: 'call',
          data: toolCall,
          label: getDisplayName(toolCall.name, `工具调用 ${index + 1}`),
          icon: <BuildIcon sx={{ fontSize: 16 }} color="warning" />
        });
      });
    }

    if (showResults && toolResults.length > 0) {
      toolResults.forEach((toolResult, index) => {
        const isError = Boolean(toolResult.isError || toolResult.is_error);
        items.push({
          type: 'result',
          data: toolResult,
          label: getDisplayName(toolResult.name, `工具结果 ${index + 1}`),
          icon: <AssignmentTurnedInIcon sx={{ fontSize: 16 }} color={isError ? 'error' : 'success'} />,
          isError
        });
      });
    }

    return items;
  }, [showCalls, showResults, toolCalls, toolResults]);

  useEffect(() => {
    if (activeTab >= tabItems.length) {
      setActiveTab(0);
    }
  }, [activeTab, tabItems.length]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <PreviewModal open={open} onClose={onClose} title={title} subtitle={subtitle} fullWidth={mode === 'results'}>
      <Box sx={{ minHeight: { xs: '50vh', md: '56vh' }, display: 'flex', flexDirection: 'column' }}>
        {tabItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Typography>没有工具调用或结果数据</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, flex: 1 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                '& .MuiTab-root': {
                  textTransform: 'none',
                  minWidth: 'auto',
                  px: 1.75,
                  py: 1.25,
                  alignItems: 'flex-start'
                }
              }}
            >
              {tabItems.map((item, index) => (
                <Tab
                  key={index}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, maxWidth: 220 }}>
                      {item.icon}
                      <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Tabs>

            <Box sx={{ flex: 1, minHeight: 0 }}>
              {tabItems.map((item, index) => (
                <Box key={index} hidden={activeTab !== index} sx={{ height: '100%' }}>
                  {activeTab === index &&
                    (item.type === 'call' ? (
                      <ToolCallContent toolCall={item.data} theme={theme} />
                    ) : (
                      <ToolResultContent toolResult={item.data} theme={theme} />
                    ))}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </PreviewModal>
  );
};

ToolCallPreview.propTypes = {
  toolCalls: PropTypes.arrayOf(toolCallShape),
  toolResults: PropTypes.arrayOf(toolResultShape),
  open: PropTypes.bool,
  onClose: PropTypes.func,
  mode: PropTypes.oneOf(['calls', 'results', 'both'])
};

export default ToolCallPreview;
