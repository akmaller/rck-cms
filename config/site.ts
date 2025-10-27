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
};

export const siteConfig: SiteConfig = {
  name: "Roemah Cita CMS",
  description:
    "Content management system untuk mengelola artikel, media, dan konfigurasi situs Roemah Cita.",
  tagline: "Platform pengelolaan konten Roemah Cita.",
  logoUrl: "/logo.svg",
  iconUrl: "/default-favicon.ico",
  contactEmail: "admin@roemahcita.local",
  url: "https://roemahcita.local",
  ogImage: "/og.jpg",
  links: {
    facebook: "https://facebook.com/roemahcita",
    instagram: "https://instagram.com/roemahcita",
    youtube: "https://youtube.com/@roemahcita",
  },
  metadata: {
    title: "Roemah Cita CMS",
    description:
      "Content management system untuk mengelola artikel dan media Roemah Cita.",
    keywords: ["roemah cita", "cms", "konten"],
  },
  comments: {
    enabled: true,
  },
  registration: {
    enabled: true,
    autoApprove: false,
  },
};
