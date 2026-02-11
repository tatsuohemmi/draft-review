/**
 * remark-obsidian-cleanup
 *
 * A remark plugin that cleans Obsidian-specific syntax from Markdown AST
 * before HTML rendering. Handles:
 *
 *   1. <pen>==...==</pen>        -> <mark>...</mark>
 *   2. <tatsuo_note>...</tatsuo_note>  -> removed entirely
 *   3. [[Target|Display]]        -> Display  (plain text)
 *      [[Target]]                -> Target   (plain text)
 *   4. obsidian:// URLs          -> plain display text (or removed)
 *   5. \u200B{digit}\u200B       -> <sup>{digit}</sup>
 */

import { visit } from 'unist-util-visit';

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** Matches <pen>==content==</pen> with optional whitespace. */
const PEN_RE = /<pen>\s*==([^]*?)==\s*<\/pen>/gi;

/**
 * Matches <tatsuo_note>...</tatsuo_note>.
 * Content may span multiple lines inside a single html node.
 */
const TATSUO_NOTE_RE = /<tatsuo_note>[^]*?<\/tatsuo_note>/gi;

/** Matches Obsidian wikilinks: [[Target|Display]] or [[Target]]. */
const WIKILINK_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/**
 * Matches zero-width-space wrapped digit sequences used as footnotes.
 * \u200B = zero-width space (ZWS).
 */
const ZWS_FOOTNOTE_RE = /\u200B(\d+)\u200B/g;

// ---------------------------------------------------------------------------
// Node-level transformers
// ---------------------------------------------------------------------------

/**
 * Process `html` nodes.
 *
 * - Convert <pen>==...==</pen> to <mark>...</mark>
 * - Strip <tatsuo_note>...</tatsuo_note> entirely
 *
 * Returns `null` when the node should be kept (possibly mutated),
 * or 'remove' when the node should be deleted from the tree.
 */
function processHtmlNode(node) {
  let value = node.value;

  // 1. Remove <tatsuo_note>...</tatsuo_note> blocks
  value = value.replace(TATSUO_NOTE_RE, '');

  // 2. Transform <pen>==...==</pen> -> <mark>...</mark>
  value = value.replace(PEN_RE, '<mark>$1</mark>');

  // If the node is now empty (or whitespace-only), mark for removal.
  if (value.trim() === '') {
    return 'remove';
  }

  node.value = value;
  return null;
}

/**
 * Process `text` nodes.
 *
 * - Replace wikilinks with plain text
 * - Replace ZWS-footnotes with <sup> HTML nodes
 *
 * Returns an array of replacement nodes when splitting is needed,
 * or `null` when the node was mutated in place.
 */
function processTextNode(node) {
  let value = node.value;

  // 3. Wikilinks -> plain text
  value = value.replace(WIKILINK_RE, (_match, target, display) => {
    return display || target;
  });

  // 5. ZWS footnotes -> <sup> tags
  //    This requires splitting the text node into multiple nodes (text + html)
  //    if any ZWS-footnote patterns are found.
  if (ZWS_FOOTNOTE_RE.test(value)) {
    const parts = [];
    let lastIndex = 0;

    // Reset regex state after the test above
    ZWS_FOOTNOTE_RE.lastIndex = 0;

    let match;
    while ((match = ZWS_FOOTNOTE_RE.exec(value)) !== null) {
      // Text before the match
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          value: value.slice(lastIndex, match.index),
        });
      }
      // The footnote digit(s) wrapped in <sup>
      parts.push({
        type: 'html',
        value: `<sup>${match[1]}</sup>`,
      });
      lastIndex = match.index + match[0].length;
    }
    // Remaining text after last match
    if (lastIndex < value.length) {
      parts.push({
        type: 'text',
        value: value.slice(lastIndex),
      });
    }

    return parts;
  }

  // No ZWS footnotes — just update in place
  node.value = value;
  return null;
}

/**
 * Process `link` nodes whose URL starts with `obsidian://`.
 *
 * - If the link has children (display text), replace the link node with
 *   its children (plain text).
 * - If no children, mark for removal.
 */
function processObsidianLink(node) {
  if (node.children && node.children.length > 0) {
    // Return the children to splice in place of the link
    return node.children;
  }
  return 'remove';
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export default function remarkObsidianCleanup() {
  /**
   * Transformer that walks the MDAST tree and applies cleanup rules.
   *
   * @param {import('mdast').Root} tree
   */
  return function transformer(tree) {
    // We collect mutations and apply them in a second pass to avoid
    // issues with modifying the tree while visiting.
    /** @type {Array<{parent: object, index: number, replacements: object[]|'remove'}>} */
    const mutations = [];

    visit(tree, (node, index, parent) => {
      if (node.type === 'html') {
        const result = processHtmlNode(node);
        if (result === 'remove' && parent && index !== undefined) {
          mutations.push({ parent, index, replacements: [] });
        }
        return;
      }

      if (node.type === 'text') {
        const result = processTextNode(node);
        if (Array.isArray(result) && parent && index !== undefined) {
          mutations.push({ parent, index, replacements: result });
        }
        return;
      }

      if (
        node.type === 'link' &&
        typeof node.url === 'string' &&
        node.url.startsWith('obsidian://')
      ) {
        const result = processObsidianLink(node);
        if (result === 'remove' && parent && index !== undefined) {
          mutations.push({ parent, index, replacements: [] });
        } else if (Array.isArray(result) && parent && index !== undefined) {
          mutations.push({ parent, index, replacements: result });
        }
        return;
      }
    });

    // Apply mutations in reverse order so that indices remain valid.
    mutations.sort((a, b) => b.index - a.index);
    for (const { parent, index, replacements } of mutations) {
      parent.children.splice(index, 1, ...replacements);
    }
  };
}
