import { handleRequest } from "../src/router.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: Request) {
  // Reconstruct absolute URL from headers as req.url might be relative in some Node.js environments
  const host = req.headers.get("host") || "localhost";
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  const baseUrl = `${protocol}://${host}`;

  const url = new URL(req.url, baseUrl);
  const origin = url.origin;

  const response = await handleRequest(req, origin, process.env);

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
