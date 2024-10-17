import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';

const ROOT_PATH = '$';
const INDENT_PX = 20;
const MAX_PREVIEW_LENGTH = 72;

const isObjectLike = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const isNavigableJson = (value) => Array.isArray(value) || isObjectLike(value);

const formatJsonPath = (parentPath, key, parentIsArray) => {
  if (parentPath === ROOT_PATH && key === ROOT_PATH) {
    return ROOT_PATH;
  }

  if (parentIsArray) {
    return `${parentPath}[${key}]`;
  }

  const normalizedKey = String(key);
  if (/^[A-Za-z_$][\w$]*$/.test(normalizedKey)) {
    return `${parentPath}.${normalizedKey}`;
  }

  return `${parentPath}[${JSON.stringify(normalizedKey)}]`;
};

const formatPrimitivePreview = (value, maxLength = MAX_PREVIEW_LENGTH) => {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== 'string') {
    return String(value);
  }

  if (serialized.length <= maxLength) {
    return serialized;
  }

  return `${serialized.slice(0, Math.max(0, maxLength - 1))}…`;
};

const formatValueTypeLabel = (value) => {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
};

const buildSummary = (value) => {
  if (Array.isArray(value)) {
    return `${value.length} items`;
  }
  if (isObjectLike(value)) {
    return `${Object.keys(value).length} keys`;
  }
  return formatPrimitivePreview(value);
};

const buildSearchText = (path, label, value) => {
  return [path, label, buildSummary(value), formatPrimitivePreview(value, 160)].filter(Boolean).join(' ').toLowerCase();
};

export const normalizeSearchFilterQuery = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

export const buildSearchModel = (inputValue) => {
  const normalizedInputValue = typeof inputValue === 'string' ? inputValue : '';

  return {
    inputValue: normalizedInputValue,
    filterQuery: normalizeSearchFilterQuery(normalizedInputValue)
  };
};

export const buildDeferredSearchState = (searchQuery, deferredSearchInput) => ({
  inputValue: typeof searchQuery === 'string' ? searchQuery : '',
  filterQuery: normalizeSearchFilterQuery(deferredSearchInput)
});

export const buildTreeNode = (value, options = {}) => {
  const { path = ROOT_PATH, label = 'root', depth = 0, parentIsArray = false } = options;
  const type = formatValueTypeLabel(value);
  const children = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      children.push(
        buildTreeNode(item, {
          path: formatJsonPath(path, index, true),
          label: `[${index}]`,
          depth: depth + 1,
          parentIsArray: true
        })
      );
    });
  } else if (isObjectLike(value)) {
    Object.entries(value).forEach(([key, childValue]) => {
      children.push(
        buildTreeNode(childValue, {
          path: formatJsonPath(path, key, false),
          label: key,
          depth: depth + 1,
          parentIsArray: false
        })
      );
    });
  }

  return {
    path,
    label,
    depth,
    type,
    value,
    summary: buildSummary(value),
    searchText: buildSearchText(path, label, value),
    parentIsArray,
    children
  };
};

export const filterTreeNode = (node, query) => {
  if (!query) {
    return node;
  }

  const filteredChildren = node.children.map((child) => filterTreeNode(child, query)).filter(Boolean);
  const matchesSelf = node.searchText.includes(query);

  if (matchesSelf || filteredChildren.length > 0) {
    return {
      ...node,
      children: filteredChildren
    };
  }

  return null;
};

const flattenTreePaths = (node, collector = []) => {
  if (!node) {
    return collector;
  }

  collector.push(node.path);
  node.children.forEach((child) => flattenTreePaths(child, collector));
  return collector;
};

const countTreeNodes = (node) => {
  if (!node) {
    return 0;
  }

  return 1 + node.children.reduce((total, child) => total + countTreeNodes(child), 0);
};

const flattenTreeNodes = (node) => {
  if (!node) {
    return [];
  }

  return [node, ...node.children.flatMap((child) => flattenTreeNodes(child))];
};

const getValueColor = (type) => {
  switch (type) {
    case 'string':
      return 'success.main';
    case 'number':
      return 'info.main';
    case 'boolean':
      return 'warning.main';
    case 'null':
      return 'text.secondary';
    default:
      return 'text.primary';
  }
};

const JsonBodyNode = ({ node, isLast, activePath, flashPath, onSelectPath, registerPathRef }) => {
  const isContainer = Array.isArray(node.value) || isObjectLike(node.value);
  const isRoot = node.path === ROOT_PATH;
  const lineIndent = node.depth * INDENT_PX;
  const isActive = activePath === node.path;
  const isFlashing = flashPath === node.path;
  const keyLabel = isRoot ? '' : node.parentIsArray ? '' : `${JSON.stringify(node.label)}: `;
  const openToken = Array.isArray(node.value) ? '[' : isObjectLike(node.value) ? '{' : '';
  const closeToken = Array.isArray(node.value) ? ']' : isObjectLike(node.value) ? '}' : '';

  const rowSx = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 0.5,
    px: 1,
    py: 0.35,
    ml: `${lineIndent}px`,
    borderLeft: '2px solid',
    borderColor: isActive ? 'primary.main' : 'transparent',
    borderRadius: 1,
    backgroundColor: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
    animation: isFlashing ? 'jsonPathFlash 1.4s ease' : 'none',
    '@keyframes jsonPathFlash': {
      '0%': {
        backgroundColor: 'rgba(59,130,246,0.18)'
      },
      '100%': {
        backgroundColor: isActive ? 'rgba(59,130,246,0.1)' : 'transparent'
      }
    },
    '&:hover': {
      backgroundColor: isActive ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.06)'
    }
  };

  const handleSelect = () => {
    onSelectPath(node.path, { scroll: false });
  };

  if (!isContainer) {
    return (
      <Box>
        <Box ref={(element) => registerPathRef(node.path, element)} onClick={handleSelect} sx={rowSx}>
          {keyLabel && (
            <Typography component="span" sx={{ color: 'primary.main', fontSize: '0.875rem', wordBreak: 'break-word' }}>
              {keyLabel}
            </Typography>
          )}
          <Typography component="span" sx={{ color: getValueColor(node.type), fontSize: '0.875rem', wordBreak: 'break-word' }}>
            {formatPrimitivePreview(node.value, 200)}
            {!isLast ? ',' : ''}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box ref={(element) => registerPathRef(node.path, element)} onClick={handleSelect} sx={rowSx}>
        {keyLabel && (
          <Typography component="span" sx={{ color: 'primary.main', fontSize: '0.875rem', wordBreak: 'break-word' }}>
            {keyLabel}
          </Typography>
        )}
        <Typography component="span" sx={{ color: 'text.primary', fontSize: '0.875rem' }}>
          {openToken}
        </Typography>
        <Chip
          label={node.summary}
          size="small"
          variant="outlined"
          sx={{
            height: 20,
            '& .MuiChip-label': {
              px: 0.75,
              fontSize: '0.7rem'
            }
          }}
        />
      </Box>
      {node.children.map((child, index) => (
        <JsonBodyNode
          key={child.path}
          node={child}
          isLast={index === node.children.length - 1}
          activePath={activePath}
          flashPath={flashPath}
          onSelectPath={onSelectPath}
          registerPathRef={registerPathRef}
        />
      ))}
      <Box onClick={handleSelect} sx={rowSx}>
        <Typography component="span" sx={{ color: 'text.primary', fontSize: '0.875rem' }}>
          {closeToken}
          {!isLast && !isRoot ? ',' : ''}
        </Typography>
      </Box>
    </Box>
  );
};

JsonBodyNode.propTypes = {
  node: PropTypes.shape({
    path: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    depth: PropTypes.number.isRequired,
    type: PropTypes.string.isRequired,
    value: PropTypes.any,
    summary: PropTypes.string.isRequired,
    parentIsArray: PropTypes.bool,
    children: PropTypes.array
  }).isRequired,
  isLast: PropTypes.bool.isRequired,
  activePath: PropTypes.string.isRequired,
  flashPath: PropTypes.string,
  onSelectPath: PropTypes.func.isRequired,
  registerPathRef: PropTypes.func.isRequired
};

const JsonTreeItem = ({ node, activePath, copiedPath, onCopyPath, onSelectPath, registerTreeItemRef }) => {
  const isActive = activePath === node.path;
  const isContainer = node.children.length > 0;
  const handleCopy = (event) => {
    event.stopPropagation();
    onCopyPath(node.path);
  };

  return (
    <Box
      ref={(element) => registerTreeItemRef(node.path, element)}
      onClick={() => onSelectPath(node.path, { scroll: true })}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.75,
        ml: `${node.depth * 10}px`,
        borderRadius: 1,
        cursor: 'pointer',
        backgroundColor: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
        transition: 'background-color 0.2s ease, transform 0.2s ease',
        '&:hover': {
          backgroundColor: isActive ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.06)',
          transform: 'translateX(2px)'
        }
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: isActive ? 700 : 500,
            color: isActive ? 'primary.main' : 'text.primary',
            fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
            wordBreak: 'break-word'
          }}
        >
          {node.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-word' }}>
          {node.path}
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Chip
          label={isContainer ? node.summary : node.type}
          size="small"
          variant={isActive ? 'filled' : 'outlined'}
          color={isActive ? 'primary' : 'default'}
          sx={{
            height: 20,
            '& .MuiChip-label': {
              px: 0.75,
              fontSize: '0.7rem'
            }
          }}
        />
        <Tooltip title="Copy path">
          <IconButton onClick={handleCopy} size="small" sx={{ opacity: isActive ? 1 : 0.6 }}>
            {copiedPath === node.path ? <CheckIcon color="success" fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
};

JsonTreeItem.propTypes = {
  node: PropTypes.shape({
    path: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    depth: PropTypes.number.isRequired,
    type: PropTypes.string.isRequired,
    summary: PropTypes.string.isRequired,
    children: PropTypes.array.isRequired
  }).isRequired,
  activePath: PropTypes.string.isRequired,
  copiedPath: PropTypes.string,
  onCopyPath: PropTypes.func.isRequired,
  onSelectPath: PropTypes.func.isRequired,
  registerTreeItemRef: PropTypes.func.isRequired
};

const JsonTreeList = ({ rootNode, activePath, copiedPath, onCopyPath, onSelectPath, registerTreeItemRef }) => {
  if (!rootNode) {
    return null;
  }

  const nodes = [rootNode, ...rootNode.children.flatMap((child) => flattenTreeNodes(child))];

  return (
    <Stack spacing={0.5}>
      {nodes.map((node) => (
        <JsonTreeItem
          key={node.path}
          node={node}
          activePath={activePath}
          copiedPath={copiedPath}
          onCopyPath={onCopyPath}
          onSelectPath={onSelectPath}
          registerTreeItemRef={registerTreeItemRef}
        />
      ))}
    </Stack>
  );
};

JsonTreeList.propTypes = {
  rootNode: PropTypes.object,
  activePath: PropTypes.string.isRequired,
  copiedPath: PropTypes.string,
  onCopyPath: PropTypes.func.isRequired,
  onSelectPath: PropTypes.func.isRequired,
  registerTreeItemRef: PropTypes.func.isRequired
};

const JsonNavigationView = ({ data }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activePath, setActivePath] = useState(ROOT_PATH);
  const [copiedPath, setCopiedPath] = useState('');
  const [flashPath, setFlashPath] = useState('');
  const bodyRef = useRef(null);
  const pathRefs = useRef({});
  const treeItemRefs = useRef({});
  const deferredSearchInput = useDeferredValue(searchQuery);
  const deferredSearchState = useMemo(() => buildDeferredSearchState(searchQuery, deferredSearchInput), [deferredSearchInput, searchQuery]);

  const treeRoot = useMemo(() => buildTreeNode(data), [data]);
  const filteredTree = useMemo(
    () => filterTreeNode(treeRoot, deferredSearchState.filterQuery),
    [treeRoot, deferredSearchState.filterQuery]
  );
  const visiblePathOrder = useMemo(() => flattenTreePaths(filteredTree, []), [filteredTree]);
  const visibleNodeCount = useMemo(() => Math.max(0, countTreeNodes(filteredTree) - 1), [filteredTree]);

  useEffect(() => {
    if (visiblePathOrder.length === 0) {
      if (activePath !== ROOT_PATH) {
        setActivePath(ROOT_PATH);
      }
      return;
    }

    if (!visiblePathOrder.includes(activePath)) {
      setActivePath(visiblePathOrder[0]);
    }
  }, [activePath, visiblePathOrder]);

  useEffect(() => {
    const activeItem = treeItemRefs.current[activePath];
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [activePath]);

  useEffect(() => {
    const container = bodyRef.current;
    if (!container || visiblePathOrder.length === 0) {
      return undefined;
    }

    let frameId = null;

    const updateActivePath = () => {
      frameId = null;
      const threshold = container.scrollTop + 24;
      let nextActivePath = visiblePathOrder[0];

      visiblePathOrder.forEach((path) => {
        const element = pathRefs.current[path];
        if (element && element.offsetTop <= threshold) {
          nextActivePath = path;
        }
      });

      setActivePath((previousPath) => (previousPath === nextActivePath ? previousPath : nextActivePath));
    };

    const handleScroll = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(updateActivePath);
    };

    updateActivePath();
    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [visiblePathOrder]);

  useEffect(() => {
    if (!flashPath) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setFlashPath('');
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [flashPath]);

  useEffect(() => {
    if (!copiedPath) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedPath('');
    }, 1600);

    return () => window.clearTimeout(timeoutId);
  }, [copiedPath]);

  const registerPathRef = (path, element) => {
    if (!element) {
      delete pathRefs.current[path];
      return;
    }

    pathRefs.current[path] = element;
  };

  const registerTreeItemRef = (path, element) => {
    if (!element) {
      delete treeItemRefs.current[path];
      return;
    }

    treeItemRefs.current[path] = element;
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleCopyPath = async (path) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
    } catch (error) {
      console.error('Failed to copy JSON path:', error);
    }
  };

  const handleSelectPath = (path, options = {}) => {
    const { scroll = false } = options;
    setActivePath(path);

    if (scroll) {
      const target = pathRefs.current[path];
      if (target && bodyRef.current) {
        bodyRef.current.scrollTo({
          top: Math.max(0, target.offsetTop - 12),
          behavior: 'smooth'
        });
        setFlashPath(path);
      }

      if (isMobile) {
        setMobileDrawerOpen(false);
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const searchField = (
    <TextField
      value={deferredSearchState.inputValue}
      onChange={handleSearchChange}
      placeholder="Search path or key"
      size="small"
      fullWidth
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: deferredSearchState.inputValue ? (
          <InputAdornment position="end">
            <Button size="small" onClick={handleClearSearch}>
              Clear
            </Button>
          </InputAdornment>
        ) : null
      }}
    />
  );

  const navigatorContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      <Stack spacing={1.25} sx={{ p: 1.5 }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            JSON Navigator
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {visibleNodeCount} visible paths
          </Typography>
        </Box>
        {searchField}
      </Stack>
      <Divider />
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 1,
          minHeight: 0
        }}
      >
        {filteredTree ? (
          <JsonTreeList
            rootNode={filteredTree}
            activePath={activePath}
            copiedPath={copiedPath}
            onCopyPath={handleCopyPath}
            onSelectPath={handleSelectPath}
            registerTreeItemRef={registerTreeItemRef}
          />
        ) : (
          <Box
            sx={{
              px: 1.5,
              py: 3,
              borderRadius: 1.5,
              border: '1px dashed',
              borderColor: 'divider',
              textAlign: 'center'
            }}
          >
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
              No matching path
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Try a different key, value type, or JSON path fragment.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip icon={<AccountTreeIcon />} label="Path-aware JSON view" variant="outlined" color="primary" />
          <Chip
            label={activePath}
            color="primary"
            variant="outlined"
            sx={{
              maxWidth: '100%',
              '& .MuiChip-label': {
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }
            }}
          />
          <Tooltip title="Copy current path">
            <IconButton onClick={() => handleCopyPath(activePath)} size="small">
              {copiedPath === activePath ? <CheckIcon color="success" fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
            </IconButton>
          </Tooltip>
        </Stack>
        {isMobile && (
          <Button variant="outlined" size="small" startIcon={<AccountTreeIcon />} onClick={() => setMobileDrawerOpen(true)}>
            Open path tree
          </Button>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'minmax(240px, 300px) minmax(0, 1fr)' },
          gap: 1.5,
          alignItems: 'stretch'
        }}
      >
        {!isMobile && (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: (currentTheme) => (currentTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.72)'),
              maxHeight: 800
            }}
          >
            {navigatorContent}
          </Box>
        )}
        <Box
          ref={bodyRef}
          sx={{
            overflow: 'auto',
            p: 1.25,
            bgcolor: (currentTheme) => (currentTheme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'grey.100'),
            color: (currentTheme) => (currentTheme.palette.mode === 'dark' ? 'text.primary' : 'inherit'),
            borderRadius: 1,
            maxHeight: 800,
            fontSize: '0.875rem',
            lineHeight: 1.6,
            fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
            scrollBehavior: 'smooth',
            '&::-webkit-scrollbar': {
              height: '8px',
              width: '8px'
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: (currentTheme) => (currentTheme.palette.mode === 'dark' ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.2)'),
              borderRadius: '4px'
            }
          }}
        >
          {filteredTree ? (
            <JsonBodyNode
              node={filteredTree}
              isLast
              activePath={activePath}
              flashPath={flashPath}
              onSelectPath={handleSelectPath}
              registerPathRef={registerPathRef}
            />
          ) : (
            <Box
              sx={{
                px: 2,
                py: 4,
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1.5,
                textAlign: 'center'
              }}
            >
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                No JSON nodes match the current search.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Clear the filter to restore the full raw payload.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Drawer
        anchor="right"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            width: 'min(88vw, 360px)',
            maxWidth: '360px'
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1.25 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            JSON Navigator
          </Typography>
          <IconButton onClick={() => setMobileDrawerOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />
        {navigatorContent}
      </Drawer>
    </Box>
  );
};

JsonNavigationView.propTypes = {
  data: PropTypes.oneOfType([PropTypes.object, PropTypes.array]).isRequired
};

export const extractNavigableJson = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isNavigableJson(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isNavigableJson(value) ? value : null;
};

export default JsonNavigationView;
