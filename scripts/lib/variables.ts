/**
 * Variable substitution and include resolution.
 *
 * {{var_name}} — replaced with variable value
 * {{include path/to/file.md}} — replaced with file contents
 *
 * Includes are single-depth only (no recursion).
 * Unresolved variables remain as-is and produce a warning.
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

// ── Includes ──────────────────────────────────────────────────────

/**
 * Resolve {{include path}} directives.
 * Paths are relative to baseDir. Single-depth only.
 */
export function resolveIncludes(text: string, baseDir: string): string {
  // Only match {{include}} directives that appear alone on a line.
  // This prevents literal {{include}} text in documentation or included
  // content from being resolved (single-depth guarantee).
  return text.replace(/^(\{\{include\s+(.+?)\}\})\s*$/gm, (_match, _full, path: string) => {
    const trimmedPath = path.trim();
    const fullPath = resolve(baseDir, trimmedPath);
    if (!existsSync(fullPath)) {
      console.warn(`Warning: include not found: ${trimmedPath}`);
      return `[include not found: ${trimmedPath}]`;
    }
    try {
      return readFileSync(fullPath, 'utf-8').trim();
    } catch {
      console.warn(`Warning: could not read include: ${trimmedPath}`);
      return `[include error: ${trimmedPath}]`;
    }
  });
}

// ── Variables ─────────────────────────────────────────────────────

/**
 * Replace {{var_name}} with values from the vars map.
 * Unresolved variables remain as-is and produce a warning.
 */
export function resolveVariables(
  text: string,
  vars: Record<string, string>,
  quiet: boolean = false
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    if (name in vars) return vars[name];
    if (!quiet) console.warn(`Warning: unresolved variable: {{${name}}}`);
    return match;
  });
}

// ── Vars file ─────────────────────────────────────────────────────

/**
 * Parse a key=value vars file.
 * Same format as ~/.airc: one key=value per line, # comments.
 */
export function parseVarsFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    console.warn(`Warning: vars file not found: ${filePath}`);
    return {};
  }
  const raw = readFileSync(filePath, 'utf-8');
  const vars: Record<string, string> = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key) vars[key] = val;
  }

  return vars;
}

/**
 * Collect variables from all sources. Later sources win on conflict.
 * Order: section defaults < vars file < CLI --var flags
 */
export function collectVars(
  sectionVars: Record<string, string> = {},
  varsFile?: string,
  cliVars?: string[]
): Record<string, string> {
  const merged = { ...sectionVars };

  // Vars file
  if (varsFile) {
    Object.assign(merged, parseVarsFile(varsFile));
  }

  // CLI --var key=value flags
  if (cliVars) {
    for (const entry of cliVars) {
      const eqIdx = entry.indexOf('=');
      if (eqIdx === -1) {
        console.warn(`Warning: invalid --var format: ${entry} (expected key=value)`);
        continue;
      }
      const key = entry.slice(0, eqIdx).trim();
      const val = entry.slice(eqIdx + 1).trim();
      if (key) merged[key] = val;
    }
  }

  return merged;
}
