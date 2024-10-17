import React from 'react';
import { Box, Typography, ButtonGroup, Button, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import TerminalIcon from '@mui/icons-material/Terminal';
import CopyablePanel from './CopyablePanel';

/**
 * 请求属性部分组件
 * 展示请求属性和提供 curl 命令复制功能
 */
const RequestSection = React.forwardRef(({ requestProps, onCopyRequestBody }, ref) => {
  return (
    <Box id="request" ref={ref}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SettingsIcon sx={{ mr: 1 }} color="primary" />
          <Typography variant="h5" fontWeight="bold" color="primary">
            请求属性
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            复制 curl:
          </Typography>
          <ButtonGroup variant="outlined" size="small">
            <Tooltip title="复制为 OpenAI API curl 命令">
              <Button
                onClick={() => onCopyRequestBody('openai-curl')}
                startIcon={<TerminalIcon sx={{ fontSize: '0.875rem' }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'rgba(16, 163, 127, 0.08)'
                  }
                }}
              >
                OpenAI
              </Button>
            </Tooltip>
            <Tooltip title="复制为 Claude API curl 命令">
              <Button
                onClick={() => onCopyRequestBody('claude-curl')}
                startIcon={<TerminalIcon sx={{ fontSize: '0.875rem' }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'rgba(204, 153, 102, 0.08)'
                  }
                }}
              >
                Claude
              </Button>
            </Tooltip>
            <Tooltip title="复制为 Gemini API curl 命令">
              <Button
                onClick={() => onCopyRequestBody('gemini-curl')}
                startIcon={<TerminalIcon sx={{ fontSize: '0.875rem' }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: 'rgba(66, 133, 244, 0.08)'
                  }
                }}
              >
                Gemini
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Box>
      </Box>
      <CopyablePanel
        title="内容"
        content={requestProps}
        isRequestBody={true}
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

export default RequestSection;
