import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Paper, Box, Typography, IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

// 预览组件
import {
  detectContentTypes,
  detectAllMessageContent,
  detectRequestContent,
  detectUnifiedModelContent,
  PreviewChips,
  MarkdownPreview,
  ImagePreview,
  ToolCallPreview,
  ToolDefinitionPreview
} from './preview';
import JsonNavigationView, { extractNavigableJson } from './JsonNavigationView';

const buildJsonContent = (rawContent, content) => {
  if (rawContent !== undefined && rawContent !== null) {
    if (typeof rawContent === 'string') {
      try {
        const parsed = JSON.parse(rawContent);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return rawContent;
      }
    }
    return JSON.stringify(rawContent, null, 2);
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
};

/**
 * 可复制面板组件
 * 用于展示 JSON 内容并提供复制功能和智能预览
 * @param {Object} props
 * @param {string} props.title - 面板标题
 * @param {any} props.content - 内容对象
 * @param {any} props.rawContent - 原始内容
 * @param {boolean} props.isRequestBody - 是否是请求体（用于启用请求格式检测）
 * @param {Object} props.sx - 自定义样式
 */
const CopyablePanel = ({
  title,
  content,
  rawContent,
  isRequestBody = false,
  unifiedModel = null,
  disableEventPreview = false,
  visibleChipTypes = null,
  detectedItemsOverride = null,
  enableJsonNavigation = false,
  sx,
  children
}) => {
  const [copied, setCopied] = useState(false);
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [toolCallPreviewOpen, setToolCallPreviewOpen] = useState(false);
  const [toolResultPreviewOpen, setToolResultPreviewOpen] = useState(false);
  const [toolDefinitionPreviewOpen, setToolDefinitionPreviewOpen] = useState(false);
  const [previewMarkdownContent, setPreviewMarkdownContent] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [previewToolCalls, setPreviewToolCalls] = useState([]);
  const [previewToolResults, setPreviewToolResults] = useState([]);
  const [previewToolDefinitions, setPreviewToolDefinitions] = useState([]);

  const jsonContent = useMemo(() => buildJsonContent(rawContent, content), [rawContent, content]);
  const navigableJson = useMemo(() => {
    if (!enableJsonNavigation) {
      return null;
    }

    if (rawContent !== undefined && rawContent !== null) {
      return extractNavigableJson(rawContent);
    }

    return extractNavigableJson(content);
  }, [content, enableJsonNavigation, rawContent]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 检测内容类型
  const detectedItems = useMemo(() => {
    if (Array.isArray(detectedItemsOverride)) {
      return detectedItemsOverride;
    }

    if (unifiedModel && typeof unifiedModel === 'object') {
      const unifiedPayload = unifiedModel.viewModel ? unifiedModel : { viewModel: unifiedModel };
      const unifiedDetected = detectUnifiedModelContent(unifiedPayload);
      if (Array.isArray(unifiedDetected) && unifiedDetected.length > 0) {
        return unifiedDetected;
      }
    }

    const dataToDetect = rawContent !== undefined && rawContent !== null ? rawContent : content;

    // 首先尝试解析数据
    let parsedData = dataToDetect;
    if (typeof dataToDetect === 'string') {
      try {
        parsedData = JSON.parse(dataToDetect);
      } catch {
        // 解析失败，使用原始数据
        parsedData = dataToDetect;
      }
    }

    // 如果是请求体，使用请求格式检测
    if (isRequestBody && parsedData && typeof parsedData === 'object') {
      const requestResult = detectRequestContent(parsedData);
      return requestResult.items;
    }

    // 如果是消息对象，使用消息格式检测
    // 支持三种格式：
    // - OpenAI/Claude: 有 role 字段
    // - Gemini: 有 parts 数组
    if (parsedData && typeof parsedData === 'object' && (parsedData.role !== undefined || Array.isArray(parsedData.parts))) {
      const messageResult = detectAllMessageContent(parsedData);
      // 合并所有检测结果到一个数组
      const allItems = [...messageResult.content, ...messageResult.toolCalls, ...messageResult.toolResults];
      return allItems;
    }

    // 否则使用通用检测
    return detectContentTypes(dataToDetect);
  }, [content, rawContent, isRequestBody, unifiedModel, detectedItemsOverride]);

  const filteredDetectedItems = useMemo(() => {
    if (!disableEventPreview) {
      return detectedItems;
    }

    return detectedItems.filter((item) => item?.type !== 'event');
  }, [detectedItems, disableEventPreview]);

  // 处理 Markdown 预览
  const handlePreviewMarkdown = (items) => {
    setPreviewMarkdownContent(items);
    setMarkdownPreviewOpen(true);
  };

  // 处理图片预览
  const handlePreviewImages = (items) => {
    setPreviewImages(items);
    setImagePreviewOpen(true);
  };

  // 处理工具调用预览
  const handlePreviewToolCalls = (items) => {
    setPreviewToolCalls(items);
    setToolCallPreviewOpen(true);
  };

  // 处理工具结果预览
  const handlePreviewToolResults = (items) => {
    setPreviewToolResults(items);
    setToolResultPreviewOpen(true);
  };

  // 处理工具定义预览
  const handlePreviewToolDefinitions = (items) => {
    const toolsFromItems = Array.isArray(items)
      ? items.flatMap((item) => {
          if (Array.isArray(item?.items)) return item.items;
          if (Array.isArray(item?.rawTools)) return item.rawTools;
          if (Array.isArray(item?.tools)) return item.tools.map((name) => ({ name }));
          return [];
        })
      : [];

    if (toolsFromItems.length > 0) {
      setPreviewToolDefinitions(toolsFromItems);
      setToolDefinitionPreviewOpen(true);
      return;
    }

    const dataToDetect = rawContent !== undefined && rawContent !== null ? rawContent : content;
    let parsedData = dataToDetect;
    if (typeof dataToDetect === 'string') {
      try {
        parsedData = JSON.parse(dataToDetect);
      } catch {
        parsedData = dataToDetect;
      }
    }

    // 提取工具定义
    let tools = [];
    if (parsedData && typeof parsedData === 'object' && Array.isArray(parsedData.tools)) {
      // OpenAI / Claude 格式
      tools = parsedData.tools;

      // Gemini 格式 - 展开 functionDeclarations
      const geminiTools = [];
      parsedData.tools.forEach((toolGroup) => {
        if (Array.isArray(toolGroup?.functionDeclarations)) {
          geminiTools.push(...toolGroup.functionDeclarations);
        }
      });

      if (geminiTools.length > 0) {
        tools = geminiTools;
      }
    }

    setPreviewToolDefinitions(tools);
    setToolDefinitionPreviewOpen(true);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        mb: 2,
        position: 'relative',
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'background.default'),
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 8px 16px rgba(0,0,0,0.4)' : '0 8px 16px rgba(0,0,0,0.1)')
        },
        ...sx
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">{title}</Typography>
        <IconButton
          onClick={handleCopy}
          size="small"
          sx={{
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'scale(1.1)'
            },
            '&:active': {
              transform: 'scale(0.95)'
            }
          }}
        >
          {copied ? (
            <CheckIcon
              color="success"
              sx={{
                animation: 'checkmarkPop 0.3s ease-out',
                '@keyframes checkmarkPop': {
                  '0%': { transform: 'scale(0)' },
                  '50%': { transform: 'scale(1.2)' },
                  '100%': { transform: 'scale(1)' }
                }
              }}
            />
          ) : (
            <ContentCopyIcon />
          )}
        </IconButton>
      </Box>

      {/* 预览芯片区域 */}
      <PreviewChips
        detectedItems={filteredDetectedItems}
        visibleTypes={visibleChipTypes}
        onPreviewMarkdown={handlePreviewMarkdown}
        onPreviewImages={handlePreviewImages}
        onPreviewToolCalls={handlePreviewToolCalls}
        onPreviewToolResults={handlePreviewToolResults}
        onPreviewToolDefinitions={handlePreviewToolDefinitions}
      />

      {children ??
        (navigableJson ? (
          <JsonNavigationView data={navigableJson} />
        ) : (
          <Box
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'auto',
              p: 1.5,
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'grey.100'),
              color: (theme) => (theme.palette.mode === 'dark' ? 'text.primary' : 'inherit'),
              borderRadius: 1,
              maxHeight: '800px',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
              '&::-webkit-scrollbar': {
                height: '8px',
                width: '8px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.2)'),
                borderRadius: '4px'
              }
            }}
          >
            {jsonContent}
          </Box>
        ))}

      {/* Markdown 预览弹窗 */}
      <MarkdownPreview content={previewMarkdownContent} open={markdownPreviewOpen} onClose={() => setMarkdownPreviewOpen(false)} />

      {/* 图片预览弹窗 */}
      <ImagePreview images={previewImages} open={imagePreviewOpen} onClose={() => setImagePreviewOpen(false)} />

      {/* 工具调用预览弹窗 */}
      <ToolCallPreview
        toolCalls={previewToolCalls}
        toolResults={[]}
        open={toolCallPreviewOpen}
        onClose={() => setToolCallPreviewOpen(false)}
        mode="calls"
      />

      {/* 工具结果预览弹窗 */}
      <ToolCallPreview
        toolCalls={[]}
        toolResults={previewToolResults}
        open={toolResultPreviewOpen}
        onClose={() => setToolResultPreviewOpen(false)}
        mode="results"
      />

      {/* 工具定义预览弹窗 */}
      <ToolDefinitionPreview
        tools={previewToolDefinitions}
        open={toolDefinitionPreviewOpen}
        onClose={() => setToolDefinitionPreviewOpen(false)}
      />
    </Paper>
  );
};

export default CopyablePanel;

CopyablePanel.propTypes = {
  title: PropTypes.string,
  content: PropTypes.any,
  rawContent: PropTypes.any,
  isRequestBody: PropTypes.bool,
  unifiedModel: PropTypes.object,
  disableEventPreview: PropTypes.bool,
  visibleChipTypes: PropTypes.arrayOf(PropTypes.string),
  detectedItemsOverride: PropTypes.array,
  enableJsonNavigation: PropTypes.bool,
  sx: PropTypes.object,
  children: PropTypes.node
};
