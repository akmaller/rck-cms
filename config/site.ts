export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  ogImage: string;
  links: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
  };
};

export const siteConfig: SiteConfig = {
  name: "Roemah Cita CMS",
  description:
    "Content management system untuk mengelola artikel, media, dan konfigurasi situs Roemah Cita.",
  url: "https://roemahcita.local",
  ogImage: "/og.jpg",
  links: {
    facebook: "https://facebook.com/roemahcita",
    instagram: "https://instagram.com/roemahcita",
    youtube: "https://youtube.com/@roemahcita",
  },
};
