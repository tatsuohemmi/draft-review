import { visit } from 'unist-util-visit';

export default function rehypeParagraphWrapper() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'p') return;

      const pid = node.properties?.['data-pid'] ?? node.properties?.dataPid;
      if (!pid) return;

      node.children.push({
        type: 'element',
        tagName: 'span',
        properties: { className: ['paragraph-tools'] },
        children: [
          {
            type: 'element',
            tagName: 'a',
            properties: {
              className: ['paragraph-anchor'],
              href: `#${pid}`,
              title: 'Copy link',
            },
            children: [{ type: 'text', value: `\u00B6 ${pid}` }],
          },
          {
            type: 'element',
            tagName: 'a',
            properties: {
              className: ['comment-button'],
              'data-pid': pid,
              href: '#',
              target: '_blank',
            },
            children: [{ type: 'text', value: 'Comment' }],
          },
        ],
      });
    });
  };
}
