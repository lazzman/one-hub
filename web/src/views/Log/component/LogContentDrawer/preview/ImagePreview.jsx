import React, { useState, useRef } from 'react';
import { Box, IconButton, Typography, Tooltip, useTheme } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import BrokenImageIcon from '@mui/icons-material/BrokenImage';
import PreviewModal from './PreviewModal';

/**
 * 图片预览组件
 * 支持缩放、旋转、下载、多图片导航
 * @param {Object} props
 * @param {Array} props.images - 图片数组 [{content: url, path: string}]
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 */
const ImagePreview = ({ images, open, onClose }) => {
  const theme = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef(null);

  // 当前图片
  const currentImage = images?.[currentIndex];
  const imageUrl = currentImage?.content || currentImage;
  const hasMultipleImages = images?.length > 1;

  // 重置状态
  const resetState = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setLoading(true);
    setError(false);
  };

  // 切换图片
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetState();
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetState();
    }
  };

  // 缩放
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // 旋转
  const handleRotateLeft = () => setRotation((prev) => prev - 90);
  const handleRotateRight = () => setRotation((prev) => prev + 90);

  // 下载
  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `image-${currentIndex + 1}.${blob.type.split('/')[1] || 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('下载失败:', err);
    }
  };

  // 滚轮缩放
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY;
    const scaleChange = delta > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(Math.max(prev + scaleChange, 0.5), 3));
  };

  // 拖拽
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 工具栏
  const toolbar = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {/* 缩放控制 */}
      <Tooltip title="缩小">
        <span>
          <IconButton size="small" onClick={handleZoomOut} disabled={scale <= 0.5}>
            <ZoomOutIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="body2" sx={{ minWidth: 45, textAlign: 'center' }}>
        {Math.round(scale * 100)}%
      </Typography>
      <Tooltip title="放大">
        <span>
          <IconButton size="small" onClick={handleZoomIn} disabled={scale >= 3}>
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Box sx={{ width: 1, height: 20, bgcolor: 'divider', mx: 1 }} />

      {/* 旋转控制 */}
      <Tooltip title="向左旋转">
        <IconButton size="small" onClick={handleRotateLeft}>
          <RotateLeftIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="向右旋转">
        <IconButton size="small" onClick={handleRotateRight}>
          <RotateRightIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ width: 1, height: 20, bgcolor: 'divider', mx: 1 }} />

      {/* 重置和下载 */}
      <Tooltip title="重置">
        <IconButton size="small" onClick={handleResetZoom}>
          <RestartAltIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="下载">
        <IconButton size="small" onClick={handleDownload}>
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <PreviewModal
      open={open}
      onClose={onClose}
      title={hasMultipleImages ? `图片预览 (${currentIndex + 1}/${images.length})` : '图片预览'}
      fullWidth
      toolbar={toolbar}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
          borderRadius: 1,
          // 棋盘格背景（用于透明图片）
          backgroundImage:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a), linear-gradient(45deg, #2a2a2a 25%, transparent 25%, transparent 75%, #2a2a2a 75%, #2a2a2a)'
              : 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0), linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 10px 10px'
        }}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 多图片导航 - 上一张 */}
        {hasMultipleImages && (
          <IconButton
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            sx={{
              position: 'absolute',
              left: 8,
              zIndex: 10,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)',
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.95)'
              }
            }}
          >
            <NavigateBeforeIcon />
          </IconButton>
        )}

        {/* 图片 */}
        {error ? (
          <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
            <BrokenImageIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
            <Typography>图片加载失败</Typography>
          </Box>
        ) : (
          <img
            ref={imageRef}
            src={imageUrl}
            alt={`Preview ${currentIndex + 1}`}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              opacity: loading ? 0 : 1
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            onMouseDown={handleMouseDown}
            draggable={false}
          />
        )}

        {/* 加载中 */}
        {loading && !error && (
          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography color="text.secondary">加载中...</Typography>
          </Box>
        )}

        {/* 多图片导航 - 下一张 */}
        {hasMultipleImages && (
          <IconButton
            onClick={handleNext}
            disabled={currentIndex === images.length - 1}
            sx={{
              position: 'absolute',
              right: 8,
              zIndex: 10,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)',
              '&:hover': {
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.95)'
              }
            }}
          >
            <NavigateNextIcon />
          </IconButton>
        )}
      </Box>

      {/* 多图片缩略图导航 */}
      {hasMultipleImages && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 1,
            mt: 2,
            flexWrap: 'wrap'
          }}
        >
          {images.map((img, index) => (
            <Box
              key={index}
              onClick={() => {
                setCurrentIndex(index);
                resetState();
              }}
              sx={{
                width: 60,
                height: 60,
                borderRadius: 1,
                overflow: 'hidden',
                cursor: 'pointer',
                border: 2,
                borderColor: index === currentIndex ? 'primary.main' : 'transparent',
                opacity: index === currentIndex ? 1 : 0.6,
                transition: 'all 0.2s ease',
                '&:hover': {
                  opacity: 1
                }
              }}
            >
              <img
                src={img.content || img}
                alt={`Thumbnail ${index + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </Box>
          ))}
        </Box>
      )}
    </PreviewModal>
  );
};

export default ImagePreview;