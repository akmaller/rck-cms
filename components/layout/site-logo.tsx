import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type ResponsiveLogoImageProps = {
  src: string;
  alt: string;
  maxHeight?: number;
  maxWidth?: number;
  priority?: boolean;
  className?: string;
};

export function ResponsiveLogoImage({
  src,
  alt,
  maxHeight = 52,
  maxWidth,
  priority,
  className,
}: ResponsiveLogoImageProps) {
  const styles: CSSProperties = {
    maxHeight,
    height: "auto",
    width: "auto",
    maxWidth,
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn("inline-block", className)}
      style={styles}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
