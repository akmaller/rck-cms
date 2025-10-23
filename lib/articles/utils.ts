import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils/slug";

function extractPlainText(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) {
    return node.map(extractPlainText).join(" ");
  }
  if (typeof node === "object") {
    const anyNode = node as { text?: unknown; content?: unknown };
    let text = "";
    if (typeof anyNode.text === "string") {
      text += anyNode.text;
    }
    if (Array.isArray(anyNode.content)) {
      text += ` ${anyNode.content.map(extractPlainText).join(" ")}`;
    }
    return text;
  }
  return "";
}

export function generateExcerptFromContent(content: Record<string, unknown>): string | null {
  const plainText = extractPlainText(content).replace(/\s+/g, " ").trim();
  if (!plainText) {
    return null;
  }

  const sentences = plainText.split(/(?<=[.!?])\s+/).filter(Boolean);
  let excerpt = sentences.length > 0 ? sentences.slice(0, 20).join(" ") : plainText;

  if (!excerpt) {
    return null;
  }

  if (excerpt.length > 500) {
    excerpt = `${excerpt.slice(0, 497).trimEnd()}...`;
  }

  return excerpt;
}

export async function ensureUniqueArticleSlug(source: string | undefined, ignoreId?: string) {
  const base = slugify(source ?? "");
  const safeBase = base.length > 0 ? base : `artikel-${Date.now()}`;
  let candidate = safeBase;
  let counter = 1;

  while (true) {
    const existing = await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === ignoreId) {
      return candidate;
    }
    candidate = `${safeBase}-${counter++}`;
  }
}
