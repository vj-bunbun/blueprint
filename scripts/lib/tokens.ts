/**
 * Token counting — provider-agnostic estimation.
 *
 * Default: 4 characters per token (good enough for planning).
 * Provider-specific overrides for tighter budgets.
 */

export type Provider = 'default' | 'anthropic' | 'openai' | 'google' | 'local';

const CHARS_PER_TOKEN: Record<Provider, number> = {
  default: 4,
  anthropic: 3.5,
  openai: 4,
  google: 4,
  local: 4.5,
};

const DEFAULT_BUDGETS: Record<Provider, number> = {
  default: 16000,
  anthropic: 16000,
  openai: 12000,
  google: 12000,
  local: 8000,
};

/**
 * Estimate token count for a string.
 */
export function estimateTokens(text: string, provider: Provider = 'default'): number {
  const cpt = CHARS_PER_TOKEN[provider];
  return Math.ceil(text.length / cpt);
}

/**
 * Get the default token budget for a provider.
 */
export function getDefaultBudget(provider: Provider = 'default'): number {
  return DEFAULT_BUDGETS[provider];
}

/**
 * Truncate text to fit within a token budget.
 * Truncates from the end, preserving the beginning.
 */
export function truncateToFit(
  text: string,
  budget: number,
  provider: Provider = 'default'
): string {
  const cpt = CHARS_PER_TOKEN[provider];
  const maxChars = budget * cpt;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... truncated to fit token budget ...]';
}
