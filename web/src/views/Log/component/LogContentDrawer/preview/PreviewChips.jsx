import React from 'react';
import { Box, Chip, Tooltip, useTheme } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageIcon from '@mui/icons-material/Image';
import BuildIcon from '@mui/icons-material/Build';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SettingsIcon from '@mui/icons-material/Settings';
import TimelineIcon from '@mui/icons-material/Timeline';
import ResponsesEventPreview from './ResponsesEventPreview';
import { buildPreviewChipModel } from './buildPreviewChipModel';

const CHIP_CONFIG = {
  markdown: { icon: DescriptionIcon, hover: 'rgba(25, 118, 210, 0.08)' },
  reasoning: { icon: DescriptionIcon, hover: 'rgba(3, 169, 244, 0.08)' },
  image: { icon: ImageIcon, hover: 'rgba(156, 39, 176, 0.08)' },
  tool_call: { icon: BuildIcon, hover: 'rgba(255, 152, 0, 0.08)' },
  tool_result: { icon: AssignmentTurnedInIcon, hover: 'rgba(76, 175, 80, 0.08)' },
  audio: { icon: AudiotrackIcon, hover: 'rgba(3, 169, 244, 0.08)' },
  file: { icon: InsertDriveFileIcon, hover: 'rgba(0,0,0,0.05)' },
  event: { icon: TimelineIcon, hover: 'rgba(0,0,0,0.05)' },
  tool_definition: { icon: SettingsIcon, hover: 'rgba(156, 39, 176, 0.08)' }
};

/**
 * 预览芯片组件
 * 显示检测到的内容类型，提供预览按钮
 * @param {Object} props
 * @param {Array} props.detectedItems - 检测到的内容项数组
 * @param {Function} props.onPreviewMarkdown - Markdown 预览回调
 * @param {Function} props.onPreviewImages - 图片预览回调
 * @param {Function} props.onPreviewToolCalls - 工具调用预览回调
 * @param {Function} props.onPreviewToolResults - 工具结果预览回调
 */
const PreviewChips = ({
  detectedItems,
  visibleTypes = null,
  onPreviewMarkdown,
  onPreviewImages,
  onPreviewToolCalls,
  onPreviewToolResults,
  onPreviewToolDefinitions
}) => {
  const theme = useTheme();
  const [eventPreviewOpen, setEventPreviewOpen] = React.useState(false);
  const [previewEvents, setPreviewEvents] = React.useState([]);

  const handlePreviewEvents = React.useCallback((items) => {
    setPreviewEvents(items || []);
    setEventPreviewOpen(true);
  }, []);

  const chipModel = React.useMemo(
    () =>
      buildPreviewChipModel({
        detectedItems: Array.isArray(detectedItems) ? detectedItems : [],
        visibleTypes,
        handlers: {
          onPreviewMarkdown,
          onPreviewImages,
          onPreviewToolCalls,
          onPreviewToolResults,
          onPreviewToolDefinitions,
          onPreviewEvents: handlePreviewEvents
        }
      }),
    [detectedItems, visibleTypes, onPreviewMarkdown, onPreviewImages, onPreviewToolCalls, onPreviewToolResults, onPreviewToolDefinitions, handlePreviewEvents]
  );

  if (chipModel.length === 0) {
    return null;
  }

  // 图标颜色：暗色主题用浅色，明色主题用深色
  const iconColor = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)';

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        flexWrap: 'wrap',
        mb: 1.5,
        p: 1,
        borderRadius: 1,
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: '1px dashed',
        borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
      }}
    >
      {chipModel.map((chip) => {
        const config = CHIP_CONFIG[chip.type] || CHIP_CONFIG[chip.previewKind] || CHIP_CONFIG.file;
        const Icon = config.icon;
        const handleClick = () => {
          if (!chip.enabled) return;
          if (chip.previewKind === 'markdown') onPreviewMarkdown(chip.items);
          if (chip.previewKind === 'image') onPreviewImages(chip.items);
          if (chip.previewKind === 'tool_call') onPreviewToolCalls(chip.items);
          if (chip.previewKind === 'tool_result') onPreviewToolResults(chip.items);
          if (chip.previewKind === 'tool_definition') onPreviewToolDefinitions(chip.items);
          if (chip.previewKind === 'event') handlePreviewEvents(chip.items);
        };

        return (
          <Tooltip key={chip.key} title={chip.enabled ? '点击查看预览' : '已检测到内容，当前上下文仅静态展示'} arrow>
            <Chip
              icon={<Icon sx={{ fontSize: '1rem !important' }} />}
              label={chip.label}
              onClick={chip.enabled ? handleClick : undefined}
              size="small"
              color={chip.color === 'default' ? undefined : chip.color}
              variant="outlined"
              sx={{
                cursor: chip.enabled ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '& .MuiChip-icon': { color: iconColor },
                '&:hover': chip.enabled
                  ? {
                      bgcolor: theme.palette.mode === 'dark' ? config.hover.replace('0.08', '0.15') : config.hover,
                      transform: 'translateY(-1px)'
                    }
                  : {}
              }}
            />
          </Tooltip>
        );
      })}

      <ResponsesEventPreview
        events={previewEvents}
        open={eventPreviewOpen}
        onClose={() => setEventPreviewOpen(false)}
      />
    </Box>
  );
};

export default PreviewChips;
