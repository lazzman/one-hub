import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, ButtonGroup, Button, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import TerminalIcon from '@mui/icons-material/Terminal';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CopyablePanel from './CopyablePanel';

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

const RequestSection = React.forwardRef(({ protocol, viewModel, request, requestProps, rawRequestBody, onCopyRequestBody }, ref) => {
  const source = viewModel?.source || {};
  const parsedRequest = request?.parsed ?? viewModel?.request?.parsed ?? null;
  const hasStructuredRequest = parsedRequest !== null && parsedRequest !== undefined;

  const requestContent = filterRequestProps(hasStructuredRequest ? parsedRequest : requestProps);
  const hasRequestProps = Object.keys(requestContent).length > 0;

  const requestRawContent = typeof request?.raw === 'string' && request.raw.trim() ? request.raw : rawRequestBody;
  const panelContent = hasRequestProps ? requestContent : requestRawContent;
  const curlTargets = useMemo(() => {
    const convertTargets = Array.isArray(viewModel?.request?.convertTargets) ? viewModel.request.convertTargets : [];
    return convertTargets.map((target) => CURL_TARGET_MAP[target]).filter(Boolean);
  }, [viewModel]);

  const sourceMeta = [source.provider, source.channelName, source.isStream ? 'stream' : 'non-stream'].filter(Boolean).join(' · ');

  return (
    <Box id="request" ref={ref}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <SettingsIcon sx={{ mr: 1 }} color="primary" />
          <Typography variant="h5" fontWeight="bold" color="primary">
            请求属性
          </Typography>
          <Typography variant="caption" color="text.secondary">
            协议: {protocol || 'unknown'}
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
      <CopyablePanel
        title={hasRequestProps ? '请求属性' : '请求原文'}
        content={panelContent}
        rawContent={hasRequestProps ? undefined : requestRawContent}
        isRequestBody={hasRequestProps}
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
    </Box>
  );
});

RequestSection.displayName = 'RequestSection';

RequestSection.propTypes = {
  protocol: PropTypes.string,
  viewModel: PropTypes.shape({
    source: PropTypes.shape({
      provider: PropTypes.string,
      channelName: PropTypes.string,
      isStream: PropTypes.bool
    }),
    request: PropTypes.shape({
      parsed: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
      convertTargets: PropTypes.arrayOf(PropTypes.string)
    })
  }),
  request: PropTypes.shape({
    parsed: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
    raw: PropTypes.string
  }),
  requestProps: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string]),
  rawRequestBody: PropTypes.string,
  onCopyRequestBody: PropTypes.func
};

export default RequestSection;
