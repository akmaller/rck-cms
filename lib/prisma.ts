import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl(rawUrl: string | undefined) {
  if (!rawUrl) {
    return undefined;
  }

  const normalized = rawUrl.trim();
  const lowerCased = normalized.toLowerCase();
  const isPostgres =
    lowerCased.startsWith("postgresql://") || lowerCased.startsWith("postgres://");

  if (!isPostgres) {
    return normalized;
  }

  const preferredLimit =
    process.env.DATABASE_CONNECTION_LIMIT?.trim() ||
    (process.env.NODE_ENV === "test" ? "1" : "5");

  const parsedLimit = Number(preferredLimit);
  const shouldAppendLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 && !/[?&]connection_limit=\d+/i.test(rawUrl);

  if (!shouldAppendLimit) {
    return rawUrl;
  }

  const separator = rawUrl.includes("?") ? "&" : "?";
  return `${normalized}${separator}connection_limit=${parsedLimit}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl = resolveDatabaseUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
