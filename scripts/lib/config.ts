/**
 * Prompt directory resolution and global config.
 * Reads ~/.airc for defaultPromptDir setting.
 * Mirrors Blackbox's vault.ts pattern — same config file, different key.
 */

import { existsSync, readFileSync, mkdirSync } from 'fs';
import { resolve, join, normalize } from 'path';
import { homedir } from 'os';

// ── Config file (~/.airc) ──────────────────────────────────────────

export interface AircConfig {
  defaultPromptDir?: string;
  defaultVault?: string;
}

const AIRC_PATH = join(homedir(), '.airc');

export function loadAirc(): AircConfig {
  if (!existsSync(AIRC_PATH)) return {};
  try {
    const raw = readFileSync(AIRC_PATH, 'utf-8');
    const config: AircConfig = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key === 'defaultPromptDir') config.defaultPromptDir = val;
      if (key === 'defaultVault') config.defaultVault = val;
    }
    return config;
  } catch {
    return {};
  }
}

export function getAircPath(): string {
  return AIRC_PATH;
}

// ── Prompt directory resolution ────────────────────────────────────

export function resolvePromptDir(cliDir?: string): string {
  if (cliDir) return resolve(normalize(cliDir));

  const airc = loadAirc();
  if (airc.defaultPromptDir) return resolve(normalize(airc.defaultPromptDir));

  return resolve('.');
}

// ── Helpers ────────────────────────────────────────────────────────

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
