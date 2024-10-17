import React, { useMemo, useState } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import BuildIcon from '@mui/icons-material/Build';
import CopyablePanel from './CopyablePanel';
import {
  detectAllMessageContent,
  ContentType,
  ToolCallPreview,
  ImagePreview
} from './preview';


/**
 * 消息卡片组件
 * 展示单条消息
 */
const MessageCard = React.forwardRef(({ message, index }, ref) => {
  const [toolCallPreviewOpen, setToolCallPreviewOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  
  // 使用 detectAllMessageContent 检测消息内容
  const detectionResult = useMemo(() => {
    // 使用原始消息数据进行检测
    const rawMessage = message.rawContent || message;
    return detectAllMessageContent(rawMessage);
  }, [message]);
  
  // 提取图片内容
  const imageItems = useMemo(() => {
    if (!detectionResult) return [];
    return detectionResult.content.filter(c =>
      c.type === ContentType.IMAGE_URL || c.type === ContentType.IMAGE_BASE64
    );
  }, [detectionResult]);

  const getRoleIcon = () => {
    // 如果是工具结果消息，显示工具图标
    if (detectionResult?.hasToolResults || message.role === 'tool') {
      return <BuildIcon sx={{ mr: 1 }} color="success" />;
    }
    // 如果消息包含工具调用，显示工具图标
    if (detectionResult?.hasToolCalls) {
      return <BuildIcon sx={{ mr: 1 }} color="warning" />;
    }
    
    switch (message.role) {
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
    // 如果是工具结果消息
    if (detectionResult?.hasToolResults || message.role === 'tool') {
      return '工具结果';
    }
    // 如果消息包含工具调用
    if (detectionResult?.hasToolCalls) {
      return 'AI助手 (工具调用)';
    }
    
    switch (message.role) {
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
    // 如果是工具结果消息
    if (detectionResult?.hasToolResults || message.role === 'tool') {
      return 'success.dark';
    }
    // 如果消息包含工具调用
    if (detectionResult?.hasToolCalls) {
      return 'warning.dark';
    }
    
    switch (message.role) {
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
    // 如果是工具结果消息
    if (detectionResult?.hasToolResults || message.role === 'tool') {
      return theme.palette.mode === 'dark'
        ? 'rgba(76, 175, 80, 0.15)'
        : 'rgba(76, 175, 80, 0.08)';
    }
    // 如果消息包含工具调用
    if (detectionResult?.hasToolCalls) {
      return theme.palette.mode === 'dark'
        ? 'rgba(255, 152, 0, 0.15)'
        : 'rgba(255, 152, 0, 0.08)';
    }
    
    if (theme.palette.mode === 'dark') {
      return message.role === 'user'
        ? 'rgba(59, 130, 246, 0.15)'
        : message.role === 'system'
          ? 'rgba(14, 165, 233, 0.15)'
          : message.role === 'tool'
            ? 'rgba(250, 204, 21, 0.15)'
            : 'rgba(168, 85, 247, 0.15)';
    }
    return message.role === 'user'
      ? 'rgba(59, 130, 246, 0.08)'
      : message.role === 'system'
        ? 'rgba(14, 165, 233, 0.08)'
        : message.role === 'tool'
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
          
          {message.content && message.content.length > 0 && (
            <CopyablePanel
              title="内容"
              content={message.content}
              rawContent={message.rawContent}
              sx={{
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255, 255, 255, 0.7)'),
                boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none')
              }}
            />
          )}
        </CardContent>
      </Card>
      
      {/* 工具调用预览弹窗 */}
      {detectionResult?.hasToolCalls && (
        <ToolCallPreview
          toolCalls={detectionResult.toolCalls}
          toolResults={[]}
          open={toolCallPreviewOpen}
          onClose={() => setToolCallPreviewOpen(false)}
          mode="calls"
        />
      )}
      
      {/* 图片预览弹窗 */}
      {imageItems.length > 0 && (
        <ImagePreview
          images={imageItems}
          open={imagePreviewOpen}
          onClose={() => setImagePreviewOpen(false)}
        />
      )}
    </Box>
  );
});

MessageCard.displayName = 'MessageCard';

/**
 * 对话历史部分组件
 * 展示所有对话消息
 */
const ConversationSection = React.forwardRef(({ messages, sectionRefs }, ref) => {
  return (
    <Box id="conversation" ref={ref}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <ChatIcon sx={{ mr: 1 }} color="primary" />
        <Typography variant="h5" fontWeight="bold" color="primary">
          对话历史
        </Typography>
      </Box>
      {messages.map((message, index) => (
        <MessageCard
          key={index}
          message={message}
          index={index}
          ref={(el) => {
            if (sectionRefs) {
              sectionRefs.current[`message-${index}`] = el;
            }
          }}
        />
      ))}
    </Box>
  );
});

ConversationSection.displayName = 'ConversationSection';

export default ConversationSection;
