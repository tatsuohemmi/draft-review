#!/usr/bin/env node
/**
 * make-patch-from-issue.mjs
 *
 * Fetches a GitHub Issue by number, extracts the paragraph-id,
 * and locates the corresponding paragraph in the draft.
 *
 * Usage:
 *   node scripts/make-patch-from-issue.mjs --issue 42
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const draftsDir = resolve(projectRoot, 'src/content/drafts');

function parseArgs() {
  const args = process.argv.slice(2);
  const issueIdx = args.indexOf('--issue');
  if (issueIdx === -1 || !args[issueIdx + 1]) {
    console.error('Usage: node scripts/make-patch-from-issue.mjs --issue <number>');
    process.exit(1);
  }
  return { issueNumber: args[issueIdx + 1] };
}

function fetchIssue(number) {
  try {
    const raw = execSync(`gh issue view ${number} --json title,body,labels`, {
      encoding: 'utf-8',
      cwd: projectRoot,
    });
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to fetch issue #${number}. Is gh CLI authenticated?`);
    process.exit(1);
  }
}

function extractParagraphId(issue) {
  // Try title pattern: [p0001]
  const titleMatch = issue.title.match(/\[(p\d{4})\]/);
  if (titleMatch) return titleMatch[1];

  // Try body for "paragraph-id" field
  if (issue.body) {
    const bodyMatch = issue.body.match(/paragraph-id[:\s]+(p\d{4})/i);
    if (bodyMatch) return bodyMatch[1];
  }
  return null;
}

function findParagraphInDrafts(pid) {
  const files = readdirSync(draftsDir).filter(f => f.endsWith('.md'));
  const results = [];

  for (const file of files) {
    const content = readFileSync(resolve(draftsDir, file), 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`^${pid}`)) {
        results.push({
          file,
          line: i + 1,
          text: lines[i].replace(` ^${pid}`, '').trim(),
        });
      }
    }
  }
  return results;
}

function main() {
  const { issueNumber } = parseArgs();
  const issue = fetchIssue(issueNumber);

  console.log(`\n--- Issue #${issueNumber} ---`);
  console.log(`Title: ${issue.title}`);

  const pid = extractParagraphId(issue);
  if (!pid) {
    console.error('Could not extract paragraph ID from issue.');
    process.exit(1);
  }

  console.log(`Paragraph ID: ${pid}\n`);

  const locations = findParagraphInDrafts(pid);
  if (locations.length === 0) {
    console.log(`Paragraph ${pid} not found in any draft.`);
    return;
  }

  for (const loc of locations) {
    console.log(`File: ${loc.file}:${loc.line}`);
    console.log(`Text: ${loc.text.slice(0, 200)}...`);
    console.log();
  }
}

main();
