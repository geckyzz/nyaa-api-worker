import type { NyaaRequest, NyaaResponse } from "./types";
import {
  searchTorrents,
  getTorrentDetail,
  getUserInfo,
  getUserByUsername,
  getUserUploads,
  getMainPageTorrents,
  getWhoami,
} from "./scraper";
import { generateOpenAPISpec } from "./openapi";
import { decryptSessionToken } from "./auth";

// Normalize PEM keys to handle:
// 1. Escaped newlines (\n in env vars) -> actual newlines
// 2. CRLF line endings -> LF for consistency (RFC 1421 specifies CRLF, but we normalize to LF)
// RSA/crypto works with both, but LF is the standard for most tools
function normalizePemKey(keyString: string | undefined): string | undefined {
  if (!keyString) return undefined;

  // Step 1: If the key contains escaped \n, convert them to actual newlines
  let normalized = keyString;
  if (normalized.includes("\\n")) {
    normalized = normalized.replace(/\\n/g, "\n");
  }

  // Step 2: Normalize CRLF to LF for consistency
  // This handles keys copied from Windows files or some generators
  normalized = normalized.replace(/\r\n/g, "\n");

  return normalized;
}

interface RouteHandler {
  (
    req: NyaaRequest,
    match: RegExpMatchArray,
    origin: string,
    env?: Record<string, any>,
  ): Promise<NyaaResponse> | NyaaResponse;
}

interface Route {
  pattern: RegExp;
  methods: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];

function addRoute(
  pattern: RegExp | string,
  methods: string | string[],
  handler: RouteHandler,
) {
  const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
  const methodsArray = typeof methods === "string" ? [methods] : methods;
  routes.push({ pattern: regex, methods: methodsArray, handler });
}

// Helper to get session from token
async function getSessionFromToken(
  req: NyaaRequest,
  env?: Record<string, any>,
): Promise<string | undefined> {
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  let sessionCookie: string | undefined;

  // 1. Try decrypting session from Bearer token (Sensitive)
  if (bearerToken) {
    const privateKey = normalizePemKey(env?.NYAA_PRIVATE_KEY_PEM);
    if (privateKey) {
      const decrypted = decryptSessionToken(bearerToken, privateKey);
      if (decrypted) {
        // Format as name=value if it's just the raw session hash
        sessionCookie = decrypted.cookie.includes("=")
          ? decrypted.cookie
          : `session=${decrypted.cookie}`;
      }
    }
  }

  // 2. Get other cookies from request header (e.g., __ddg)
  const requestCookies = req.headers["cookie"];

  if (!sessionCookie && !requestCookies) return undefined;

  // Combine cookies, prioritizing the encrypted session if present
  return [sessionCookie, requestCookies].filter(Boolean).join("; ");
}

// Auth Routes
addRoute(/^\/auth\/public-key\/?$/, "GET", async (req, match, origin, env) => {
  const publicKey = normalizePemKey(env?.NYAA_PUBLIC_KEY_PEM);
  if (!publicKey) {
    return errorResponse(
      500,
      "Public key not configured. Admin: set NYAA_PUBLIC_KEY_PEM secret",
    );
  }

  return jsonResponse({
    public_key: publicKey,
    algorithm: "RSA-4096",
    padding: "OAEP",
    encoding: "base64",
    encryption_help:
      "https://github.com/geckyzz/nyaa-api-worker/blob/main/README.md",
  });
});

addRoute(/^\/auth\/validate\/?$/, "GET", async (req, match, origin, env) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(401, "Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);
  const privateKey = normalizePemKey(env?.NYAA_PRIVATE_KEY_PEM);

  if (!privateKey) {
    return errorResponse(500, "Private key not configured");
  }

  const decrypted = decryptSessionToken(token, privateKey);
  if (!decrypted) {
    return errorResponse(401, "Invalid, expired, or malformed session token");
  }

  const expiresIn = decrypted.expires_at - Math.floor(Date.now() / 1000);

  return jsonResponse({
    valid: true,
    expires_at: new Date(decrypted.expires_at * 1000).toISOString(),
    expires_in: expiresIn,
    message: "Token successfully decrypted and session extracted.",
  });
});

// Site-scoped Auth Routes
addRoute(
  /^\/([a-z]+)\/v1\/auth\/public-key\/?$/,
  "GET",
  async (req, match, origin, env) => {
    const publicKey = normalizePemKey(env?.NYAA_PUBLIC_KEY_PEM);
    if (!publicKey) {
      return errorResponse(
        500,
        "Public key not configured. Admin: set NYAA_PUBLIC_KEY_PEM secret",
      );
    }

    return jsonResponse({
      public_key: publicKey,
      algorithm: "RSA-4096",
      padding: "OAEP",
      encoding: "base64",
      encryption_help:
        "https://github.com/geckyzz/nyaa-api-worker/blob/main/README.md",
    });
  },
);

addRoute(
  /^\/([a-z]+)\/v1\/auth\/validate\/?$/,
  "GET",
  async (req, match, origin, env) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(401, "Missing or invalid Authorization header");
    }

    const token = authHeader.slice(7);
    const privateKey = normalizePemKey(env?.NYAA_PRIVATE_KEY_PEM);

    if (!privateKey) {
      return errorResponse(500, "Private key not configured");
    }

    const decrypted = decryptSessionToken(token, privateKey);
    if (!decrypted) {
      return errorResponse(401, "Invalid, expired, or malformed session token");
    }

    const expiresIn = decrypted.expires_at - Math.floor(Date.now() / 1000);

    return jsonResponse({
      valid: true,
      expires_at: new Date(decrypted.expires_at * 1000).toISOString(),
      expires_in: expiresIn,
      message: "Token successfully decrypted and session extracted.",
    });
  },
);

addRoute(
  /^\/([a-z]+)\/v1\/auth\/whoami\/?$/,
  "GET",
  async (req, match, origin, env) => {
    const site = match[1] as "nyaa" | "sukebei";
    if (!["nyaa", "sukebei"].includes(site)) {
      return errorResponse(400, "Invalid site");
    }

    const session = await getSessionFromToken(req, env);
    if (!session) {
      return errorResponse(401, "Authentication required for whoami");
    }

    const username = await getWhoami(site, session);
    if (!username) {
      return errorResponse(
        401,
        "Failed to identify user. Session might be invalid or expired.",
      );
    }

    return jsonResponse({
      username,
      authenticated: true,
    });
  },
);

// Main API Routes
addRoute(/^\/([a-z]+)\/v1\/?$/, "GET", async (req, match, origin, env) => {
  const site = match[1] as "nyaa" | "sukebei";
  if (!["nyaa", "sukebei"].includes(site)) {
    return errorResponse(400, "Invalid site");
  }

  const session = await getSessionFromToken(req, env);
  const url = new URL(req.url, origin);
  const query = url.searchParams.get("q");

  if (
    query ||
    url.searchParams.has("p") ||
    url.searchParams.has("c") ||
    url.searchParams.has("f") ||
    url.searchParams.has("s")
  ) {
    const p = url.searchParams.get("p")
      ? parseInt(url.searchParams.get("p")!)
      : undefined;
    const c = url.searchParams.get("c") || undefined;
    const f = url.searchParams.get("f") || undefined;
    const s = url.searchParams.get("s") || undefined;
    const o = url.searchParams.get("o") || undefined;

    const result = await searchTorrents(site, query || "", {
      p,
      c,
      f,
      s,
      o,
      session,
    });
    return jsonResponse(result);
  }

  const torrents = await getMainPageTorrents(site, session);
  return jsonResponse({
    torrents,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalResults: torrents.length,
    },
  });
});

addRoute(
  /^\/([a-z]+)\/v1\/view\/([^/]+)(?:\/(files|trackers|comments))?\/?$/,
  "GET",
  async (req, match, origin, env) => {
    const site = match[1] as "nyaa" | "sukebei";
    const idOrHash = match[2];
    const subType = match[3];

    if (!["nyaa", "sukebei"].includes(site)) {
      return errorResponse(400, "Invalid site");
    }

    const session = await getSessionFromToken(req, env);

    let torrentId: number;
    if (/^\d+$/.test(idOrHash)) {
      torrentId = parseInt(idOrHash);
    } else {
      // Treat as infoHash lookup
      console.log(`[Router] Reverse lookup for infoHash: ${idOrHash}`);
      const result = await searchTorrents(site, idOrHash, { f: "1", session });
      const exactMatch = result.torrents.find(
        (t) => t.infoHash?.toLowerCase() === idOrHash.toLowerCase(),
      );

      if (!exactMatch) {
        return errorResponse(404, "Torrent not found by infoHash");
      }
      torrentId = exactMatch.id;
    }

    const result = await getTorrentDetail(site, torrentId, session);
    if (!result) {
      return errorResponse(404, "Torrent not found");
    }

    if (subType === "files") return jsonResponse(result.fileList);
    if (subType === "trackers") return jsonResponse(result.trackers);
    if (subType === "comments") return jsonResponse(result.comments);

    return jsonResponse(result);
  },
);

addRoute(
  /^\/([a-z]+)\/v1\/user\/(\d+)\/?$/,
  "GET",
  async (req, match, origin, env) => {
    const site = match[1] as "nyaa" | "sukebei";
    const userId = parseInt(match[2]);

    if (!["nyaa", "sukebei"].includes(site)) {
      return errorResponse(400, "Invalid site");
    }

    const session = await getSessionFromToken(req, env);
    const url = new URL(req.url, origin);
    const uploadsParam = url.searchParams.get("uploads");

    if (uploadsParam === "true") {
      const p = url.searchParams.get("p")
        ? parseInt(url.searchParams.get("p")!)
        : undefined;
      const s = url.searchParams.get("s") || undefined;
      const o = url.searchParams.get("o") || undefined;
      const result = await getUserUploads(site, userId, { p, s, o, session });
      return jsonResponse(result);
    }

    const result = await getUserInfo(site, userId, session);
    if (!result) {
      return jsonResponse({
        username: `user_${userId}`,
        title: null,
        uploads: 0,
      });
    }
    return jsonResponse(result);
  },
);

addRoute(
  /^\/([a-z]+)\/v1\/user\/(.+)\/uploads\/?$/,
  "GET",
  async (req, match, origin, env) => {
    const site = match[1] as "nyaa" | "sukebei";
    const userParam = decodeURIComponent(match[2]);

    if (!["nyaa", "sukebei"].includes(site)) {
      return errorResponse(400, "Invalid site");
    }

    const session = await getSessionFromToken(req, env);
    const url = new URL(req.url, origin);
    const p = url.searchParams.get("p")
      ? parseInt(url.searchParams.get("p")!)
      : undefined;
    const s = url.searchParams.get("s") || undefined;
    const o = url.searchParams.get("o") || undefined;

    const result = await getUserUploads(site, userParam, { p, s, o, session });
    return jsonResponse(result);
  },
);

addRoute(
  /^\/([a-z]+)\/v1\/user\/([^/]+)\/?$/,
  "GET",
  async (req, match, origin, env) => {
    const site = match[1] as "nyaa" | "sukebei";
    const userParam = decodeURIComponent(match[2]);

    if (!["nyaa", "sukebei"].includes(site)) {
      return errorResponse(400, "Invalid site");
    }

    const session = await getSessionFromToken(req, env);

    if (/^\d+$/.test(userParam)) {
      const userId = parseInt(userParam);
      const result = await getUserInfo(site, userId, session);
      if (!result) {
        return jsonResponse({
          username: `user_${userId}`,
          title: null,
          uploads: 0,
        });
      }
      return jsonResponse(result);
    }

    const result = await getUserByUsername(site, userParam, session);
    if (!result) {
      return jsonResponse({
        username: userParam,
        title: null,
        uploads: 0,
      });
    }
    return jsonResponse(result);
  },
);

addRoute(/^\/([a-z]+)\/v1\/openapi\/?$/, "GET", async (req, match, origin) => {
  const site = match[1] as "nyaa" | "sukebei";
  if (!["nyaa", "sukebei"].includes(site)) {
    return errorResponse(400, "Invalid site");
  }

  const spec = generateOpenAPISpec(`${origin}/${site}/v1`);
  return jsonResponse(spec);
});

// Helper functions
function jsonResponse(data: any, status = 200): NyaaResponse {
  return {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
    body: JSON.stringify(data),
  };
}

function errorResponse(status: number, message: string): NyaaResponse {
  return jsonResponse({ error: message }, status);
}

function redirectResponse(url: string): NyaaResponse {
  return {
    status: 302,
    headers: {
      Location: url,
    },
    body: "",
  };
}

function corsPreflightResponse(): NyaaResponse {
  return {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
    body: "",
  };
}

export async function handleRequest(
  request: Request,
  origin?: string,
  env?: Record<string, any>,
): Promise<NyaaResponse> {
  const req: NyaaRequest = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  };

  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  const actualOrigin = origin || new URL(req.url).origin;
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname === "/") {
    const redirectTo = env?.NYAAPI_REDIRECT_TO;
    if (redirectTo) {
      return redirectResponse(redirectTo);
    }

    const isLocalhost =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!isLocalhost) {
      return redirectResponse("https://github.com/geckyzz/nyaa-api-worker");
    }
  }

  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (match && route.methods.includes(req.method)) {
      try {
        const response = await route.handler(req, match, actualOrigin, env);
        return response;
      } catch (error) {
        console.error("Route handler error:", error);
        return errorResponse(500, "Internal Server Error");
      }
    }
  }

  return errorResponse(404, "Not Found");
}
