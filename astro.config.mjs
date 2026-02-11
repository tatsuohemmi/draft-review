import { defineConfig } from 'astro/config';
import remarkObsidianCleanup from './src/plugins/remark-obsidian-cleanup.mjs';
import remarkParagraphIds from './src/plugins/remark-paragraph-ids.mjs';
import rehypeParagraphWrapper from './src/plugins/rehype-paragraph-wrapper.mjs';

export default defineConfig({
  site: 'https://tatsuohemmi.github.io',
  base: '/draft-review/',
  markdown: {
    remarkPlugins: [
      remarkObsidianCleanup,
      remarkParagraphIds,
    ],
    rehypePlugins: [
      rehypeParagraphWrapper,
    ],
  },
});
