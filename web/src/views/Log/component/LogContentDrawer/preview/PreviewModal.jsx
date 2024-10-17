import React from 'react';
import { Modal, Box, IconButton, Typography, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * 通用预览弹窗容器组件
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {string} props.title - 标题
 * @param {React.ReactNode} props.children - 子内容
 * @param {boolean} props.fullWidth - 是否全宽
 * @param {React.ReactNode} props.toolbar - 工具栏内容
 */
const PreviewModal = ({ open, onClose, title, children, fullWidth = false, toolbar }) => {
  const theme = useTheme();

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '& .MuiBackdrop-root': {
          backdropFilter: 'blur(4px)',
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)'
        }
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: fullWidth ? '95vw' : { xs: '95vw', sm: '85vw', md: '70vw', lg: '60vw' },
          maxWidth: fullWidth ? '95vw' : '1200px',
          maxHeight: '90vh',
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 24,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalFadeIn 0.2s ease-out',
          '@keyframes modalFadeIn': {
            from: {
              opacity: 0,
              transform: 'scale(0.95)'
            },
            to: {
              opacity: 1,
              transform: 'scale(1)'
            }
          }
        }}
      >
        {/* 标题栏 */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
          }}
        >
          <Typography variant="h6" fontWeight="bold">
            {title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {toolbar}
            <IconButton
              onClick={onClose}
              size="small"
              sx={{
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* 内容区域 */}
        <Box
          sx={{
            p: 2,
            overflow: 'auto',
            flexGrow: 1,
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
              borderRadius: '4px'
            }
          }}
        >
          {children}
        </Box>
      </Box>
    </Modal>
  );
};

export default PreviewModal;