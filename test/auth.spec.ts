import { describe, it, expect } from "vitest";
import { decryptSessionToken, generateKeyPair } from "../src/auth";
import { publicEncrypt, constants } from "crypto";

describe("Authentication Logic", () => {
  const { publicKey, privateKey } = generateKeyPair();

  it("should decrypt a valid RSA-4096 session token", () => {
    const sessionValue = "test-session-123";
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const payload = `session::::${expiresAt}::::${sessionValue}`;

    const encrypted = publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(payload),
    );
    const token = encrypted.toString("base64");

    const result = decryptSessionToken(token, privateKey);
    expect(result).not.toBeNull();
    expect(result?.cookie).toBe(sessionValue);
    expect(result?.expires_at).toBe(expiresAt);
  });

  it("should fail for an expired token", () => {
    const sessionValue = "test-session-123";
    const expiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const payload = `session::::${expiresAt}::::${sessionValue}`;

    const encrypted = publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      Buffer.from(payload),
    );
    const token = encrypted.toString("base64");

    const result = decryptSessionToken(token, privateKey);
    expect(result).toBeNull();
  });

  it("should fail for a malformed token", () => {
    const result = decryptSessionToken("invalid-token", privateKey);
    expect(result).toBeNull();
  });

  it("should correctly merge encrypted session with request cookies in router logic (integration-ish)", async () => {
    // This part tests the logic used in the router
    const sessionValue = "encrypted-session";
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const payload = `session::::${expiresAt}::::${sessionValue}`;
    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING },
      Buffer.from(payload)
    );
    const token = encrypted.toString("base64");

    // Simulate getSessionFromToken logic
    const decrypted = decryptSessionToken(token, privateKey);
    const sessionCookie = decrypted?.cookie ? `session=${decrypted.cookie}` : undefined;
    const requestCookies = "__ddg1_=val1; __ddg8_=val2";
    
    const combined = [sessionCookie, requestCookies].filter(Boolean).join("; ");
    expect(combined).toBe(`session=${sessionValue}; __ddg1_=val1; __ddg8_=val2`);
  });
});
