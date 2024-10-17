import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Typography } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';

const DIAGNOSTIC_FIELDS = [
  {
    key: 'rawEvents',
    label: 'rawEvents',
    description: '原始事件总数（含流式事件与合成事件）'
  },
  {
    key: 'rawCalls',
    label: 'rawCalls',
    description: '识别到的原始工具调用次数（含重试）'
  },
  {
    key: 'uniqueCalls',
    label: 'uniqueCalls',
    description: '按调用节点去重后的工具调用数'
  },
  {
    key: 'completedResults',
    label: 'completedResults',
    description: '已匹配到有效结果载荷的结果数'
  },
  {
    key: 'unmatchedCalls',
    label: 'unmatchedCalls',
    description: '有调用但未匹配结果的节点数'
  },
  {
    key: 'orphanResults',
    label: 'orphanResults',
    description: '有结果但找不到调用来源的节点数'
  }
];

const toSafeNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const TraceDiagnostics = ({ diagnostics }) => {
  const safeDiagnostics = diagnostics && typeof diagnostics === 'object' ? diagnostics : {};
  const unmatchedCalls = toSafeNumber(safeDiagnostics.unmatchedCalls);
  const orphanResults = toSafeNumber(safeDiagnostics.orphanResults);
  const shouldShowWarning = unmatchedCalls > 0 || orphanResults > 0;

  return (
    <Box
      sx={{
        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
        borderRadius: '12px',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark' ? '0 4px 6px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1)',
        p: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <BugReportIcon sx={{ mr: 1 }} color="warning" />
        <Typography variant="subtitle1" fontWeight="bold" color="warning.main">
          诊断统计
        </Typography>
      </Box>

      {shouldShowWarning && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          检测到轨迹不一致：unmatchedCalls={unmatchedCalls}，orphanResults={orphanResults}。建议结合事件流回溯工具调用链路。
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, minmax(0, 1fr))',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))'
          },
          gap: 1
        }}
      >
        {DIAGNOSTIC_FIELDS.map((item) => (
          <Box
            key={item.key}
            sx={{
              border: '1px solid',
              borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
              borderRadius: 1.5,
              p: 1.25,
              minHeight: 92
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
              {item.label}
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.2, mb: 0.25 }}>
              {toSafeNumber(safeDiagnostics[item.key])}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: 'block' }}>
              {item.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

TraceDiagnostics.propTypes = {
  diagnostics: PropTypes.object
};

export default TraceDiagnostics;
