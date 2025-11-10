"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const CONSENT_COOKIE_NAME = "rcms_cookie_consent";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function hasConsentCookie() {
  if (typeof document === "undefined") {
    return false;
  }
  return document.cookie.split(";").some((entry) => entry.trim().startsWith(`${CONSENT_COOKIE_NAME}=`));
}

function setConsentCookie() {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${CONSENT_COOKIE_NAME}=accepted; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax`;
}

type CookieConsentBannerProps = {
  privacyPolicySlug: string | null;
};

export function CookieConsentBanner({ privacyPolicySlug }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setVisible(!hasConsentCookie());
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (!hydrated || !visible) {
    return null;
  }
  const policyUrl = privacyPolicySlug ? `/pages/${privacyPolicySlug}` : null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 sm:px-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-background/95 px-4 py-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Kami menggunakan cookie untuk meningkatkan pengalaman Anda, menganalisis trafik, dan menyesuaikan konten.
            Anda dapat membaca detailnya di {" "}
            {policyUrl ? (
              <Link href={policyUrl} className="font-medium text-primary hover:underline">
                Kebijakan Privasi
              </Link>
            ) : (
              <span className="font-medium">Kebijakan Privasi</span>
            )}
            .
          </p>
          <div className="flex flex-shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setConsentCookie();
                setVisible(false);
              }}
            >
              Terima
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setVisible(false)}
            >
              Tutup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
