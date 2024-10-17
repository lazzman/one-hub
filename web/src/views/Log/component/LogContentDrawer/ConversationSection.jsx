import React from 'react';
import { Box, Typography, Card, CardContent, Alert } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import BuildIcon from '@mui/icons-material/Build';
import CopyablePanel from './CopyablePanel';

/**
 * 消息卡片组件
 * 展示单条消息
 */
const MessageCard = React.forwardRef(({ message, index }, ref) => {
  const role = message?.role || 'assistant';
  const text = typeof message?.text === 'string' ? message.text : '';
  const hasText = text.trim().length > 0;
  const rawMessage = message?.raw ?? null;
  const panelContent = hasText ? text : rawMessage;

  const getRoleIcon = () => {
    switch (role) {
      case 'system':
        return <MenuBookIcon sx={{ mr: 1 }} color="info" />;
      case 'user':
        return <PersonIcon sx={{ mr: 1 }} color="primary" />;
      case 'tool':
        return <BuildIcon sx={{ mr: 1 }} color="warning" />;
      default:
        return <SmartToyIcon sx={{ mr: 1 }} color="secondary" />;
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'user':
        return '用户';
      case 'system':
        return '预设提示词';
      case 'tool':
        return '工具';
      default:
        return 'AI助手';
    }
  };

  const getRoleColor = () => {
    switch (role) {
      case 'user':
        return 'primary.dark';
      case 'system':
        return 'info.dark';
      case 'tool':
        return 'warning.dark';
      default:
        return 'secondary.dark';
    }
  };

  const getCardBgColor = (theme) => {
    if (theme.palette.mode === 'dark') {
      return role === 'user'
        ? 'rgba(59, 130, 246, 0.15)'
        : role === 'system'
          ? 'rgba(14, 165, 233, 0.15)'
          : role === 'tool'
            ? 'rgba(250, 204, 21, 0.15)'
            : 'rgba(168, 85, 247, 0.15)';
    }
    return role === 'user'
      ? 'rgba(59, 130, 246, 0.08)'
      : role === 'system'
        ? 'rgba(14, 165, 233, 0.08)'
        : role === 'tool'
          ? 'rgba(250, 204, 21, 0.08)'
          : 'rgba(168, 85, 247, 0.08)';
  };

  return (
    <Box id={`message-${index}`} ref={ref}>
      <Card
        sx={{
          bgcolor: getCardBgColor,
          borderRadius: '12px',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark' ? '0 6px 8px rgba(0,0,0,0.3)' : '0 6px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.12)'
          },
          mb: 2
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            {getRoleIcon()}
            <Typography variant="h6" fontWeight="bold" color={getRoleColor()}>
              {getRoleLabel()}
              {` - ${index + 1}`}
            </Typography>
          </Box>

          {panelContent ? (
            <CopyablePanel
              title={hasText ? '内容' : '结构化消息'}
              content={panelContent}
              rawContent={hasText ? text : undefined}
              sx={{
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255, 255, 255, 0.7)'),
                boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none')
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              该消息无可展示文本内容
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
});

MessageCard.displayName = 'MessageCard';

/**
 * 对话历史部分组件
 * 展示所有对话消息
 */
const normalizeMessageText = (message) => {
  if (!message || typeof message !== 'object') return '';

  if (typeof message.text === 'string' && message.text.trim()) {
    return message.text.trim();
  }

  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          if (typeof item.text === 'string') return item.text;
          if (typeof item.content === 'string') return item.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();

    if (text) return text;
  }

  return '';
};

const ConversationSection = React.forwardRef(({ messages, fallbackRaw, sectionRefs }, ref) => {
  const normalizedMessages = Array.isArray(messages)
    ? messages
        .map((message) => {
          const text = normalizeMessageText(message);
          if (text) {
            return {
              ...message,
              text
            };
          }

          if (message?.raw !== undefined && message?.raw !== null) {
            return {
              ...message,
              text: ''
            };
          }

          return null;
        })
        .filter(Boolean)
    : [];

  const hasStructuredMessages = normalizedMessages.length > 0;
  const fallbackContent = typeof fallbackRaw === 'string' ? fallbackRaw : '';

  return (
    <Box id="conversation" ref={ref}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <ChatIcon sx={{ mr: 1 }} color="primary" />
        <Typography variant="h5" fontWeight="bold" color="primary">
          对话历史
        </Typography>
      </Box>

      {!hasStructuredMessages ? (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            未解析到结构化对话，已降级展示最终消息文本。
          </Alert>
          <CopyablePanel
            title="最终消息文本"
            content={fallbackContent}
            rawContent={fallbackContent}
            sx={{
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
              borderRadius: '12px',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)'
            }}
          />
        </Box>
      ) : (
        normalizedMessages.map((message, index) => (
          <MessageCard
            key={`${message?.role || 'unknown'}-${index}`}
            message={message}
            index={index}
            ref={(el) => {
              if (sectionRefs) {
                sectionRefs.current[`message-${index}`] = el;
              }
            }}
          />
        ))
      )}
    </Box>
  );
});

ConversationSection.displayName = 'ConversationSection';

export default ConversationSection;
