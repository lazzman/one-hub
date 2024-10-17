import React from 'react';
import PropTypes from 'prop-types';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Typography } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CopyablePanel from './CopyablePanel';

const TraceAuditSection = React.forwardRef(({ flags, diagnostics, events, rawPayload, sectionRefs }, ref) => {
  const eventCount = Array.isArray(events) ? events.length : 0;
  const summary = {
    payloadParsed: Boolean(flags?.payloadParsed),
    requestParsed: Boolean(flags?.requestParsed),
    responseParsed: Boolean(flags?.responseParsed),
    parseFailed: Boolean(flags?.parseFailed),
    usedFallback: Boolean(flags?.usedFallback),
    eventCount,
    responseIsSSE: Boolean(diagnostics?.responseIsSSE),
    sseDone: Boolean(diagnostics?.sseDone)
  };
  const parseIssues = {
    payloadError: diagnostics?.payloadError || '',
    requestError: diagnostics?.requestError || '',
    responseError: diagnostics?.responseError || '',
    sseError: diagnostics?.sseError || ''
  };
  const hasParseIssues = Object.values(parseIssues).some(Boolean);

  return (
    <Box id="trace" ref={ref} sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <TimelineIcon sx={{ mr: 1 }} color="primary" />
        <Typography variant="h5" fontWeight="bold" color="primary">
          轨迹与诊断
        </Typography>
      </Box>

      {flags?.usedFallback && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          解析失败或协议未知，轨迹与诊断区保留诊断字段，请求与响应区保留完整原始内容。
        </Alert>
      )}

      <Box id="trace-diagnostics" ref={(el) => sectionRefs && (sectionRefs.current['trace-diagnostics'] = el)}>
        <CopyablePanel
          title="解析诊断"
          content={summary}
          rawContent={summary}
          disableEventPreview={true}
          visibleChipTypes={[]}
          sx={{
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'background.paper' : 'rgba(255,255,255,0.9)'),
            borderRadius: '12px'
          }}
        />
      </Box>

      {hasParseIssues && (
        <Box id="trace-parse-issues" ref={(el) => sectionRefs && (sectionRefs.current['trace-parse-issues'] = el)}>
          <Accordion defaultExpanded sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700}>解析错误与 SSE 诊断</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <CopyablePanel
                title="诊断细节"
                content={parseIssues}
                rawContent={parseIssues}
                disableEventPreview={true}
                visibleChipTypes={[]}
              />
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {rawPayload && flags?.usedFallback && (
        <Box id="trace-fallback-payload" ref={(el) => sectionRefs && (sectionRefs.current['trace-fallback-payload'] = el)}>
          <Accordion defaultExpanded sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={700}>降级原始载荷</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <CopyablePanel
                title="降级原始载荷"
                content={rawPayload}
                rawContent={rawPayload}
                disableEventPreview={true}
                visibleChipTypes={[]}
              />
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
    </Box>
  );
});

TraceAuditSection.displayName = 'TraceAuditSection';

TraceAuditSection.propTypes = {
  flags: PropTypes.object,
  diagnostics: PropTypes.object,
  events: PropTypes.array,
  rawPayload: PropTypes.string,
  sectionRefs: PropTypes.shape({
    current: PropTypes.object
  })
};

export default TraceAuditSection;
