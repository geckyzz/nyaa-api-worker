import { privateDecrypt, generateKeyPairSync, constants } from "crypto";

export interface DecryptedSession {
  cookie: string;
  expires_at: number;
}

/**
 * Decrypts a self-contained session token.
 * Format: RSA_encrypt(Base64("session::::{expires_at}::::{cookie_value}"))
 * The token itself is the Base64 of the ciphertext.
 */
export function decryptSessionToken(
  token: string,
  privateKeyPem: string,
): DecryptedSession | null {
  try {
    const encrypted = Buffer.from(token, "base64");
    const decrypted = privateDecrypt(
      {
        key: privateKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      encrypted,
    );

    // The decrypted payload is the raw string "session::::{expires_at}::::{cookie_value}"
    const decodedPayload = decrypted.toString();

    const [prefix, expiresAtStr, cookieValue] = decodedPayload.split("::::");

    if (prefix !== "session" || !expiresAtStr || !cookieValue) {
      return null;
    }

    const expiresAt = parseInt(expiresAtStr);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(expiresAt) || expiresAt < now) {
      console.warn("Session token expired or has invalid timestamp");
      return null;
    }

    return {
      cookie: cookieValue,
      expires_at: expiresAt,
    };
  } catch (error) {
    // Fail silently to allow trying other auth methods or public access
    return null;
  }
}

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicExponent: 0x10001,
  });

  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" });

  return {
    publicKey: publicKeyPem.toString(),
    privateKey: privateKeyPem.toString(),
  };
}

// For client-side encryption helper
export function encryptCredentials(
  publicKeyPem: string,
  username: string,
  password: string,
): string {
  const credentials = `${username}:${password}`;
  const encrypted = publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(credentials),
  );

  return encrypted.toString("base64");
}
