/* eslint-env jest */
import { detectClaudeRequestContent, detectGeminiRequestContent, detectOpenAIRequestContent } from './contentDetector';

describe('contentDetector tool definition fallback', () => {
  it('uses function name, explicit name, type, then unknown for OpenAI tools', () => {
    const results = detectOpenAIRequestContent({
      tools: [
        {
          type: 'function',
          function: { name: 'search_docs' }
        },
        {
          type: 'web_search'
        },
        {}
      ]
    });

    expect(results[0].tools).toEqual(['search_docs', 'web_search', 'unknown']);
  });

  it('uses unknown fallback for Claude and Gemini tools without names', () => {
    const claudeResults = detectClaudeRequestContent({
      tools: [
        {
          input_schema: { type: 'object' }
        }
      ]
    });
    const geminiResults = detectGeminiRequestContent({
      tools: [
        {
          functionDeclarations: [{}]
        }
      ]
    });

    expect(claudeResults[0].tools).toEqual(['unknown']);
    expect(geminiResults[0].tools).toEqual(['unknown']);
  });
});
