import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ensureTrailingSlash(url: string) {
  if (!url) return url;
  return url.endsWith("/") ? url : `${url}/`;
}
