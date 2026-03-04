import { prisma } from "@/lib/prisma";
import { decryptJsonPayload, encryptJsonPayload } from "@/lib/security/encryption";

type NullableString = string | null;

export type SocialCredentials = {
  facebook: {
    pageId: NullableString;
    pageAccessToken: NullableString;
  };
  instagram: {
    igUserId: NullableString;
    pageAccessToken: NullableString;
  };
  twitter: {
    accessToken: NullableString;
  };
};

export type SocialCredentialInput = {
  facebook?: {
    pageId?: NullableString;
    pageAccessToken?: NullableString;
  };
  instagram?: {
    igUserId?: NullableString;
    pageAccessToken?: NullableString;
  };
  twitter?: {
    accessToken?: NullableString;
  };
};

const EMPTY_CREDENTIALS: SocialCredentials = {
  facebook: {
    pageId: null,
    pageAccessToken: null,
  },
  instagram: {
    igUserId: null,
    pageAccessToken: null,
  },
  twitter: {
    accessToken: null,
  },
};

const PLATFORM = {
  FACEBOOK: "FACEBOOK",
  INSTAGRAM: "INSTAGRAM",
  TWITTER: "TWITTER",
} as const;

type Platform = (typeof PLATFORM)[keyof typeof PLATFORM];

type SocialAccountCredentialRow = {
  platform: Platform;
  encryptedPayload: string;
};

type SocialAccountCredentialStore = {
  deleteMany(args: { where: { platform: Platform } }): Promise<unknown>;
  upsert(args: {
    where: { platform: Platform };
    create: { platform: Platform; encryptedPayload: string };
    update: { encryptedPayload: string };
  }): Promise<unknown>;
  findMany(args: {
    where: { platform: { in: Platform[] } };
    select: { platform: true; encryptedPayload: true };
  }): Promise<SocialAccountCredentialRow[]>;
};

function socialAccountStore(): SocialAccountCredentialStore {
  return (prisma as unknown as { socialAccountCredential: SocialAccountCredentialStore }).socialAccountCredential;
}

function mergeMissingCredentials(
  primary: SocialCredentials,
  fallback: SocialCredentials | null | undefined
): SocialCredentials {
  if (!fallback) {
    return primary;
  }

  return {
    facebook: {
      pageId: primary.facebook.pageId ?? fallback.facebook.pageId,
      pageAccessToken: primary.facebook.pageAccessToken ?? fallback.facebook.pageAccessToken,
    },
    instagram: {
      igUserId: primary.instagram.igUserId ?? fallback.instagram.igUserId,
      pageAccessToken: primary.instagram.pageAccessToken ?? fallback.instagram.pageAccessToken,
    },
    twitter: {
      accessToken: primary.twitter.accessToken ?? fallback.twitter.accessToken,
    },
  };
}

async function getLegacyCredentialsFromSiteConfig(): Promise<SocialCredentials | null> {
  const record = await prisma.siteConfig.findUnique({
    where: { key: "general" },
    select: { value: true },
  });

  if (!record || typeof record.value !== "object" || record.value === null || Array.isArray(record.value)) {
    return null;
  }

  const value = record.value as Record<string, unknown>;
  const socialAutopost =
    typeof value.socialAutopost === "object" && value.socialAutopost !== null && !Array.isArray(value.socialAutopost)
      ? (value.socialAutopost as Record<string, unknown>)
      : null;
  if (!socialAutopost) {
    return null;
  }

  const facebook =
    typeof socialAutopost.facebook === "object" &&
    socialAutopost.facebook !== null &&
    !Array.isArray(socialAutopost.facebook)
      ? (socialAutopost.facebook as Record<string, unknown>)
      : {};
  const instagram =
    typeof socialAutopost.instagram === "object" &&
    socialAutopost.instagram !== null &&
    !Array.isArray(socialAutopost.instagram)
      ? (socialAutopost.instagram as Record<string, unknown>)
      : {};
  const twitter =
    typeof socialAutopost.twitter === "object" &&
    socialAutopost.twitter !== null &&
    !Array.isArray(socialAutopost.twitter)
      ? (socialAutopost.twitter as Record<string, unknown>)
      : {};

  const legacy: SocialCredentials = {
    facebook: {
      pageId: normalize(facebook.pageId),
      pageAccessToken: normalize(facebook.pageAccessToken),
    },
    instagram: {
      igUserId: normalize(instagram.igUserId),
      pageAccessToken: normalize(instagram.pageAccessToken),
    },
    twitter: {
      accessToken: normalize(twitter.accessToken),
    },
  };

  const hasLegacy = Boolean(
    legacy.facebook.pageId ||
      legacy.facebook.pageAccessToken ||
      legacy.instagram.igUserId ||
      legacy.instagram.pageAccessToken ||
      legacy.twitter.accessToken
  );
  return hasLegacy ? legacy : null;
}

function normalize(value: unknown): NullableString {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasCredentialValue(payload: Record<string, unknown>) {
  return Object.values(payload).some((value) => typeof value === "string" && value.trim().length > 0);
}

async function upsertOrDelete(platform: Platform, payload: Record<string, unknown>) {
  const db = socialAccountStore();
  if (!hasCredentialValue(payload)) {
    await db.deleteMany({ where: { platform } });
    return;
  }

  const encryptedPayload = encryptJsonPayload(payload);
  await db.upsert({
    where: { platform },
    create: { platform, encryptedPayload },
    update: { encryptedPayload },
  });
}

export async function saveSocialCredentials(input: SocialCredentialInput) {
  await upsertOrDelete(PLATFORM.FACEBOOK, {
    pageId: normalize(input.facebook?.pageId),
    pageAccessToken: normalize(input.facebook?.pageAccessToken),
  });

  await upsertOrDelete(PLATFORM.INSTAGRAM, {
    igUserId: normalize(input.instagram?.igUserId),
    pageAccessToken: normalize(input.instagram?.pageAccessToken),
  });

  await upsertOrDelete(PLATFORM.TWITTER, {
    accessToken: normalize(input.twitter?.accessToken),
  });
}

export async function getSocialCredentials(): Promise<SocialCredentials> {
  const db = socialAccountStore();
  const rows = await db.findMany({
    where: {
      platform: {
        in: [PLATFORM.FACEBOOK, PLATFORM.INSTAGRAM, PLATFORM.TWITTER],
      },
    },
    select: {
      platform: true,
      encryptedPayload: true,
    },
  });

  const result: SocialCredentials = {
    ...EMPTY_CREDENTIALS,
    facebook: { ...EMPTY_CREDENTIALS.facebook },
    instagram: { ...EMPTY_CREDENTIALS.instagram },
    twitter: { ...EMPTY_CREDENTIALS.twitter },
  };

  for (const row of rows) {
    if (row.platform === PLATFORM.FACEBOOK) {
      const decoded = decryptJsonPayload<{ pageId?: string | null; pageAccessToken?: string | null }>(
        row.encryptedPayload
      );
      result.facebook.pageId = normalize(decoded.pageId);
      result.facebook.pageAccessToken = normalize(decoded.pageAccessToken);
      continue;
    }

    if (row.platform === PLATFORM.INSTAGRAM) {
      const decoded = decryptJsonPayload<{ igUserId?: string | null; pageAccessToken?: string | null }>(
        row.encryptedPayload
      );
      result.instagram.igUserId = normalize(decoded.igUserId);
      result.instagram.pageAccessToken = normalize(decoded.pageAccessToken);
      continue;
    }

    if (row.platform === PLATFORM.TWITTER) {
      const decoded = decryptJsonPayload<{ accessToken?: string | null }>(row.encryptedPayload);
      result.twitter.accessToken = normalize(decoded.accessToken);
    }
  }

  const legacy = await getLegacyCredentialsFromSiteConfig();
  return mergeMissingCredentials(result, legacy);
}

export async function getSocialCredentialsSafe(): Promise<SocialCredentials> {
  try {
    return await getSocialCredentials();
  } catch (error) {
    console.error("Gagal membaca kredensial sosial", error);
    return {
      ...EMPTY_CREDENTIALS,
      facebook: { ...EMPTY_CREDENTIALS.facebook },
      instagram: { ...EMPTY_CREDENTIALS.instagram },
      twitter: { ...EMPTY_CREDENTIALS.twitter },
    };
  }
}
