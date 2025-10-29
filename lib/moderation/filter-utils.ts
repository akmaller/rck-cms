export const MAX_FORBIDDEN_TERM_LENGTH = 200;

type SearchableString = string | null | undefined;

export function normalizePhrase(value: SearchableString): string {
  if (!value || typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return normalizeForComparison(trimmed);
}

export function normalizeForComparison(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function findForbiddenMatch(
  target: SearchableString,
  normalizedPhrases: Array<{ phrase: string; normalized: string }>
): { phrase: string; normalized: string } | null {
  if (!target || typeof target !== "string") {
    return null;
  }
  const normalizedTarget = normalizeForComparison(target);
  if (!normalizedTarget) {
    return null;
  }
  for (const item of normalizedPhrases) {
    if (!item.normalized) {
      continue;
    }
    if (normalizedTarget.includes(item.normalized)) {
      return item;
    }
  }
  return null;
}
