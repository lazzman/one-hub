import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Drawer,
  IconButton,
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  Modal,
  Collapse,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLess from '@mui/icons-material/ExpandMore';
import ExpandMore from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CodeIcon from '@mui/icons-material/Code';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ListAltIcon from '@mui/icons-material/ListAlt';
import DescriptionIcon from '@mui/icons-material/Description';
import BuildIcon from '@mui/icons-material/Build';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';

const ImagePreview = ({ url }) => {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 }); // 添加位置状态
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef(null);

  const handleOpen = () => {
    setOpen(true);
    resetImagePosition();
  };

  const handleClose = () => {
    setOpen(false);
    setError(null);
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setScale(1);

  const handleRotateLeft = () => setRotation((prev) => prev - 90);
  const handleRotateRight = () => setRotation((prev) => prev + 90);

  const handleDownload = async () => {
    try {
      setLoading(true);
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = url.split('/').pop() || 'image';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(objectUrl);
      setLoading(false);
    } catch (err) {
      setError('下载失败，请重试');
      setLoading(false);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    const scaleChange = delta > 0 ? -0.1 : 0.1;
    const newScale = Math.min(Math.max(scale + scaleChange, 0.5), 3);

    // 计算鼠标相对于图片的位置
    const rect = imageRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 计算新的位置，使缩放以鼠标位置为中心
    if (newScale !== scale) {
      const scaleRatio = newScale / scale;
      const newX = mouseX - (mouseX - position.x) * scaleRatio;
      const newY = mouseY - (mouseY - position.y) * scaleRatio;

      setScale(newScale);
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      // 只响应左键
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      e.target.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = (e) => {
    setIsDragging(false);
    e.target.style.cursor = 'grab';
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (imageRef.current) {
        imageRef.current.style.cursor = 'grab';
      }
    }
  };

  const resetImagePosition = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          display: 'inline-block',
          transition: 'transform 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.02)',
            '& .MuiIconButton-root': {
              opacity: 1,
              transform: 'scale(1)'
            }
          }
        }}
      >
        <img
          src={url}
          alt="Content"
          style={{
            maxWidth: '100%',
            height: 'auto',
            cursor: 'pointer',
            borderRadius: '8px',
            boxShadow: (theme) => `0 4px 8px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'}`,
            transition: 'all 0.3s ease-in-out'
          }}
          onClick={handleOpen}
        />
        <IconButton
          onClick={handleOpen}
          size="small"
          className="MuiIconButton-root"
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)'),
            backdropFilter: 'blur(4px)',
            transform: 'scale(0.9)',
            opacity: 0,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,1)'),
              transform: 'scale(1.1) !important'
            }
          }}
        >
          <ZoomInIcon />
        </IconButton>
      </Box>
      <Modal
        open={open}
        onClose={handleClose}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(8px)',
            backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)')
          }
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '95vw', // 增加宽度
            height: '90vh', // 增加高度
            display: 'flex',
            flexDirection: 'column',
            transform: 'scale(0.95)',
            opacity: 0,
            animation: 'modalFadeIn 0.3s ease-out forwards',
            '@keyframes modalFadeIn': {
              to: {
                transform: 'scale(1)',
                opacity: 1
              }
            }
          }}
        >
          {/* 工具栏 */}
          <Box
            sx={{
              position: 'absolute',
              top: -48,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 1,
              bgcolor: 'background.paper',
              borderRadius: '24px',
              padding: '4px 12px', // 增加内边距
              boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.4)' : '0 4px 6px rgba(0,0,0,0.1)'),
              zIndex: 1
            }}
          >
            {/* 缩放信息 */}
            <Typography
              variant="body2"
              sx={{
                minWidth: 40,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7
              }}
            >
              {Math.round(scale * 100)}%
            </Typography>

            {/* 原有的工具按钮 */}
            <IconButton size="small" onClick={handleZoomOut} disabled={scale <= 0.5}>
              <RemoveIcon />
            </IconButton>
            <IconButton size="small" onClick={handleResetZoom} disabled={scale === 1}>
              <RestartAltIcon />
            </IconButton>
            <IconButton size="small" onClick={handleZoomIn} disabled={scale >= 3}>
              <AddIcon />
            </IconButton>
            <Box sx={{ width: 1, bgcolor: 'divider', mx: 1 }} />
            <IconButton size="small" onClick={handleRotateLeft}>
              <RotateLeftIcon />
            </IconButton>
            <Typography
              variant="body2"
              sx={{
                minWidth: 40,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.7
              }}
            >
              {rotation}°
            </Typography>
            <IconButton size="small" onClick={handleRotateRight}>
              <RotateRightIcon />
            </IconButton>
            <Box sx={{ width: 1, bgcolor: 'divider', mx: 1 }} />
            <IconButton
              size="small"
              onClick={handleDownload}
              disabled={loading}
              color={error ? 'error' : 'default'}
              title={error || '下载图片'}
            >
              <DownloadIcon />
            </IconButton>
          </Box>

          {/* 图片容器 */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'),
              borderRadius: 2,
              p: 2,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: (theme) =>
                  `linear-gradient(45deg, ${theme.palette.mode === 'dark' ? '#1a1a1a' : '#f0f0f0'} 25%, transparent 25%, transparent 75%, ${
                    theme.palette.mode === 'dark' ? '#1a1a1a' : '#f0f0f0'
                  } 75%, ${theme.palette.mode === 'dark' ? '#1a1a1a' : '#f0f0f0'})`,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 10px 10px',
                opacity: 0.1
              }
            }}
            onWheel={handleWheel}
          >
            <img
              ref={imageRef}
              src={url}
              alt="Full size content"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                WebkitUserDrag: 'none'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              draggable={false}
            />
          </Box>

          {/* 重置按钮 */}
          {(scale !== 1 || rotation !== 0 || position.x !== 0 || position.y !== 0) && (
            <IconButton
              onClick={resetImagePosition}
              size="small"
              sx={{
                position: 'absolute',
                left: -20,
                top: -20,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'),
                boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 2px 4px rgba(0,0,0,0.4)' : '0 2px 4px rgba(0,0,0,0.2)'),
                '&:hover': {
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,1)'),
                  transform: 'scale(1.1)'
                },
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <RestartAltIcon />
            </IconButton>
          )}

          {/* 关闭按钮 */}
          <IconButton
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: -20,
              top: -20,
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)'),
              boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 2px 4px rgba(0,0,0,0.4)' : '0 2px 4px rgba(0,0,0,0.2)'),
              '&:hover': {
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,1)'),
                transform: 'scale(1.1)'
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Modal>
    </>
  );
};

const ImageWithLoading = ({ url }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <Box sx={{ position: 'relative', width: '100%', minHeight: 200 }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => theme.palette.mode === 'dark' 
              ? 'rgba(255,255,255,0.05)' 
              : 'rgba(0,0,0,0.03)',
            borderRadius: 1
          }}
        >
          <CircularProgress size={40} />
        </Box>
      )}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => theme.palette.mode === 'dark' 
              ? 'rgba(255,255,255,0.05)' 
              : 'rgba(0,0,0,0.03)',
            borderRadius: 1
          }}
        >
          <BrokenImageIcon sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
          <Typography variant="body2" color="text.secondary">
            图片加载失败
          </Typography>
        </Box>
      )}
      <ImagePreview 
        url={url} 
        sx={{ 
          opacity: loading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out'
        }}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </Box>
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

  const toggleViewMode = () => setViewMode((prev) => (prev === 'formatted' ? 'raw' : 'formatted'));

  const renderContent = () => {
    if (viewMode === 'raw') {
      return JSON.stringify(content, null, 2);
    }

    try {
      if (typeof content === 'object' && content.type === 'json' && typeof content?.content !== 'object') {
        const jsonData = JSON.parse(content.content);

        // DALL-E 图片生成响应格式
        if (jsonData.data && Array.isArray(jsonData.data) && jsonData.data[0]?.url) {
          return jsonData.data.map((item, index) => (
            <Box 
              key={index} 
              sx={{ 
                mb: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%'
              }}
            >
              <Box sx={{ maxWidth: '60%', width: 'fit-content' }}>
                <ImageWithLoading url={item.url} />
              </Box>
              {item.revised_prompt && (
                <Typography 
                  sx={{ 
                    mt: 1,
                    p: 1.5,
                    maxWidth: '80%',
                    width: '100%',
                    bgcolor: (theme) => theme.palette.mode === 'dark' 
                      ? 'rgba(255,255,255,0.05)' 
                      : 'rgba(0,0,0,0.03)',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.1)',
                    textAlign: 'center'
                  }}
                >
                  {item.revised_prompt}
                </Typography>
              )}
            </Box>
          ));
        }

        // TTS 音频生成响应格式
        if (jsonData.audio) {
          return (
            <Box 
              sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                gap: 2
              }}
            >
              <audio 
                controls 
                src={jsonData.audio} 
                style={{ width: '80%', maxWidth: '500px' }}
              />
              {jsonData.text && (
                <Typography 
                  sx={{ 
                    p: 1.5,
                    maxWidth: '80%',
                    width: '100%',
                    bgcolor: (theme) => theme.palette.mode === 'dark' 
                      ? 'rgba(255,255,255,0.05)' 
                      : 'rgba(0,0,0,0.03)',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.1)',
                    textAlign: 'center'
                  }}
                >
                  {jsonData.text}
                </Typography>
              )}
            </Box>
          );
        }

        // 视频生成响应格式
        if (jsonData.video) {
          return (
            <Box 
              sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                gap: 2
              }}
            >
              <video 
                controls 
                src={jsonData.video}
                style={{ 
                  width: '80%', 
                  maxWidth: '800px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              />
              {jsonData.description && (
                <Typography 
                  sx={{ 
                    p: 1.5,
                    maxWidth: '80%',
                    width: '100%',
                    bgcolor: (theme) => theme.palette.mode === 'dark' 
                      ? 'rgba(255,255,255,0.05)' 
                      : 'rgba(0,0,0,0.03)',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.1)',
                    textAlign: 'center'
                  }}
                >
                  {jsonData.description}
                </Typography>
              )}
            </Box>
          );
        }

        // 图片变体/编辑响应格式
        if (jsonData.images && Array.isArray(jsonData.images)) {
          return (
            <Box 
              sx={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                gap: 3
              }}
            >
              <Box 
                sx={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 2,
                  width: '100%',
                  maxWidth: '80%'
                }}
              >
                {jsonData.images.map((url, index) => (
                  <Box key={index} sx={{ width: '100%' }}>
                    <ImageWithLoading url={url} />
                  </Box>
                ))}
              </Box>
              {jsonData.prompt && (
                <Typography 
                  sx={{ 
                    p: 1.5,
                    maxWidth: '80%',
                    width: '100%',
                    bgcolor: (theme) => theme.palette.mode === 'dark' 
                      ? 'rgba(255,255,255,0.05)' 
                      : 'rgba(0,0,0,0.03)',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(0,0,0,0.1)',
                    textAlign: 'center'
                  }}
                >
                  {jsonData.prompt}
                </Typography>
              )}
            </Box>
          );
        }
      }
    } catch (error) {
      console.error('解析模型响应失败:', error);
    }

    // 保持原有的渲染逻辑
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
    <Paper
      elevation={3}
      sx={{
        p: 2,
        mb: 2,
        position: 'relative',
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'background.default'),
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 8px 16px rgba(0,0,0,0.4)' : '0 8px 16px rgba(0,0,0,0.1)')
        },
        ...sx
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{title}</Typography>
        <Box>
          <Button
            startIcon={<CodeIcon />}
            onClick={toggleViewMode}
            size="small"
            sx={{
              mr: 1,
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-1px)'
              }
            }}
          >
            {viewMode === 'formatted' ? '查看原始' : '查看格式化'}
          </Button>
          <IconButton
            onClick={handleCopy}
            size="small"
            sx={{
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.1)'
              },
              '&:active': {
                transform: 'scale(0.95)'
              }
            }}
          >
            {copied ? (
              <CheckIcon
                color="success"
                sx={{
                  animation: 'checkmarkPop 0.3s ease-out',
                  '@keyframes checkmarkPop': {
                    '0%': { transform: 'scale(0)' },
                    '50%': { transform: 'scale(1.2)' },
                    '100%': { transform: 'scale(1)' }
                  }
                }}
              />
            ) : (
              <ContentCopyIcon />
            )}
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
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.default' : 'grey.100'),
          color: (theme) => (theme.palette.mode === 'dark' ? 'text.primary' : 'inherit'),
          borderRadius: 1,
          maxHeight: '800px',
          '&::-webkit-scrollbar': {
            height: '8px',
            width: '8px'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.2)'),
            borderRadius: '4px'
          }
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
  const [showNav, setShowNav] = useState(false);
  const sectionRefs = useRef({});
  const contentRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isAnimating, setIsAnimating] = useState(false);

  // 优化导航切换性能和滚动位置保持
  const handleNavToggle = useCallback(() => {
    if (isMobile) {
      // 保存当前滚动位置
      if (contentRef.current) {
        scrollPositionRef.current = contentRef.current.scrollTop;
      }
      
      setIsAnimating(true);
      setShowNav(prev => !prev);
      
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

  // 处理导航项点击
  const handleNavItemClick = useCallback((sectionId, isConversation = false) => {
    if (isConversation) {
      handleConversationClick();
    } else {
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
    }
  }, [isMobile, handleNavToggle, debouncedScrollToSection]);

  const parseContent = useCallback((content) => {
    try {
      // 验证输入内容
      if (!content?.trim()) {
        throw new Error('无效的内容格式');
      }

      // 提取请求和响应部分
      const [requestPart, responsePart] = extractRequestAndResponse(content);

      // 解析请求体
      const requestJson = parseRequestBody(requestPart);
      const { messages = [], ...otherProps } = requestJson;

      // 处理消息数组
      const parsedMessages = Array.isArray(messages) ? messages.map(parseMessage) : [];

      // 解析响应体
      const responseJson = parseResponseBody(responsePart);

      return {
        requestProps: otherProps,
        messages: parsedMessages,
        response: responseJson
      };
    } catch (error) {
      console.error('解析内容时出错:', error.message);
      return { requestProps: {}, messages: [], response: {} };
    }
  }, []);

  // 提取请求和响应部分
  const extractRequestAndResponse = (content) => {
    const lastIndex = content.lastIndexOf('【Response Body】:');

    // 如果找不到响应体标记，则将所有内容作为请求部分
    if (lastIndex === -1) {
      return [content, '[{"type": "text", "text": ""}]']; // 返回空的响应体JSON字符串
    }

    const requestPart = content.substring(0, lastIndex);
    const responsePart = content.substring(lastIndex + '【Response Body】:'.length);

    // 如果响应部分为空，也返回空的JSON对象字符串
    return [requestPart, responsePart.trim() || '[{"type": "text", "text": ""}]'];
  };

  // 解析请求体
  const parseRequestBody = (requestPart) => {
    const match = requestPart.match(/【Request Body】:([\s\S]*)/);
    if (!match?.[1]?.trim()) {
      throw new Error('无法找到请求体内容');
    }

    try {
      return JSON.parse(match[1].trim());
    } catch {
      throw new Error('请求体内容不是有效的JSON格式');
    }
  };

  // 解析响应体
  const parseResponseBody = (responsePart) => {
    try {
      return JSON.parse(responsePart.trim());
    } catch {
      throw new Error('响应体内容不是有效的JSON格式');
    }
  };

  const parseMessage = useCallback((message) => {
    const { role, content, ...otherMessageProps } = message;
    const parsedContent = Array.isArray(content) ? content.map(parseContentItem) : [{ type: 'text', text: content?.trim() || '' }];

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

  const scrollToSection = useCallback((sectionId) => {
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleConversationClick = useCallback(() => {
    setOpenConversation((prev) => !prev);
  }, []);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '90%', md: '80%', lg: '70%' },
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
        {/* 头部区域 - 移动端优化 */}
        <Box
          sx={{
            display: 'flex',
            borderBottom: '1px solid',
            borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.95)',
            backdropFilter: isMobile ? 'none' : 'blur(8px)',
            position: 'sticky',
            top: 0,
            zIndex: 1100
          }}
        >
          {isMobile ? (
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1
              }}
            >
              <IconButton 
                onClick={handleNavToggle} 
                color="primary"
                disabled={isAnimating}
              >
                {showNav ? <MenuIcon /> : <MenuOpenIcon />}
              </IconButton>
              <Typography variant="h6" color="primary" sx={{ flexGrow: 1, textAlign: 'center' }}>
                日志详情
              </Typography>
              <IconButton onClick={onClose} color="primary">
                <CloseIcon />
              </IconButton>
            </Box>
          ) : (
            // 桌面端头部布局
            <>
              <Box
                sx={{
                  width: '15vw',
                  minWidth: '200px',
                  maxWidth: '300px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: '1px solid',
                  borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                }}
              >
                <ListAltIcon sx={{ mr: 1 }} color="primary" />
                <Typography variant="h4" fontWeight="bold" color="primary.main">
                  目录
                </Typography>
              </Box>
              <Box
                sx={{
                  flexGrow: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 3
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <DescriptionIcon sx={{ mr: 1 }} color="primary" />
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    日志详情
                  </Typography>
                </Box>
                <IconButton onClick={onClose} color="primary" sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </>
          )}
        </Box>

        {/* 内容区域 - 性能优化 */}
        <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
          {/* 导航侧边栏 - 移动端优化 */}
          {(!isMobile || showNav) && (
            <Box
              sx={{
                width: { xs: '80%', sm: '15vw' },
                minWidth: { sm: '200px' },
                maxWidth: { sm: '300px' },
                borderRight: '1px solid',
                borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.95)',
                backdropFilter: isMobile ? 'none' : 'blur(8px)',
                overflowY: 'auto',
                position: isMobile ? 'fixed' : 'relative',
                top: isMobile ? '56px' : 'auto',
                bottom: 0,
                left: 0,
                zIndex: isMobile ? 1050 : 'auto',
                transition: isAnimating ? 'transform 0.3s ease-in-out' : 'none',
                transform: isMobile && !showNav ? 'translateX(-100%)' : 'translateX(0)',
                willChange: isMobile ? 'transform' : 'auto',
                height: isMobile ? 'calc(100% - 56px)' : 'auto'
              }}
            >
              <List disablePadding>
                {sections.map((section) => (
                  <React.Fragment key={section.id}>
                    <ListItem
                      onClick={() => handleNavItemClick(section.id, section.id === 'conversation')}
                      sx={{
                        bgcolor: activeSection === section.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                        transition: isAnimating ? 'all 0.2s ease' : 'none',
                        '&:hover': {
                          bgcolor: 'rgba(59, 130, 246, 0.05)',
                          transform: 'translateX(4px)'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                        {section.icon}
                        <ListItemText
                          primary={section.title}
                          primaryTypographyProps={{
                            noWrap: true,
                            fontWeight: activeSection === section.id ? 'bold' : 'medium',
                            color: activeSection === section.id ? 'primary.main' : 'text.primary'
                          }}
                        />
                      </Box>
                      {section.id === 'conversation' && (openConversation ? <ExpandLess color="action" /> : <ExpandMore color="action" />)}
                    </ListItem>
                    {section.id === 'conversation' && (
                      <Collapse in={openConversation} timeout={300}>
                        <List component="div" disablePadding>
                          {section.subSections.map((subSection) => (
                            <ListItem
                              key={subSection.id}
                              onClick={() => handleNavItemClick(subSection.id)}
                              sx={{
                                pl: 4,
                                bgcolor: activeSection === subSection.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                position: 'relative',
                                '&:hover': {
                                  bgcolor: 'rgba(59, 130, 246, 0.05)',
                                  transform: 'translateX(4px)',
                                  '&::after': {
                                    transform: 'scaleX(1)'
                                  }
                                },
                                '&::after': {
                                  content: '""',
                                  position: 'absolute',
                                  left: 0,
                                  bottom: 0,
                                  width: '100%',
                                  height: '2px',
                                  background: 'primary.main',
                                  transform: 'scaleX(0)',
                                  transformOrigin: 'left',
                                  transition: 'transform 0.3s ease'
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, pl: 1 }}>
                                {subSection.icon}
                                <ListItemText
                                  primary={subSection.title}
                                  primaryTypographyProps={{
                                    fontSize: '0.9rem',
                                    fontWeight: activeSection === subSection.id ? 'bold' : 'normal',
                                    color:
                                      activeSection === subSection.id
                                        ? 'primary.main'
                                        : subSection.title.startsWith('用户')
                                          ? 'primary.dark'
                                          : subSection.title.startsWith('预设')
                                            ? 'info.dark'
                                            : subSection.title.startsWith('工具')
                                              ? 'warning.dark'
                                              : 'secondary.dark',
                                    noWrap: true
                                  }}
                                />
                              </Box>
                            </ListItem>
                          ))}
                        </List>
                      </Collapse>
                    )}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}

          {/* 主要内容区域 - 性能优化 */}
          <Box
            ref={contentRef}
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.9)',
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
              {/* 请求属性部分 */}
              <Box id="request" ref={(el) => (sectionRefs.current['request'] = el)}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <SettingsIcon sx={{ mr: 1 }} color="primary" />
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    请求属性
                  </Typography>
                </Box>
                <CopyablePanel
                  title="内容"
                  content={requestProps}
                  sx={{
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
                    borderRadius: '12px',
                    boxShadow: (theme) =>
                      theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: (theme) =>
                        theme.palette.mode === 'dark'
                          ? '0 6px 8px rgba(0,0,0,0.3)'
                          : '0 6px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.12)'
                    }
                  }}
                />
              </Box>

              {/* 对话历史部分 */}
              <Box id="conversation" ref={(el) => (sectionRefs.current['conversation'] = el)}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <ChatIcon sx={{ mr: 1 }} color="primary" />
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    对话历史
                  </Typography>
                </Box>
                {messages.map((message, index) => (
                  <Box key={index} id={`message-${index}`} ref={(el) => (sectionRefs.current[`message-${index}`] = el)}>
                    <Card
                      sx={{
                        bgcolor: (theme) => {
                          if (theme.palette.mode === 'dark') {
                            return message.role === 'user'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : message.role === 'system'
                                ? 'rgba(14, 165, 233, 0.15)'
                                : message.role === 'tool'
                                  ? 'rgba(250, 204, 21, 0.15)' // 工具消息的暗色模式背景
                                  : 'rgba(168, 85, 247, 0.15)';
                          }
                          return message.role === 'user'
                            ? 'rgba(59, 130, 246, 0.08)'
                            : message.role === 'system'
                              ? 'rgba(14, 165, 233, 0.08)'
                              : message.role === 'tool'
                                ? 'rgba(250, 204, 21, 0.08)' // 工具消息的亮色模式背景
                                : 'rgba(168, 85, 247, 0.08)';
                        },
                        borderRadius: '12px',
                        boxShadow: (theme) =>
                          theme.palette.mode === 'dark'
                            ? '0 4px 6px rgba(0,0,0,0.2)'
                            : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
                        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: (theme) =>
                            theme.palette.mode === 'dark'
                              ? '0 6px 8px rgba(0,0,0,0.3)'
                              : '0 6px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.12)'
                        },
                        mb: 2
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          {message.role === 'system' ? (
                            <MenuBookIcon sx={{ mr: 1 }} color="info" />
                          ) : message.role === 'user' ? (
                            <PersonIcon sx={{ mr: 1 }} color="primary" />
                          ) : message.role === 'tool' ? (
                            <BuildIcon sx={{ mr: 1 }} color="warning" />
                          ) : (
                            <SmartToyIcon sx={{ mr: 1 }} color="secondary" />
                          )}
                          <Typography
                            variant="h6"
                            fontWeight="bold"
                            color={
                              message.role === 'user'
                                ? 'primary.dark'
                                : message.role === 'system'
                                  ? 'info.dark'
                                  : message.role === 'tool'
                                    ? 'warning.dark'
                                    : 'secondary.dark'
                            }
                          >
                            {message.role === 'user'
                              ? '用户'
                              : message.role === 'system'
                                ? '预设提示词'
                                : message.role === 'tool'
                                  ? '工具'
                                  : 'AI助手'}
                            {` - ${index + 1}`}
                          </Typography>
                        </Box>
                        {message.content && message.content.length > 0 && (
                          <CopyablePanel
                            title="内容"
                            content={message.content}
                            defaultView="formatted"
                            sx={{
                              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255, 255, 255, 0.7)'),
                              boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none')
                            }}
                          />
                        )}
                        {message.otherProps && Object.keys(message.otherProps).length > 0 && (
                          <CopyablePanel
                            title="其他属性"
                            content={message.otherProps}
                            sx={{
                              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255, 255, 255, 0.7)'),
                              mt: 2,
                              boxShadow: (theme) => (theme.palette.mode === 'dark' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none')
                            }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Box>
                ))}
              </Box>

              {/* AI 响应部分 */}
              <Box id="response" ref={(el) => (sectionRefs.current['response'] = el)}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AutoAwesomeIcon sx={{ mr: 1 }} color="primary" />
                  <Typography variant="h5" fontWeight="bold" color="primary">
                    AI 响应
                  </Typography>
                </Box>
                <CopyablePanel
                  title="内容"
                  content={response}
                  defaultView="formatted"
                  isAIResponse={true}
                  sx={{
                    bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
                    borderRadius: '12px',
                    boxShadow: (theme) =>
                      theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: (theme) =>
                        theme.palette.mode === 'dark'
                          ? '0 6px 8px rgba(0,0,0,0.3)'
                          : '0 6px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.12)'
                    }
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
};

// 添加 debounce 工具函数
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default LogContentDrawer;
