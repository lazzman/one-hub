import React from 'react';
import { Box, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ThinkingContent from './ThinkingContent';
import CopyablePanel from './CopyablePanel';

/**
 * AI 响应部分组件
 * 展示 AI 响应内容，包括思考过程
 */
const ResponseSection = React.forwardRef(({ response, rawResponseBody }, ref) => {
  return (
    <Box id="response" ref={ref}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <AutoAwesomeIcon sx={{ mr: 1 }} color="primary" />
        <Typography variant="h5" fontWeight="bold" color="primary">
          AI 响应
        </Typography>
      </Box>

      {/* 思考内容展示 - Claude thinking 或 DeepSeek reasoning_content */}
      <ThinkingContent thinking={response?.thinking} reasoningContent={response?.reasoning_content} />

      <CopyablePanel
        title="回复内容"
        content={response}
        rawContent={rawResponseBody}
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

ResponseSection.displayName = 'ResponseSection';

export default ResponseSection;
