import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, Alert } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BuildIcon from '@mui/icons-material/Build';
import ImageIcon from '@mui/icons-material/Image';
import TimelineIcon from '@mui/icons-material/Timeline';
import ArticleIcon from '@mui/icons-material/Article';
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

const buildMarkdownPreviewModel = (text, protocol = 'unknown') => ({
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

const panelSx = {
  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
  borderRadius: '12px',
  boxShadow: (theme) =>
    theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)'
};

const SectionTitle = ({ icon, title, color = 'primary.main' }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
    {React.cloneElement(icon, { sx: { mr: 1 }, color: undefined, htmlColor: undefined })}
    <Typography variant="h6" fontWeight="bold" color={color}>
      {title}
    </Typography>
  </Box>
);

SectionTitle.propTypes = {
  icon: PropTypes.element.isRequired,
  title: PropTypes.string.isRequired,
  color: PropTypes.string
};

const ResponseSection = React.forwardRef(
  ({ protocol, viewModel, response, rawResponseBody, finalAssistantText, toolCalls, reasoning, media, linearTrace, sectionRefs }, ref) => {
    const capabilities = viewModel?.capabilities || {};
    const normalizedReasoning = useMemo(
      () => (Array.isArray(reasoning) ? reasoning.filter((item) => typeof item?.text === 'string' && item.text.trim()) : []),
      [reasoning]
    );
    const reasoningText = useMemo(() => extractMergedReasoningText(normalizedReasoning), [normalizedReasoning]);
    const normalizedToolCalls = useMemo(() => (Array.isArray(toolCalls) ? toolCalls : []), [toolCalls]);
    const normalizedMedia = useMemo(() => (Array.isArray(media) ? media : []), [media]);
    const normalizedLinearTrace = useMemo(() => (Array.isArray(linearTrace) ? linearTrace : []), [linearTrace]);
    const responseRawText =
      typeof rawResponseBody === 'string' && rawResponseBody.trim() ? rawResponseBody : viewModel?.response?.raw || '';
    const responsePayload = response ?? viewModel?.response?.parsed ?? null;

    const finalResponseText = useMemo(() => {
      if (typeof finalAssistantText === 'string' && finalAssistantText.trim()) {
        return finalAssistantText.trim();
      }

      const modelFinalText = typeof viewModel?.response?.finalText === 'string' ? viewModel.response.finalText.trim() : '';
      if (modelFinalText) {
        return modelFinalText;
      }

      const extracted = extractTextFromResponsePayload(responsePayload);
      if (extracted) {
        return extracted;
      }

      return responseRawText;
    }, [finalAssistantText, viewModel, responsePayload, responseRawText]);

    const responsePreviewModel = useMemo(
      () => ({
        protocol: viewModel?.protocol || protocol || 'unknown',
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
      [viewModel, protocol, finalResponseText, normalizedToolCalls, reasoningText, normalizedMedia]
    );

    const finalOnlyPreviewModel = useMemo(() => buildMarkdownPreviewModel(finalResponseText, protocol), [finalResponseText, protocol]);
    const reasoningOnlyPreviewModel = useMemo(() => buildMarkdownPreviewModel(reasoningText, protocol), [reasoningText, protocol]);
    const parseFailed = Boolean(
      viewModel?.flags?.parseFailed || (viewModel?.flags?.usedFallback && !finalResponseText && !responseRawText)
    );

    return (
      <Box id="response" ref={ref}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AutoAwesomeIcon sx={{ mr: 1 }} color="primary" />
          <Typography variant="h5" fontWeight="bold" color="primary">
            AI 响应
          </Typography>
        </Box>

        {parseFailed && (
          <Alert severity="info" sx={{ mb: 2 }}>
            未完整解析到结构化响应，已展示可用的原始内容。
          </Alert>
        )}

        {capabilities.finalAnswer && finalResponseText && (
          <Box id="response-final-answer" ref={(el) => sectionRefs && (sectionRefs.current['response-final-answer'] = el)} sx={{ mb: 2 }}>
            <SectionTitle icon={<AutoAwesomeIcon />} title="Final Answer" color="primary.main" />
            <CopyablePanel
              title="最终回复内容"
              content={finalResponseText}
              rawContent={finalResponseText}
              unifiedModel={finalOnlyPreviewModel}
              visibleChipTypes={['markdown']}
              disableEventPreview={true}
              sx={panelSx}
            />
          </Box>
        )}

        {capabilities.reasoning && (
          <Box id="response-reasoning" ref={(el) => sectionRefs && (sectionRefs.current['response-reasoning'] = el)} sx={{ mb: 2 }}>
            <SectionTitle icon={<AutoAwesomeIcon />} title="Reasoning" color="secondary.main" />
            {reasoningText ? (
              <CopyablePanel
                title="推理内容"
                content={reasoningText}
                rawContent={reasoningText}
                unifiedModel={reasoningOnlyPreviewModel}
                visibleChipTypes={['markdown']}
                disableEventPreview={true}
                sx={panelSx}
              />
            ) : (
              <Alert severity="info">未检测到推理片段</Alert>
            )}
          </Box>
        )}

        {capabilities.tools && normalizedToolCalls.length > 0 && (
          <Box id="response-tool-calls" ref={(el) => sectionRefs && (sectionRefs.current['response-tool-calls'] = el)} sx={{ mb: 2 }}>
            <SectionTitle icon={<BuildIcon />} title="工具调用" color="warning.main" />
            <CopyablePanel
              title="工具调用列表"
              content={normalizedToolCalls}
              rawContent={normalizedToolCalls}
              unifiedModel={responsePreviewModel}
              sx={panelSx}
            />
          </Box>
        )}

        {capabilities.media && normalizedMedia.length > 0 && (
          <Box id="response-media" ref={(el) => sectionRefs && (sectionRefs.current['response-media'] = el)} sx={{ mb: 2 }}>
            <SectionTitle icon={<ImageIcon />} title="多模态片段" color="secondary.main" />
            <CopyablePanel
              title="多模态片段"
              content={normalizedMedia}
              rawContent={normalizedMedia}
              unifiedModel={responsePreviewModel}
              sx={panelSx}
            />
          </Box>
        )}

        {capabilities.trace && (
          <Box id="response-linear-trace" ref={(el) => sectionRefs && (sectionRefs.current['response-linear-trace'] = el)} sx={{ mb: 2 }}>
            <SectionTitle icon={<TimelineIcon />} title="Linear Trace / 线性调用过程" color="warning.main" />
            <LinearTraceSection linearTrace={normalizedLinearTrace} />
          </Box>
        )}

        {capabilities.rawResponse && responseRawText && (
          <Box id="response-raw" ref={(el) => sectionRefs && (sectionRefs.current['response-raw'] = el)} sx={{ mb: 2 }}>
            <SectionTitle icon={<ArticleIcon />} title="Raw Response" color="text.primary" />
            <CopyablePanel
              title="响应原文"
              content={responsePayload || responseRawText}
              rawContent={responseRawText}
              unifiedModel={responsePreviewModel}
              disableEventPreview={true}
              sx={panelSx}
            />
          </Box>
        )}
      </Box>
    );
  }
);

ResponseSection.displayName = 'ResponseSection';

ResponseSection.propTypes = {
  protocol: PropTypes.string,
  viewModel: PropTypes.shape({
    protocol: PropTypes.string,
    capabilities: PropTypes.shape({
      finalAnswer: PropTypes.bool,
      reasoning: PropTypes.bool,
      tools: PropTypes.bool,
      media: PropTypes.bool,
      trace: PropTypes.bool,
      rawResponse: PropTypes.bool
    }),
    request: PropTypes.shape({
      raw: PropTypes.string,
      parsed: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string])
    }),
    response: PropTypes.shape({
      raw: PropTypes.string,
      parsed: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
      finalText: PropTypes.string
    }),
    flags: PropTypes.shape({
      parseFailed: PropTypes.bool,
      usedFallback: PropTypes.bool
    })
  }),
  response: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
  rawResponseBody: PropTypes.string,
  finalAssistantText: PropTypes.string,
  toolCalls: PropTypes.array,
  reasoning: PropTypes.array,
  media: PropTypes.array,
  linearTrace: PropTypes.array,
  sectionRefs: PropTypes.shape({
    current: PropTypes.object
  })
};

export default ResponseSection;
