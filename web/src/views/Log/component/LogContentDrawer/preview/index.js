/**
 * 预览组件模块导出
 */

// 内容检测器
export {
  ContentType,
  MessageFormat,
  RequestFormat,
  detectContentTypes,
  groupByType,
  getAllImages,
  hasPreviewableContent,
  isMarkdown,
  isImageUrl,
  isBase64Image,
  // 请求格式检测
  detectRequestFormat,
  detectRequestContent,
  detectOpenAIRequestContent,
  detectClaudeRequestContent,
  detectGeminiRequestContent,
  // 消息格式检测
  detectMessageFormat,
  detectMessagesFormat,
  // 统一消息内容检测
  detectAllMessageContent,
  detectAllMessagesContent,
  // 快捷检测函数
  hasToolCall,
  isToolResult,
  hasMultimediaContent,
  // OpenAI 格式检测
  detectOpenAIMessageContent,
  detectOpenAIToolCalls,
  detectOpenAIToolResult,
  // Claude 格式检测
  detectClaudeMessageContent,
  detectClaudeToolUse,
  detectClaudeToolResult,
  // Gemini 格式检测
  detectGeminiMessageContent,
  detectGeminiFunctionCall,
  detectGeminiFunctionResponse
} from './contentDetector';

// 预览组件
export { default as PreviewModal } from './PreviewModal';
export { default as PreviewChips } from './PreviewChips';
export { default as MarkdownPreview } from './MarkdownPreview';
export { default as ImagePreview } from './ImagePreview';
export { default as ToolCallPreview } from './ToolCallPreview';
export { default as ToolDefinitionPreview } from './ToolDefinitionPreview';