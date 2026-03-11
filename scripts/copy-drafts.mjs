#!/usr/bin/env node
/**
 * copy-drafts.mjs
 *
 * Reads drafts.config.json and, for each listed project, copies
 * ../{project}/draft.md into src/content/drafts/{slug}.md with
 * additional frontmatter fields injected.
 *
 * Usage:
 *   node scripts/copy-drafts.mjs          (from _web/ root)
 *   npm run copy-drafts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { folderToSlug } from './slug-utils.mjs';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const projectRoot = resolve(__dirname, '..');                // _web/

const configPath = resolve(projectRoot, 'drafts.config.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter delimited by leading `---` fences.
 * Returns { attrs: string (raw YAML), body: string } or null.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;
  return { attrs: match[1], body: match[2] };
}

/**
 * Check whether the body contains at least one Obsidian paragraph ID (`^pNNNN`).
 */
function hasParagraphIds(body) {
  return /\^[pn]\d{4}/.test(body);
}

/**
 * Inject extra YAML fields into existing frontmatter string.
 * Appended right before the closing `---`.
 */
function injectFrontmatter(rawYaml, extraFields) {
  const lines = Object.entries(extraFields).map(
    ([key, value]) => `${key}: "${value}"`
  );
  return rawYaml.trimEnd() + '\n' + lines.join('\n');
}

/**
 * Strip Markdown and Obsidian wiki-style image references from the body.
 *
 * Patterns handled:
 *   - Markdown images:  `![alt](path)`
 *   - Obsidian wiki images:  `![[filename]]`
 *
 * If the image line also carries a paragraph ID (`^pNNNN`), the ID is
 * preserved as a standalone line so downstream paragraph anchoring is
 * not broken.
 *
 * @param {string} body - Document body (after frontmatter).
 * @returns {{ body: string, imageCount: number }}
 */
function stripImageReferences(body) {
  let imageCount = 0;

  // Markdown images: ![alt](path)  optional ^pNNNN at end of line
  const pass1 = body.replace(
    /^!\[([^\]]*)\]\([^)]+\)([ \t]*\^p\d{4})?[ \t]*$/gm,
    (_match, _alt, pid) => {
      imageCount++;
      return pid ? pid.trim() : '';
    },
  );

  // Obsidian wiki images: ![[filename]]  optional ^pNNNN at end of line
  const pass2 = pass1.replace(
    /^!\[\[([^\]]+)\]\]([ \t]*\^p\d{4})?[ \t]*$/gm,
    (_match, _file, pid) => {
      imageCount++;
      return pid ? pid.trim() : '';
    },
  );

  return { body: pass2, imageCount };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  // --- Load config ---------------------------------------------------------
  if (!existsSync(configPath)) {
    console.error(`[copy-drafts] ERROR: config not found at ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  const { projects, vaultDraftsRoot, outputDir } = config;

  if (!Array.isArray(projects) || projects.length === 0) {
    console.error('[copy-drafts] ERROR: "projects" array is empty or missing in config.');
    process.exit(1);
  }

  const draftsRoot = resolve(projectRoot, vaultDraftsRoot);   // ../ from _web
  const outDir     = resolve(projectRoot, outputDir);         // src/content/drafts

  // Ensure output directory exists
  mkdirSync(outDir, { recursive: true });

  const now = new Date().toISOString();
  let copied  = 0;
  let skipped = 0;

  // --- Process each project ------------------------------------------------
  for (const project of projects) {
    const draftPath = resolve(draftsRoot, project, 'draft.md');

    // Check existence
    if (!existsSync(draftPath)) {
      console.warn(`[copy-drafts] WARN: draft.md not found for "${project}" — skipping`);
      console.warn(`              expected: ${draftPath}`);
      skipped++;
      continue;
    }

    // Read source
    const raw = readFileSync(draftPath, 'utf-8');

    // Parse frontmatter
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      console.warn(`[copy-drafts] WARN: no YAML frontmatter in "${project}/draft.md" — skipping`);
      skipped++;
      continue;
    }

    // Warn (but don't skip) if no paragraph IDs
    if (!hasParagraphIds(parsed.body)) {
      console.warn(`[copy-drafts] WARN: no ^p IDs found in "${project}/draft.md" — copying anyway`);
    }

    // Strip image references (Markdown & Obsidian wiki syntax)
    const { body: cleanedBody, imageCount } = stripImageReferences(parsed.body);
    if (imageCount > 0) {
      console.log(`[copy-drafts] INFO: removed ${imageCount} image reference(s) from "${project}/draft.md"`);
    }

    // Build output
    const slug = folderToSlug(project);

    const newYaml = injectFrontmatter(parsed.attrs, {
      slug,
      sourceFolder: project,
      lastCopied:   now,
    });

    const output = `---\n${newYaml}\n---\n${cleanedBody}`;

    // Write
    const outPath = resolve(outDir, `${slug}.md`);
    writeFileSync(outPath, output, 'utf-8');

    console.log(`[copy-drafts] OK: ${project} -> ${slug}.md`);
    copied++;
  }

  // --- Summary -------------------------------------------------------------
  console.log(`\n[copy-drafts] Done. ${copied} copied, ${skipped} skipped.`);
}

main();
