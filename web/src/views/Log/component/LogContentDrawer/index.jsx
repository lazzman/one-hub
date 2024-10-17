import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Drawer, Box, IconButton, Snackbar, Alert, useTheme, useMediaQuery, Chip, Stack } from '@mui/material';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import BuildIcon from '@mui/icons-material/Build';
import ImageIcon from '@mui/icons-material/Image';
import TimelineIcon from '@mui/icons-material/Timeline';

// 子组件
import NavigationSidebar from './NavigationSidebar';
import RequestSection from './RequestSection';
import ConversationSection, { getConversationMessageMeta } from './ConversationSection';
import ResponseSection from './ResponseSection';

// 工具函数
import { debounce, parseContent } from './utils';
import { convertToResponsesCurl, convertToOpenAICurl, convertToClaudeCurl, convertToGeminiCurl } from './formatConverters';

/**
 * 日志内容抽屉组件
 * 用于展示请求和响应的详细内容
 */
const LogContentDrawer = ({ open, onClose, content }) => {
  const [activeSection, setActiveSection] = useState('');
  const [openConversation, setOpenConversation] = useState(true);
  const [openResponse, setOpenResponse] = useState(true);
  const [showNav, setShowNav] = useState(false);
  const sectionRefs = useRef({});
  const contentRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isAnimating, setIsAnimating] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // 关闭 Snackbar
  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // 显示提示消息
  const showMessage = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // 解析内容（统一模型）
  const parsedContent = useMemo(() => parseContent(content), [content]);
  const {
    protocol,
    viewModel,
    requestProps,
    rawRequestBody,
    response,
    rawResponseBody,
    request,
    toolCalls,
    reasoning,
    media,
    capabilities,
    flags,
    source,
    linearTrace,
    normalized,
    request: parsedRequest
  } = parsedContent;

  // 复制请求体到剪贴板（三种 curl 格式）
  const handleCopyRequestBody = useCallback(
    async (format) => {
      try {
        const requestForConversion = parsedRequest?.normalized || normalized;
        let textToCopy;
        let formatName;

        if (format === 'raw-request') {
          textToCopy = typeof parsedRequest?.raw === 'string' && parsedRequest.raw.trim() ? parsedRequest.raw : '';
          formatName = '原始请求';
          if (!textToCopy) {
            showMessage('没有可复制的原始请求', 'warning');
            return;
          }
        } else {
          const options = { useOfficial: false };

          switch (format) {
            case 'responses-curl':
              textToCopy = convertToResponsesCurl(requestForConversion, options);
              formatName = 'Responses curl';
              break;
            case 'openai-curl':
              textToCopy = convertToOpenAICurl(requestForConversion, options);
              formatName = 'OpenAI curl';
              break;
            case 'claude-curl':
              textToCopy = convertToClaudeCurl(requestForConversion, options);
              formatName = 'Claude curl';
              break;
            case 'gemini-curl':
              textToCopy = convertToGeminiCurl(requestForConversion, options);
              formatName = 'Gemini curl';
              break;
            default:
              return;
          }
        }

        await navigator.clipboard.writeText(textToCopy);
        showMessage(`已复制${formatName}`, 'success');
      } catch (error) {
        console.error('复制失败:', error);
        showMessage('复制失败，请重试', 'error');
      }
    },
    [normalized, parsedRequest, showMessage]
  );

  // 优化导航切换性能和滚动位置保持
  const handleNavToggle = useCallback(() => {
    if (isMobile) {
      // 保存当前滚动位置
      if (contentRef.current) {
        scrollPositionRef.current = contentRef.current.scrollTop;
      }

      setIsAnimating(true);
      setShowNav((prev) => !prev);

      // 动画结束后恢复滚动位置
      setTimeout(() => {
        setIsAnimating(false);
        if (contentRef.current) {
          contentRef.current.scrollTop = scrollPositionRef.current;
        }
      }, 300);
    }
  }, [isMobile]);

  // 优化滚动性能
  const debouncedScrollToSection = useMemo(
    () =>
      debounce((sectionId) => {
        if (sectionRefs.current[sectionId]) {
          const sectionElement = sectionRefs.current[sectionId];
          const contentElement = contentRef.current;

          if (contentElement) {
            const sectionTop = sectionElement.offsetTop;
            contentElement.scrollTo({
              top: sectionTop - 80, // 考虑头部高度
              behavior: 'smooth'
            });
          }
        }
      }, 100),
    []
  );

  useEffect(() => {
    return () => {
      if (typeof debouncedScrollToSection.cancel === 'function') {
        debouncedScrollToSection.cancel();
      }
    };
  }, [debouncedScrollToSection]);

  // 处理输入消息点击
  const handleConversationClick = useCallback(() => {
    setOpenConversation((prev) => !prev);
  }, []);

  // 处理导航项点击
  const handleNavItemClick = useCallback(
    (sectionId) => {
      // 保存目标滚动位置
      if (sectionRefs.current[sectionId]) {
        scrollPositionRef.current = sectionRefs.current[sectionId].offsetTop - 80;
      }

      // 如果是移动端，先关闭导航
      if (isMobile) {
        handleNavToggle();
        // 等待导航关闭动画完成后滚动到目标位置
        setTimeout(() => {
          debouncedScrollToSection(sectionId);
        }, 350);
      } else {
        debouncedScrollToSection(sectionId);
      }
    },
    [isMobile, handleNavToggle, debouncedScrollToSection]
  );

  // 处理 AI 响应点击（展开/折叠）
  const handleResponseClick = useCallback(() => {
    setOpenResponse((prev) => !prev);
  }, []);

  // 解析内容（统一模型）
  const unifiedMessages = useMemo(() => {
    return Array.isArray(viewModel?.messages) ? viewModel.messages : [];
  }, [viewModel]);

  const orderedConversationMessages = useMemo(() => {
    const systemMessages = [];
    const developerMessages = [];
    const historyMessages = [];

    unifiedMessages.forEach((message) => {
      const role = typeof message?.role === 'string' ? message.role.toLowerCase() : '';
      if (role === 'system') {
        systemMessages.push(message);
      } else if (role === 'developer') {
        developerMessages.push(message);
      } else {
        historyMessages.push(message);
      }
    });

    return [...systemMessages, ...developerMessages, ...historyMessages];
  }, [unifiedMessages]);

  const conversationSubSections = useMemo(
    () =>
      orderedConversationMessages.map((message, index) => {
        const messageMeta = getConversationMessageMeta(message, index);
        const icon =
          messageMeta.iconType === 'system' ? (
            <MenuBookIcon sx={{ mr: 1 }} />
          ) : messageMeta.iconType === 'user' ? (
            <PersonIcon sx={{ mr: 1 }} />
          ) : messageMeta.iconType === 'tool_call' || messageMeta.iconType === 'tool_result' ? (
            <BuildIcon sx={{ mr: 1 }} />
          ) : (
            <SmartToyIcon sx={{ mr: 1 }} />
          );

        return {
          id: `message-${index}`,
          title: messageMeta.navTitle,
          icon,
          kind: messageMeta.kind
        };
      }),
    [orderedConversationMessages]
  );

  const finalAssistantText = useMemo(() => {
    const responseFinalText = typeof viewModel?.response?.finalText === 'string' ? viewModel.response.finalText.trim() : '';
    return responseFinalText;
  }, [viewModel]);

  const conversationFallbackRaw = useMemo(() => {
    if (typeof request?.raw === 'string' && request.raw.trim()) {
      return request.raw;
    }
    if (typeof rawRequestBody === 'string' && rawRequestBody.trim()) {
      return rawRequestBody;
    }
    return typeof content === 'string' ? content : '';
  }, [request, rawRequestBody, content]);

  const normalizedReasoning = Array.isArray(reasoning)
    ? reasoning.filter((item) => typeof item?.text === 'string' && item.text.trim())
    : [];
  const visibleReasoning = normalizedReasoning;

  const hasReasoning = Boolean(capabilities?.reasoning) && visibleReasoning.length > 0;
  const hasToolCalls = Boolean(capabilities?.tools) && Array.isArray(toolCalls) && toolCalls.length > 0;
  const hasMedia = Boolean(capabilities?.media) && Array.isArray(media) && media.length > 0;
  const hasFinalAnswer = Boolean(capabilities?.finalAnswer) && Boolean(finalAssistantText);
  const hasTrace = Boolean(capabilities?.trace) && Array.isArray(linearTrace) && linearTrace.length > 0;
  const hasRawResponse = Boolean(capabilities?.rawResponse) && Boolean(rawResponseBody?.trim?.() || viewModel?.response?.raw);

  const summaryItems = useMemo(
    () => [source?.protocol, source?.provider, source?.channelName, source?.isStream ? 'stream' : 'non-stream'].filter(Boolean),
    [source]
  );

  // 构建导航部分
  const sections = useMemo(() => {
    const responseChildren = [];

    if (hasFinalAnswer) {
      responseChildren.push({
        id: 'response-final-answer',
        title: 'Final Answer',
        icon: <AutoAwesomeIcon sx={{ mr: 1 }} />
      });
    }

    if (hasReasoning) {
      responseChildren.push({
        id: 'response-reasoning',
        title: 'Reasoning',
        icon: <AutoAwesomeIcon sx={{ mr: 1 }} />
      });
    }

    if (hasToolCalls) {
      responseChildren.push({
        id: 'response-tool-calls',
        title: '工具调用',
        icon: <BuildIcon sx={{ mr: 1 }} />
      });
    }

    if (hasMedia) {
      responseChildren.push({
        id: 'response-media',
        title: '多模态片段',
        icon: <ImageIcon sx={{ mr: 1 }} />
      });
    }

    if (hasTrace) {
      responseChildren.push({
        id: 'response-linear-trace',
        title: 'Linear Trace',
        icon: <TimelineIcon sx={{ mr: 1 }} />
      });
    }

    if (hasRawResponse) {
      responseChildren.push({
        id: 'response-raw',
        title: 'Raw Response',
        icon: <MenuBookIcon sx={{ mr: 1 }} />
      });
    }

    return [
      {
        id: 'request',
        title: '请求属性',
        icon: <SettingsIcon sx={{ mr: 1 }} />
      },
      {
        id: 'conversation',
        title: '输入消息',
        icon: <ChatIcon sx={{ mr: 1 }} />,
        subSections: conversationSubSections
      },
      {
        id: 'response',
        title: 'AI 响应',
        icon: <AutoAwesomeIcon sx={{ mr: 1 }} />,
        children: responseChildren.length > 0 ? responseChildren : undefined
      }
    ];
  }, [conversationSubSections, hasFinalAnswer, hasReasoning, hasToolCalls, hasMedia, hasTrace, hasRawResponse]);

  // 监听滚动位置更新活动部分
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -80% 0px',
      threshold: 0
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    Object.values(sectionRefs.current).forEach((sectionRef) => {
      if (sectionRef) observer.observe(sectionRef);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          top: { xs: '56px', sm: '64px' },
          height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' }
        }
      }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '90%', md: '80%', lg: '70%' },
          top: { xs: '56px', sm: '64px' },
          height: { xs: 'calc(100% - 56px)', sm: 'calc(100% - 64px)' },
          bgcolor: 'transparent',
          backgroundImage: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #1a1b1e 0%, #2d2d2d 100%)'
              : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none'
          }
        }
      }}
      SlideProps={{
        timeout: isMobile ? 200 : { enter: 400, exit: 300 }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 内容区域 */}
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* 导航侧边栏 */}
          {(!isMobile || showNav) && (
            <NavigationSidebar
              sections={sections}
              activeSection={activeSection}
              openConversation={openConversation}
              openResponse={openResponse}
              showNav={showNav}
              isMobile={isMobile}
              isAnimating={isAnimating}
              onNavToggle={handleNavToggle}
              onNavItemClick={handleNavItemClick}
              onConversationClick={handleConversationClick}
              onResponseClick={handleResponseClick}
            />
          )}

          {/* 主要内容区域 */}
          <Box
            ref={contentRef}
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.9)'),
              backdropFilter: isMobile ? 'none' : 'blur(8px)',
              width: '100%',
              position: 'relative',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth'
            }}
          >
            <Box
              sx={{
                p: { xs: 2, sm: 3 },
                maxWidth: { xs: '100%', sm: '90%', md: '80%', lg: '70%' },
                margin: '0 auto',
                minHeight: '100%'
              }}
            >
              {/* 移动端导航切换按钮（浮动） */}
              {isMobile && !showNav && (
                <IconButton
                  onClick={handleNavToggle}
                  color="primary"
                  disabled={isAnimating}
                  sx={{
                    position: 'fixed',
                    top: { xs: '64px', sm: '72px' },
                    left: 8,
                    zIndex: 1100,
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)'),
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    '&:hover': {
                      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)')
                    }
                  }}
                >
                  <MenuOpenIcon />
                </IconButton>
              )}

              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {summaryItems.map((item) => (
                    <Chip key={item} label={item} size="small" color="primary" variant="outlined" />
                  ))}
                  {flags?.usedFallback && <Chip label="fallback" size="small" color="warning" variant="outlined" />}
                </Stack>
              </Box>

              {/* 请求属性部分 */}
              <RequestSection
                ref={(el) => (sectionRefs.current['request'] = el)}
                protocol={protocol}
                viewModel={viewModel}
                request={request}
                requestProps={requestProps}
                rawRequestBody={rawRequestBody}
                onCopyRequestBody={handleCopyRequestBody}
              />

              {/* 输入消息部分 */}
              <ConversationSection
                ref={(el) => (sectionRefs.current['conversation'] = el)}
                messages={orderedConversationMessages}
                fallbackRaw={conversationFallbackRaw}
                sectionRefs={sectionRefs}
              />

              {/* AI 响应部分 */}
              <ResponseSection
                ref={(el) => (sectionRefs.current['response'] = el)}
                protocol={protocol}
                viewModel={viewModel}
                response={response}
                rawResponseBody={rawResponseBody}
                finalAssistantText={finalAssistantText}
                toolCalls={toolCalls}
                reasoning={visibleReasoning}
                media={media}
                linearTrace={linearTrace}
                sectionRefs={sectionRefs}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 复制成功提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{
            width: '100%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            '& .MuiAlert-icon': {
              fontSize: '1.25rem'
            }
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Drawer>
  );
};

LogContentDrawer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
};

export default LogContentDrawer;
