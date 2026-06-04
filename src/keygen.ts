import { generateKeyPairSync } from "crypto";

/**
 * Generate RSA-4096 keypair for authentication
 * @returns { publicKey: string, privateKey: string } PEM-formatted keys
 */
export function generateKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return {
    publicKey: publicKey as string,
    privateKey: privateKey as string,
  };
}

/**
 * CLI entry point for keygen
 * Usage: node -r tsx src/keygen.ts
 * Outputs keys in different formats for different deployment scenarios
 */
if (
  require.main === module ||
  import.meta.url === `file://${process.argv[1]}`
) {
  const { publicKey, privateKey } = generateKeyPair();

  console.log("🔑 RSA-4096 Keypair Generated\n");
  console.log("=" + "=".repeat(77) + "\n");

  console.log("📋 Format 1: Literal newlines (for .env files)\n");
  console.log(`NYAA_PUBLIC_KEY_PEM="${publicKey}"\n`);
  console.log(`NYAA_PRIVATE_KEY_PEM="${privateKey}"\n`);

  console.log("=" + "=".repeat(77) + "\n");

  console.log("📋 Format 2: Escaped newlines (for CLI/Docker -e)\n");
  const publicKeyEscaped = publicKey.replace(/\n/g, "\\n");
  const privateKeyEscaped = privateKey.replace(/\n/g, "\\n");

  console.log(`export NYAA_PUBLIC_KEY_PEM="${publicKeyEscaped}"`);
  console.log(`export NYAA_PRIVATE_KEY_PEM="${privateKeyEscaped}"\n`);

  console.log("=" + "=".repeat(77) + "\n");

  console.log("📋 Format 3: Docker -e flags\n");
  console.log(`docker run -e NYAA_PUBLIC_KEY_PEM="${publicKeyEscaped}" \\`);
  console.log(`           -e NYAA_PRIVATE_KEY_PEM="${privateKeyEscaped}" \\`);
  console.log(`           <image>`);
  console.log("\n⚠️  Copy keys from above formats and save them securely!\n");
  console.log("⚠️  Keep PRIVATE key secret - never commit or share!\n");
}
