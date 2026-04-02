/**
 * Section discovery, parsing, and ordering.
 * Finds all .md files in a prompt directory, parses frontmatter,
 * validates the section schema, and returns them sorted by order.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

// ── Types ─────────────────────────────────────────────────────────

export interface SectionFrontmatter {
  section: string;
  order: number;
  budget?: number;
  cache?: 'static' | 'dynamic';
  required?: boolean;
  provider?: string | null;
  vars?: Record<string, string>;
}

export interface ParsedSection {
  data: SectionFrontmatter;
  content: string;
  filePath: string;
  fileName: string;
}

// ── Discovery ─────────────────────────────────────────────────────

/**
 * Find all .md section files in a prompt directory.
 * Parses frontmatter, validates, sorts by order.
 * Non-recursive — only reads the top-level directory.
 */
export function discoverSections(dir: string): ParsedSection[] {
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  const sections: ParsedSection[] = [];

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);

      // Derive defaults from filename if frontmatter is incomplete
      const derived = deriveFromFilename(file);
      const section: SectionFrontmatter = {
        section: data.section || derived.section,
        order: typeof data.order === 'number' ? data.order : derived.order,
        budget: data.budget,
        cache: data.cache || 'static',
        required: data.required || false,
        provider: data.provider || null,
        vars: data.vars || {},
      };

      const errors = validateSection(section);
      if (errors.length > 0) {
        console.warn(`Warning: ${file} — ${errors.join(', ')}`);
        continue;
      }

      sections.push({
        data: section,
        content: content.trim(),
        filePath,
        fileName: file,
      });
    } catch {
      console.warn(`Warning: could not parse ${file}, skipping`);
    }
  }

  // Sort by order, then alphabetically by section name for stable ordering
  return sections.sort((a, b) => {
    if (a.data.order !== b.data.order) return a.data.order - b.data.order;
    return a.data.section.localeCompare(b.data.section);
  });
}

// ── Validation ────────────────────────────────────────────────────

export function validateSection(data: SectionFrontmatter): string[] {
  const errors: string[] = [];

  if (!data.section || typeof data.section !== 'string') {
    errors.push('missing or invalid "section" field');
  }
  if (typeof data.order !== 'number' || isNaN(data.order)) {
    errors.push('missing or invalid "order" field (must be a number)');
  }
  if (data.cache && data.cache !== 'static' && data.cache !== 'dynamic') {
    errors.push('"cache" must be "static" or "dynamic"');
  }
  if (data.budget !== undefined && (typeof data.budget !== 'number' || data.budget <= 0)) {
    errors.push('"budget" must be a positive number');
  }

  return errors;
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Derive section name and order from filename pattern: NN-name.md
 */
function deriveFromFilename(filename: string): { section: string; order: number } {
  const base = filename.replace(/\.md$/, '');
  const match = base.match(/^(\d+)-(.+)$/);
  if (match) {
    return {
      order: parseInt(match[1], 10),
      section: match[2],
    };
  }
  return { section: base, order: 50 };
}
