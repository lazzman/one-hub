import React, { useMemo } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BuildIcon from '@mui/icons-material/Build';
import ImageIcon from '@mui/icons-material/Image';
import TimelineIcon from '@mui/icons-material/Timeline';
import CopyablePanel from './CopyablePanel';
import LinearTraceSection from './LinearTraceSection';

const isObjectLike = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const extractTextFromResponsePayload = (payload) => {
  if (typeof payload === 'string') {
    return payload.trim();
  }

  if (Array.isArray(payload)) {
    return payload
      .map((item) => extractTextFromResponsePayload(item))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (!isObjectLike(payload)) {
    return '';
  }

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.choices)) {
    for (const choice of payload.choices) {
      const message = choice?.message;
      if (!isObjectLike(message)) continue;

      if (typeof message.content === 'string' && message.content.trim()) {
        return message.content.trim();
      }

      if (Array.isArray(message.content)) {
        const contentText = message.content
          .map((item) => {
            if (typeof item === 'string') return item;
            if (isObjectLike(item) && typeof item.text === 'string') return item.text;
            return '';
          })
          .filter(Boolean)
          .join('\n')
          .trim();

        if (contentText) return contentText;
      }
    }
  }

  if (Array.isArray(payload.content)) {
    const contentText = payload.content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (isObjectLike(item)) {
          if (typeof item.text === 'string') return item.text;
          if (typeof item.content === 'string') return item.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();

    if (contentText) return contentText;
  }

  if (Array.isArray(payload.candidates)) {
    for (const candidate of payload.candidates) {
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      const partText = parts
        .map((part) => (isObjectLike(part) && typeof part.text === 'string' ? part.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      if (partText) return partText;
    }
  }

  if (typeof payload.text === 'string' && payload.text.trim()) {
    return payload.text.trim();
  }

  return '';
};

const extractMergedReasoningText = (reasoningItems) => {
  if (!Array.isArray(reasoningItems)) return '';

  return reasoningItems
    .map((item) => (typeof item?.text === 'string' ? item.text.trim() : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
};

const buildMarkdownPreviewModel = (text, protocol = 'responses') => ({
  protocol,
  request: { raw: '', parsed: null },
  response: { raw: '', parsed: null },
  events: [],
  messages: text
    ? [
        {
          role: 'assistant',
          text
        }
      ]
    : [],
  toolCalls: [],
  reasoning: [],
  media: []
});

/**
 * AI 响应部分组件
 * 仅展示客户端最终可见的累加消息，不展示流式事件列表
 */
const ResponseSection = React.forwardRef(
  (
    {
      protocol,
      viewModel,
      response,
      rawResponseBody,
      finalAssistantText,
      toolCalls,
      reasoning,
      media,
      linearTrace,
      sectionRefs
    },
    ref
  ) => {
    const normalizedReasoning = Array.isArray(reasoning)
      ? reasoning.filter((item) => typeof item?.text === 'string' && item.text.trim())
      : [];
    const reasoningText = useMemo(() => extractMergedReasoningText(normalizedReasoning), [normalizedReasoning]);
    const shouldShowReasoning = Boolean(reasoningText);
    const normalizedToolCalls = Array.isArray(toolCalls) ? toolCalls : [];
    const normalizedMedia = Array.isArray(media) ? media : [];
    const normalizedLinearTrace = Array.isArray(linearTrace) ? linearTrace : [];
    const isResponsesProtocol = protocol === 'responses';

    const finalResponseText = useMemo(() => {
      if (typeof finalAssistantText === 'string' && finalAssistantText.trim()) {
        return finalAssistantText.trim();
      }

      if (protocol === 'responses') {
        return '';
      }

      const extracted = extractTextFromResponsePayload(response);
      if (extracted) {
        return extracted;
      }

      if (typeof rawResponseBody === 'string') {
        return rawResponseBody;
      }

      return '';
    }, [protocol, finalAssistantText, response, rawResponseBody]);

    const unifiedForPreview = useMemo(
      () => ({
        protocol: viewModel?.protocol || 'unknown',
        request: viewModel?.request || { raw: '', parsed: null },
        response: viewModel?.response || { raw: '', parsed: null },
        events: [],
        messages: finalResponseText
          ? [
              {
                role: 'assistant',
                text: finalResponseText
              }
            ]
          : [],
        toolCalls: normalizedToolCalls,
        reasoning: reasoningText
          ? [
              {
                type: 'reasoning',
                text: reasoningText
              }
            ]
          : [],
        media: normalizedMedia
      }),
      [viewModel, finalResponseText, normalizedToolCalls, reasoningText, normalizedMedia]
    );

    const finalOnlyPreviewModel = useMemo(
      () => buildMarkdownPreviewModel(finalResponseText, viewModel?.protocol || 'responses'),
      [finalResponseText, viewModel?.protocol]
    );

    const reasoningOnlyPreviewModel = useMemo(
      () => buildMarkdownPreviewModel(reasoningText, viewModel?.protocol || 'responses'),
      [reasoningText, viewModel?.protocol]
    );

    const hasStructuredBlocks = shouldShowReasoning || normalizedToolCalls.length > 0 || normalizedMedia.length > 0;
    const hasResponsesSkeletonData = Boolean(finalResponseText) || shouldShowReasoning || normalizedLinearTrace.length > 0;

    return (
      <Box id="response" ref={ref}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AutoAwesomeIcon sx={{ mr: 1 }} color="primary" />
          <Typography variant="h5" fontWeight="bold" color="primary">
            AI 响应
          </Typography>
        </Box>

        {isResponsesProtocol ? (
          <>
            {!hasResponsesSkeletonData && (
              <Alert severity="info" sx={{ mb: 2 }}>
                未解析到响应结构化内容，已降级展示基础骨架。
              </Alert>
            )}

            <Box id="response-final-answer" ref={(el) => sectionRefs && (sectionRefs.current['response-final-answer'] = el)} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AutoAwesomeIcon sx={{ mr: 1 }} color="primary" />
                <Typography variant="h6" fontWeight="bold" color="primary.main">
                  Final Answer
                </Typography>
              </Box>
              <CopyablePanel
                title="最终回复内容"
                content={finalResponseText}
                rawContent={finalResponseText}
                unifiedModel={finalOnlyPreviewModel}
                visibleChipTypes={['markdown']}
                disableEventPreview={true}
                sx={{
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
                  borderRadius: '12px',
                  boxShadow: (theme) =>
                    theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)'
                }}
              />
            </Box>

            <Box id="response-reasoning" ref={(el) => sectionRefs && (sectionRefs.current['response-reasoning'] = el)} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AutoAwesomeIcon sx={{ mr: 1 }} color="secondary" />
                <Typography variant="h6" fontWeight="bold" color="secondary.main">
                  Reasoning
                </Typography>
              </Box>
              {shouldShowReasoning ? (
                <CopyablePanel
                  title="推理内容"
                  content={reasoningText}
                  rawContent={reasoningText}
                  unifiedModel={reasoningOnlyPreviewModel}
                  visibleChipTypes={['markdown']}
                  disableEventPreview={true}
                  sx={{
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
                    borderRadius: '12px',
                    boxShadow: (theme) =>
                      theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)'
                  }}
                />
              ) : (
                <Alert severity="info">未检测到推理片段</Alert>
              )}
            </Box>

            <Box id="response-linear-trace" ref={(el) => sectionRefs && (sectionRefs.current['response-linear-trace'] = el)} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TimelineIcon sx={{ mr: 1 }} color="warning" />
                <Typography variant="h6" fontWeight="bold" color="warning.main">
                  Linear Trace / 线性调用过程
                </Typography>
              </Box>
              <LinearTraceSection linearTrace={normalizedLinearTrace} />
            </Box>
          </>
        ) : (
          <>
            {!hasStructuredBlocks && !finalResponseText && (
              <Alert severity="info" sx={{ mb: 2 }}>
                未解析到结构化响应内容，已降级展示响应原文文本。
              </Alert>
            )}

            {shouldShowReasoning && (
              <Box id="response-reasoning" ref={(el) => sectionRefs && (sectionRefs.current['response-reasoning'] = el)} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AutoAwesomeIcon sx={{ mr: 1 }} color="secondary" />
                  <Typography variant="h6" fontWeight="bold" color="secondary.main">
                    推理内容
                  </Typography>
                </Box>
                <CopyablePanel
                  title="推理内容"
                  content={reasoningText}
                  rawContent={reasoningText}
                  unifiedModel={unifiedForPreview}
                  disableEventPreview={true}
                  sx={{
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
                    borderRadius: '12px',
                    boxShadow: (theme) =>
                      theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)'
                  }}
                />
              </Box>
            )}

            {normalizedToolCalls.length > 0 && (
              <Box id="response-tool-calls" ref={(el) => sectionRefs && (sectionRefs.current['response-tool-calls'] = el)} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <BuildIcon sx={{ mr: 1 }} color="warning" />
                  <Typography variant="h6" fontWeight="bold" color="warning.main">
                    工具调用
                  </Typography>
                </Box>
                <CopyablePanel
                  title="工具调用列表"
                  content={normalizedToolCalls}
                  rawContent={normalizedToolCalls}
                  unifiedModel={unifiedForPreview}
                  sx={{
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
                    borderRadius: '12px',
                    boxShadow: (theme) =>
                      theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)'
                  }}
                />
              </Box>
            )}

            {normalizedMedia.length > 0 && (
              <Box id="response-media" ref={(el) => sectionRefs && (sectionRefs.current['response-media'] = el)} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ImageIcon sx={{ mr: 1 }} color="secondary" />
                  <Typography variant="h6" fontWeight="bold" color="secondary.main">
                    多模态片段
                  </Typography>
                </Box>
                <CopyablePanel
                  title="多模态片段"
                  content={normalizedMedia}
                  rawContent={normalizedMedia}
                  unifiedModel={unifiedForPreview}
                  sx={{
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
                    borderRadius: '12px',
                    boxShadow: (theme) =>
                      theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)'
                  }}
                />
              </Box>
            )}

            <CopyablePanel
              title="最终回复内容"
              content={finalResponseText}
              rawContent={finalResponseText}
              unifiedModel={unifiedForPreview}
              disableEventPreview={true}
              sx={{
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
                borderRadius: '12px',
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: (theme) =>
                    theme.palette.mode === 'dark' ? '0 6px 8px rgba(0,0,0,0.3)' : '0 6px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.12)'
                }
              }}
            />
          </>
        )}
      </Box>
    );
  }
);

ResponseSection.displayName = 'ResponseSection';

export default ResponseSection;
