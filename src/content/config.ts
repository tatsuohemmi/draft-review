import { defineCollection, z } from 'astro:content';

const drafts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    type: z.string().optional(),
    project: z.string().optional(),
    'creation-date': z.coerce.string().optional(),
    source: z.string().optional(),
    enccre_url: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    sourceFolder: z.string(),
    lastCopied: z.string(),
  }),
});

export const collections = { drafts };
