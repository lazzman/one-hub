import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SettingsIcon from '@mui/icons-material/Settings';

const TOOL_KIND_LABELS = {
  function: '函数',
  builtin: '内建',
  namespace: '命名空间',
  unknown: '未知'
};

const stringifyJson = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const summarizeFieldList = (fields, limit = 4) => {
  if (!Array.isArray(fields) || fields.length === 0) {
    return '必填字段：无';
  }

  if (fields.length <= limit) {
    return `必填字段：${fields.join(', ')}`;
  }

  return `必填字段：${fields.slice(0, limit).join(', ')} +${fields.length - limit}`;
};

const SchemaPreview = ({ schema, raw }) => {
  const hasSchema = schema !== undefined && schema !== null;
  const content = hasSchema ? schema : raw;
  const text = stringifyJson(content);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  if (!text) {
    return (
      <Typography variant="body2" color="text.secondary">
        未提供 schema。
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.26)' : 'rgba(15,23,42,0.03)')
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {hasSchema ? '结构定义原文' : '原始工具定义'}
        </Typography>
        <Tooltip title={copied ? '已复制' : hasSchema ? '复制结构定义' : '复制原始工具定义'}>
          <IconButton size="small" onClick={handleCopy}>
            {copied ? <CheckIcon color="success" fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0,
          px: 1.5,
          pb: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'auto',
          maxHeight: 320,
          fontSize: '0.8rem',
          lineHeight: 1.55,
          fontFamily: '"Fira Code", "Consolas", "Monaco", monospace'
        }}
      >
        {text}
      </Box>
    </Box>
  );
};

SchemaPreview.propTypes = {
  schema: PropTypes.any,
  raw: PropTypes.any
};

const ToolDefinitionCard = ({ tool }) => {
  const previewFields = Array.isArray(tool.schemaPropertyNames) ? tool.schemaPropertyNames.slice(0, 6) : [];
  const previewRequiredFields = Array.isArray(tool.requiredFields) ? tool.requiredFields.slice(0, 6) : [];
  const kindLabel = TOOL_KIND_LABELS[tool.kind] || tool.kind || '未知';
  const convertibilityLabel = tool.convertibility?.convertible ? '可转换' : '仅原协议保留';

  return (
    <Accordion
      defaultExpanded
      disableGutters
      sx={{
        border: '1px solid',
        borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)'),
        borderRadius: '14px !important',
        overflow: 'hidden',
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.88)'),
        '&:before': {
          display: 'none'
        }
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                {tool.displayName}
              </Typography>
              {tool.description ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {tool.description}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  未提供说明
                </Typography>
              )}
            </Box>
            <Chip size="small" icon={<SettingsIcon />} label={tool.path} variant="outlined" />
          </Box>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
            <Chip size="small" label={`类型：${tool.toolType}`} variant="outlined" />
            <Chip size="small" label={`分类：${kindLabel}`} variant="outlined" />
            <Chip
              size="small"
              label={convertibilityLabel}
              color={tool.convertibility?.convertible ? 'success' : 'warning'}
              variant="outlined"
            />
            {tool.kind === 'namespace' ? (
              <Chip size="small" label={`子工具：${tool.namespaceChildCount}`} color="info" variant="outlined" />
            ) : null}
            {tool.schemaSummary ? <Chip size="small" label={tool.schemaSummary} color="secondary" variant="outlined" /> : null}
            <Chip
              size="small"
              label={summarizeFieldList(tool.requiredFields)}
              color={Array.isArray(tool.requiredFields) && tool.requiredFields.length > 0 ? 'warning' : 'default'}
              variant="outlined"
            />
          </Stack>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {previewRequiredFields.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
              必填字段
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {previewRequiredFields.map((field) => (
                <Chip key={`${tool.path}-required-${field}`} size="small" label={field} color="warning" variant="outlined" />
              ))}
              {tool.requiredFields.length > previewRequiredFields.length ? (
                <Chip size="small" label={`+${tool.requiredFields.length - previewRequiredFields.length}`} variant="outlined" />
              ) : null}
            </Stack>
          </Box>
        )}

        {previewFields.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
              参数字段
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {previewFields.map((field) => (
                <Chip key={`${tool.path}-${field}`} size="small" label={field} />
              ))}
              {tool.schemaPropertyNames.length > previewFields.length ? (
                <Chip size="small" label={`+${tool.schemaPropertyNames.length - previewFields.length}`} variant="outlined" />
              ) : null}
            </Stack>
          </Box>
        )}

        <SchemaPreview schema={tool.schema} raw={tool.raw} />
      </AccordionDetails>
    </Accordion>
  );
};

ToolDefinitionCard.propTypes = {
  tool: PropTypes.shape({
    name: PropTypes.string,
    displayName: PropTypes.string,
    description: PropTypes.string,
    schema: PropTypes.any,
    raw: PropTypes.any,
    path: PropTypes.string,
    toolType: PropTypes.string,
    kind: PropTypes.string,
    convertibility: PropTypes.shape({
      convertible: PropTypes.bool,
      reason: PropTypes.string
    }),
    namespaceChildCount: PropTypes.number,
    schemaSummary: PropTypes.string,
    schemaPropertyNames: PropTypes.arrayOf(PropTypes.string),
    requiredFields: PropTypes.arrayOf(PropTypes.string)
  }).isRequired
};

const ToolDefinitionList = ({ tools }) => {
  if (!Array.isArray(tools) || tools.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {`工具定义（${tools.length}）`}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          审计视图展示工具名称、说明、结构定义摘要、必填字段和原始路径。
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {tools.map((tool) => (
          <ToolDefinitionCard key={tool.path || tool.displayName || tool.name} tool={tool} />
        ))}
      </Box>
    </Box>
  );
};

ToolDefinitionList.propTypes = {
  tools: PropTypes.arrayOf(ToolDefinitionCard.propTypes.tool)
};

export default ToolDefinitionList;
