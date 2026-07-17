import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = "v1";

function configuredKey(): Buffer | null {
  const raw = process.env.WORKSPACE_SECRETS_KEY;
  if (!raw) return null;

  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error("WORKSPACE_SECRETS_KEY must be a 32-byte base64 or 64-character hex value.");
  }

  return key;
}

export function hasWorkspaceSecretsKey(): boolean {
  return configuredKey() !== null;
}

export function encryptSecret(value: string): string {
  const key = configuredKey();
  if (!key) {
    throw new Error("WORKSPACE_SECRETS_KEY is required before saving encrypted credentials.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptSecret(value: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split(":");
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error("Encrypted credential has an unsupported format.");
  }

  const key = configuredKey();
  if (!key) {
    throw new Error("WORKSPACE_SECRETS_KEY is required to use encrypted credentials.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/** Resolves encrypted credentials first while allowing a one-release legacy migration path. */
export function resolveWorkspaceSecret(encrypted?: string | null, legacy?: string | null): string | undefined {
  if (encrypted) return decryptSecret(encrypted);
  return legacy || undefined;
}

export function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length < 10) return "•••";
  return `${value.slice(0, 4)}•••••••••${value.slice(-4)}`;
}
