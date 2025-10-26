"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_COMMENT_LENGTH } from "@/lib/validators/comment";

import { createCommentAction, type CommentFormState } from "./actions";

type CommentFormProps = {
  articleId: string;
  slug: string;
  userName: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Mengirim..." : "Kirim Komentar"}
    </Button>
  );
}

export function CommentForm({ articleId, slug, userName }: CommentFormProps) {
  const [state, formAction] = useActionState<CommentFormState, FormData>(
    createCommentAction.bind(null, articleId, slug),
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

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
    <form ref={formRef} action={formAction} className="space-y-4">
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
      {state?.error ? (
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
