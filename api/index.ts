import { handleRequest } from "../src/router.js";

export const config = {
  runtime: "nodejs",
};

async function unifiedHandler(req: any) {
  // Normalize headers (supports both Web Headers and Node.js plain object)
  const headers = req.headers instanceof Headers ? req.headers : new Headers(req.headers);

  // Reconstruct absolute URL
  const host = headers.get("host") || "localhost";
  const protocol = headers.get("x-forwarded-proto") || "https";
  const baseUrl = `${protocol}://${host}`;

  // In Node.js runtime, req.url might be relative
  const fullUrl = req.url.startsWith("http") ? req.url : new URL(req.url, baseUrl).toString();
  const url = new URL(fullUrl);
  const origin = url.origin;

  // Construct a standard Web Request if necessary for handleRequest
  const webReq = req instanceof Request ? req : new Request(fullUrl, {
    method: req.method,
    headers: headers,
  });

  const response = await handleRequest(webReq, origin, process.env);

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export const GET = unifiedHandler;
export const POST = unifiedHandler;
export const OPTIONS = unifiedHandler;
export const PUT = unifiedHandler;
export const DELETE = unifiedHandler;
export const PATCH = unifiedHandler;

