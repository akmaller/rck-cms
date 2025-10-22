import { authenticator } from "otplib";

const TOTP_WINDOW = 1; // allows slight drift

authenticator.options = {
  step: 30,
  window: TOTP_WINDOW,
};

export function generateTwoFactorSecret(label: string) {
  const secret = authenticator.generateSecret();
  const uri = authenticator.keyuri(label, "Roemah Cita CMS", secret);
  return { secret, uri };
}

export function verifyTwoFactorToken(token: string, secret: string) {
  return authenticator.check(token, secret);
}
