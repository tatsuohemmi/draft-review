#!/usr/bin/env node
/**
 * seed-annotation-ids.mjs
 *
 * Adds Obsidian block reference markers (^n0001, ^n0002, ...) to prose
 * paragraphs in the `## 注釈` section of each vault-side draft.md.
 *
 * Rules:
 *   - Only processes the `## 注釈` section (from `## 注釈` to the next `##`
 *     heading or a standalone `---` line).
 *   - Skips heading lines (starting with `#`).
 *   - Skips list items (starting with `- `, `* `, `+ `, or `N. `).
 *   - Skips table rows (starting with `|`).
 *   - Skips content inside code blocks (``` fences, properly tracked).
 *   - Skips footnote lines (starting with superscript characters ¹²³…).
 *   - Skips blocks that already end with a block marker `^[a-z]\d{4}`.
 *   - Numbering is per-file and resets to ^n0001 for each file.
 *   - Idempotent: running twice produces no additional changes.
 *
 * Code block fence tracking:
 *   Opening: any line starting with 3+ backticks (possibly with info string)
 *   Closing: same fence character, same or greater length, followed only by
 *            optional whitespace or an Obsidian block reference (^x\d{4})
 *
 * Usage:
 *   node scripts/seed-annotation-ids.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const configPath = resolve(projectRoot, 'drafts.config.json');

function main() {
  if (!existsSync(configPath)) {
    console.error(`[seed] ERROR: config not found at ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const { projects, vaultDraftsRoot } = config;
  const draftsRoot = resolve(projectRoot, vaultDraftsRoot);

  const uniqueProjects = [...new Set(projects)];

  let totalFiles = 0;
  let totalAdded = 0;

  for (const project of uniqueProjects) {
    const draftPath = resolve(draftsRoot, project, 'draft.md');

    if (!existsSync(draftPath)) {
      console.warn(`[seed] WARN: ${project}/draft.md not found — skipping`);
      continue;
    }

    const raw = readFileSync(draftPath, 'utf-8');
    const result = processFile(raw, project);

    if (result.added > 0) {
      writeFileSync(draftPath, result.content, 'utf-8');
      console.log(`[seed] OK  ${project}: added ${result.added} marker(s)`);
    } else {
      console.log(`[seed] --  ${project}: no changes (${result.skipped} already marked)`);
    }

    totalFiles++;
    totalAdded += result.added;
  }

  console.log(`\n[seed] Done. Processed ${totalFiles} files, added ${totalAdded} markers total.`);
}

/**
 * Returns true if the line is a prose paragraph block start (not a heading,
 * list item, table row, etc.).
 */
function isProseBlock(firstLine) {
  const t = firstLine.trimStart();
  if (!t) return false;
  if (/^#{1,6} /.test(t)) return false;                        // heading
  if (/^[-*+] /.test(t)) return false;                         // unordered list
  if (/^\d+[.)]\s/.test(t)) return false;                      // ordered list
  if (t.startsWith('|')) return false;                          // table row
  if (/^[¹²³⁴⁵⁶⁷⁸⁹⁰]/.test(t)) return false;                 // superscript footnote
  if (/^\[\^/.test(t)) return false;                            // markdown footnote ref
  if (/^(`{3,}|~{3,})/.test(t)) return false;                  // code fence line
  if (t.startsWith('>')) return false;                          // blockquote
  return true;
}

/**
 * Code-block fence tracker.
 * Returns a function that takes a (stripped) line and returns whether it's a fence.
 * The function mutates its closure state.
 */
function makeFenceTracker() {
  let inCodeBlock = false;
  let openChar    = null;  // '`' or '~'
  let openLen     = 0;

  function check(line) {
    const s = line.trimStart();
    const m = s.match(/^(`+|~+)/);
    if (!m) return { isFence: false, inCode: inCodeBlock };

    const ch  = m[1][0];
    const len = m[1].length;
    if (len < 3) return { isFence: false, inCode: inCodeBlock };

    const afterFence = s.slice(len);

    if (!inCodeBlock) {
      // Any 3+ fence opens a code block
      inCodeBlock = true;
      openChar    = ch;
      openLen     = len;
      return { isFence: true, inCode: true };
    } else {
      // Closing fence: same character, same or longer, only optional whitespace after
      // (CommonMark spec: closing fence must not have non-whitespace after it)
      if (ch === openChar && len >= openLen && /^\s*$/.test(afterFence)) {
        inCodeBlock = false;
        openChar    = null;
        openLen     = 0;
        return { isFence: true, inCode: false };
      }
      // Looks like a fence but doesn't close (e.g., ```info inside a block)
      return { isFence: false, inCode: true };
    }
  }

  check.isInCode = () => inCodeBlock;
  return check;
}

function processFile(content, project) {
  const hasCrlf = content.includes('\r\n');
  const eol = hasCrlf ? '\r\n' : '\n';
  const lines = content.split(eol);

  // Find ## 注釈 section boundaries
  let annotStart = -1;
  let annotEnd   = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].replace(/\r$/, '');
    if (s === '## 注釈') {
      annotStart = i + 1;
    } else if (annotStart >= 0 && annotEnd === lines.length) {
      if (/^## /.test(s) && s !== '## 注釈') { annotEnd = i; break; }
      if (s === '---') { annotEnd = i; break; }
    }
  }

  if (annotStart < 0) {
    console.warn(`[seed] WARN: no ## 注釈 section in "${project}" — skipping`);
    return { content, added: 0, skipped: 0 };
  }

  const modifiedLines = [...lines];
  const fenceCheck = makeFenceTracker();
  let markerSeq = 0;
  let added   = 0;
  let skipped = 0;

  let i = annotStart;
  while (i < annotEnd) {
    const rawLine = lines[i];
    const s = rawLine.replace(/\r$/, '');

    // Check for code fence (properly tracked)
    const { isFence } = fenceCheck(s);
    if (isFence) { i++; continue; }

    // Inside code block: skip
    if (fenceCheck.isInCode()) { i++; continue; }

    // Empty line
    if (s.trim() === '') { i++; continue; }

    // Collect contiguous non-empty, non-fence lines as a block
    const blockStart = i;
    while (i < annotEnd) {
      const ls = lines[i].replace(/\r$/, '');
      if (ls.trim() === '') break;
      // Stop at a fence (don't include it in the block)
      const fm = ls.trimStart().match(/^(`+|~+)/);
      if (fm && fm[1].length >= 3) break;
      i++;
    }
    const blockEnd = i; // exclusive

    const firstLine = lines[blockStart].replace(/\r$/, '');
    const lastLine  = lines[blockEnd - 1].replace(/\r$/, '');

    // Skip non-prose blocks
    if (!isProseBlock(firstLine)) continue;

    // Skip if already has any block marker
    if (/ \^[a-z]\d{4}$/.test(lastLine)) { skipped++; continue; }

    // Assign marker
    markerSeq++;
    const marker = `^n${String(markerSeq).padStart(4, '0')}`;

    // Append to last line, preserving trailing CR
    const raw = lines[blockEnd - 1];
    const hasTrailingCr = raw.endsWith('\r');
    const base = hasTrailingCr ? raw.slice(0, -1) : raw;
    modifiedLines[blockEnd - 1] = base + ` ${marker}` + (hasTrailingCr ? '\r' : '');

    added++;
  }

  return { content: modifiedLines.join(eol), added, skipped };
}

main();
