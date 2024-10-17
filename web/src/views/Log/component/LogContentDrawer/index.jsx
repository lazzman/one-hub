import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Drawer, Box, IconButton, Snackbar, Alert, useTheme, useMediaQuery } from '@mui/material';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import BuildIcon from '@mui/icons-material/Build';

// 子组件
import NavigationSidebar from './NavigationSidebar';
import RequestSection from './RequestSection';
import ConversationSection from './ConversationSection';
import ResponseSection from './ResponseSection';

// 工具函数
import { debounce, parseContent } from './utils';
import { convertToOpenAICurl, convertToClaudeCurl, convertToGeminiCurl } from './formatConverters';

/**
 * 日志内容抽屉组件
 * 用于展示请求和响应的详细内容
 */
const LogContentDrawer = ({ open, onClose, content }) => {
  const [activeSection, setActiveSection] = useState('');
  const [openConversation, setOpenConversation] = useState(true);
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

  // 复制请求体到剪贴板（三种 curl 格式）
  const handleCopyRequestBody = useCallback(
    async (format) => {
      try {
        const { normalized } = parseContent(content);
        let textToCopy;
        let formatName;

        // 使用 One Hub baseUrl 作为默认端点
        const options = { useOfficial: false };

        switch (format) {
          case 'openai-curl':
            textToCopy = convertToOpenAICurl(normalized, options);
            formatName = 'OpenAI curl';
            break;
          case 'claude-curl':
            textToCopy = convertToClaudeCurl(normalized, options);
            formatName = 'Claude curl';
            break;
          case 'gemini-curl':
            textToCopy = convertToGeminiCurl(normalized, options);
            formatName = 'Gemini curl';
            break;
          default:
            return;
        }

        await navigator.clipboard.writeText(textToCopy);
        showMessage(`已复制为 ${formatName} 命令`, 'success');
      } catch (error) {
        console.error('复制失败:', error);
        showMessage('复制失败，请重试', 'error');
      }
    },
    [content, showMessage]
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
  const debouncedScrollToSection = useCallback(
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

  // 处理对话历史点击
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

  // 解析内容
  const { requestProps, messages, response, rawResponseBody } = useMemo(() => parseContent(content), [content]);

  // 构建导航部分
  const sections = useMemo(
    () => [
      {
        id: 'request',
        title: '请求属性',
        icon: <SettingsIcon sx={{ mr: 1 }} />
      },
      {
        id: 'conversation',
        title: '对话历史',
        icon: <ChatIcon sx={{ mr: 1 }} />,
        subSections: messages.map((message, index) => ({
          id: `message-${index}`,
          title:
            message.role === 'system'
              ? `预设提示词 ${index + 1}`
              : message.role === 'user'
                ? `用户消息 ${index + 1}`
                : message.role === 'tool'
                  ? `工具消息 ${index + 1}`
                  : `AI助手消息 ${index + 1}`,
          icon:
            message.role === 'system' ? (
              <MenuBookIcon sx={{ mr: 1 }} />
            ) : message.role === 'user' ? (
              <PersonIcon sx={{ mr: 1 }} />
            ) : message.role === 'tool' ? (
              <BuildIcon sx={{ mr: 1 }} />
            ) : (
              <SmartToyIcon sx={{ mr: 1 }} />
            )
        }))
      },
      {
        id: 'response',
        title: 'AI 响应',
        icon: <AutoAwesomeIcon sx={{ mr: 1 }} />
      }
    ],
    [messages]
  );

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

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

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
              showNav={showNav}
              isMobile={isMobile}
              isAnimating={isAnimating}
              onNavToggle={handleNavToggle}
              onNavItemClick={handleNavItemClick}
              onConversationClick={handleConversationClick}
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

              {/* 请求属性部分 */}
              <RequestSection
                ref={(el) => (sectionRefs.current['request'] = el)}
                requestProps={requestProps}
                onCopyRequestBody={handleCopyRequestBody}
              />

              {/* 对话历史部分 */}
              <ConversationSection
                ref={(el) => (sectionRefs.current['conversation'] = el)}
                messages={messages}
                sectionRefs={sectionRefs}
              />

              {/* AI 响应部分 */}
              <ResponseSection ref={(el) => (sectionRefs.current['response'] = el)} response={response} rawResponseBody={rawResponseBody} />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 复制成功提示 */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
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

export default LogContentDrawer;
