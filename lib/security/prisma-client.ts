import type { PrismaClient } from "@prisma/client";

const globalScope = globalThis as unknown as {
  __prismaClientPromise?: Promise<PrismaClient>;
};

function isEdgeRuntime() {
  return typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime !== "undefined";
}

export async function getPrismaClient(): Promise<PrismaClient | null> {
  if (isEdgeRuntime()) {
    return null;
  }

  if (!globalScope.__prismaClientPromise) {
    globalScope.__prismaClientPromise = import("@/lib/prisma").then((mod) => mod.prisma);
  }

  return globalScope.__prismaClientPromise;
}
