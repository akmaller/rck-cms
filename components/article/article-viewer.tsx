import Image from "next/image";
import Link from "next/link";
import { Fragment, ReactNode } from "react";

type TiptapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: TiptapNode[];
  marks?: TiptapMark[];
};

type ArticleViewerProps = {
  content: unknown;
};

function applyMarks(text: ReactNode, marks: TiptapMark[] = []) {
  return marks.reduce((acc, mark, index) => {
    switch (mark.type) {
      case "bold":
        return <strong key={`bold-${index}`}>{acc}</strong>;
      case "italic":
        return <em key={`italic-${index}`}>{acc}</em>;
      case "strike":
        return <span key={`strike-${index}`} className="line-through">{acc}</span>;
      case "code":
        return (
          <code key={`code-${index}`} className="rounded bg-muted px-1 py-0.5 text-sm">
            {acc}
          </code>
        );
      case "link":
        return (
          <Link key={`link-${index}`} href={(mark.attrs?.href as string) ?? "#"} className="text-primary underline">
            {acc}
          </Link>
        );
      default:
        return acc;
    }
  }, text);
}

function renderNodes(nodes: TiptapNode[] | undefined, keyPrefix = "node" ): ReactNode[] {
  if (!nodes) return [];
  return nodes.map((node, index) => renderNode(node, `${keyPrefix}-${index}`));
}

function renderNode(node: TiptapNode, key: string): ReactNode {
  switch (node.type) {
    case "paragraph":
      if (!node.content || node.content.length === 0) {
        return <p key={key} className="leading-7">&nbsp;</p>;
      }
      return (
        <p key={key} className="leading-7">
          {renderNodes(node.content, key)}
        </p>
      );
    case "text":
      return <Fragment key={key}>{applyMarks(node.text ?? "", node.marks)}</Fragment>;
    case "heading":
      const level = node.attrs?.level ?? 2;
      const HeadingTag = (`h${Math.min(6, Math.max(1, level))}` as keyof JSX.IntrinsicElements);
      return (
        <HeadingTag key={key} className="scroll-m-20 font-semibold tracking-tight">
          {renderNodes(node.content, key)}
        </HeadingTag>
      );
    case "bulletList":
      return (
        <ul key={key} className="ml-6 list-disc space-y-2">
          {renderNodes(node.content, key)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="ml-6 list-decimal space-y-2">
          {renderNodes(node.content, key)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{renderNodes(node.content, key)}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
          {renderNodes(node.content, key)}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre key={key} className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
          <code>{node.content?.map((child) => child.text).join("\n")}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} className="my-6 border-border" />;
    case "hardBreak":
      return <br key={key} />;
    case "image":
      if (node.attrs?.src && typeof node.attrs.src === "string") {
        return (
          <div key={key} className="my-4 overflow-hidden rounded-md border border-border/60">
            <Image
              src={node.attrs.src}
              alt={(node.attrs.alt as string) ?? ""}
              width={node.attrs.width ? Number(node.attrs.width) : 800}
              height={node.attrs.height ? Number(node.attrs.height) : 450}
              className="h-auto w-full object-cover"
            />
            {node.attrs.title ? (
              <p className="bg-muted px-3 py-2 text-xs text-muted-foreground">{node.attrs.title}</p>
            ) : null}
          </div>
        );
      }
      return null;
    default:
      return node.content ? <Fragment key={key}>{renderNodes(node.content, key)}</Fragment> : null;
  }
}

export function ArticleViewer({ content }: ArticleViewerProps) {
  if (!content || typeof content !== "object") {
    return null;
  }

  const doc = content as { type?: string; content?: TiptapNode[] };
  if (doc.type !== "doc") {
    return null;
  }

  return <div className="prose prose-neutral max-w-none dark:prose-invert">{renderNodes(doc.content)}</div>;
}
