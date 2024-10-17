import React from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Grid, Paper, Stack, Typography, Alert } from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheck';

const Field = ({ label, value, hint }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 1.5,
      height: '100%',
      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.75)')
    }}
  >
    <Typography variant="caption" color="text.secondary" display="block">
      {label}
    </Typography>
    <Typography variant="body1" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
      {value || '-'}
    </Typography>
    {hint && (
      <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
        {hint}
      </Typography>
    )}
  </Paper>
);

Field.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  hint: PropTypes.string
};

const OverviewSection = React.forwardRef(({ sourceDisplay, flags }, ref) => (
  <Box id="overview" ref={ref} sx={{ mb: 3 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <FactCheckIcon sx={{ mr: 1 }} color="primary" />
      <Typography variant="h5" fontWeight="bold" color="primary">
        概览
      </Typography>
    </Box>

    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
      {(sourceDisplay?.badges || []).map((badge) => (
        <Chip
          key={badge.key}
          label={badge.label}
          size="small"
          color={badge.color === 'default' ? undefined : badge.color}
          variant="outlined"
        />
      ))}
    </Stack>

    {flags?.usedFallback && (
      <Alert severity="warning" sx={{ mb: 2 }}>
        当前日志使用降级审计视图，已保留可复制的原始请求与响应。
      </Alert>
    )}

    <Grid container spacing={1.5}>
      <Grid item xs={12} sm={6} md={4}>
        <Field label="提供方" value={sourceDisplay?.provider?.label} hint={sourceDisplay?.provider?.key} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Field label="API 协议" value={sourceDisplay?.schema?.label} hint={sourceDisplay?.schema?.key} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Field label="端点" value={sourceDisplay?.endpoint?.label} hint={sourceDisplay?.endpoint?.key} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Field label="传输方式" value={sourceDisplay?.transport?.label} hint={sourceDisplay?.transport?.key} />
      </Grid>
      <Grid item xs={12} sm={6} md={4}>
        <Field label="渠道" value={sourceDisplay?.channel?.name} />
      </Grid>
    </Grid>
  </Box>
));

OverviewSection.displayName = 'OverviewSection';

OverviewSection.propTypes = {
  sourceDisplay: PropTypes.object,
  flags: PropTypes.object
};

export default OverviewSection;
