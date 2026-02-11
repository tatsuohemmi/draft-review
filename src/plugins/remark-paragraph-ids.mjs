import { visit } from 'unist-util-visit';

/**
 * remark plugin: Obsidian block references (^p0001) to HTML element attributes.
 *
 * Walks MDAST paragraph (and listItem) nodes, detects trailing ` ^pNNNN`
 * patterns, strips them from the text, and sets id / data-pid /
 * class="commentable-paragraph" on the resulting HTML element via hProperties.
 */
export default function remarkParagraphIds() {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      // --- 1. Direct paragraph nodes ---
      if (node.type === 'paragraph') {
        applyBlockId(node);
        return;
      }

      // --- 2. listItem nodes (e.g. `- ^p0018`) ---
      //     A listItem typically wraps its content in a child paragraph.
      if (node.type === 'listItem') {
        const children = node.children || [];
        for (const child of children) {
          if (child.type === 'paragraph') {
            applyBlockId(child);
          }
        }
      }
    });
  };
}

/**
 * Inspect the last child of a paragraph node for a trailing ` ^pNNNN`
 * block-reference pattern.  When found, strip the suffix from the text
 * and attach hProperties (id, data-pid, class) so that remark-rehype
 * renders them as HTML attributes.
 *
 * @param {object} paragraphNode — MDAST node with type === 'paragraph'
 */
function applyBlockId(paragraphNode) {
  const children = paragraphNode.children;
  if (!children || children.length === 0) return;

  const last = children[children.length - 1];
  if (last.type !== 'text') return;

  // Match ` ^pNNNN` only at the very end of the text value.
  const match = last.value.match(/ \^(p\d{4})$/);
  if (!match) return;

  const id = match[1]; // e.g. "p0001"

  // Strip the block-reference suffix from the text node.
  last.value = last.value.slice(0, -match[0].length);

  // If stripping left an empty text node, remove it entirely.
  if (last.value === '') {
    children.pop();
  }

  // Attach hProperties so remark-rehype converts them to HTML attributes.
  paragraphNode.data = paragraphNode.data || {};
  paragraphNode.data.hProperties = paragraphNode.data.hProperties || {};
  paragraphNode.data.hProperties.id = id;
  paragraphNode.data.hProperties['data-pid'] = id;
  paragraphNode.data.hProperties.class = 'commentable-paragraph';
}
