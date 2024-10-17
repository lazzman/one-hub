import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Chip, Collapse, Divider, Typography } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const FILTER_OPTIONS = [
  { key: 'all', label: 'all' },
  { key: 'completed', label: 'completed' },
  { key: 'failed', label: 'failed' },
  { key: 'cancelled', label: 'cancelled' },
  { key: 'missing_result', label: 'missing_result' },
  { key: 'orphan_result', label: 'orphan_result' },
  { key: 'in_progress', label: 'in_progress' }
];

const STATUS_ORDER = ['completed', 'failed', 'cancelled', 'missing_result', 'orphan_result', 'in_progress'];

const STATUS_META = {
  completed: { label: 'completed', color: 'success' },
  failed: { label: 'failed', color: 'error' },
  cancelled: { label: 'cancelled', color: 'warning' },
  missing_result: { label: 'missing_result', color: 'warning' },
  orphan_result: { label: 'orphan_result', color: 'error' },
  in_progress: { label: 'in_progress', color: 'info' }
};

const ABNORMAL_STATUSES = new Set(['missing_result', 'orphan_result', 'failed', 'cancelled']);

const toSafeNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizeText = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeStatus = (value) => {
  const status = normalizeText(value, 'in_progress').toLowerCase();
  return STATUS_META[status] ? status : 'in_progress';
};

const getStatusMeta = (status) => STATUS_META[status] || { label: status || 'in_progress', color: 'default' };

const toSummaryText = (value, maxLength = 240) => {
  if (value === undefined || value === null) return '—';

  let text = '';

  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '—';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}…`;
};

const ToolTimelineSection = ({ traceNodes }) => {
  const safeTraceNodes = useMemo(() => (Array.isArray(traceNodes) ? traceNodes : []), [traceNodes]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [groupMode, setGroupMode] = useState('status');
  const [expandedNodes, setExpandedNodes] = useState({});

  const filteredNodes = useMemo(() => {
    if (activeFilter === 'all') return safeTraceNodes;
    return safeTraceNodes.filter((node) => normalizeStatus(node?.status) === activeFilter);
  }, [safeTraceNodes, activeFilter]);

  const groupedNodes = useMemo(() => {
    const groupedMap = new Map();

    filteredNodes.forEach((node, index) => {
      const status = normalizeStatus(node?.status);
      const toolName = normalizeText(node?.toolName, '未知工具');
      const groupKey = groupMode === 'tool' ? `tool:${toolName}` : `status:${status}`;
      const groupLabel = groupMode === 'tool' ? toolName : getStatusMeta(status).label;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          nodes: []
        });
      }

      groupedMap.get(groupKey).nodes.push({ node, index });
    });

    const groups = Array.from(groupedMap.values());

    if (groupMode === 'status') {
      const orderMap = new Map(STATUS_ORDER.map((status, index) => [status, index]));
      groups.sort((a, b) => {
        const statusA = a.key.replace('status:', '');
        const statusB = b.key.replace('status:', '');
        const rankA = orderMap.has(statusA) ? orderMap.get(statusA) : Number.MAX_SAFE_INTEGER;
        const rankB = orderMap.has(statusB) ? orderMap.get(statusB) : Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      });
    } else {
      groups.sort((a, b) => a.label.localeCompare(b.label));
    }

    return groups;
  }, [filteredNodes, groupMode]);

  const abnormalCount = useMemo(
    () => filteredNodes.filter((node) => ABNORMAL_STATUSES.has(normalizeStatus(node?.status))).length,
    [filteredNodes]
  );

  const handleToggleNode = (nodeKey) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

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
        <TimelineIcon sx={{ mr: 1 }} color="warning" />
        <Typography variant="subtitle1" fontWeight="bold" color="warning.main">
          工具调用时间线
        </Typography>
      </Box>

      {safeTraceNodes.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          无工具轨迹数据
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 1.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="caption" color="text.secondary">
                状态筛选：
              </Typography>
              {FILTER_OPTIONS.map((option) => (
                <Chip
                  key={option.key}
                  size="small"
                  label={option.label}
                  color={activeFilter === option.key ? 'primary' : 'default'}
                  variant={activeFilter === option.key ? 'filled' : 'outlined'}
                  onClick={() => setActiveFilter(option.key)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="caption" color="text.secondary">
                分组方式：
              </Typography>
              <Chip
                size="small"
                label="按状态"
                color={groupMode === 'status' ? 'primary' : 'default'}
                variant={groupMode === 'status' ? 'filled' : 'outlined'}
                onClick={() => setGroupMode('status')}
                sx={{ cursor: 'pointer' }}
              />
              <Chip
                size="small"
                label="按工具名"
                color={groupMode === 'tool' ? 'primary' : 'default'}
                variant={groupMode === 'tool' ? 'filled' : 'outlined'}
                onClick={() => setGroupMode('tool')}
                sx={{ cursor: 'pointer' }}
              />
            </Box>
          </Box>

          {abnormalCount > 0 && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              当前筛选下发现 {abnormalCount} 个异常节点（missing_result / orphan_result / failed / cancelled）。
            </Alert>
          )}

          {groupedNodes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              当前筛选条件下无匹配轨迹节点
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {groupedNodes.map((group) => (
                <Box key={group.key}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {groupMode === 'status' ? `状态：${group.label}` : `工具：${group.label}`}
                    </Typography>
                    <Chip size="small" variant="outlined" label={`${group.nodes.length} 节点`} />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {group.nodes.map(({ node, index }) => {
                      const toolName = normalizeText(node?.toolName, '未知工具');
                      const callId = normalizeText(node?.callId, `#${index + 1}`);
                      const status = normalizeStatus(node?.status);
                      const statusMeta = getStatusMeta(status);
                      const attempts = toSafeNumber(node?.attempts);
                      const eventCount = toSafeNumber(node?.eventCount);
                      const argsSummary = toSummaryText(node?.args);
                      const resultSummary = toSummaryText(node?.result);
                      const errors = Array.isArray(node?.errors)
                        ? node.errors.map((item) => String(item || '').trim()).filter(Boolean)
                        : [];
                      const errorSummary = errors.length > 0 ? errors.join(' | ') : '—';
                      const nodeKey = `${callId}-${toolName}-${index}`;
                      const expanded = Boolean(expandedNodes[nodeKey]);
                      const isAbnormal = ABNORMAL_STATUSES.has(status);

                      return (
                        <Box
                          key={nodeKey}
                          sx={{
                            border: '1px solid',
                            borderColor: (theme) => {
                              if (isAbnormal) {
                                return theme.palette.mode === 'dark' ? 'rgba(244,67,54,0.45)' : 'rgba(211,47,47,0.35)';
                              }
                              return theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
                            },
                            bgcolor: (theme) => {
                              if (isAbnormal) {
                                return theme.palette.mode === 'dark' ? 'rgba(244,67,54,0.06)' : 'rgba(244,67,54,0.03)';
                              }
                              return 'transparent';
                            },
                            borderRadius: 1.5,
                            p: 1.25
                          }}
                        >
                          <Box
                            onClick={() => handleToggleNode(nodeKey)}
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 1,
                              cursor: 'pointer'
                            }}
                          >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {toolName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                callId: {callId}
                              </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0.75 }}>
                              <Chip
                                label={`status: ${statusMeta.label}`}
                                size="small"
                                color={statusMeta.color}
                                variant={isAbnormal ? 'filled' : 'outlined'}
                              />
                              <Chip label={`attempts: ${attempts}`} size="small" variant="outlined" />
                              <Chip label={`eventCount: ${eventCount}`} size="small" variant="outlined" />
                              {expanded ? (
                                <ExpandLessIcon fontSize="small" color="action" />
                              ) : (
                                <ExpandMoreIcon fontSize="small" color="action" />
                              )}
                            </Box>
                          </Box>

                          <Collapse in={expanded} timeout="auto" unmountOnExit>
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  args 摘要
                                </Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                  {argsSummary}
                                </Typography>
                              </Box>

                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  result 摘要
                                </Typography>
                                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                  {resultSummary}
                                </Typography>
                              </Box>

                              <Box>
                                <Typography variant="caption" color="text.secondary">
                                  error 摘要
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ wordBreak: 'break-word' }}
                                  color={errors.length > 0 ? 'error.main' : 'text.primary'}
                                >
                                  {errorSummary}
                                </Typography>
                              </Box>
                            </Box>
                          </Collapse>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

ToolTimelineSection.propTypes = {
  traceNodes: PropTypes.array
};

export default ToolTimelineSection;
