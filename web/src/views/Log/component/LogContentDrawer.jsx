import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Drawer, IconButton, Box, Typography, Paper, Card, CardContent, Button, List, ListItem, ListItemText, Modal, Collapse } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLess from '@mui/icons-material/ExpandMore';
import ExpandMore from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CodeIcon from '@mui/icons-material/Code';
import ZoomInIcon from '@mui/icons-material/ZoomIn';

const ImagePreview = ({ url }) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        <img
          src={url}
          alt="Content"
          style={{ maxWidth: '100%', height: 'auto', cursor: 'pointer' }}
          onClick={handleOpen}
        />
        <IconButton
          onClick={handleOpen}
          size="small"
          sx={{ position: 'absolute', right: 8, top: 8, bgcolor: 'rgba(255,255,255,0.7)' }}
        >
          <ZoomInIcon />
        </IconButton>
      </Box>
      <Modal
        open={open}
        onClose={handleClose}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Box sx={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
          <img
            src={url}
            alt="Full size content"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
          <IconButton
            onClick={handleClose}
            sx={{ position: 'absolute', right: 8, top: 8, bgcolor: 'rgba(255,255,255,0.7)' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Modal>
    </>
  );
};

const CopyablePanel = ({ title, content, defaultView = 'formatted', isAIResponse = false, sx }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState(defaultView);

  const handleCopy = async () => {
    const displayedContent = viewMode === 'raw' ? JSON.stringify(content, null, 2) : renderContent();
    const textContent = await processContentForCopy(displayedContent);

    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const processContentForCopy = async (content) => {
    const textParts = [];
    const processItem = async (item) => {
      if (typeof item === 'string') {
        textParts.push(item);
      } else if (React.isValidElement(item)) {
        if (item.props.src || item.props.url) {
          textParts.push(item.props.src || item.props.url);
        } else if (item.props.children) {
          await processItem(item.props.children);
        }
      } else if (Array.isArray(item)) {
        for (const subItem of item) {
          await processItem(subItem);
        }
      } else if (item && typeof item === 'object') {
        textParts.push(item.textContent || item.innerText || JSON.stringify(item));
      }
    };

    await processItem(content);
    return textParts.join('\n');
  };

  const toggleViewMode = () => setViewMode(prev => prev === 'formatted' ? 'raw' : 'formatted');

  const renderContent = () => {
    if (viewMode === 'raw') {
      return JSON.stringify(content, null, 2);
    }

    if (isAIResponse && content.content?.content) {
      return typeof content.content.content === 'string' 
        ? content.content.content 
        : JSON.stringify(content.content.content, null, 2);
    }

    if (Array.isArray(content)) {
      return content.map((item, index) => {
        switch (item.type) {
          case 'text':
            return <Typography key={index}>{item.text}</Typography>;
          case 'image':
            return <ImagePreview key={index} url={item.url} />;
          default:
            return <Typography key={index}>{JSON.stringify(item, null, 2)}</Typography>;
        }
      });
    }

    return typeof content === 'object' && content !== null
      ? JSON.stringify(content, null, 2)
      : String(content);
  };

  return (
    <Paper elevation={3} sx={{ p: 2, mb: 2, position: 'relative', ...sx }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{title}</Typography>
        <Box>
          <Button
            startIcon={<CodeIcon />}
            onClick={toggleViewMode}
            size="small"
            sx={{ mr: 1 }}
          >
            {viewMode === 'formatted' ? '查看原始' : '查看格式化'}
          </Button>
          <IconButton
            onClick={handleCopy}
            size="small"
          >
            {copied ? <CheckIcon color="success" /> : <ContentCopyIcon />}
          </IconButton>
        </Box>
      </Box>
      <Box
        component="pre"
        sx={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'auto',
          p: 1,
          bgcolor: 'grey.100',
          borderRadius: 1,
          maxHeight: '300px',
          '&::-webkit-scrollbar': {
            height: '8px',
            width: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,.2)',
            borderRadius: '4px',
          },
        }}
      >
        {renderContent()}
      </Box>
    </Paper>
  );
};

const LogContentDrawer = ({ open, onClose, content }) => {
  const [activeSection, setActiveSection] = useState('');
  const [openConversation, setOpenConversation] = useState(true);
  const sectionRefs = useRef({});

  const parseContent = useCallback((content) => {
    try {
      if (typeof content !== 'string' || content.trim() === '') {
        throw new Error('无效的内容格式');
      }

      const [requestBodyPart, responseBodyPart] = content.split('【Response Body】:');
      if (!requestBodyPart || !responseBodyPart) {
        throw new Error('无法分割请求和响应部分');
      }

      const requestBodyContent = requestBodyPart.split('【Request Body】:')[1];
      if (!requestBodyContent) {
        throw new Error('无法找到请求体内容');
      }

      const requestJson = JSON.parse(requestBodyContent.trim());
      const { messages, ...otherProps } = requestJson;

      const parsedMessages = Array.isArray(messages) 
        ? messages.map(parseMessage)
        : [];

      const responseJson = JSON.parse(responseBodyPart.trim());

      return { requestProps: otherProps, messages: parsedMessages, response: responseJson };
    } catch (error) {
      console.error('解析内容时出错:', error);
      return { requestProps: {}, messages: [], response: {} };
    }
  }, []);

  const parseMessage = useCallback((message) => {
    const { role, content, ...otherMessageProps } = message;
    const parsedContent = Array.isArray(content)
      ? content.map(parseContentItem)
      : [{ type: 'text', text: content?.trim() || '' }];

    return {
      role,
      content: parsedContent,
      otherProps: Object.keys(otherMessageProps).length > 0 ? otherMessageProps : null
    };
  }, []);

  const parseContentItem = useCallback((item) => {
    if (typeof item === 'string') {
      return { type: 'text', text: item.trim() };
    } else if (item.type === 'text') {
      return { type: 'text', text: item.text.trim() };
    } else if (item.type === 'image_url') {
      return { type: 'image', url: item.image_url.url };
    }
    return { type: 'text', text: JSON.stringify(item) };
  }, []);

  const { requestProps, messages, response } = useMemo(() => parseContent(content), [content, parseContent]);

  const sections = useMemo(() => [
    { id: 'request', title: '请求属性' },
    { 
      id: 'conversation', 
      title: '对话历史',
      subSections: messages.map((message, index) => ({ 
        id: `message-${index}`, 
        title: message.role === 'system' ? '预设提示词' : 
               message.role === 'user' ? `用户消息 ${index + 1}` : 
               `AI助手消息 ${index + 1}` 
      }))
    },
    { id: 'response', title: 'AI 响应' }
  ], [messages]);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -80% 0px',
      threshold: 0,
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = useCallback((sectionId) => {
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleConversationClick = useCallback(() => {
    setOpenConversation(prev => !prev);
  }, []);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: '80%', md: '70%' }, bgcolor: 'background.default' },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 头部区域 */}
        <Box sx={{
          display: 'flex',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          // 移除固定高度
        }}>
          <Box sx={{
            width: '15vw',
            minWidth: '200px',
            maxWidth: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: '1px solid',
            borderColor: 'divider',
          }}>
            <Typography variant="h4" fontWeight="bold" color="primary.main">
              目录
            </Typography>
          </Box>
          <Box sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
          }}>
            <Typography variant="h4" fontWeight="bold" color="primary">日志详情</Typography>
            <IconButton onClick={onClose} color="primary" sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* 内容区域 */}
        <Box sx={{ 
          display: 'flex',
          flexGrow: 1,
          overflow: 'hidden', // 防止内容溢出
        }}>
          {/* 导航侧边栏 */}
          <Box sx={{ 
            width: '15vw', 
            minWidth: '200px',
            maxWidth: '300px',
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper', 
            overflowY: 'auto',
          }}>
            <List disablePadding>
              {sections.map((section) => (
                <React.Fragment key={section.id}>
                  <ListItem 
                    button 
                    onClick={() => section.id === 'conversation' ? handleConversationClick() : scrollToSection(section.id)}
                    sx={{ 
                      bgcolor: activeSection === section.id ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <ListItemText 
                      primary={section.title} 
                      primaryTypographyProps={{
                        noWrap: true,
                        fontWeight: activeSection === section.id ? 'bold' : 'medium',
                        color: activeSection === section.id ? 'primary.main' : 'text.primary',
                      }}
                    />
                    {section.id === 'conversation' && (openConversation ? <ExpandLess color="action" /> : <ExpandMore color="action" />)}
                  </ListItem>
                  {section.id === 'conversation' && (
                    <Collapse in={openConversation} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        {section.subSections.map((subSection) => (
                          <ListItem 
                            button 
                            key={subSection.id}
                            onClick={() => scrollToSection(subSection.id)}
                            sx={{ 
                              pl: 4, 
                              bgcolor: activeSection === subSection.id ? 'primary.light' : 'transparent',
                              '&:hover': { bgcolor: 'primary.light' },
                              borderBottom: '1px solid #e0e0e0',
                            }}
                          >
                            <ListItemText 
                              primary={subSection.title} 
                              primaryTypographyProps={{ 
                                fontSize: '0.9rem',
                                fontWeight: activeSection === subSection.id ? 'bold' : 'normal',
                                color: activeSection === subSection.id ? 'primary.main' : 'inherit',
                                noWrap: true,
                              }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  )}
                </React.Fragment>
              ))}
            </List>
          </Box>

          {/* 主要内容区域 */}
          <Box sx={{ 
            flexGrow: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
            <Box sx={{ 
              p: 3, 
              maxWidth: '70vw', // 添加这行
              margin: '0 auto', // 添加这行
            }}>
              {/* 请求属性部分 */}
              <Box id="request" ref={(el) => sectionRefs.current['request'] = el}>
                <Typography variant="h5" fontWeight="bold" color="primary" sx={{ mb: 2 }}>请求属性</Typography>
                <CopyablePanel
                  title="请求属性"
                  content={requestProps}
                  sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}
                />
              </Box>

              {/* 对话历史部分 */}
              <Box id="conversation" ref={(el) => sectionRefs.current['conversation'] = el}>
                <Typography variant="h5" fontWeight="bold" color="primary" sx={{ mb: 2 }}>对话历史</Typography>
                {messages.map((message, index) => (
                  <Box key={index} id={`message-${index}`} ref={(el) => sectionRefs.current[`message-${index}`] = el}>
                    <Card sx={{ 
                      bgcolor: message.role === 'user' ? 'primary.light' : 
                               message.role === 'system' ? 'info.light' : 'secondary.light', 
                      borderRadius: 2, 
                      boxShadow: 1,
                      mb: 2
                    }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom fontWeight="bold" color={
                          message.role === 'user' ? 'primary.dark' : 
                          message.role === 'system' ? 'info.dark' : 'secondary.dark'
                        }>
                          {message.role === 'user' ? '用户' : 
                           message.role === 'system' ? '预设提示词' : 'AI助手'} 
                          {message.role !== 'system' && ` - 消息 ${index + 1}`}
                        </Typography>
                        {message.content && message.content.length > 0 && (
                          <CopyablePanel
                            title="内容"
                            content={message.content}
                            defaultView="formatted"
                            sx={{ bgcolor: 'rgba(255, 255, 255, 0.7)' }}
                          />
                        )}
                        {message.otherProps && Object.keys(message.otherProps).length > 0 && (
                          <CopyablePanel
                            title="其他属性"
                            content={message.otherProps}
                            sx={{ bgcolor: 'rgba(255, 255, 255, 0.7)', mt: 2 }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>

              {/* AI 响应部分 */}
              <Box id="response" ref={(el) => sectionRefs.current['response'] = el}>
                <Typography variant="h5" fontWeight="bold" color="primary" sx={{ mb: 2 }}>AI 响应</Typography>
                <CopyablePanel
                  title="响应内容"
                  content={response}
                  defaultView="formatted"
                  isAIResponse={true}
                  sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

export default LogContentDrawer;
