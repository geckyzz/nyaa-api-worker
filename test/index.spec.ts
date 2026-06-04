import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import worker from "../src/index";
import { generateKeyPair } from "../src/auth";

describe("Nyaa API Worker", () => {
  let publicKey: string;
  let privateKey: string;

  beforeAll(() => {
    const keys = generateKeyPair();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;

    // Set environment variables for the test
    (env as any).NYAA_PUBLIC_KEY_PEM = publicKey;
    (env as any).NYAA_PRIVATE_KEY_PEM = privateKey;
  });

  it("should return OpenAPI spec", async () => {
    const request = new Request("http://localhost/nyaa/v1/openapi");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    expect(data.openapi).toBe("3.0.0");
    expect(data.info.title).toBe("Nyaa REST API");
  });

  it("should return public key", async () => {
    const request = new Request("http://localhost/auth/public-key");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const data = (await response.json()) as any;
    expect(data.public_key).toContain("BEGIN PUBLIC KEY");
    expect(data.algorithm).toBe("RSA-4096");
  });

  it("should handle CORS preflight", async () => {
    const request = new Request("http://localhost/nyaa/v1", {
      method: "OPTIONS",
    });
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
      "GET",
    );
  });

  it("should return 404 for unknown routes", async () => {
    const request = new Request("http://localhost/unknown");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(404);
  });
});
