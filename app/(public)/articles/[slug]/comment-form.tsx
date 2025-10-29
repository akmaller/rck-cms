"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_COMMENT_LENGTH } from "@/lib/validators/comment";

import { createCommentAction, type CommentFormState } from "./actions";
import { findForbiddenMatch, normalizeForComparison } from "@/lib/moderation/filter-utils";

type CommentFormProps = {
  articleId: string;
  slug: string;
  userName: string;
  forbiddenPhrases?: string[];
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Mengirim..." : "Kirim Komentar"}
    </Button>
  );
}

export function CommentForm({ articleId, slug, userName, forbiddenPhrases = [] }: CommentFormProps) {
  const [state, formAction] = useActionState<CommentFormState, FormData>(
    createCommentAction.bind(null, articleId, slug),
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const forbiddenEntries = useMemo(
    () =>
      forbiddenPhrases
        .map((phrase) => ({ phrase, normalized: normalizeForComparison(phrase) }))
        .filter((item) => item.normalized.length > 0),
    [forbiddenPhrases]
  );
  const handleSubmit = useCallback(
    async (formData: FormData) => {
      setClientError(null);
      if (forbiddenEntries.length) {
        const contentValue = formData.get("content");
        const match = findForbiddenMatch(
          typeof contentValue === "string" ? contentValue : null,
          forbiddenEntries
        );
        if (match) {
          setClientError(
            `Komentar mengandung kata/kalimat terlarang "${match.phrase}". Hapus kata tersebut sebelum mengirim.`
          );
          return;
        }
      }
      await formAction(formData);
    },
    [formAction, forbiddenEntries]
  );

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      if (formRef.current) {
        const textarea = formRef.current.querySelector("textarea");
        textarea?.focus();
      }
    }
  }, [state?.success]);

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Mengomentari sebagai{" "}
        <span className="font-semibold text-foreground">{userName}</span>
      </div>
      <div className="space-y-2">
        <Textarea
          name="content"
          id="comment-content"
          placeholder="Bagikan pandangan Anda dengan santun dan relevan..."
          rows={4}
          maxLength={MAX_COMMENT_LENGTH}
          minLength={1}
          required
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Tetap sopan dan hindari membagikan data pribadi.</span>
          <span>Maks. {MAX_COMMENT_LENGTH} karakter</span>
        </div>
      </div>
      {clientError ? (
        <p className="text-sm text-destructive">{clientError}</p>
      ) : state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="text-sm text-emerald-600">Komentar berhasil dikirim.</p>
      ) : null}
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
