"use client";

import { Editor } from "@tiptap/react";
import { Bold, Italic, Heading2, Heading3, Heading4, List, ListOrdered, Quote, Code, Minus, Link as LinkIcon, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

const toggleClasses = "h-9 w-9 p-0";

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const addLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Masukkan URL", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt("URL gambar");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <Button
        type="button"
        variant={editor.isActive("bold") ? "default" : "ghost"}
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("italic") ? "default" : "ghost"}
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().clearNodes().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("heading", { level: 3 }) ? "default" : "ghost"}
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().clearNodes().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("heading", { level: 4 }) ? "default" : "ghost"}
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().clearNodes().toggleHeading({ level: 4 }).run()}
      >
        <Heading4 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("bulletList") ? "default" : "ghost"}
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("orderedList") ? "default" : "ghost"}
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("blockquote") ? "default" : "ghost"}
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().clearNodes().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor.isActive("codeBlock") ? "default" : "ghost"}
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().clearNodes().toggleCodeBlock().run()}
      >
        <Code className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={toggleClasses}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={toggleClasses} onClick={addLink}>
        <LinkIcon className="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={toggleClasses} onClick={addImage}>
        <ImageIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
