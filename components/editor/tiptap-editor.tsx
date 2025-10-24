"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image, { type SetImageOptions } from "@tiptap/extension-image";
import { Bold, Italic, List, ListOrdered, Quote, Heading2, Heading3, Heading4, Minus, Link as LinkIcon, Image as ImageIcon, Code, Strikethrough } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MediaItem } from "@/components/media/media-grid";
import { ImageInsertDialog } from "@/components/editor/image-insert-dialog";

export type TiptapEditorProps = {
  value?: Record<string, unknown>;
  onChange?: (json: Record<string, unknown>) => void;
  placeholder?: string;
  mediaItems?: MediaItem[];
};

const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: {
        default: null,
      },
      "data-width": {
        default: null,
      },
    };
  },
});

const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    bulletList: { keepMarks: true, keepAttributes: false },
    orderedList: { keepMarks: true, keepAttributes: false },
    blockquote: {},
    codeBlock: {},
    strike: {},
    link: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
  }),
  CustomImage.configure({ inline: false, allowBase64: true }),
];

export function TiptapEditor({ value, onChange, placeholder, mediaItems = [] }: TiptapEditorProps) {
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    content: value && Object.keys(value).length ? value : { type: "doc", content: [] },
    editorProps: {
      attributes: {
        class:
          "min-h-[240px] prose prose-neutral max-w-none dark:prose-invert focus:outline-none",
      },
    },
    onUpdate({ editor }) {
      onChange?.(editor.getJSON() as Record<string, unknown>);
    },
  });

  useEffect(() => {
    if (!editor || !value) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  const toggleLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Masukkan URL tautan", previousUrl ?? "https://");
    if (url === null) {
      return;
    }
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]);

  const insertImage = useCallback(() => {
    if (!editor) return;
    setIsImageDialogOpen(true);
  }, [editor]);

  const handleInsertImage = useCallback(
    (data: { src: string; alt?: string; width?: string }) => {
      if (!editor) return;
      const imageOptions: SetImageOptions = {
        src: data.src,
      };
      if (data.alt) {
        imageOptions.alt = data.alt;
        imageOptions.title = data.alt;
      }

      const chain = editor.chain().focus().setImage(imageOptions);

      if (data.width && data.width !== "auto") {
        chain.updateAttributes("image", {
          style: `display:block;margin-left:auto;margin-right:auto;width:${data.width};`,
          "data-width": data.width,
        } as Record<string, unknown>);
      } else {
        chain.updateAttributes("image", {
          style: "display:block;margin-left:auto;margin-right:auto;",
          "data-width": null,
        } as Record<string, unknown>);
      }

      chain.run();
    },
    [editor]
  );

  if (!editor) {
    return (
      <div className="rounded-md border border-input bg-background px-3 py-4 text-sm text-muted-foreground">
        Memuat editor...
      </div>
    );
  }

  return (
    <div className="rounded-md border border-input bg-background">
      {placeholder ? (
        <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          {placeholder}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-b border-border px-3 py-2">
        <ToolbarButton
          tooltip="Judul 2"
          onClick={() => editor.chain().focus().clearNodes().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Judul 3"
          onClick={() => editor.chain().focus().clearNodes().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Judul 4"
          onClick={() => editor.chain().focus().clearNodes().toggleHeading({ level: 4 }).run()}
          isActive={editor.isActive("heading", { level: 4 })}
        >
          <Heading4 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton
          tooltip="Tebal"
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Miring"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Coret"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton
          tooltip="Daftar"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Daftar bernomor"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Indentasi kutipan"
          onClick={() => editor.chain().focus().clearNodes().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          tooltip="Kode blok"
          onClick={() => editor.chain().focus().clearNodes().toggleCodeBlock().run()}
          isActive={editor.isActive("codeBlock")}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton tooltip="Tautkan" onClick={toggleLink} isActive={editor.isActive("link")}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Hapus tautan" onClick={() => editor.chain().focus().unsetLink().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton tooltip="Sisipkan gambar" onClick={insertImage}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className="px-3 py-4" />
      <ImageInsertDialog
        open={isImageDialogOpen}
        onOpenChange={setIsImageDialogOpen}
        onInsert={(image) => {
          handleInsertImage(image);
          setIsImageDialogOpen(false);
        }}
        initialItems={mediaItems}
      />
    </div>
  );
}

type ToolbarButtonProps = {
  children: ReactNode;
  onClick: () => void;
  isActive?: boolean;
  tooltip?: string;
};

function ToolbarButton({ children, onClick, isActive = false, tooltip }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant={isActive ? "secondary" : "ghost"}
      size="sm"
      title={tooltip}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-1 h-6 w-px bg-border" aria-hidden />;
}
