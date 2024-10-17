import React from 'react';
import { Box, IconButton, Tooltip, Tabs, Tab } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { marked } from 'marked';
import PreviewModal from './PreviewModal';

// 配置 marked 选项
marked.setOptions({
  breaks: true,
  gfm: true
});

// 标准 HTML 标签列表（小写）
const STANDARD_HTML_TAGS = new Set([
  // 文档结构
  'html', 'head', 'body', 'title', 'meta', 'link', 'script', 'style', 'base',
  // 文本内容
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'pre', 'blockquote',
  'ol', 'ul', 'li', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'main', 'div',
  // 内联文本
  'a', 'em', 'strong', 'small', 's', 'cite', 'q', 'dfn', 'abbr', 'ruby', 'rt',
  'rp', 'data', 'time', 'code', 'var', 'samp', 'kbd', 'sub', 'sup', 'i', 'b',
  'u', 'mark', 'bdi', 'bdo', 'span', 'wbr',
  // 多媒体
  'img', 'audio', 'video', 'source', 'track', 'map', 'area', 'picture',
  // 表格
  'table', 'caption', 'colgroup', 'col', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th',
  // 表单
  'form', 'label', 'input', 'button', 'select', 'datalist', 'optgroup', 'option',
  'textarea', 'output', 'progress', 'meter', 'fieldset', 'legend',
  // 交互
  'details', 'summary', 'dialog', 'menu',
  // 嵌入
  'iframe', 'embed', 'object', 'param', 'canvas', 'noscript', 'template', 'slot',
  // 其他
  'section', 'article', 'nav', 'aside', 'header', 'footer', 'address',
  // 自闭合标签
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
]);

/**
 * 处理包含 <think>...</think> 或 <thinking>...</thinking> 标签的内容
 * 将内容切分为普通片段和思考片段，分别渲染
 * @param {string} text - 原始文本
 * @returns {string} 处理后的 HTML
 */
const processThinkTags = (text) => {
  if (!text || typeof text !== 'string') return text;

  // 检查是否包含 think 或 thinking 标签
  const thinkRegex = /<(think|thinking)>([\s\S]*?)<\/\1>/g;
  if (!thinkRegex.test(text)) {
    // 没有 think/thinking 标签时，按 Markdown 解析
    return marked.parse(text);
  }

  // 重置正则表达式
  thinkRegex.lastIndex = 0;

  const parts = [];
  let lastIndex = 0;
  let match;

  // 切分内容
  while ((match = thinkRegex.exec(text)) !== null) {
    // 添加 think/thinking 标签之前的普通内容
    if (match.index > lastIndex) {
      const normalContent = text.substring(lastIndex, match.index);
      if (normalContent.trim()) {
        parts.push({
          type: 'normal',
          content: normalContent
        });
      }
    }

    // 添加 think/thinking 标签内的内容
    const thinkContent = match[2];
    if (thinkContent.trim()) {
      parts.push({
        type: 'think',
        content: thinkContent
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // 添加最后一个 think/thinking 标签之后的内容
  if (lastIndex < text.length) {
    const remainingContent = text.substring(lastIndex);
    if (remainingContent.trim()) {
      parts.push({
        type: 'normal',
        content: remainingContent
      });
    }
  }

  // 渲染各个部分
  const renderedParts = parts.map((part) => {
    const parsedContent = marked.parse(part.content);

    if (part.type === 'think') {
      // 思考块：添加特殊样式容器
      return `
        <div style="
          background-color: #f5f5f5;
          border-left: 4px solid #9e9e9e;
          padding: 12px 16px;
          margin: 12px 0;
          border-radius: 4px;
        ">
          <div style="
            font-weight: 600;
            color: #616161;
            margin-bottom: 8px;
            font-size: 0.875rem;
          ">💭 思考</div>
          <div>${parsedContent}</div>
        </div>
      `;
    } else {
      // 普通内容
      return parsedContent;
    }
  });

  return renderedParts.join('');
};

/**
 * 转义非标准 HTML 的 XML 标签（排除 think 标签）
 * 将 <custom_tag> 转换为 &lt;custom_tag&gt; 以便在 Markdown 中正确显示
 * @param {string} text - 输入文本
 * @returns {string} - 转义后的文本
 */
const escapeNonHtmlTags = (text) => {
  if (!text || typeof text !== 'string') return text;

  // 匹配 XML/HTML 标签的正则表达式
  // 匹配开始标签、结束标签和自闭合标签
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9_-]*)\b[^>]*\/?>/g;

  return text.replace(tagRegex, (match, tagName) => {
    const lowerTagName = tagName.toLowerCase();
    // 如果是标准 HTML 标签或 think 标签，保持不变
    if (STANDARD_HTML_TAGS.has(lowerTagName) || lowerTagName === 'think') {
      return match;
    }
    // 非标准标签，转义尖括号
    return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });
};

/**
 * Markdown 预览组件
 * 复用现有的 ContentViewer 组件渲染 Markdown 内容
 * 当有多个内容时使用 Tab 标签页展示
 * 支持 <think>...</think> 标签的特殊渲染
 * @param {Object} props
 * @param {Array|string} props.content - Markdown 内容（可以是数组或字符串）
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 */
const MarkdownPreview = ({ content, open, onClose }) => {
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);

  // 将内容标准化为数组格式（原始内容，用于复制）
  const rawContentArray = React.useMemo(() => {
    if (!content) return [];

    const extractContent = (item) => {
      // 如果是字符串，直接返回
      if (typeof item === 'string') {
        return item;
      }
      // 如果是对象且有 content 属性，返回 content
      if (typeof item === 'object' && item !== null) {
        if (item.content !== undefined && item.content !== null) {
          // content 可能是字符串或其他类型
          return typeof item.content === 'string' ? item.content : JSON.stringify(item.content, null, 2);
        }
        // 如果没有 content 属性，将整个对象序列化为 JSON
        return JSON.stringify(item, null, 2);
      }
      // 其他类型转为字符串
      return String(item);
    };

    if (Array.isArray(content)) {
      return content.map(extractContent).filter(c => c && c.trim() !== '');
    }

    if (typeof content === 'object' && content !== null && content.content) {
      const extracted = typeof content.content === 'string' ? content.content : JSON.stringify(content.content, null, 2);
      return extracted && extracted.trim() !== '' ? [extracted] : [];
    }

    if (typeof content === 'string') {
      return content.trim() !== '' ? [content] : [];
    }

    return [String(content)];
  }, [content]);

  // 处理后的内容数组（转义非标准标签 + 处理 think 标签）
  const processedContentArray = React.useMemo(() => {
    return rawContentArray.map(text => {
      // 先转义非标准 HTML 标签（保留 think 标签）
      const escaped = escapeNonHtmlTags(text);
      // 再处理 think 标签
      const processed = processThinkTags(escaped);
      return processed;
    });
  }, [rawContentArray]);

  // 是否显示 Tab（多个内容时显示）
  const showTabs = processedContentArray.length > 1;

  // 当前显示的内容（处理后的 HTML）
  const currentContent = processedContentArray[activeTab] || '';

  // 当前原始内容（用于复制）
  const currentRawContent = rawContentArray[activeTab] || '';

  // 处理 Tab 切换
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setCopied(false); // 切换 Tab 时重置复制状态
  };

  // 复制当前 Tab 的原始 Markdown 内容
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentRawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 重置 Tab 索引当弹窗关闭时
  React.useEffect(() => {
    if (!open) {
      setActiveTab(0);
      setCopied(false);
    }
  }, [open]);

  // 工具栏
  const toolbar = (
    <Tooltip title={copied ? '已复制' : '复制原始 Markdown'}>
      <IconButton onClick={handleCopy} size="small">
        {copied ? <CheckIcon color="success" /> : <ContentCopyIcon />}
      </IconButton>
    </Tooltip>
  );

  return (
    <PreviewModal open={open} onClose={onClose} title="Markdown 预览" toolbar={toolbar}>
      <Box
        sx={{
          maxHeight: '70vh',
          overflow: 'auto',
          '& .content-viewer': {
            padding: 0
          }
        }}
      >
        {showTabs && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 40,
                '& .MuiTab-root': {
                  minHeight: 40,
                  py: 1
                }
              }}
            >
              {processedContentArray.map((_, index) => (
                <Tab key={index} label={`内容 ${index + 1}`} />
              ))}
            </Tabs>
          </Box>
        )}
        <Box
          className="content-viewer"
          sx={{
            fontSize: 'inherit',
            lineHeight: 1.6,
            '& img': {
              maxWidth: '100%',
              height: 'auto'
            }
          }}
          dangerouslySetInnerHTML={{ __html: currentContent }}
        />
      </Box>
    </PreviewModal>
  );
};

export default MarkdownPreview;