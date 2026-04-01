#!/usr/bin/env bun
/**
 * inspect.ts — Show section breakdown for a prompt directory.
 *
 * Debug tool for understanding your prompt composition
 * without actually building it.
 *
 * Usage:
 *   bun run inspect.ts --dir ./prompts
 *   bun run inspect.ts --dir ./prompts --provider anthropic
 *   bun run inspect.ts --section identity
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { resolvePromptDir } from './lib/config.js';
import { discoverSections } from './lib/sections.js';
import { estimateTokens, getDefaultBudget, type Provider } from './lib/tokens.js';

// ── CLI ────────────────────────────────────────────────────────────

const program = new Command()
  .name('inspect')
  .description('Show section breakdown for a prompt directory')
  .option('--dir <path>', 'Prompt directory')
  .option('--provider <name>', 'Show tokens for this provider')
  .option('--section <name>', 'Show details for a specific section')
  .parse();

const opts = program.opts();
const promptDir = resolvePromptDir(opts.dir);
const provider = (opts.provider || 'default') as Provider;
const budget = getDefaultBudget(provider);

// ── Discover ──────────────────────────────────────────────────────

const sections = discoverSections(promptDir);

if (sections.length === 0) {
  console.error(`No section files found in: ${promptDir}`);
  process.exit(1);
}

// ── Single section detail ─────────────────────────────────────────

if (opts.section) {
  const match = sections.find(s => s.data.section === opts.section);
  if (!match) {
    console.error(`Section not found: ${opts.section}`);
    console.error(`Available: ${sections.map(s => s.data.section).join(', ')}`);
    process.exit(1);
  }

  const tokens = estimateTokens(match.content, provider);
  console.log(`\nSection: ${match.data.section}`);
  console.log(`  File:     ${match.fileName}`);
  console.log(`  Order:    ${match.data.order}`);
  console.log(`  Cache:    ${match.data.cache || 'static'}`);
  console.log(`  Required: ${match.data.required ? 'yes' : 'no'}`);
  console.log(`  Budget:   ${match.data.budget || '—'}`);
  console.log(`  Tokens:   ${tokens} (${provider})`);
  if (match.data.vars && Object.keys(match.data.vars).length > 0) {
    console.log(`  Vars:     ${JSON.stringify(match.data.vars)}`);
  }
  if (match.data.provider) {
    console.log(`  Provider: ${match.data.provider} only`);
  }
  console.log(`\n--- Content preview (first 500 chars) ---`);
  console.log(match.content.slice(0, 500));
  if (match.content.length > 500) console.log('...');
  process.exit(0);
}

// ── Full breakdown ────────────────────────────────────────────────

console.log(`\nBlueprint — inspecting: ${promptDir}`);
console.log(`Provider: ${provider} | Default budget: ${budget} tokens\n`);

const staticSections = sections.filter(s => s.data.cache !== 'dynamic');
const dynamicSections = sections.filter(s => s.data.cache === 'dynamic');

if (staticSections.length > 0) {
  console.log('  STATIC (cached, above break)');
  for (const s of staticSections) {
    printRow(s);
  }
}

if (dynamicSections.length > 0) {
  if (staticSections.length > 0) console.log('  ── cache break ──────────────────────────────');
  console.log('  DYNAMIC (below break, changes per conversation)');
  for (const s of dynamicSections) {
    printRow(s);
  }
}

const totalTokens = sections.reduce((sum, s) => sum + estimateTokens(s.content, provider), 0);
const staticTokens = staticSections.reduce((sum, s) => sum + estimateTokens(s.content, provider), 0);
const dynamicTokens = dynamicSections.reduce((sum, s) => sum + estimateTokens(s.content, provider), 0);

console.log(`\n  Total: ${totalTokens} tokens`);
if (staticSections.length > 0 && dynamicSections.length > 0) {
  console.log(`  Static: ${staticTokens} | Dynamic: ${dynamicTokens}`);
}
console.log(`  Budget: ${budget} tokens (${totalTokens <= budget ? 'fits' : 'OVER by ' + (totalTokens - budget)})`);

function printRow(s: typeof sections[0]) {
  const tokens = estimateTokens(s.content, provider);
  const budgetStr = s.data.budget ? s.data.budget.toString() : '—';
  const fit = s.data.budget && tokens > s.data.budget ? 'OVER' : 'ok';
  const req = s.data.required ? '*' : ' ';
  console.log(
    `  ${req} ${s.data.order.toString().padStart(3)}  ${s.data.section.padEnd(18)} ${tokens.toString().padStart(6)} tok  budget: ${budgetStr.padStart(6)}  ${fit}`
  );
}
