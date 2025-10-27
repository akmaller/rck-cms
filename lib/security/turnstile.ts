const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

type TurnstileVerifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
};

export type TurnstileVerifyResult = {
  success: boolean;
  skipped?: boolean;
  errors?: string[];
};

export async function verifyTurnstileToken(token: string | null | undefined, remoteIp?: string): Promise<TurnstileVerifyResult> {
  if (!TURNSTILE_SECRET_KEY) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("TURNSTILE_SECRET_KEY is not configured. Skipping Turnstile verification (development only).");
    }
    return { success: true, skipped: true };
  }

  if (!token || typeof token !== "string") {
    return { success: false, errors: ["missing-input"] };
  }

  try {
    const params = new URLSearchParams();
    params.append("secret", TURNSTILE_SECRET_KEY);
    params.append("response", token);
    if (remoteIp && remoteIp !== "unknown") {
      params.append("remoteip", remoteIp);
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: params,
    });

    if (!response.ok) {
      return { success: false, errors: ["verification-request-failed"] };
    }

    const data = (await response.json()) as TurnstileVerifyResponse;
    return {
      success: Boolean(data.success),
      errors: data["error-codes"],
    };
  } catch (error) {
    console.error("Turnstile verification failed", error);
    return { success: false, errors: ["verification-error"] };
  }
}
