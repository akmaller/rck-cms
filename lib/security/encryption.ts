import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function parseEncryptionKey(rawKey: string) {
  const value = rawKey.trim();

  if (/^[a-fA-F0-9]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  try {
    const asBase64 = Buffer.from(value, "base64");
    if (asBase64.length === 32) {
      return asBase64;
    }
  } catch {
    // ignore
  }

  const asUtf8 = Buffer.from(value, "utf8");
  if (asUtf8.length === 32) {
    return asUtf8;
  }

  throw new Error(
    "SOCIAL_CREDENTIALS_KEY tidak valid. Gunakan 32-byte key (hex 64 char, base64, atau plain 32 char)."
  );
}

function getCredentialsKey() {
  const raw = process.env.SOCIAL_CREDENTIALS_KEY;
  if (!raw || !raw.trim()) {
    throw new Error("SOCIAL_CREDENTIALS_KEY belum dikonfigurasi.");
  }
  return parseEncryptionKey(raw);
}

export function encryptJsonPayload(value: unknown) {
  const key = getCredentialsKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");

  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptJsonPayload<T>(payload: string): T {
  const key = getCredentialsKey();
  const packed = Buffer.from(payload, "base64");

  if (packed.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Payload terenkripsi tidak valid.");
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
