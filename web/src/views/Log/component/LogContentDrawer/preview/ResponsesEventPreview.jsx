import React from 'react';
import { Box, Chip, Divider, Typography, useTheme } from '@mui/material';
import PreviewModal from './PreviewModal';

const toPreviewText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

/**
 * Responses SSE 事件预览（最小可用）
 * 展示 event/type/data 概览
 */
const ResponsesEventPreview = ({ events = [], open, onClose }) => {
  const theme = useTheme();

  return (
    <PreviewModal open={open} onClose={onClose} title={`事件预览 (${events.length})`}>
      <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        {events.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            无可预览事件
          </Typography>
        ) : (
          events.map((eventItem, index) => {
            const eventName = eventItem?.event || 'message';
            const eventType = eventItem?.eventType || '';
            const dataText = toPreviewText(eventItem?.data ?? eventItem?.raw ?? '');

            return (
              <Box key={`${eventName}-${index}`} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" label={`#${index + 1}`} variant="outlined" />
                  <Chip size="small" label={`event: ${eventName}`} color="primary" variant="outlined" />
                  {eventType ? <Chip size="small" label={`type: ${eventType}`} color="secondary" variant="outlined" /> : null}
                  {eventItem?.done ? <Chip size="small" label="DONE" color="success" /> : null}
                </Box>

                <Box
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    m: 0,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)',
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                    maxHeight: 220,
                    overflow: 'auto'
                  }}
                >
                  {dataText || '(empty)'}
                </Box>

                {index < events.length - 1 ? <Divider sx={{ mt: 2 }} /> : null}
              </Box>
            );
          })
        )}
      </Box>
    </PreviewModal>
  );
};

export default ResponsesEventPreview;
