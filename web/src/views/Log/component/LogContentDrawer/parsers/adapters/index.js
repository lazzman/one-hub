const scoreByProtocol = (candidateProtocol, currentProtocol) => {
  if (candidateProtocol === currentProtocol) return 100;
  if (candidateProtocol === 'openai-compatible' && (currentProtocol === 'openai-chat' || currentProtocol === 'openai-compatible')) return 80;
  if (candidateProtocol === 'fallback') return 1;
  return 0;
};

import { openAIResponsesAdapter } from './openAIResponsesAdapter';
import { openAIChatAdapter } from './openAIChatAdapter';
import { claudeAdapter } from './claudeAdapter';
import { geminiAdapter } from './geminiAdapter';
import { openAICompatibleAdapter } from './openAICompatibleAdapter';
import { fallbackTextAdapter } from './fallbackTextAdapter';

const ADAPTERS = [openAIResponsesAdapter, openAIChatAdapter, claudeAdapter, geminiAdapter, openAICompatibleAdapter, fallbackTextAdapter];

export const pickPreviewAdapter = ({ previewModel, parsedPayload }) => {
  const scored = ADAPTERS.map((adapter) => ({
    adapter,
    score: typeof adapter.match === 'function' ? adapter.match({ previewModel, parsedPayload, scoreByProtocol }) : 0
  })).sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].adapter : fallbackTextAdapter;
};

export { ADAPTERS };
