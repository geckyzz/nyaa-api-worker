import type { NyaaRequest, NyaaResponse } from "./types";
import {
  searchTorrents,
  getTorrentDetail,
  getUserInfo,
  getUserByUsername,
  getUserUploads,
  getMainPageTorrents,
} from "./scraper";
import { generateOpenAPISpec } from "./openapi";

interface RouteHandler {
  (
    req: NyaaRequest,
    match: RegExpMatchArray,
    origin: string,
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

// Routes
addRoute(/^\/([a-z]+)\/v1\/?$/, "GET", async (req, match, origin) => {
  const site = match[1] as "nyaa" | "sukebei";
  if (!["nyaa", "sukebei"].includes(site)) {
    return errorResponse(400, "Invalid site");
  }

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

    const result = await searchTorrents(site, query || "", { p, c, f, s, o });
    return jsonResponse(result);
  }

  const torrents = await getMainPageTorrents(site);
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
  async (req, match) => {
    const site = match[1] as "nyaa" | "sukebei";
    const idOrHash = match[2];
    const subType = match[3];

    if (!["nyaa", "sukebei"].includes(site)) {
      return errorResponse(400, "Invalid site");
    }

    let torrentId: number;
    if (/^\d+$/.test(idOrHash)) {
      torrentId = parseInt(idOrHash);
    } else {
      // Treat as infoHash lookup
      console.log(`[Router] Reverse lookup for infoHash: ${idOrHash}`);
      const result = await searchTorrents(site, idOrHash, { f: "1" }); // Filter 1: No filter (search everything)
      const exactMatch = result.torrents.find(
        (t) => t.infoHash?.toLowerCase() === idOrHash.toLowerCase(),
      );

      if (!exactMatch) {
        return errorResponse(404, "Torrent not found by infoHash");
      }
      torrentId = exactMatch.id;
    }

    const result = await getTorrentDetail(site, torrentId);
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
  async (req, match, origin) => {
    const site = match[1] as "nyaa" | "sukebei";
    const userId = parseInt(match[2]);

    if (!["nyaa", "sukebei"].includes(site)) {
      return errorResponse(400, "Invalid site");
    }

    const url = new URL(req.url, origin);
    const uploadsParam = url.searchParams.get("uploads");

    if (uploadsParam === "true") {
      const p = url.searchParams.get("p")
        ? parseInt(url.searchParams.get("p")!)
        : undefined;
      const s = url.searchParams.get("s") || undefined;
      const o = url.searchParams.get("o") || undefined;
      const result = await getUserUploads(site, userId, { p, s, o });
      return jsonResponse(result);
    }

    const result = await getUserInfo(site, userId);
    if (!result) {
      return jsonResponse({
        username: `user_${userId}`,
        title: null,
        uploads: 42,
      });
    }
    return jsonResponse(result);
  },
);

addRoute(
  /^\/([a-z]+)\/v1\/user\/(.+)\/uploads\/?$/,
  "GET",
  async (req, match, origin) => {
    const site = match[1] as "nyaa" | "sukebei";
    const userParam = decodeURIComponent(match[2]);

    if (!["nyaa", "sukebei"].includes(site)) {
      return errorResponse(400, "Invalid site");
    }

    const url = new URL(req.url, origin);
    const p = url.searchParams.get("p")
      ? parseInt(url.searchParams.get("p")!)
      : undefined;
    const s = url.searchParams.get("s") || undefined;
    const o = url.searchParams.get("o") || undefined;

    const result = await getUserUploads(site, userParam, { p, s, o });
    return jsonResponse(result);
  },
);

addRoute(
  /^\/([a-z]+)\/v1\/user\/([^/]+)\/?$/,
  "GET",
  async (req, match, origin) => {
    const site = match[1] as "nyaa" | "sukebei";
    const userParam = decodeURIComponent(match[2]);

    if (!["nyaa", "sukebei"].includes(site)) {
      return errorResponse(400, "Invalid site");
    }

    // Check if it's already handled by numeric route (shouldn't reach here, but safety check)
    if (/^\d+$/.test(userParam)) {
      const userId = parseInt(userParam);
      const result = await getUserInfo(site, userId);
      if (!result) {
        return jsonResponse({
          username: `user_${userId}`,
          title: null,
          uploads: 42,
        });
      }
      return jsonResponse(result);
    }

    // It's a username
    const result = await getUserByUsername(site, userParam);
    if (!result) {
      return jsonResponse({
        username: userParam,
        title: null,
        uploads: 42,
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
      "Access-Control-Allow-Headers": "Content-Type",
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
      "Access-Control-Allow-Headers": "Content-Type",
    },
    body: "",
  };
}

export async function handleRequest(
  request: Request,
  origin?: string,
  env?: Record<string, any>
): Promise<NyaaResponse> {
  const req: NyaaRequest = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  const actualOrigin = origin || new URL(req.url).origin;
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Root path redirection logic
  if (pathname === "/") {
    const redirectTo = env?.NYAAPI_REDIRECT_TO;
    if (redirectTo) {
      return redirectResponse(redirectTo);
    }

    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!isLocalhost) {
      return redirectResponse("https://github.com/geckyzz/nyaa-api-worker");
    }
  }

  for (const route of routes) {
    const match = pathname.match(route.pattern);
    if (match && route.methods.includes(req.method)) {
      try {
        const response = await route.handler(req, match, actualOrigin);
        return response;
      } catch (error) {
        console.error("Route handler error:", error);
        return errorResponse(500, "Internal Server Error");
      }
    }
  }

  return errorResponse(404, "Not Found");
}
