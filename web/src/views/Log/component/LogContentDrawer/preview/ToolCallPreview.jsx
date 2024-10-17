import React, { useState, useMemo } from 'react';
import { Box, IconButton, Tooltip, Typography, Chip, Divider, useTheme, Tabs, Tab } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import BuildIcon from '@mui/icons-material/Build';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import PreviewModal from './PreviewModal';

/**
 * 格式化 JSON 内容
 * @param {any} content - 要格式化的内容
 * @returns {string} 格式化后的 JSON 字符串
 */
function formatContent(content) {
  if (content === undefined || content === null) {
    return 'null';
  }
  
  if (typeof content === 'string') {
    // 尝试解析为 JSON
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
 * 工具调用内容组件
 */
const ToolCallContent = ({ toolCall, theme }) => {
  const [copied, setCopied] = useState(false);
  
  // 格式化参数
  const formattedArgs = useMemo(() => {
    const args = toolCall.arguments || toolCall.input || toolCall.args;
    return formatContent(args);
  }, [toolCall]);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedArgs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };
  
  return (
    <Box
      sx={{
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.05)' : 'rgba(255, 152, 0, 0.03)',
        border: '1px solid',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(255, 152, 0, 0.15)',
        borderRadius: 2,
        p: 2
      }}
    >
      {/* ID 显示 */}
      {toolCall.id && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            工具调用 ID
          </Typography>
          <Tooltip title={`完整 ID: ${toolCall.id}`} arrow>
            <Chip
              label={toolCall.id}
              size="small"
              variant="outlined"
              sx={{
                ml: 1,
                height: 20,
                fontSize: '0.7rem',
                maxWidth: '300px',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              }}
            />
          </Tooltip>
        </Box>
      )}
      
      {/* 参数区域 */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            参数 (Arguments)
          </Typography>
          <Tooltip title={copied ? '已复制' : '复制参数'}>
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
          {formattedArgs}
        </Box>
      </Box>
    </Box>
  );
};

/**
 * 工具结果内容组件
 */
const ToolResultContent = ({ toolResult, theme }) => {
  const [copied, setCopied] = useState(false);
  
  // 格式化内容
  const formattedContent = useMemo(() => {
    const content = toolResult.content || toolResult.response;
    return formatContent(content);
  }, [toolResult]);
  
  // 获取工具 ID 或名称
  const toolId = toolResult.toolCallId || toolResult.toolUseId || toolResult.name || '未知';
  const isError = toolResult.isError;
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };
  
  return (
    <Box
      sx={{
        bgcolor: isError
          ? (theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.05)' : 'rgba(244, 67, 54, 0.03)')
          : (theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.05)' : 'rgba(76, 175, 80, 0.03)'),
        border: '1px solid',
        borderColor: isError
          ? (theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.15)')
          : (theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.15)'),
        borderRadius: 2,
        p: 2
      }}
    >
      {/* ID 和状态显示 */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          工具调用 ID:
        </Typography>
        <Tooltip title={`完整 ID: ${toolId}`} arrow>
          <Chip
            label={toolId}
            size="small"
            variant="outlined"
            color={isError ? 'error' : 'success'}
            sx={{
              height: 20,
              fontSize: '0.7rem',
              maxWidth: '300px',
              '& .MuiChip-label': {
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }
            }}
          />
        </Tooltip>
        {isError && (
          <Chip
            label="错误"
            size="small"
            color="error"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        )}
      </Box>
      
      {/* 结果内容区域 */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            结果内容
          </Typography>
          <Tooltip title={copied ? '已复制' : '复制结果'}>
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
          {formattedContent}
        </Box>
      </Box>
    </Box>
  );
};

/**
 * 工具调用预览组件
 * 展示工具调用和工具结果的详细信息
 * 统一使用 Tab 标签页展示
 * @param {Object} props
 * @param {Array} props.toolCalls - 工具调用数组
 * @param {Array} props.toolResults - 工具结果数组
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {string} props.mode - 模式：'calls' | 'results' | 'both'
 */
const ToolCallPreview = ({ toolCalls = [], toolResults = [], open, onClose, mode = 'both' }) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  
  const showCalls = mode === 'calls' || mode === 'both';
  const showResults = mode === 'results' || mode === 'both';
  
  // 确定标题
  const title = useMemo(() => {
    if (mode === 'calls') return `工具调用 (${toolCalls.length})`;
    if (mode === 'results') return `工具结果 (${toolResults.length})`;
    return '工具调用与结果';
  }, [mode, toolCalls.length, toolResults.length]);

  // 构建 Tab 项目列表
  const tabItems = useMemo(() => {
    const items = [];
    
    if (showCalls && toolCalls.length > 0) {
      toolCalls.forEach((toolCall, index) => {
        items.push({
          type: 'call',
          data: toolCall,
          label: toolCall.name || `工具调用 ${index + 1}`,
          icon: <BuildIcon sx={{ fontSize: 16 }} color="warning" />
        });
      });
    }
    
    if (showResults && toolResults.length > 0) {
      toolResults.forEach((toolResult, index) => {
        const isError = toolResult.isError;
        items.push({
          type: 'result',
          data: toolResult,
          label: `结果 ${index + 1}`,
          icon: <AssignmentTurnedInIcon sx={{ fontSize: 16 }} color={isError ? 'error' : 'success'} />,
          isError
        });
      });
    }
    
    return items;
  }, [showCalls, showResults, toolCalls, toolResults]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <PreviewModal open={open} onClose={onClose} title={title}>
      <Box sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        {tabItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography>没有工具调用或结果数据</Typography>
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
              {tabItems.map((item, index) => (
                <Tab
                  key={index}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {item.icon}
                      <span>{item.label}</span>
                    </Box>
                  }
                />
              ))}
            </Tabs>
            {tabItems.map((item, index) => (
              <Box key={index} hidden={activeTab !== index}>
                {activeTab === index && (
                  item.type === 'call' ? (
                    <ToolCallContent
                      toolCall={item.data}
                      theme={theme}
                    />
                  ) : (
                    <ToolResultContent
                      toolResult={item.data}
                      theme={theme}
                    />
                  )
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </PreviewModal>
  );
};

export default ToolCallPreview;