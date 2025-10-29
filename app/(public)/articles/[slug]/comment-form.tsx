"use client";

import { useActionState, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  parentId?: string;
  onSuccess?: () => void;
  variant?: "default" | "reply";
  autoFocus?: boolean;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Mengirim..." : label}
    </Button>
  );
}

export function CommentForm({
  articleId,
  slug,
  userName,
  forbiddenPhrases = [],
  parentId,
  onSuccess,
  variant = "default",
  autoFocus = false,
}: CommentFormProps) {
  const [state, formAction] = useActionState<CommentFormState, FormData>(
    createCommentAction.bind(null, articleId, slug),
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const controlId = useId();
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
      onSuccess?.();
    }
  }, [state?.success, onSuccess]);

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <input type="hidden" name="parentId" value={parentId ?? ""} />
      {variant === "default" ? (
        <div className="text-sm text-muted-foreground">
          Mengomentari sebagai{" "}
          <span className="font-semibold text-foreground">{userName}</span>
        </div>
      ) : null}
      <div className="space-y-2">
        <Textarea
          name="content"
          id={`comment-content-${controlId}`}
          placeholder={
            variant === "reply"
              ? "Tulis balasan Anda..."
              : "Bagikan pandangan Anda dengan santun dan relevan..."
          }
          rows={variant === "reply" ? 3 : 4}
          maxLength={MAX_COMMENT_LENGTH}
          minLength={1}
          required
          autoFocus={autoFocus}
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
        <SubmitButton label={variant === "reply" ? "Kirim Balasan" : "Kirim Komentar"} />
      </div>
    </form>
  );
}
