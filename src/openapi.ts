import type { OpenAPISchema } from "./types";

export function generateOpenAPISpec(baseUrl: string): OpenAPISchema {
  return {
    openapi: "3.0.0",
    info: {
      title: "Nyaa REST API",
      version: "1.2.0",
      description: "A REST API for accessing Nyaa anime torrent data",
    },
    servers: [
      {
        url: baseUrl || "{protocol}://{host}",
        description: "API Server",
      },
    ],
    paths: {
      "/auth/public-key": {
        get: {
          summary: "Get RSA public key for encryption",
          operationId: "getPublicKey",
          responses: {
            200: {
              description: "Public key metadata",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      public_key: { type: "string" },
                      algorithm: { type: "string" },
                      padding: { type: "string" },
                      encoding: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/auth/validate": {
        get: {
          summary: "Validate a session token",
          operationId: "validateToken",
          responses: {
            200: { description: "Token is valid" },
            401: { description: "Invalid or expired token" },
          },
        },
      },
      "/{site}/v1/auth/public-key": {
        get: {
          summary: "Get site-scoped RSA public key",
          operationId: "getSitePublicKey",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
          ],
          responses: {
            200: { description: "Public key metadata" },
          },
        },
      },
      "/{site}/v1/auth/validate": {
        get: {
          summary: "Validate a session token for a specific site",
          operationId: "validateSiteToken",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
          ],
          responses: {
            200: { description: "Token is valid" },
            401: { description: "Invalid or expired token" },
          },
        },
      },
      "/{site}/v1/auth/whoami": {
        get: {
          summary: "Check currently logged-in user",
          operationId: "getWhoami",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
          ],
          responses: {
            200: {
              description: "Currently logged-in username",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      username: { type: "string" },
                      authenticated: { type: "boolean" },
                    },
                  },
                },
              },
            },
            401: { description: "Authentication required" },
          },
        },
      },
      "/{site}/v1": {
        get: {
          summary: "Get main page torrents or search torrents",
          operationId: "getMainOrSearch",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
            {
              name: "q",
              in: "query",
              description: "Search query",
              schema: { type: "string" },
            },
            {
              name: "p",
              in: "query",
              description: "Page number",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "c",
              in: "query",
              description: "Category filter",
              schema: { type: "string" },
            },
            {
              name: "f",
              in: "query",
              description:
                "Filter type (0=all, 1=no filter, 2=trusted, 3=remakes)",
              schema: { type: "string" },
            },
            {
              name: "s",
              in: "query",
              description:
                "Sort field (id, comments, size, seeders, leechers, downloads)",
              schema: { type: "string" },
            },
            {
              name: "o",
              in: "query",
              description: "Sort order (asc, desc)",
              schema: { type: "string", enum: ["asc", "desc"] },
            },
          ],
          responses: {
            200: {
              description: "SearchResult containing torrents and pagination",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SearchResult" },
                },
              },
            },
            400: { description: "Bad request" },
          },
        },
      },
      "/{site}/v1/view/{idOrHash}": {
        get: {
          summary: "Get torrent details by ID or infoHash",
          operationId: "getTorrentDetail",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
            {
              name: "idOrHash",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Torrent ID (numeric) or infoHash (40-char hex)",
            },
          ],
          responses: {
            200: {
              description: "Torrent details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TorrentDetail" },
                },
              },
            },
            404: { description: "Torrent not found" },
          },
        },
      },
      "/{site}/v1/view/{idOrHash}/files": {
        get: {
          summary: "Get torrent file list only",
          operationId: "getTorrentFiles",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
            {
              name: "idOrHash",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Array of FileNode objects",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/FileNode" },
                  },
                },
              },
            },
            404: { description: "Torrent not found" },
          },
        },
      },
      "/{site}/v1/view/{idOrHash}/trackers": {
        get: {
          summary: "Get torrent trackers only",
          operationId: "getTorrentTrackers",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
            {
              name: "idOrHash",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Array of tracker URLs",
              content: {
                "application/json": {
                  schema: { type: "array", items: { type: "string" } },
                },
              },
            },
            404: { description: "Torrent not found" },
          },
        },
      },
      "/{site}/v1/view/{idOrHash}/comments": {
        get: {
          summary: "Get torrent comments only",
          operationId: "getTorrentComments",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
            {
              name: "idOrHash",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Array of Comment objects",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Comment" },
                  },
                },
              },
            },
            404: { description: "Torrent not found" },
          },
        },
      },
      "/{site}/v1/user/{usernameOrId}": {
        get: {
          summary: "Get user information",
          operationId: "getUserInfo",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
            {
              name: "usernameOrId",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Username or numeric User ID",
            },
          ],
          responses: {
            200: {
              description: "User information",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/User" },
                },
              },
            },
            404: { description: "User not found" },
          },
        },
      },
      "/{site}/v1/user/{usernameOrId}/uploads": {
        get: {
          summary: "Get user uploads (paginated)",
          operationId: "getUserUploads",
          parameters: [
            {
              name: "site",
              in: "path",
              required: true,
              schema: { type: "string", enum: ["nyaa", "sukebei"] },
            },
            {
              name: "usernameOrId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "p",
              in: "query",
              description: "Page number",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "s",
              in: "query",
              description: "Sort field",
              schema: { type: "string" },
            },
            {
              name: "o",
              in: "query",
              description: "Sort order",
              schema: { type: "string", enum: ["asc", "desc"] },
            },
          ],
          responses: {
            200: {
              description: "Paginated user uploads",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SearchResult" },
                },
              },
            },
            404: { description: "User not found" },
          },
        },
      },
    },
    components: {
      schemas: {
        Torrent: {
          type: "object",
          required: [
            "id",
            "name",
            "category",
            "subcategory",
            "comments",
            "downloads",
            "seeders",
            "leechers",
            "size",
            "uploadDate",
            "magnet",
            "download",
            "infoHash",
            "trusted",
            "remake",
            "anonymous",
          ],
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            category: { type: "string" },
            subcategory: { type: "string" },
            comments: { type: "integer" },
            downloads: { type: "integer" },
            seeders: { type: "integer" },
            leechers: { type: "integer" },
            size: { type: "string" },
            uploadDate: { type: "string", format: "date-time" },
            magnet: { type: "string" },
            download: { type: "string" },
            infoHash: { type: "string", nullable: true },
            trusted: { type: "boolean" },
            remake: { type: "boolean" },
            anonymous: { type: "boolean" },
          },
        },
        SearchResult: {
          type: "object",
          required: ["torrents", "pagination"],
          properties: {
            torrents: {
              type: "array",
              items: { $ref: "#/components/schemas/Torrent" },
            },
            pagination: {
              type: "object",
              required: ["currentPage", "totalPages", "totalResults"],
              properties: {
                currentPage: { type: "integer" },
                totalPages: { type: "integer" },
                totalResults: { type: "integer" },
              },
            },
          },
        },
        FileNode: {
          type: "object",
          required: ["name", "size", "type"],
          properties: {
            name: { type: "string" },
            size: { type: "string", nullable: true },
            type: { type: "string", enum: ["file", "dir"] },
            children: {
              type: "array",
              items: { $ref: "#/components/schemas/FileNode" },
            },
          },
        },
        TorrentDetail: {
          type: "object",
          required: [
            "id",
            "name",
            "category",
            "subcategory",
            "comments",
            "downloads",
            "seeders",
            "leechers",
            "size",
            "uploadDate",
            "uploader",
            "magnet",
            "download",
            "infoHash",
            "trackers",
            "trusted",
            "remake",
            "anonymous",
            "description",
            "information",
            "fileList",
          ],
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
            category: { type: "string" },
            subcategory: { type: "string" },
            comments: {
              type: "array",
              items: { $ref: "#/components/schemas/Comment" },
            },
            downloads: { type: "integer" },
            seeders: { type: "integer" },
            leechers: { type: "integer" },
            size: { type: "string" },
            uploadDate: { type: "string", format: "date-time" },
            uploader: { type: "string" },
            magnet: { type: "string" },
            download: { type: "string" },
            infoHash: { type: "string", nullable: true },
            trackers: { type: "array", items: { type: "string" } },
            trusted: { type: "boolean" },
            remake: { type: "boolean" },
            anonymous: { type: "boolean" },
            description: { type: "string" },
            information: { type: "string", nullable: true },
            fileList: {
              type: "array",
              items: { $ref: "#/components/schemas/FileNode" },
            },
          },
        },
        User: {
          type: "object",
          required: ["username", "title", "uploads"],
          properties: {
            username: { type: "string" },
            title: { type: "string", nullable: true },
            uploads: { type: "integer", nullable: true },
          },
        },
        Comment: {
          type: "object",
          required: [
            "id",
            "pos",
            "username",
            "text",
            "timestamp",
            "role",
            "avatar",
          ],
          properties: {
            id: { type: "integer" },
            pos: { type: "integer" },
            username: { type: "string" },
            text: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            role: { type: "string", nullable: true },
            avatar: { type: "string", nullable: true },
          },
        },
      },
    },
  };
}
