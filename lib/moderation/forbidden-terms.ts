import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  MAX_FORBIDDEN_TERM_LENGTH,
  findForbiddenMatch,
  normalizeForComparison,
  normalizePhrase,
} from "./filter-utils";

export type ForbiddenTermRecord = Prisma.ForbiddenTermGetPayload<{
  select: {
    id: true;
    phrase: true;
    normalizedPhrase: true;
    createdAt: true;
    createdById: true;
    createdBy: { select: { id: true; name: true } };
  };
}>;

export async function listForbiddenTerms(): Promise<ForbiddenTermRecord[]> {
  return prisma.forbiddenTerm.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phrase: true,
      normalizedPhrase: true,
      createdAt: true,
      createdById: true,
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export type CreateForbiddenTermResult =
  | { ok: true; term: ForbiddenTermRecord }
  | { ok: false; error: string };

export async function createForbiddenTerm(params: {
  phrase: string;
  createdById?: string;
}): Promise<CreateForbiddenTermResult> {
  const cleanedPhrase = params.phrase.trim().replace(/\s+/g, " ");
  if (!cleanedPhrase) {
    return { ok: false, error: "Kata atau kalimat tidak boleh kosong." };
  }

  if (cleanedPhrase.length > MAX_FORBIDDEN_TERM_LENGTH) {
    return {
      ok: false,
      error: `Batas maksimal kata/kalimat terlarang adalah ${MAX_FORBIDDEN_TERM_LENGTH} karakter.`,
    };
  }

  const normalized = normalizePhrase(cleanedPhrase);
  if (!normalized) {
    return { ok: false, error: "Kata atau kalimat tidak valid." };
  }

  const existing = await prisma.forbiddenTerm.findUnique({
    where: { normalizedPhrase: normalized },
    select: { id: true, phrase: true },
  });

  if (existing) {
    return {
      ok: false,
      error: `Istilah "${existing.phrase}" sudah ada di daftar filter.`,
    };
  }

  const term = await prisma.forbiddenTerm.create({
    data: {
      phrase: cleanedPhrase,
      normalizedPhrase: normalized,
      createdById: params.createdById ?? null,
    },
    select: {
      id: true,
      phrase: true,
      normalizedPhrase: true,
      createdAt: true,
      createdById: true,
      createdBy: { select: { id: true, name: true } },
    },
  });

  return { ok: true, term };
}

export async function deleteForbiddenTerm(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    await prisma.forbiddenTerm.delete({ where: { id } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return false;
    }
    throw error;
  }
}

export async function getForbiddenPhraseEntries(): Promise<Array<{ phrase: string; normalized: string }>> {
  const terms = await prisma.forbiddenTerm.findMany({
    select: { phrase: true, normalizedPhrase: true },
  });
  return terms.map((term) => ({
    phrase: term.phrase,
    normalized: term.normalizedPhrase ?? normalizeForComparison(term.phrase),
  }));
}

export async function detectForbiddenPhrase(
  target: string | null | undefined
): Promise<{ phrase: string; normalized: string } | null> {
  const entries = await getForbiddenPhraseEntries();
  if (!entries.length) {
    return null;
  }
  return findForbiddenMatch(target, entries);
}

export async function findForbiddenPhraseInInputs(
  inputs: Array<string | null | undefined>
): Promise<{ phrase: string; normalized: string } | null> {
  if (!inputs.length) {
    return null;
  }
  const entries = await getForbiddenPhraseEntries();
  if (!entries.length) {
    return null;
  }
  for (const value of inputs) {
    const match = findForbiddenMatch(value, entries);
    if (match) {
      return match;
    }
  }
  return null;
}

export async function getForbiddenPhrases(): Promise<string[]> {
  const entries = await getForbiddenPhraseEntries();
  return entries.map((entry) => entry.phrase);
}
