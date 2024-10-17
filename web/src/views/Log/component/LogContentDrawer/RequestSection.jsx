import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Grid,
  Stack,
  Typography,
  ButtonGroup,
  Button,
  Tooltip
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import TerminalIcon from '@mui/icons-material/Terminal';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CopyablePanel from './CopyablePanel';
import { buildRequestAuditModel } from './parsers/auditModel';
import ToolDefinitionList from './ToolDefinitionList';
import { getCrossProtocolToolWarnings } from './formatConverters';

/**
 * 请求属性部分组件
 * 展示请求属性和提供 curl 命令复制功能
 */
const HIDDEN_REQUEST_FIELD_PATTERNS = [
  /^messages?$/i,
  /^input$/i,
  /^contents?$/i,
  /^system$/i,
  /^system_instruction$/i,
  /^systeminstruction$/i,
  /^instructions?$/i,
  /^prompt$/i,
  /^history$/i,
  /^conversation$/i,
  /^conversation_history$/i,
  /^chat_history$/i,
  /^previous_messages$/i,
  /^past_messages$/i
];

const CURL_TARGET_MAP = {
  original: {
    key: 'original',
    action: 'original-curl',
    label: '原协议',
    title: '按当前日志的原始 endpoint 和原始请求体复制 curl',
    hoverBg: 'rgba(25, 118, 210, 0.08)'
  },
  responses: {
    key: 'responses',
    action: 'responses-curl',
    label: 'Responses',
    title: '复制为 OpenAI Responses API curl 命令',
    hoverBg: 'rgba(99, 102, 241, 0.08)'
  },
  openai: {
    key: 'openai',
    action: 'openai-curl',
    label: 'OpenAI',
    title: '复制为 OpenAI API curl 命令',
    hoverBg: 'rgba(16, 163, 127, 0.08)'
  },
  claude: {
    key: 'claude',
    action: 'claude-curl',
    label: 'Claude',
    title: '复制为 Claude API curl 命令',
    hoverBg: 'rgba(204, 153, 102, 0.08)'
  },
  gemini: {
    key: 'gemini',
    action: 'gemini-curl',
    label: 'Gemini',
    title: '复制为 Gemini API curl 命令',
    hoverBg: 'rgba(66, 133, 244, 0.08)'
  }
};

const isObjectLike = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const normalizeRole = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const shouldHideRequestField = (key) => HIDDEN_REQUEST_FIELD_PATTERNS.some((pattern) => pattern.test(key));

const filterRequestProps = (payload) => {
  if (!isObjectLike(payload)) {
    return {};
  }

  return Object.entries(payload).reduce((acc, [key, value]) => {
    if (shouldHideRequestField(key)) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
};

const buildConversationContextSummary = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { total: 0, roleCounts: [] };
  }

  const counts = new Map();
  messages.forEach((message) => {
    const roleKey = normalizeRole(message?.role) || normalizeRole(message?.raw?.role) || 'assistant';
    counts.set(roleKey, (counts.get(roleKey) || 0) + 1);
  });

  return {
    total: messages.length,
    roleCounts: Array.from(counts.entries()).map(([role, count]) => ({ role, count }))
  };
};

const NON_CONVERSATION_KIND_LABELS = {
  audio: '音频',
  images: '图像',
  embeddings: '向量',
  completions: '补全'
};

const ROLE_LABELS = {
  assistant: '助手',
  user: '用户',
  system: '系统',
  developer: '开发者',
  tool: '工具'
};

const TARGET_PROTOCOL_LABELS = {
  openai: 'OpenAI',
  responses: 'Responses',
  claude: 'Claude',
  gemini: 'Gemini'
};

const RequestSection = React.forwardRef(
  ({ protocol, viewModel, sourceDisplay, request, requestProps, rawRequestBody, sectionRefs, onCopyRequestBody }, ref) => {
    const source = viewModel?.source || {};
    const parsedRequest = request?.parsed ?? viewModel?.request?.parsed ?? null;
    const hasStructuredRequest = parsedRequest !== null && parsedRequest !== undefined;
    const schemaKey = sourceDisplay?.schema?.key || protocol || '';
    const auditModel = useMemo(() => buildRequestAuditModel(parsedRequest, { schemaKey }), [parsedRequest, schemaKey]);
    const conversationContext = useMemo(() => buildConversationContextSummary(viewModel?.messages), [viewModel?.messages]);
    const requestConversionWarnings = useMemo(() => {
      const normalizedRequest = viewModel?.request?.normalized;
      const convertTargets = Array.isArray(viewModel?.request?.convertTargets) ? viewModel.request.convertTargets : [];
      return getCrossProtocolToolWarnings(normalizedRequest, convertTargets);
    }, [viewModel]);

    const requestContent = filterRequestProps(hasStructuredRequest ? parsedRequest : requestProps);
    const hasRequestProps = Object.keys(requestContent).length > 0;

    const requestRawContent = typeof request?.raw === 'string' && request.raw.trim() ? request.raw : rawRequestBody;
    const panelContent = hasRequestProps ? requestContent : requestRawContent;
    const originalRequestContent = hasStructuredRequest ? parsedRequest : panelContent;
    const nonConversationTitle = auditModel.nonConversation
      ? `${NON_CONVERSATION_KIND_LABELS[auditModel.nonConversation.kind] || '通用'}请求摘要`
      : '';
    const curlTargets = useMemo(() => {
      const convertTargets = Array.isArray(viewModel?.request?.convertTargets) ? viewModel.request.convertTargets : [];
      return ['original', ...convertTargets].map((target) => CURL_TARGET_MAP[target]).filter(Boolean);
    }, [viewModel]);

    const sourceMeta = [
      sourceDisplay?.provider?.label || source.provider,
      sourceDisplay?.schema?.label || protocol,
      sourceDisplay?.transport?.label || (source.isStream ? '流式' : '非流式'),
      source.channelName
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <Box id="request" ref={ref}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <SettingsIcon sx={{ mr: 1 }} color="primary" />
            <Typography variant="h5" fontWeight="bold" color="primary">
              请求
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {sourceDisplay?.schema?.label || protocol || '未知协议'}
            </Typography>
            {sourceMeta && (
              <Typography variant="caption" color="text.secondary">
                {sourceMeta}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {curlTargets.length > 0 && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  复制 curl:
                </Typography>
                <ButtonGroup variant="outlined" size="small">
                  {curlTargets.map((target) => (
                    <Tooltip key={target.key} title={target.title}>
                      <Button
                        onClick={() => onCopyRequestBody(target.action)}
                        startIcon={<TerminalIcon sx={{ fontSize: '0.875rem' }} />}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 500,
                          '&:hover': {
                            bgcolor: target.hoverBg
                          }
                        }}
                      >
                        {target.label}
                      </Button>
                    </Tooltip>
                  ))}
                </ButtonGroup>
              </>
            )}
            {requestRawContent && (
              <Tooltip title="复制原始请求体">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onCopyRequestBody('raw-request')}
                  startIcon={<ContentCopyIcon sx={{ fontSize: '0.875rem' }} />}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                >
                  原始请求
                </Button>
              </Tooltip>
            )}
          </Box>
        </Box>
        {auditModel.params.length > 0 && (
          <Grid
            id="request-params"
            ref={(el) => sectionRefs && (sectionRefs.current['request-params'] = el)}
            container
            spacing={1.25}
            sx={{ mb: 2 }}
          >
            {auditModel.params.map((item) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={`${item.label}-${item.path}`}>
                <Box
                  sx={{
                    p: 1.25,
                    border: '1px solid',
                    borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
                    borderRadius: 1,
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.75)')
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block">
                    {item.label}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                    {item.displayValue || (typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value))}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.path}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}

        {conversationContext.total > 0 && (
          <Alert
            id="request-conversation-summary"
            ref={(el) => sectionRefs && (sectionRefs.current['request-conversation-summary'] = el)}
            severity="info"
            variant="outlined"
            sx={{
              mb: 2,
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(2,136,209,0.08)' : 'rgba(2,136,209,0.04)')
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
              对话上下文摘要
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              下方对话上下文区承接本次请求的历史消息，严格保持原始顺序，共 {conversationContext.total} 条。
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {conversationContext.roleCounts.map((item) => (
                <Chip key={item.role} size="small" label={`${ROLE_LABELS[item.role] || item.role} ×${item.count}`} variant="outlined" />
              ))}
            </Stack>
          </Alert>
        )}

        {requestConversionWarnings.length > 0 && (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75 }}>
              部分工具不可跨协议转换
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              复制跨协议 curl 时，仅保留可可靠映射的函数工具；以下工具会在目标协议请求中被省略。
            </Typography>
            <Stack direction="column" spacing={1}>
              {requestConversionWarnings.map((warning) => (
                <Box key={warning.target}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    {TARGET_PROTOCOL_LABELS[warning.target] || warning.target}
                  </Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    {warning.omittedTools.map((tool) => (
                      <Chip
                        key={`${warning.target}-${tool.path}`}
                        size="small"
                        color="warning"
                        variant="outlined"
                        label={`${tool.displayName} · ${tool.toolType}`}
                      />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Alert>
        )}

        <Box id="request-tools" ref={(el) => sectionRefs && (sectionRefs.current['request-tools'] = el)}>
          <ToolDefinitionList tools={auditModel.tools} />
        </Box>

        {auditModel.nonConversation && (
          <CopyablePanel
            title={nonConversationTitle}
            content={auditModel.nonConversation.items}
            rawContent={auditModel.nonConversation.items}
            visibleChipTypes={[]}
          />
        )}

        {Object.keys(auditModel.remaining).length > 0 && (
          <Box id="request-full-params" ref={(el) => sectionRefs && (sectionRefs.current['request-full-params'] = el)}>
            <CopyablePanel
              title="完整参数视图"
              content={auditModel.remaining}
              rawContent={auditModel.remaining}
              isRequestBody={false}
              visibleChipTypes={[]}
            />
          </Box>
        )}

        <Accordion id="request-raw" ref={(el) => sectionRefs && (sectionRefs.current['request-raw'] = el)} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={700}>原始请求</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <CopyablePanel
              title="请求原文"
              content={originalRequestContent}
              rawContent={
                requestRawContent ||
                (hasStructuredRequest
                  ? JSON.stringify(parsedRequest, null, 2)
                  : hasRequestProps
                    ? JSON.stringify(requestContent, null, 2)
                    : requestRawContent)
              }
              isRequestBody={hasRequestProps}
              enableJsonNavigation={true}
              sx={{
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
                borderRadius: '12px',
                boxShadow: 'none'
              }}
            />
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  }
);

RequestSection.displayName = 'RequestSection';

RequestSection.propTypes = {
  protocol: PropTypes.string,
  viewModel: PropTypes.shape({
    source: PropTypes.shape({
      provider: PropTypes.string,
      channelName: PropTypes.string,
      isStream: PropTypes.bool
    }),
    messages: PropTypes.arrayOf(
      PropTypes.shape({
        role: PropTypes.string,
        raw: PropTypes.oneOfType([PropTypes.object, PropTypes.string])
      })
    ),
    request: PropTypes.shape({
      parsed: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
      normalized: PropTypes.object,
      convertTargets: PropTypes.arrayOf(PropTypes.string)
    })
  }),
  sourceDisplay: PropTypes.object,
  request: PropTypes.shape({
    parsed: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
    raw: PropTypes.string
  }),
  requestProps: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
  rawRequestBody: PropTypes.string,
  sectionRefs: PropTypes.shape({
    current: PropTypes.object
  }),
  onCopyRequestBody: PropTypes.func
};

export default RequestSection;
