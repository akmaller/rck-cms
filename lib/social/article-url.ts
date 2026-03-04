export function buildArticleUrl(siteUrl: string, slug: string) {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/articles/${slug}`;
}
