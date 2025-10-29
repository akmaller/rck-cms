"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

type GoogleSignInButtonProps = {
  callbackUrl?: string;
  label?: string;
};

export function GoogleSignInButton({ callbackUrl, label = "Masuk dengan Google" }: GoogleSignInButtonProps) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      void signIn("google", {
        callbackUrl: callbackUrl ?? "/dashboard",
      });
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full text-base font-semibold"
      onClick={handleClick}
      disabled={pending}
      aria-label={label}
    >
      {pending ? (
        "Menghubungkan..."
      ) : (
        <>
          <GoogleIcon />
          {label}
        </>
      )}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
    >
      <path
        d="M17.64 9.2045c0-.638-.0573-1.252-.1637-1.836H9v3.472h4.843c-.2093 1.125-.8433 2.08-1.7963 2.717v2.258h2.908c1.702-1.568 2.684-3.88 2.684-6.611z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.805 5.956-2.184l-2.908-2.258c-.805.54-1.835.86-3.048.86-2.344 0-4.328-1.584-5.035-3.71H.957v2.332C2.438 15.983 5.48 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.965 10.708A5.413 5.413 0 0 1 3.683 9c0-.591.102-1.164.282-1.708V4.96H.957A9.003 9.003 0 0 0 0 9c0 1.466.351 2.854.957 4.04l3.008-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.504.454 3.435 1.346l2.573-2.573C13.463.835 11.426 0 9 0 5.48 0 2.438 2.017.957 4.96l3.008 2.332C4.672 5.164 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
