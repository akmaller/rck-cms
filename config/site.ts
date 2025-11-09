const FALLBACK_SITE_URL = "https://kabarmerpati.id";

const resolveSiteUrl = (): string => {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.SITE_URL ??
    FALLBACK_SITE_URL;

  const ensureProtocol = (value: string) => {
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
    return hasProtocol ? value : `https://${value}`;
  };

  try {
    const candidate = new URL(ensureProtocol(envUrl.trim()));
    candidate.hash = "";
    candidate.search = "";
    candidate.pathname = candidate.pathname.replace(/\/+$/, "");
    const normalized = candidate.toString();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return FALLBACK_SITE_URL;
  }
};

export type SiteConfig = {
  name: string;
  description: string;
  tagline?: string;
  logoUrl?: string;
  iconUrl?: string;
  contactEmail?: string;
  url: string;
  ogImage: string;
  links: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  comments?: {
    enabled?: boolean;
  };
  registration?: {
    enabled?: boolean;
    autoApprove?: boolean;
    privacyPolicyPageSlug?: string | null;
  };
  analytics?: {
    googleTagManagerId?: string | null;
  };
};

export const siteConfig: SiteConfig = {
  name: "Kabar Merpati",
  description:
    "Portal opini dan berita yang menjunjung tinggi asas kebebasan berpendapat. Sebuah ruang di mana ide, kritik, dan gagasan bisa terbang bebas.",
  tagline: "Terbangkan Pikiranmu, Sampaikan Pandanganmu.",
  logoUrl: "https://cdn.kabarmerpati.id/uploads/1761664668969-aff06322-2231-4eb1-9536-83c8df9430d1.webp",
  iconUrl: "https://cdn.kabarmerpati.id/uploads/1762632578643-f9f71996-cb57-4a8c-8db8-7d6b0a6a00c3.webp",
  contactEmail: "contact@kabarmerpati.id",
  url: resolveSiteUrl(),
  ogImage: "https://cdn.kabarmerpati.id/uploads/1761664668969-aff06322-2231-4eb1-9536-83c8df9430d1.webp",
  links: {
    facebook: "https://www.facebook.com/kabarmerpati.id",
    instagram: "https://www.instagram.com/kabarmerpati_id/",
    youtube: "https://youtube.com/@roemahcita",
  },
  metadata: {
    title: "Kabar Merpati",
    description:
      "Portal opini dan berita yang menjunjung tinggi asas kebebasan berpendapat. Sebuah ruang di mana ide, kritik, dan gagasan bisa terbang bebas.",
    keywords: ["kabar merpati", "kabar", "merpati", "opini publik"],
  },
  comments: {
    enabled: true,
  },
  registration: {
    enabled: true,
    autoApprove: false,
  },
  analytics: {
    googleTagManagerId: null,
  },
};
