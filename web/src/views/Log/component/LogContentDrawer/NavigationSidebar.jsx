import React from 'react';
import PropTypes from 'prop-types';
import { Box, List, ListItem, ListItemText, Collapse, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

/**
 * 导航侧边栏组件
 * 用于展示内容导航菜单
 */
const NavigationSidebar = ({
  sections,
  activeSection,
  openRequest,
  openConversation,
  openResponse,
  openTrace,
  showNav,
  isMobile,
  isAnimating,
  onNavToggle,
  onNavItemClick,
  onRequestClick,
  onConversationClick,
  onResponseClick,
  onTraceClick
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
              onClick={() => {
                if (section.id === 'request' && Array.isArray(section.children) && section.children.length > 0) {
                  onRequestClick();
                  return;
                }
                if (section.id === 'conversation') {
                  onConversationClick();
                  return;
                }
                if (section.id === 'response' && Array.isArray(section.children) && section.children.length > 0) {
                  onResponseClick();
                  return;
                }
                if (section.id === 'trace' && Array.isArray(section.children) && section.children.length > 0) {
                  onTraceClick();
                  return;
                }
                onNavItemClick(section.id);
              }}
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
              {section.id === 'request' &&
                Array.isArray(section.children) &&
                section.children.length > 0 &&
                (openRequest ? <ExpandLess color="action" /> : <ExpandMore color="action" />)}
              {section.id === 'response' &&
                Array.isArray(section.children) &&
                section.children.length > 0 &&
                (openResponse ? <ExpandLess color="action" /> : <ExpandMore color="action" />)}
              {section.id === 'trace' &&
                Array.isArray(section.children) &&
                section.children.length > 0 &&
                (openTrace ? <ExpandLess color="action" /> : <ExpandMore color="action" />)}
            </ListItem>
            {section.id === 'request' && Array.isArray(section.children) && section.children.length > 0 && (
              <Collapse in={openRequest} timeout={300}>
                <List component="div" disablePadding>
                  {section.children.map((childSection) => (
                    <ListItem
                      key={childSection.id}
                      onClick={() => onNavItemClick(childSection.id)}
                      sx={{
                        pl: 4,
                        bgcolor: activeSection === childSection.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
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
                        {childSection.icon}
                        <ListItemText
                          primary={childSection.title}
                          primaryTypographyProps={{
                            fontSize: '0.9rem',
                            fontWeight: activeSection === childSection.id ? 'bold' : 'normal',
                            color: activeSection === childSection.id ? 'primary.main' : 'text.secondary',
                            noWrap: true
                          }}
                        />
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            )}
            {section.id === 'conversation' && section.subSections && section.subSections.length > 0 && (
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
                                : subSection.kind === 'user'
                                  ? 'primary.dark'
                                  : subSection.kind === 'system'
                                    ? 'info.dark'
                                    : subSection.kind === 'tool_call' || subSection.kind === 'tool_result'
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
            {section.id === 'response' && Array.isArray(section.children) && section.children.length > 0 && (
              <Collapse in={openResponse} timeout={300}>
                <List component="div" disablePadding>
                  {section.children.map((childSection) => (
                    <ListItem
                      key={childSection.id}
                      onClick={() => onNavItemClick(childSection.id)}
                      sx={{
                        pl: 4,
                        bgcolor: activeSection === childSection.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
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
                        {childSection.icon}
                        <ListItemText
                          primary={childSection.title}
                          primaryTypographyProps={{
                            fontSize: '0.9rem',
                            fontWeight: activeSection === childSection.id ? 'bold' : 'normal',
                            color: activeSection === childSection.id ? 'primary.main' : 'secondary.dark',
                            noWrap: true
                          }}
                        />
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            )}
            {section.id === 'trace' && Array.isArray(section.children) && section.children.length > 0 && (
              <Collapse in={openTrace} timeout={300}>
                <List component="div" disablePadding>
                  {section.children.map((childSection) => (
                    <ListItem
                      key={childSection.id}
                      onClick={() => onNavItemClick(childSection.id)}
                      sx={{
                        pl: 4,
                        bgcolor: activeSection === childSection.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
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
                        {childSection.icon}
                        <ListItemText
                          primary={childSection.title}
                          primaryTypographyProps={{
                            fontSize: '0.9rem',
                            fontWeight: activeSection === childSection.id ? 'bold' : 'normal',
                            color: activeSection === childSection.id ? 'primary.main' : 'warning.dark',
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

NavigationSidebar.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      icon: PropTypes.node,
      kind: PropTypes.string,
      subSections: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          title: PropTypes.string,
          icon: PropTypes.node,
          kind: PropTypes.string
        })
      ),
      children: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          title: PropTypes.string,
          icon: PropTypes.node
        })
      )
    })
  ),
  activeSection: PropTypes.string,
  openRequest: PropTypes.bool,
  openConversation: PropTypes.bool,
  openResponse: PropTypes.bool,
  openTrace: PropTypes.bool,
  showNav: PropTypes.bool,
  isMobile: PropTypes.bool,
  isAnimating: PropTypes.bool,
  onNavToggle: PropTypes.func,
  onNavItemClick: PropTypes.func,
  onRequestClick: PropTypes.func,
  onConversationClick: PropTypes.func,
  onResponseClick: PropTypes.func,
  onTraceClick: PropTypes.func
};

export default NavigationSidebar;
