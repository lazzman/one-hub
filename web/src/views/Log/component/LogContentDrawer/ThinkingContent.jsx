import React, { useState } from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Box, Typography, Chip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PsychologyIcon from '@mui/icons-material/Psychology';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

/**
 * 思考内容展示组件
 * 用于展示 Claude thinking 或 DeepSeek reasoning_content
 */
const ThinkingContent = ({ thinking, reasoningContent }) => {
  const [expanded, setExpanded] = useState(false);
  const hasThinking = thinking && thinking.trim().length > 0;
  const hasReasoning = reasoningContent && reasoningContent.trim().length > 0;

  if (!hasThinking && !hasReasoning) {
    return null;
  }

  const content = thinking || reasoningContent;
  const label = hasThinking ? '思考过程 (Claude Thinking)' : '推理内容 (DeepSeek Reasoning)';
  const icon = hasThinking ? <PsychologyIcon /> : <LightbulbIcon />;

  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(!expanded)}
      sx={{
        mb: 2,
        borderRadius: '12px !important',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)'),
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.04)'),
        '&:before': {
          display: 'none'
        },
        '&.Mui-expanded': {
          margin: '0 0 16px 0'
        },
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.4)'),
          boxShadow: (theme) =>
            theme.palette.mode === 'dark' ? '0 4px 12px rgba(139, 92, 246, 0.2)' : '0 4px 12px rgba(139, 92, 246, 0.1)'
        }
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: 'rgb(139, 92, 246)' }} />}
        sx={{
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.08)'),
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)'),
          minHeight: '48px',
          '&.Mui-expanded': {
            minHeight: '48px'
          },
          '& .MuiAccordionSummary-content': {
            margin: '12px 0',
            '&.Mui-expanded': {
              margin: '12px 0'
            }
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: '8px',
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)'),
              color: 'rgb(139, 92, 246)'
            }}
          >
            {icon}
          </Box>
          <Typography
            variant="subtitle1"
            fontWeight="600"
            sx={{
              color: (theme) => (theme.palette.mode === 'dark' ? 'rgb(167, 139, 250)' : 'rgb(109, 40, 217)')
            }}
          >
            {label}
          </Typography>
          <Chip
            size="small"
            label={expanded ? '点击收起' : '点击展开'}
            sx={{
              ml: 1,
              height: '22px',
              fontSize: '0.75rem',
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.12)'),
              color: (theme) => (theme.palette.mode === 'dark' ? 'rgb(167, 139, 250)' : 'rgb(109, 40, 217)'),
              border: 'none'
            }}
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          p: 0,
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.8)')
        }}
      >
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflow: 'auto',
            maxHeight: '500px',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
            color: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.8)'),
            '&::-webkit-scrollbar': {
              height: '8px',
              width: '8px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(139, 92, 246, 0.3)',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'rgba(139, 92, 246, 0.5)'
              }
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)')
            }
          }}
        >
          {content}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

export default ThinkingContent;
