#!/usr/bin/env bun
/**
 * build.ts — Assemble a system prompt from section files.
 *
 * The core value of Blueprint. Reads a prompt directory, resolves
 * variables and includes, assembles within a token budget, and
 * outputs in provider-specific format.
 *
 * Usage:
 *   bun run build.ts --dir ./prompts --execute --clipboard
 *   bun run build.ts --dir ./prompts --provider anthropic --output prompt.json
 *   bun run build.ts --dir ./prompts --var agent_name=Claude --execute
 */

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { resolvePromptDir } from './lib/config.js';
import { discoverSections } from './lib/sections.js';
import { getDefaultBudget, estimateTokens, type Provider } from './lib/tokens.js';
import { assemble } from './lib/assembler.js';
import { formatForProvider } from './lib/providers.js';

// ── CLI ────────────────────────────────────────────────────────────

const program = new Command()
  .name('build')
  .description('Assemble a system prompt from section files')
  .option('--dir <path>', 'Prompt directory')
  .option('--provider <name>', 'Output format: raw (default), anthropic, openai, google, local')
  .option('--budget <tokens>', 'Total token budget (default: provider-dependent)')
  .option('--var <key=value...>', 'Set a variable (repeatable)', collect, [])
  .option('--vars-file <path>', 'Path to a key=value vars file')
  .option('--output <path>', 'Write to file')
  .option('--clipboard', 'Copy to clipboard')
  .option('--execute', 'Actually assemble and output (default is dry-run)')
  .option('--quiet', 'Suppress progress output')
  .parse();

function collect(value: string, previous: string[]) {
  return previous.concat([value]);
}

const opts = program.opts();
const promptDir = resolvePromptDir(opts.dir);
const provider = (opts.provider || 'default') as Provider;
const budget = parseInt(opts.budget) || getDefaultBudget(provider);
const execute = opts.execute;
const quiet = opts.quiet;

// ── Discover sections ─────────────────────────────────────────────

const sections = discoverSections(promptDir);

if (sections.length === 0) {
  console.error(`No section files found in: ${promptDir}`);
  console.error('Run "bun run init.ts <path>" to create a prompt directory.');
  process.exit(1);
}

if (!quiet) {
  console.log(`\nBlueprint — assembling from: ${promptDir}`);
  console.log(`  Provider: ${provider} | Budget: ${budget} tokens`);
  console.log(`  Sections found: ${sections.length}\n`);
}

// ── Dry-run: show section breakdown ───────────────────────────────

if (!execute) {
  const staticSections = sections.filter(s => s.data.cache !== 'dynamic');
  const dynamicSections = sections.filter(s => s.data.cache === 'dynamic');

  console.log('  Order  Section              Cache     Tokens  Budget   Required');
  console.log('  ─────  ───────────────────   ───────   ──────  ──────   ────────');

  for (const s of [...staticSections, ...dynamicSections]) {
    const tokens = estimateTokens(s.content, provider);
    const budgetStr = s.data.budget ? s.data.budget.toString() : '—';
    const overBudget = s.data.budget && tokens > s.data.budget ? ' ⚠' : '';
    console.log(
      `  ${s.data.order.toString().padStart(5)}  ${s.data.section.padEnd(20)} ${(s.data.cache || 'static').padEnd(9)} ${tokens.toString().padStart(6)}  ${budgetStr.padStart(6)}   ${s.data.required ? 'yes' : 'no'}${overBudget}`
    );
  }

  const totalTokens = sections.reduce((sum, s) => sum + estimateTokens(s.content, provider), 0);
  console.log(`\n  Total: ${totalTokens} tokens (budget: ${budget})`);

  if (staticSections.length > 0 && dynamicSections.length > 0) {
    const staticTokens = staticSections.reduce((sum, s) => sum + estimateTokens(s.content, provider), 0);
    const dynamicTokens = dynamicSections.reduce((sum, s) => sum + estimateTokens(s.content, provider), 0);
    console.log(`  Static: ${staticTokens} tokens | Dynamic: ${dynamicTokens} tokens`);
  }

  console.log('\n  This is a dry run. Add --execute to assemble and output.');
  process.exit(0);
}

// ── Execute: assemble and output ──────────────────────────────────

const result = assemble(sections, {
  provider,
  budget,
  varsFile: opts.varsFile,
  cliVars: opts.var,
  quiet,
});

const output = formatForProvider(result, provider);

// Report
if (!quiet) {
  for (const s of result.sections) {
    const status = s.cut ? 'CUT' : s.truncated ? 'TRUNC' : 'OK';
    console.log(
      `  ${s.order.toString().padStart(5)}  ${s.name.padEnd(20)} ${s.cache.padEnd(9)} ${s.tokens.toString().padStart(6)} tok  ${status}`
    );
  }
  console.log(`\n  Assembled: ${result.totalTokens} / ${result.budget} tokens`);
}

// Output
if (opts.clipboard) {
  const platform = process.platform;
  const clipCmd = platform === 'win32' ? 'clip.exe'
    : platform === 'darwin' ? 'pbcopy'
    : 'xclip -selection clipboard';
  const args = clipCmd.split(' ');
  const proc = Bun.spawn(args, { stdin: 'pipe' });
  proc.stdin.write(output);
  proc.stdin.end();
  await proc.exited;
  if (!quiet) {
    console.log(`  Copied to clipboard (${output.length} chars)`);
  }
} else if (opts.output) {
  writeFileSync(opts.output, output, 'utf-8');
  if (!quiet) {
    console.log(`  Written to ${opts.output}`);
  }
} else {
  // Default: print to stdout
  console.log(output);
}
