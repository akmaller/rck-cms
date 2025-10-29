import Image from "next/image";
import Link from "next/link";
import { Fragment, type JSX, type ReactNode } from "react";

import { cn } from "@/lib/utils";

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

type TagReference = {
  name: string;
  slug: string;
};

type ArticleViewerProps = {
  content: unknown;
  tags?: TagReference[];
};

type TagLookupEntry = {
  label: string;
  slug: string;
};

type TagMatchContext = {
  lookup: Map<string, TagLookupEntry>;
  matcher: RegExp | null;
};

type TextSegment =
  | { type: "text"; value: string }
  | { type: "tag"; value: string; slug: string };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTagLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

function createTagMatchContext(tags: TagReference[]): TagMatchContext {
  const lookup = new Map<string, TagLookupEntry>();
  for (const tag of tags) {
    const name = typeof tag.name === "string" ? tag.name.trim() : "";
    const slug = typeof tag.slug === "string" ? tag.slug.trim() : "";
    if (!name || !slug) {
      continue;
    }
    const normalized = normalizeTagLabel(name);
    if (!lookup.has(normalized)) {
      lookup.set(normalized, { label: name, slug });
    }
  }

  if (lookup.size === 0) {
    return { lookup, matcher: null };
  }

  const pattern = Array.from(lookup.values())
    .map((entry) => entry.label)
    .sort((a, b) => b.length - a.length)
    .map((label) => escapeRegExp(label))
    .join("|");

  const matcher = pattern ? new RegExp(pattern, "giu") : null;
  return { lookup, matcher };
}

function isLetterOrNumber(char: string | undefined): boolean {
  if (!char) {
    return false;
  }
  return /\p{L}|\p{N}/u.test(char);
}

function splitTextSegments(text: string, context: TagMatchContext): TextSegment[] {
  if (!text) {
    return [];
  }
  const { matcher, lookup } = context;
  if (!matcher) {
    return [{ type: "text", value: text }];
  }

  const workingMatcher = new RegExp(matcher.source, matcher.flags);
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = workingMatcher.exec(text)) !== null) {
    const start = match.index;
    const end = workingMatcher.lastIndex;
    const matchedValue = match[0];

    if (start > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, start) });
    }

    const beforeChar = start > 0 ? text[start - 1] : "";
    const afterChar = end < text.length ? text[end] : "";
    const normalizedMatch = normalizeTagLabel(matchedValue);
    const tagEntry = lookup.get(normalizedMatch);

    if (!tagEntry || isLetterOrNumber(beforeChar) || isLetterOrNumber(afterChar)) {
      segments.push({ type: "text", value: matchedValue });
    } else {
      segments.push({ type: "tag", value: matchedValue, slug: tagEntry.slug });
    }

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

function sanitizeHref(value: unknown): string {
  if (typeof value !== "string") {
    return "#";
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (/^(https?:|mailto:|tel:)/.test(lower)) {
    return trimmed;
  }
  return "#";
}

function sanitizeImageSrc(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (trimmed.startsWith("/") || lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("data:image") || lower.startsWith("blob:")) {
    return trimmed;
  }
  return null;
}

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
      case "link": {
        const href = sanitizeHref(mark.attrs?.href);
        const isExternal = href.startsWith('http');
        return (
          <Link
            key={`link-${index}`}
            href={href}
            className="text-primary underline"
            rel={isExternal ? 'noopener noreferrer' : undefined}
            target={isExternal ? '_blank' : undefined}
          >
            {acc}
          </Link>
        );
      }
      default:
        return acc;
    }
  }, text);
}

function renderNodes(nodes: TiptapNode[] | undefined, keyPrefix: string, context: TagMatchContext): ReactNode[] {
  if (!nodes) return [];
  return nodes.map((node, index) => renderNode(node, `${keyPrefix}-${index}`, context));
}

function resolveWidthAttributes(value: unknown): { widthPx: number | null; widthPercent: string | null } {
  const fallbackPercent = "50%";

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    if (value <= 100) {
      return { widthPx: null, widthPercent: fallbackPercent };
    }
    return { widthPx: value, widthPercent: null };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return { widthPx: null, widthPercent: fallbackPercent };
    }

    const numeric = Number(trimmed.replace(/%$/, ""));
    if (!Number.isNaN(numeric) && numeric > 0) {
      if (numeric <= 100) {
        return { widthPx: null, widthPercent: fallbackPercent };
      }
      return { widthPx: numeric, widthPercent: null };
    }
  }

  return { widthPx: null, widthPercent: fallbackPercent };
}

function resolveHeightAttribute(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value.trim());
    if (!Number.isNaN(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return null;
}

function renderTextNode(node: TiptapNode, key: string, context: TagMatchContext): ReactNode {
  const textContent = node.text ?? "";
  if (!textContent) {
    return <Fragment key={key}>{applyMarks("", node.marks)}</Fragment>;
  }

  const hasLinkMark = node.marks?.some((mark) => mark.type === "link") ?? false;
  if (hasLinkMark || context.lookup.size === 0) {
    return <Fragment key={key}>{applyMarks(textContent, node.marks)}</Fragment>;
  }

  const segments = splitTextSegments(textContent, context);
  if (segments.length === 0) {
    return <Fragment key={key}>{applyMarks(textContent, node.marks)}</Fragment>;
  }

  return (
    <Fragment key={key}>
      {segments.map((segment, index) => {
        const baseContent =
          segment.type === "tag" ? (
            <Link
              href={`/tags/${segment.slug}`}
              className="font-medium text-primary no-underline hover:no-underline focus-visible:no-underline"
            >
              {segment.value}
            </Link>
          ) : (
            segment.value
          );

        return (
          <Fragment key={`${key}-segment-${index}`}>
            {applyMarks(baseContent, node.marks)}
          </Fragment>
        );
      })}
    </Fragment>
  );
}

function renderNode(node: TiptapNode, key: string, context: TagMatchContext): ReactNode {
  switch (node.type) {
    case "paragraph":
      if (!node.content || node.content.length === 0) {
        return <p key={key} className="leading-7">&nbsp;</p>;
      }
      return (
        <p key={key} className="leading-7">
          {renderNodes(node.content, key, context)}
        </p>
      );
    case "text":
      return renderTextNode(node, key, context);
    case "heading": {
      const rawLevel = Number(node.attrs?.level ?? 2);
      const safeLevel = Number.isFinite(rawLevel) ? rawLevel : 2;
      const HeadingTag = `h${Math.min(6, Math.max(1, safeLevel))}` as keyof JSX.IntrinsicElements;
      return (
        <HeadingTag key={key} className="scroll-m-20 font-semibold tracking-tight">
          {renderNodes(node.content, key, context)}
        </HeadingTag>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="ml-6 list-disc space-y-2">
          {renderNodes(node.content, key, context)}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="ml-6 list-decimal space-y-2">
          {renderNodes(node.content, key, context)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{renderNodes(node.content, key, context)}</li>;
    case "blockquote":
      return (
        <blockquote key={key} className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground">
          {renderNodes(node.content, key, context)}
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
    case "image": {
      const src = sanitizeImageSrc(node.attrs?.src);
      if (!src) {
        return null;
      }
      const { widthPx, widthPercent } = resolveWidthAttributes(node.attrs?.width);
      const height = resolveHeightAttribute(node.attrs?.height) ?? 450;
      const width = widthPx ?? 800;
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      const wrapperStyle = widthPercent ? { width: widthPercent } : undefined;
      return (
        <div
          key={key}
          className={cn(
            "my-4 overflow-hidden rounded-md border border-border/60",
            widthPercent ? "mx-auto" : undefined
          )}
          style={wrapperStyle}
        >
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            className="h-auto w-full object-cover"
            style={{ width: "100%", height: "auto" }}
          />
        </div>
      );
    }
    default:
      return node.content ? <Fragment key={key}>{renderNodes(node.content, key, context)}</Fragment> : null;
  }
}

export function ArticleViewer({ content, tags }: ArticleViewerProps) {
  if (!content || typeof content !== "object") {
    return null;
  }

  const doc = content as { type?: string; content?: TiptapNode[] };
  if (doc.type !== "doc") {
    return null;
  }

  const tagContext = createTagMatchContext(tags ?? []);

  return (
    <div className="prose prose-neutral max-w-none dark:prose-invert">
      {renderNodes(doc.content, "node", tagContext)}
    </div>
  );
}
