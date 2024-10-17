import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Typography } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import ToolCallPreview from './preview/ToolCallPreview';

const isObjectLike = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeText = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeOrder = (value, fallback) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const normalizeKind = (value) => {
  const kind = normalizeText(value, 'tool_call').toLowerCase();
  if (kind === 'tool_result') return 'tool_result';
  return 'tool_call';
};

const toSummaryText = (value, maxLength = 260) => {
  if (value === undefined || value === null) return '—';

  let text = '';
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '—';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
};

const pickToolCallArgs = (payload) =>
  payload?.arguments ?? payload?.args ?? payload?.input ?? payload?.raw?.arguments ?? payload?.raw?.input ?? payload?.raw?.item?.arguments;

const pickToolResultValue = (payload) =>
  payload?.result ??
  payload?.output ??
  payload?.response ??
  payload?.content ??
  payload?.raw?.result ??
  payload?.raw?.output ??
  payload?.raw?.response ??
  payload?.raw?.content ??
  payload?.raw?.item?.output ??
  payload?.raw?.item?.result ??
  payload?.raw?.item?.content;

const pickPayloadSummary = (entry) => {
  const payload = entry?.payload;
  if (!isObjectLike(payload)) {
    return toSummaryText(payload);
  }

  const kind = normalizeKind(entry?.kind);

  if (kind === 'tool_call') {
    return toSummaryText(pickToolCallArgs(payload));
  }

  return toSummaryText(pickToolResultValue(payload));
};

const pickPreviewCallId = (entry) => {
  const payload = isObjectLike(entry?.payload) ? entry.payload : null;
  const raw = isObjectLike(payload?.raw) ? payload.raw : null;
  const rawItem = isObjectLike(raw?.item) ? raw.item : null;

  return normalizeText(
    entry?.callId ??
      payload?.callId ??
      raw?.call_id ??
      raw?.callId ??
      raw?.tool_call_id ??
      raw?.toolCallId ??
      raw?.tool_use_id ??
      raw?.toolUseId ??
      rawItem?.call_id ??
      rawItem?.callId ??
      rawItem?.tool_call_id ??
      rawItem?.toolCallId ??
      rawItem?.tool_use_id ??
      rawItem?.toolUseId ??
      rawItem?.id,
    ''
  );
};

const pickPreviewToolName = (entry) => {
  const payload = isObjectLike(entry?.payload) ? entry.payload : null;
  const raw = isObjectLike(payload?.raw) ? payload.raw : null;
  const rawItem = isObjectLike(raw?.item) ? raw.item : null;

  return normalizeText(
    entry?.toolName ?? payload?.name ?? raw?.name ?? rawItem?.name ?? raw?.function?.name ?? rawItem?.function?.name,
    '未知工具'
  );
};

const toPreviewToolCall = (entry) => {
  const payload = isObjectLike(entry?.payload) ? entry.payload : {};
  const raw = isObjectLike(payload?.raw) ? payload.raw : null;
  const rawItem = isObjectLike(raw?.item) ? raw.item : null;
  const argumentsValue = pickToolCallArgs(payload) ?? pickToolCallArgs(rawItem) ?? raw?.arguments ?? raw?.input ?? null;

  return {
    id: pickPreviewCallId(entry),
    name: pickPreviewToolName(entry),
    arguments: argumentsValue
  };
};

const isErrorLike = (value) =>
  value.includes('fail') || value.includes('error') || value.includes('cancel') || value.includes('incomplete');

const toPreviewToolResult = (entry) => {
  const payload = isObjectLike(entry?.payload) ? entry.payload : {};
  const raw = isObjectLike(payload?.raw) ? payload.raw : null;
  const rawItem = isObjectLike(raw?.item) ? raw.item : null;
  const resultContent = pickToolResultValue(payload) ?? pickToolResultValue(rawItem) ?? null;
  const statusText = normalizeText(payload?.status ?? raw?.status ?? rawItem?.status, '').toLowerCase();
  const eventType = normalizeText(payload?.eventType ?? raw?.type ?? rawItem?.type, '').toLowerCase();

  return {
    toolCallId: pickPreviewCallId(entry),
    name: pickPreviewToolName(entry),
    content: resultContent,
    response: resultContent,
    isError: isErrorLike(statusText) || isErrorLike(eventType)
  };
};

const LinearTraceSection = ({ linearTrace }) => {
  const safeLinearTrace = useMemo(() => (Array.isArray(linearTrace) ? linearTrace : []), [linearTrace]);
  const [previewState, setPreviewState] = useState({
    open: false,
    mode: 'calls',
    toolCalls: [],
    toolResults: []
  });

  const orderedTrace = useMemo(() => {
    return safeLinearTrace
      .map((item, index) => ({
        item,
        index,
        order: normalizeOrder(item?.order, index + 1)
      }))
      .sort((a, b) => {
        if (a.order === b.order) {
          return a.index - b.index;
        }
        return a.order - b.order;
      });
  }, [safeLinearTrace]);

  const handleClosePreview = () => {
    setPreviewState((prev) => ({
      ...prev,
      open: false
    }));
  };

  const handlePreviewByKind = (entry, kind) => {
    if (kind === 'tool_result') {
      setPreviewState({
        open: true,
        mode: 'results',
        toolCalls: [],
        toolResults: [toPreviewToolResult(entry)]
      });
      return;
    }

    setPreviewState({
      open: true,
      mode: 'calls',
      toolCalls: [toPreviewToolCall(entry)],
      toolResults: []
    });
  };

  return (
    <Box
      sx={{
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
        borderRadius: '12px',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
        p: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <TimelineIcon sx={{ mr: 1 }} color="warning" />
        <Typography variant="subtitle1" fontWeight="bold" color="warning.main">
          线性调用过程
        </Typography>
      </Box>

      {orderedTrace.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          无工具调用过程数据
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {orderedTrace.map(({ item, index, order }) => {
            const kind = normalizeKind(item?.kind);
            const toolName = normalizeText(item?.toolName, '未知工具');
            const callId = normalizeText(item?.callId, '—');
            const payloadSummary = pickPayloadSummary(item);
            const orderLabel = `#${order}`;
            const chipConfig =
              kind === 'tool_result'
                ? {
                    label: 'tool_result',
                    color: 'success',
                    icon: <AssignmentTurnedInRoundedIcon fontSize="small" />,
                    hoverBg: (theme) => (theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(76, 175, 80, 0.08)')
                  }
                : {
                    label: 'tool_call',
                    color: 'warning',
                    icon: <PlayArrowRoundedIcon fontSize="small" />,
                    hoverBg: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 152, 0, 0.08)')
                  };

            return (
              <Box
                key={`${orderLabel}-${callId}-${index}`}
                sx={{
                  border: '1px solid',
                  borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
                  borderRadius: 1.5,
                  p: 1.25
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {orderLabel} · {kind}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      toolName: {toolName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      callId: {callId}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={chipConfig.label}
                    color={chipConfig.color}
                    icon={chipConfig.icon}
                    variant="outlined"
                    clickable
                    onClick={() => handlePreviewByKind(item, kind)}
                    sx={{
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '& .MuiChip-icon': {
                        color: 'inherit'
                      },
                      '&:hover': {
                        bgcolor: chipConfig.hoverBg,
                        transform: 'translateY(-1px)'
                      }
                    }}
                  />
                </Box>

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                  payload 摘要
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word', mb: 1 }}>
                  {payloadSummary}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <ToolCallPreview
        toolCalls={previewState.toolCalls}
        toolResults={previewState.toolResults}
        open={previewState.open}
        onClose={handleClosePreview}
        mode={previewState.mode}
      />
    </Box>
  );
};

LinearTraceSection.propTypes = {
  linearTrace: PropTypes.array
};

export default LinearTraceSection;
