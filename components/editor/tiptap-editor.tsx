"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";


export type TiptapEditorProps = {
  value?: Record<string, unknown>;
  onChange?: (json: Record<string, unknown>) => void;
  placeholder?: string;
};

const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false },
    blockquote: true,
    codeBlock: true,
  }),
  Link.configure({
    openOnClick: true,
    autolink: true,
    linkOnPaste: true,
  }),
  Image.configure({ inline: false, allowBase64: true }),
];

export function TiptapEditor({ value, onChange, placeholder }: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    content: value && Object.keys(value).length ? value : { type: "doc", content: [] },
    editorProps: {
      attributes: {
        class:
          "min-h-[200px] prose prose-neutral max-w-none dark:prose-invert focus:outline-none",
      },
    },
    onUpdate({ editor }) {
      const json = editor.getJSON();
      onChange?.(json as Record<string, unknown>);
    },
  });

  useEffect(() => {
    if (!editor || !value) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  return (
    <div className="rounded-md border border-input bg-background">
      {placeholder ? (
        <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          {placeholder}
        </div>
      ) : null}
      <EditorContent editor={editor} className="px-3 py-4" />
    </div>
  );
}
