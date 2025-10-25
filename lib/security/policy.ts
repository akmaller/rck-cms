import { getPrismaClient } from "./prisma-client";

export type SecurityPolicyConfig = {
  login: {
    maxAttempts: number;
    windowMinutes: number;
  };
  page: {
    maxVisits: number;
    windowMinutes: number;
  };
  api: {
    maxRequests: number;
    windowMinutes: number;
  };
  block: {
    durationMinutes: number;
  };
};

const DEFAULT_POLICY: SecurityPolicyConfig = {
  login: { maxAttempts: 5, windowMinutes: 5 },
  page: { maxVisits: 120, windowMinutes: 10 },
  api: { maxRequests: 240, windowMinutes: 5 },
  block: { durationMinutes: 60 },
};

const POLICY_CACHE_TTL = 60 * 1000; // 1 minute

type PolicyCacheEntry = {
  policy: SecurityPolicyConfig;
  expiresAt: number;
};

const globalScope = globalThis as unknown as {
  __securityPolicyCache?: PolicyCacheEntry;
};

export function getDefaultSecurityPolicy(): SecurityPolicyConfig {
  return JSON.parse(JSON.stringify(DEFAULT_POLICY)) as SecurityPolicyConfig;
}

function normalizePolicy(input: Partial<SecurityPolicyConfig> | null | undefined): SecurityPolicyConfig {
  const defaults = getDefaultSecurityPolicy();
  if (!input) {
    return defaults;
  }

  return {
    login: {
      maxAttempts: Math.max(1, Number(input.login?.maxAttempts ?? defaults.login.maxAttempts)),
      windowMinutes: Math.max(1, Number(input.login?.windowMinutes ?? defaults.login.windowMinutes)),
    },
    page: {
      maxVisits: Math.max(1, Number(input.page?.maxVisits ?? defaults.page.maxVisits)),
      windowMinutes: Math.max(1, Number(input.page?.windowMinutes ?? defaults.page.windowMinutes)),
    },
    api: {
      maxRequests: Math.max(1, Number(input.api?.maxRequests ?? defaults.api.maxRequests)),
      windowMinutes: Math.max(1, Number(input.api?.windowMinutes ?? defaults.api.windowMinutes)),
    },
    block: {
      durationMinutes: Math.max(1, Number(input.block?.durationMinutes ?? defaults.block.durationMinutes)),
    },
  } satisfies SecurityPolicyConfig;
}

export async function getSecurityPolicy(): Promise<SecurityPolicyConfig> {
  const cached = globalScope.__securityPolicyCache;
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.policy;
  }

  const prisma = await getPrismaClient();
  if (!prisma) {
    const policy = getDefaultSecurityPolicy();
    globalScope.__securityPolicyCache = { policy, expiresAt: now + POLICY_CACHE_TTL };
    return policy;
  }

  const record = await prisma.securityPolicy.findUnique({ where: { key: "default" } });
  if (!record) {
    const policy = getDefaultSecurityPolicy();
    await prisma.securityPolicy.create({
      data: {
        key: "default",
        value: policy,
      },
    });
    globalScope.__securityPolicyCache = { policy, expiresAt: now + POLICY_CACHE_TTL };
    return policy;
  }

  const policy = normalizePolicy(record.value as Partial<SecurityPolicyConfig>);
  globalScope.__securityPolicyCache = { policy, expiresAt: now + POLICY_CACHE_TTL };
  return policy;
}

export async function updateSecurityPolicy(policy: SecurityPolicyConfig) {
  const normalized = normalizePolicy(policy);
  const prisma = await getPrismaClient();
  if (!prisma) {
    throw new Error("Cannot update security policy without database access.");
  }
  await prisma.securityPolicy.upsert({
    where: { key: "default" },
    update: { value: normalized },
    create: { key: "default", value: normalized },
  });
  clearSecurityPolicyCache();
  return normalized;
}

export function clearSecurityPolicyCache() {
  globalScope.__securityPolicyCache = undefined;
}

export function securityPolicyToFormValues(policy: SecurityPolicyConfig) {
  return {
    loginMaxAttempts: policy.login.maxAttempts,
    loginWindowMinutes: policy.login.windowMinutes,
    pageMaxVisits: policy.page.maxVisits,
    pageWindowMinutes: policy.page.windowMinutes,
    apiMaxRequests: policy.api.maxRequests,
    apiWindowMinutes: policy.api.windowMinutes,
    blockDurationMinutes: policy.block.durationMinutes,
  };
}
