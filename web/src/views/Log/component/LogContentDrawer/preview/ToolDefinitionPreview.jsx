import React, { useState, useMemo } from 'react';
import { Box, IconButton, Tooltip, Typography, Tabs, Tab, useTheme } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SettingsIcon from '@mui/icons-material/Settings';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionIcon from '@mui/icons-material/Description';
import PreviewModal from './PreviewModal';

/**
 * 格式化 JSON 内容
 * @param {any} content - 要格式化的内容
 * @returns {string} 格式化后的 JSON 字符串
 */
function formatJson(content) {
  if (content === undefined || content === null) {
    return 'null';
  }
  
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }
  
  return JSON.stringify(content, null, 2);
}

/**
 * 提取工具定义的标准化信息
 * 支持 OpenAI、Claude、Gemini 格式
 * @param {Object} tool - 工具定义对象
 * @returns {Object} 标准化的工具信息
 */
function extractToolInfo(tool) {
  if (!tool || typeof tool !== 'object') {
    return { name: '未知工具', description: '', parameters: null };
  }

  // OpenAI 格式: { type: "function", function: { name, description, parameters } }
  if (tool.type === 'function' && tool.function) {
    return {
      name: tool.function.name || '未知工具',
      description: tool.function.description || '',
      parameters: tool.function.parameters || tool.function.strict ? { ...tool.function.parameters, strict: tool.function.strict } : tool.function.parameters
    };
  }

  // Claude 格式: { name, description, input_schema }
  if (tool.name && tool.input_schema) {
    return {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.input_schema
    };
  }

  // Gemini 格式: { name, description, parameters } (在 functionDeclarations 中)
  if (tool.name && (tool.parameters || tool.description)) {
    return {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || null
    };
  }

  // 直接格式 (兼容简单定义)
  return {
    name: tool.name || '未知工具',
    description: tool.description || '',
    parameters: tool.parameters || tool.input_schema || null
  };
}

/**
 * 工具定义内容组件
 */
const ToolDefinitionContent = ({ tool, theme }) => {
  const [copied, setCopied] = useState(false);
  
  const toolInfo = useMemo(() => extractToolInfo(tool), [tool]);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatJson(tool));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };
  
  return (
    <Box
      sx={{
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(156, 39, 176, 0.05)' : 'rgba(156, 39, 176, 0.03)',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(156, 39, 176, 0.2)' : 'rgba(156, 39, 176, 0.15)',
        borderRadius: 2,
        p: 2
      }}
    >
      {/* 描述区域 */}
      {toolInfo.description && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <DescriptionIcon sx={{ fontSize: 16 }} color="action" />
            <Typography variant="caption" color="text.secondary">
              描述 (Description)
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              p: 1.5,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
              borderRadius: 1,
              whiteSpace: 'pre-wrap'
            }}
          >
            {toolInfo.description}
          </Typography>
        </Box>
      )}
      
      {/* 参数区域 */}
      {toolInfo.parameters && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CodeIcon sx={{ fontSize: 16 }} color="action" />
              <Typography variant="caption" color="text.secondary">
                参数定义 (Parameters)
              </Typography>
            </Box>
            <Tooltip title={copied ? '已复制' : '复制工具定义'}>
              <IconButton size="small" onClick={handleCopy}>
                {copied ? <CheckIcon color="success" fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
          <Box
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'auto',
              p: 1.5,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
              borderRadius: 1,
              maxHeight: '400px',
              fontSize: '0.8rem',
              lineHeight: 1.5,
              fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
              m: 0
            }}
          >
            {formatJson(toolInfo.parameters)}
          </Box>
        </Box>
      )}
      
      {/* 如果没有参数定义，显示完整工具定义 */}
      {!toolInfo.parameters && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CodeIcon sx={{ fontSize: 16 }} color="action" />
              <Typography variant="caption" color="text.secondary">
                工具定义 (Definition)
              </Typography>
            </Box>
            <Tooltip title={copied ? '已复制' : '复制工具定义'}>
              <IconButton size="small" onClick={handleCopy}>
                {copied ? <CheckIcon color="success" fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
          <Box
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'auto',
              p: 1.5,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
              borderRadius: 1,
              maxHeight: '400px',
              fontSize: '0.8rem',
              lineHeight: 1.5,
              fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
              m: 0
            }}
          >
            {formatJson(tool)}
          </Box>
        </Box>
      )}
    </Box>
  );
};

/**
 * 工具定义预览组件
 * 展示工具定义的详细信息（名称、描述、参数）
 * 统一使用 Tab 标签页展示
 * @param {Object} props
 * @param {Array} props.tools - 工具定义数组
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 */
const ToolDefinitionPreview = ({ tools = [], open, onClose }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  
  const title = `工具定义 (${tools.length})`;

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <PreviewModal open={open} onClose={onClose} title={title}>
      <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        {tools.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography>没有工具定义数据</Typography>
          </Box>
        ) : (
          <Box>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                mb: 2,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  minWidth: 'auto',
                  px: 2
                }
              }}
            >
              {tools.map((tool, index) => {
                const info = extractToolInfo(tool);
                return (
                  <Tab
                    key={index}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <SettingsIcon sx={{ fontSize: 16 }} />
                        <span>{info.name}</span>
                      </Box>
                    }
                  />
                );
              })}
            </Tabs>
            {tools.map((tool, index) => (
              <Box key={index} hidden={activeTab !== index}>
                {activeTab === index && (
                  <ToolDefinitionContent
                    tool={tool}
                    theme={theme}
                  />
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </PreviewModal>
  );
};

export default ToolDefinitionPreview;