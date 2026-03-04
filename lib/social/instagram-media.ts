import { deriveThumbnailUrl } from "@/lib/storage/media";

type FeaturedMediaInput = {
  url: string | null;
  thumbnailUrl: string | null;
  mimeType: string | null;
};

export function resolveInstagramSourceImageUrl(featuredMedia: FeaturedMediaInput | null | undefined) {
  if (!featuredMedia) {
    return null;
  }

  const isVideo = featuredMedia.mimeType?.startsWith("video/") ?? false;
  return (
    (isVideo ? featuredMedia.thumbnailUrl : featuredMedia.url) ??
    deriveThumbnailUrl(featuredMedia.url ?? "") ??
    null
  );
}

export function buildInstagramShareImageApiUrl(options: {
  siteUrl: string;
  slug: string;
  articleUrl: string;
}) {
  const base = options.siteUrl.replace(/\/+$/, "");
  return `${base}/api/public/articles/${encodeURIComponent(options.slug)}/share-instagram?articleUrl=${encodeURIComponent(
    options.articleUrl
  )}`;
}
