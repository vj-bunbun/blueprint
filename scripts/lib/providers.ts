/**
 * Provider-specific output formatters.
 *
 * Takes assembled content and wraps it for a target provider's API format.
 * Outputs only the system prompt portion, not the full API request body.
 */

import type { AssemblyResult } from './assembler.js';
import type { Provider } from './tokens.js';

/**
 * Format the assembled result for a specific provider.
 */
export function formatForProvider(result: AssemblyResult, provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return formatAnthropic(result);
    case 'openai':
      return formatOpenAI(result);
    case 'google':
      return formatGoogle(result);
    default:
      return formatRaw(result);
  }
}

/**
 * Raw — plain text output. Default format.
 */
function formatRaw(result: AssemblyResult): string {
  return result.output;
}

/**
 * Anthropic — JSON array of content blocks with cache_control.
 * Static content gets cache_control for prompt caching optimization.
 */
function formatAnthropic(result: AssemblyResult): string {
  const blocks: object[] = [];

  if (result.staticContent) {
    blocks.push({
      type: 'text',
      text: result.staticContent,
      cache_control: { type: 'ephemeral' },
    });
  }

  if (result.dynamicContent) {
    blocks.push({
      type: 'text',
      text: result.dynamicContent,
    });
  }

  // If no cache boundary, single block without cache_control
  if (blocks.length === 0) {
    blocks.push({ type: 'text', text: result.output });
  }

  return JSON.stringify(blocks, null, 2);
}

/**
 * OpenAI — system message object for Chat Completions API.
 */
function formatOpenAI(result: AssemblyResult): string {
  return JSON.stringify({
    role: 'system',
    content: result.output,
  }, null, 2);
}

/**
 * Google — systemInstruction field for Generative AI API.
 */
function formatGoogle(result: AssemblyResult): string {
  return JSON.stringify({
    parts: [{ text: result.output }],
  }, null, 2);
}
