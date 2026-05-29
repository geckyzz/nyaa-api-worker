# Nyaa REST API

a REST API proxy for accessing torrents uploaded on Nyaa (and Sukebei)

## Accessing

### base url

*try guess where it is* :3

### detailed docs

you can view the full interactive API documentation by visiting the `/openapi` endpoint in your browser or a tool like [Swagger Editor](https://editor.swagger.io/):
`GET /nyaa/v1/openapi`

## API endpoints

all endpoints follow the pattern: `/:site/v1/{endpoint}`, where `:site` is either `nyaa` or `sukebei`.

### 1. main page & search

```http
GET /:site/v1?q=query&p=1&c=1_2&s=seeders&o=desc
```

if no query parameters are provided, returns the main page. if parameters are present, performs a search.

valid query parameters:

- `q`: search query.
- `p`: page number.
- `c`: category (e.g., `1_2` for anime - english).
- `f`: filter (0=all, 1=no filter, 2=trusted, 3=remake).
- `s`: sort field (`id`, `comments`, `size`, `seeders`, `leechers`, `downloads`).
- `o`: order (`asc` or `desc`).

### 2. torrent details

```http
GET /{site}/v1/view/{idOrHash}
```

accepts either a numeric ID (e.g., `1`) or a 40-character BitTorrent InfoHash v1/SHA-1.

sub-resources:

- `GET /{site}/v1/view/{idOrHash}/files`: returns only the file list tree.
- `GET /{site}/v1/view/{idOrHash}/trackers`: returns only the tracker list.
- `GET /{site}/v1/view/{idOrHash}/comments`: returns only the comments.

### 3. user profiles & uploads

- `GET /{site}/v1/user/{usernameOrId}`: returns user title and upload count.
- `GET /{site}/v1/user/{usernameOrId}/uploads`: returns a paginated list of user's torrents.

---

## deployment

> [!WARNING]
> while we provide Cloudflare's wrangler config, Nyaa.si uses DDoS-Guard and firewalls that often block Cloudflare's IP ranges, so deployment to Cloudflare Worker highly limited. rhis may result in HTTP errors when running as a Worker.

### local development

1. `npm install`
2. `npm run dev`
   * runs at `http://localhost:8787`

*you can also try to execute using vercel's sdk*

## testing

the project uses `vitest` with the Cloudflare Workers pool for testing... although, it might not be properly implemented, yet.

- run all tests: `npm test`
- run tests in watch mode: `npx vitest dev`

---

## license

see LICENSE file. this is an unofficial API, use responsibly.
