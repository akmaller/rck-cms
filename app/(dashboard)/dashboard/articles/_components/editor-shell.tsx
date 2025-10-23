
import type { MediaItem } from "@/components/media/media-grid";
import { ArticleForm } from "@/components/forms/article-form";

export type ArticleEditorShellProps = {
  backHref?: string;
  mediaItems: MediaItem[];
  initialValues?: Parameters<typeof ArticleForm>[0]["initialValues"];
  submitLabel?: string;
  redirectTo?: string;
  allTags: string[];
  allCategories: string[];
};

export function ArticleEditorShell({
  mediaItems,
  initialValues,
  submitLabel,
  redirectTo,
  allTags,
  allCategories,
}: ArticleEditorShellProps) {
  return (
    <div className="space-y-6">
      <ArticleForm
        key={initialValues?.id ?? "new-article"}
        mediaItems={mediaItems}
        initialValues={initialValues}
        submitLabel={submitLabel}
        redirectTo={redirectTo}
        allTags={allTags}
        allCategories={allCategories}
      />
    </div>
  );
}
