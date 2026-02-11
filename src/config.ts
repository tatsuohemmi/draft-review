export const SITE_CONFIG = {
  owner: 'tatsuohemmi',
  repo: 'draft-review',
  basePath: '/draft-review',
  issueTemplateFile: 'paragraph-comment.yml',
} as const;

export function buildCommentUrl(params: {
  pid: string;
  title: string;
  context: string;
  pageUrl: string;
}): string {
  const base = `https://github.com/${SITE_CONFIG.owner}/${SITE_CONFIG.repo}/issues/new`;
  const searchParams = new URLSearchParams({
    template: SITE_CONFIG.issueTemplateFile,
    title: `[${params.pid}] ${params.title}`,
    'paragraph-id': params.pid,
    'paragraph-context': params.context.slice(0, 140),
    'page-url': params.pageUrl,
  });
  return `${base}?${searchParams.toString()}`;
}
