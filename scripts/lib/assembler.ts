/**
 * Core assembly algorithm.
 *
 * Takes parsed sections, a token budget, a provider, and resolved variables.
 * Produces the final assembled string plus metadata about what was included/cut.
 */

import type { ParsedSection } from './sections.js';
import { estimateTokens, truncateToFit, type Provider } from './tokens.js';
import { resolveIncludes, resolveVariables, collectVars } from './variables.js';

// ── Types ─────────────────────────────────────────────────────────

export interface AssemblyOptions {
  provider: Provider;
  budget: number;
  varsFile?: string;
  cliVars?: string[];
  quiet?: boolean;
}

export interface AssembledSection {
  name: string;
  order: number;
  tokens: number;
  cache: 'static' | 'dynamic';
  required: boolean;
  truncated: boolean;
  cut: boolean;
}

export interface AssemblyResult {
  output: string;
  staticContent: string;
  dynamicContent: string;
  sections: AssembledSection[];
  totalTokens: number;
  budget: number;
}

// ── Assembly ──────────────────────────────────────────────────────

export function assemble(
  sections: ParsedSection[],
  opts: AssemblyOptions
): AssemblyResult {
  const { provider, budget, varsFile, cliVars, quiet } = opts;

  // 1. Filter by provider
  const filtered = sections.filter(s => {
    if (!s.data.provider) return true;
    return s.data.provider === provider || s.data.provider === 'raw';
  });

  // 2. Resolve includes and variables for each section
  const resolved = filtered.map(s => {
    const globalVars = collectVars(s.data.vars || {}, varsFile, cliVars);
    let content = resolveIncludes(s.content, s.filePath.replace(/[/\\][^/\\]+$/, ''));
    content = resolveVariables(content, globalVars, quiet);
    return { ...s, content };
  });

  // 3. Partition into static and dynamic
  const staticSections = resolved.filter(s => s.data.cache !== 'dynamic');
  const dynamicSections = resolved.filter(s => s.data.cache === 'dynamic');
  const ordered = [...staticSections, ...dynamicSections];

  // 4. Per-section budget enforcement
  const budgeted = ordered.map(s => {
    let content = s.content;
    let truncated = false;
    if (s.data.budget) {
      const tokens = estimateTokens(content, provider);
      if (tokens > s.data.budget) {
        content = truncateToFit(content, s.data.budget, provider);
        truncated = true;
      }
    }
    return { ...s, content, truncated };
  });

  // 5. Global budget enforcement
  let usedTokens = 0;
  const included: { content: string; meta: AssembledSection }[] = [];

  for (const s of budgeted) {
    const tokens = estimateTokens(s.content, provider);
    const meta: AssembledSection = {
      name: s.data.section,
      order: s.data.order,
      tokens,
      cache: s.data.cache || 'static',
      required: s.data.required || false,
      truncated: s.truncated,
      cut: false,
    };

    if (usedTokens + tokens <= budget) {
      included.push({ content: s.content, meta });
      usedTokens += tokens;
    } else if (s.data.required) {
      // Required sections always get in
      included.push({ content: s.content, meta });
      usedTokens += tokens;
    } else {
      const remaining = budget - usedTokens;
      if (remaining > 100) {
        const truncContent = truncateToFit(s.content, remaining, provider);
        meta.tokens = estimateTokens(truncContent, provider);
        meta.truncated = true;
        included.push({ content: truncContent, meta });
        usedTokens += meta.tokens;
      } else {
        meta.cut = true;
        meta.tokens = 0;
        included.push({ content: '', meta });
      }
    }
  }

  // 6. Concatenate with cache boundary
  const staticParts: string[] = [];
  const dynamicParts: string[] = [];

  for (const item of included) {
    if (item.meta.cut) continue;
    if (item.meta.cache === 'dynamic') {
      dynamicParts.push(item.content);
    } else {
      staticParts.push(item.content);
    }
  }

  const staticContent = staticParts.join('\n\n');
  const dynamicContent = dynamicParts.join('\n\n');
  const output = dynamicContent
    ? `${staticContent}\n\n${dynamicContent}`
    : staticContent;

  return {
    output,
    staticContent,
    dynamicContent,
    sections: included.map(i => i.meta),
    totalTokens: usedTokens,
    budget,
  };
}
