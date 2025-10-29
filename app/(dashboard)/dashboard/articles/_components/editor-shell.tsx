
import type { MediaItem } from "@/components/media/media-grid";
import { ArticleForm } from "@/components/forms/article-form";

export type ArticleEditorShellProps = {
  backHref?: string;
  mediaItems: MediaItem[];
  initialValues?: Parameters<typeof ArticleForm>[0]["initialValues"];
  draftLabel?: string;
  publishLabel?: string;
  redirectTo?: string;
  allTags: string[];
  allCategories: string[];
  currentRole: Parameters<typeof ArticleForm>[0]["currentRole"];
  canPublishContent?: boolean;
  forbiddenPhrases?: string[];
};

export function ArticleEditorShell({
  mediaItems,
  initialValues,
  draftLabel,
  publishLabel,
  redirectTo,
  allTags,
  allCategories,
  currentRole,
  canPublishContent = true,
  forbiddenPhrases = [],
}: ArticleEditorShellProps) {
  return (
    <div className="space-y-6">
      <ArticleForm
        key={initialValues?.id ?? "new-article"}
        mediaItems={mediaItems}
        initialValues={initialValues}
        draftLabel={draftLabel}
        publishLabel={publishLabel}
        redirectTo={redirectTo}
        allTags={allTags}
        allCategories={allCategories}
        currentRole={currentRole}
        canPublishContent={canPublishContent}
        forbiddenPhrases={forbiddenPhrases}
      />
    </div>
  );
}
