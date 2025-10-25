export const AUTHOR_SOCIAL_KEYS = ["instagram", "facebook", "twitter", "youtube", "linkedin"] as const;

export type AuthorSocialKey = (typeof AUTHOR_SOCIAL_KEYS)[number];

export const AUTHOR_SOCIAL_FIELDS = [
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/username",
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/username",
  },
  {
    key: "twitter",
    label: "Twitter / X",
    placeholder: "https://twitter.com/username",
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@channel",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/username",
  },
] satisfies ReadonlyArray<{ key: AuthorSocialKey; label: string; placeholder: string }>;
