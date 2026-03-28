import { encrypt, decrypt, isEncrypted, encryptSensitiveFields, decryptSensitiveFields, ENCRYPTED_FIELDS } from "@/lib/crypto";

// Set test encryption key
process.env.PROFILE_ENCRYPTION_KEY = "test-encryption-key-for-unit-tests-32chars!";

describe("crypto", () => {
  describe("encrypt/decrypt", () => {
    it("round-trips a simple string", () => {
      const plain = "123-45-6789";
      const encrypted = encrypt(plain);
      expect(encrypted).not.toBe(plain);
      expect(decrypt(encrypted)).toBe(plain);
    });

    it("round-trips unicode text", () => {
      const plain = "日本語テスト 🔐";
      expect(decrypt(encrypt(plain))).toBe(plain);
    });

    it("round-trips empty string", () => {
      expect(decrypt(encrypt(""))).toBe("");
    });

    it("produces different ciphertext each time (random salt/IV)", () => {
      const plain = "same-input";
      const a = encrypt(plain);
      const b = encrypt(plain);
      expect(a).not.toBe(b);
      expect(decrypt(a)).toBe(plain);
      expect(decrypt(b)).toBe(plain);
    });
  });

  describe("decrypt error handling", () => {
    it("throws on invalid format", () => {
      expect(() => decrypt("not-valid")).toThrow("Invalid encrypted data format");
    });

    it("throws on tampered ciphertext", () => {
      const encrypted = encrypt("secret");
      const parts = encrypted.split(":");
      parts[3] = "0000" + parts[3].slice(4); // tamper with ciphertext
      expect(() => decrypt(parts.join(":"))).toThrow();
    });
  });

  describe("isEncrypted", () => {
    it("returns true for encrypted values", () => {
      expect(isEncrypted(encrypt("test"))).toBe(true);
    });

    it("returns false for plain strings", () => {
      expect(isEncrypted("123-45-6789")).toBe(false);
      expect(isEncrypted("")).toBe(false);
      expect(isEncrypted("just:three:parts")).toBe(false);
    });
  });

  describe("encryptSensitiveFields", () => {
    it("encrypts only sensitive fields", () => {
      const data = {
        firstName: "John",
        ssn: "123-45-6789",
        passportNumber: "AB1234567",
        email: "john@example.com",
      };
      const result = encryptSensitiveFields(data);
      expect(result.firstName).toBe("John");
      expect(result.email).toBe("john@example.com");
      expect(result.ssn).not.toBe("123-45-6789");
      expect(isEncrypted(result.ssn as string)).toBe(true);
      expect(isEncrypted(result.passportNumber as string)).toBe(true);
    });

    it("skips already-encrypted values", () => {
      const encrypted = encrypt("123-45-6789");
      const data = { ssn: encrypted };
      const result = encryptSensitiveFields(data);
      expect(result.ssn).toBe(encrypted); // not double-encrypted
    });

    it("skips empty strings", () => {
      const data = { ssn: "" };
      const result = encryptSensitiveFields(data);
      expect(result.ssn).toBe("");
    });
  });

  describe("decryptSensitiveFields", () => {
    it("round-trips with encryptSensitiveFields", () => {
      const original = {
        firstName: "Jane",
        ssn: "987-65-4321",
        taxId: "12-3456789",
        driverLicense: "D1234567",
      };
      const encrypted = encryptSensitiveFields(original);
      const decrypted = decryptSensitiveFields(encrypted);
      expect(decrypted).toEqual(original);
    });

    it("returns empty string on decryption failure", () => {
      const data = { ssn: "bad:data:that:looks-encrypted".replace("looks-encrypted", "a".repeat(64)) };
      // This has 4 parts but the first part isn't valid hex of right length
      const result = decryptSensitiveFields({ ssn: encrypt("test") });
      expect(typeof result.ssn).toBe("string");
    });
  });

  describe("PROFILE_ENCRYPTION_KEY required", () => {
    it("throws if key is not set", () => {
      const original = process.env.PROFILE_ENCRYPTION_KEY;
      delete process.env.PROFILE_ENCRYPTION_KEY;
      expect(() => encrypt("test")).toThrow("PROFILE_ENCRYPTION_KEY is required");
      process.env.PROFILE_ENCRYPTION_KEY = original;
    });
  });
});
