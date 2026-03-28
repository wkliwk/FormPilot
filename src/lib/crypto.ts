import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

function getEncryptionSecret(): string {
  const secret = process.env.PROFILE_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("PROFILE_ENCRYPTION_KEY is required. Set it in your environment variables.");
  }
  return secret;
}

function deriveKey(salt: Buffer): Buffer {
  return scryptSync(getEncryptionSecret(), salt, KEY_LENGTH);
}

/** Encrypt a string value. Returns base64-encoded ciphertext with embedded salt, IV, and auth tag. */
export function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  // Format: salt:iv:tag:ciphertext (all hex)
  return `${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/** Decrypt a value produced by encrypt(). */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted data format");
  }

  const [saltHex, ivHex, tagHex, ciphertext] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const key = deriveKey(salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/** Check if a value looks like it was encrypted by us (has the salt:iv:tag:data format). */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 4) return false;
  // Salt should be 64 hex chars (32 bytes)
  return parts[0].length === SALT_LENGTH * 2 && /^[0-9a-f]+$/.test(parts[0]);
}

// Fields that require encryption
export const ENCRYPTED_FIELDS = new Set([
  "ssn",
  "passportNumber",
  "driverLicense",
  "taxId",
]);

/** Encrypt sensitive fields in a profile data object. */
export function encryptSensitiveFields(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  for (const key of ENCRYPTED_FIELDS) {
    const value = result[key];
    if (typeof value === "string" && value.length > 0 && !isEncrypted(value)) {
      result[key] = encrypt(value);
    }
  }
  return result;
}

/** Decrypt sensitive fields in a profile data object. */
export function decryptSensitiveFields(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  for (const key of ENCRYPTED_FIELDS) {
    const value = result[key];
    if (typeof value === "string" && isEncrypted(value)) {
      try {
        result[key] = decrypt(value);
      } catch {
        // If decryption fails, leave as-is (key may have changed)
        result[key] = "";
      }
    }
  }
  return result;
}
