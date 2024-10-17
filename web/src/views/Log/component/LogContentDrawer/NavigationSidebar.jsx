import React from 'react';
import { Box, List, ListItem, ListItemText, Collapse, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLess from '@mui/icons-material/ExpandMore';
import ExpandMore from '@mui/icons-material/ExpandLess';

/**
 * 导航侧边栏组件
 * 用于展示内容导航菜单
 */
const NavigationSidebar = ({
  sections,
  activeSection,
  openConversation,
  showNav,
  isMobile,
  isAnimating,
  onNavToggle,
  onNavItemClick,
  onConversationClick
}) => {
  if (!isMobile && !showNav) {
    // 桌面端始终显示
  }

  if (isMobile && !showNav) {
    return null;
  }

  return (
    <Box
      sx={{
        width: { xs: '80%', sm: '15vw' },
        minWidth: { sm: '200px' },
        maxWidth: { sm: '300px' },
        borderRight: '1px solid',
        borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.95)'),
        backdropFilter: isMobile ? 'none' : 'blur(8px)',
        overflowY: 'auto',
        position: isMobile ? 'fixed' : 'relative',
        top: isMobile ? 0 : 'auto',
        bottom: 0,
        left: 0,
        zIndex: isMobile ? 1050 : 'auto',
        transition: isAnimating ? 'transform 0.3s ease-in-out' : 'none',
        transform: isMobile && !showNav ? 'translateX(-100%)' : 'translateX(0)',
        willChange: isMobile ? 'transform' : 'auto',
        height: isMobile ? '100%' : 'auto'
      }}
    >
      {/* 移动端导航关闭按钮 */}
      {isMobile && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            p: 1,
            borderBottom: '1px solid',
            borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
          }}
        >
          <IconButton onClick={onNavToggle} color="primary" disabled={isAnimating} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      )}
      <List disablePadding>
        {sections.map((section) => (
          <React.Fragment key={section.id}>
            <ListItem
              onClick={() => (section.id === 'conversation' ? onConversationClick() : onNavItemClick(section.id))}
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
            {section.id === 'conversation' && section.subSections && (
              <Collapse in={openConversation} timeout={300}>
                <List component="div" disablePadding>
                  {section.subSections.map((subSection) => (
                    <ListItem
                      key={subSection.id}
                      onClick={() => onNavItemClick(subSection.id)}
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
  );
};

export default NavigationSidebar;
