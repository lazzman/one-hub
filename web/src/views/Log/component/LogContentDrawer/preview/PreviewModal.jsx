import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Box, IconButton, Typography, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

/**
 * 通用预览弹窗容器组件
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {string} props.title - 标题
 * @param {string} props.subtitle - 副标题
 * @param {React.ReactNode} props.children - 子内容
 * @param {boolean} props.fullWidth - 是否全宽
 * @param {React.ReactNode} props.toolbar - 工具栏内容
 */
const PreviewModal = ({ open, onClose, title, subtitle = '', children, fullWidth = false, toolbar }) => {
  const theme = useTheme();

  return (
    <Modal
      open={open}
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 1, sm: 2 },
        '& .MuiBackdrop-root': {
          backdropFilter: 'blur(6px)',
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.74)' : 'rgba(15,23,42,0.28)'
        }
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: fullWidth ? '96vw' : { xs: '96vw', sm: '88vw', md: '76vw', lg: '68vw', xl: '60vw' },
          maxWidth: fullWidth ? '1600px' : '1280px',
          maxHeight: '92vh',
          bgcolor: 'background.paper',
          borderRadius: 3,
          boxShadow: theme.palette.mode === 'dark' ? '0 24px 80px rgba(0,0,0,0.55)' : '0 24px 80px rgba(15,23,42,0.18)',
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalFadeIn 0.2s ease-out',
          '@keyframes modalFadeIn': {
            from: {
              opacity: 0,
              transform: 'translateY(8px) scale(0.98)'
            },
            to: {
              opacity: 1,
              transform: 'translateY(0) scale(1)'
            }
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
            px: { xs: 2, sm: 3 },
            py: 2,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(248,250,252,0.9)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.35 }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            {toolbar}
            <IconButton
              onClick={onClose}
              size="small"
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
                }
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: { xs: 2, sm: 2.5 },
            overflow: 'auto',
            flexGrow: 1,
            bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.96)',
            '&::-webkit-scrollbar': {
              width: '10px',
              height: '10px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.18)',
              borderRadius: '999px',
              border: '2px solid transparent',
              backgroundClip: 'padding-box'
            }
          }}
        >
          {children}
        </Box>
      </Box>
    </Modal>
  );
};

PreviewModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  fullWidth: PropTypes.bool,
  toolbar: PropTypes.node
};

export default PreviewModal;
