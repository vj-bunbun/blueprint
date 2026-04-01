#!/usr/bin/env bun
/**
 * init.ts — Scaffold a new prompt directory with starter sections.
 *
 * Creates a prompt directory with example section files and
 * optionally sets it as the default in ~/.airc.
 *
 * Usage:
 *   bun run init.ts ~/my-prompts
 *   bun run init.ts ~/my-prompts --no-default
 */

import { Command } from 'commander';
import { existsSync, writeFileSync, readFileSync, readdirSync, copyFileSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { homedir } from 'os';
import { ensureDir, getAircPath } from './lib/config.js';

// ── CLI ────────────────────────────────────────────────────────────

const program = new Command()
  .name('init')
  .description('Scaffold a new prompt directory')
  .argument('[path]', 'Where to create the prompt directory', './prompts')
  .option('--no-default', 'Do not set as default in ~/.airc')
  .parse();

const targetPath = resolve(program.args[0] || './prompts');
const setDefault = program.opts().default !== false;

// ── Check existing ────────────────────────────────────────────────

if (existsSync(targetPath)) {
  const files = readdirSync(targetPath).filter(f => f.endsWith('.md'));
  if (files.length > 0) {
    console.log(`Prompt directory already exists with ${files.length} section files: ${targetPath}`);
    console.log('Nothing to do.');
    process.exit(0);
  }
}

// ── Create structure ──────────────────────────────────────────────

ensureDir(targetPath);

// Copy starter sections from examples/starter/
const starterDir = join(dirname(import.meta.dir), 'examples', 'starter');
if (existsSync(starterDir)) {
  const starterFiles = readdirSync(starterDir).filter(f => f.endsWith('.md'));
  for (const file of starterFiles) {
    copyFileSync(join(starterDir, file), join(targetPath, file));
  }
  console.log(`Created ${starterFiles.length} starter sections in: ${targetPath}`);
} else {
  // Fallback: create minimal starter sections inline
  writeStarterSections(targetPath);
}

// ── Update ~/.airc ────────────────────────────────────────────────

if (setDefault) {
  const aircPath = getAircPath();
  const line = `defaultPromptDir=${targetPath}`;

  if (existsSync(aircPath)) {
    const existing = readFileSync(aircPath, 'utf-8');
    if (existing.includes('defaultPromptDir=')) {
      // Replace existing line
      const updated = existing.replace(/defaultPromptDir=.*/g, line);
      writeFileSync(aircPath, updated, 'utf-8');
    } else {
      // Append
      writeFileSync(aircPath, existing.trimEnd() + '\n' + line + '\n', 'utf-8');
    }
  } else {
    writeFileSync(aircPath, `# Blueprint defaults\n${line}\n`, 'utf-8');
  }
  console.log(`Set as default prompt directory in ~/.airc`);
}

// ── Summary ───────────────────────────────────────────────────────

console.log(`
Prompt directory ready:
  ${targetPath}/
  ├── 10-identity.md       ← Who the AI is
  ├── 20-tools.md          ← Available tools and usage
  ├── 30-instructions.md   ← Behavioral guidelines
  ├── 80-context.md        ← Project context (dynamic)
  └── 90-memory.md         ← Session memory (dynamic)

Next steps:
  1. Edit the section files to match your needs
  2. Preview:  bun run build.ts --dir ${targetPath}
  3. Build:    bun run build.ts --dir ${targetPath} --execute --clipboard
`);

// ── Fallback starter sections ─────────────────────────────────────

function writeStarterSections(dir: string): void {
  writeFileSync(join(dir, '10-identity.md'), `---
section: identity
order: 10
cache: static
required: true
---

You are a helpful assistant.
`, 'utf-8');

  writeFileSync(join(dir, '20-tools.md'), `---
section: tools
order: 20
cache: static
---

# Tools

(Describe available tools and how to use them)
`, 'utf-8');

  writeFileSync(join(dir, '30-instructions.md'), `---
section: instructions
order: 30
cache: static
---

# Instructions

(Behavioral guidelines, output format rules, constraints)
`, 'utf-8');

  writeFileSync(join(dir, '80-context.md'), `---
section: context
order: 80
cache: dynamic
budget: 4000
---

# Context

(Project context — paste here or use {{include path/to/context.md}})
`, 'utf-8');

  writeFileSync(join(dir, '90-memory.md'), `---
section: memory
order: 90
cache: dynamic
budget: 2000
---

# Memory

(Session memory, user preferences, recent conversation context)
`, 'utf-8');

  console.log(`Created 5 starter sections in: ${dir}`);
}
