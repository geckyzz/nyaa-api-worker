# Nyaa REST API

a REST API proxy for accessing torrents uploaded on Nyaa (and Sukebei)

## Accessing

### base url

_try guess where it is_ :3

### detailed docs

you can view the full interactive API documentation by visiting the `/openapi` endpoint:

- `GET /nyaa/v1/openapi`
- `GET /sukebei/v1/openapi`

## API endpoints

all endpoints follow the pattern: `/:site/v1`, where `:site` is either `nyaa` or `sukebei`.

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
GET /:site/v1/view/:ids
```

accepts either a numeric ID (e.g., `1`) or a 40-character BitTorrent InfoHash v1/SHA-1.

sub-resources:

- `GET /:site/v1/view/:ids/files`: returns only the file list tree.
- `GET /:site/v1/view/:ids/trackers`: returns only the tracker list.
- `GET /:site/v1/view/:ids/comments`: returns only the comments.

### 3. user profiles & uploads

- `GET /:site/v1/user/:username`: returns user title and upload count.
- `GET /:site/v1/user/:username/uploads`: returns a paginated list of user's torrents.

## authentication

to access authenticated content (private user data), use token-based authentication with RSA-4096 encrypted session cookies.

> [!IMPORTANT]
> Nyaa and Sukebei **require separate authentication**. you must provide a valid session cookie for each site.

> [!TIP]
> to avoid MITM attacks and keep your account secure, encrypt only your sensitive `session` cookie in the `Bearer` token and send non-sensitive DDoS-Guard cookies (`__ddg`) via the standard `Cookie` header. the server will merge them automatically.
>
> providing the `session` cookie directly in the `Cookie` header is also supported but **not recommended** for public or untrusted proxies.

### quick start (5 minutes)

#### 1. export your cookies

use a browser extension to export your cookies in **Netscape** format:

- **Firefox:** [Get-cookies.txt-Locally](https://addons.mozilla.org/firefox/addon/get-cookies-txt-locally/)
- **Chrome/Chromium:** [Get-cookies.txt-Locally](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)

open the exported file. it will look like this:

```text
.nyaa.si  TRUE  /  FALSE  1783259130  session  eyJfcGVybW...
.nyaa.si  TRUE  /  FALSE  1812083973  __ddg1_   vpM9j37toS...
```

- the **5th column** is the expiration timestamp (`expires_at`).
- the **6th column** is the cookie name.
- the **7th column** is the cookie value.

#### 2. get the public key

```bash
curl http://localhost:8787/auth/public-key
```

#### 3. wrap your session cookie

Python:

```python
import base64
import http.cookiejar
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding

# 1. get public key from the API
public_key_pem = """-----BEGIN PUBLIC KEY-----
... (from /auth/public-key) ...
-----END PUBLIC KEY-----"""

# 2. load cookies from file
cj = http.cookiejar.MozillaCookieJar('cookies.txt')
cj.load(ignore_discard=True, ignore_expires=True)

# 3. find the session cookie
session_cookie = next(c for c in cj if c.name == 'session' and 'nyaa.si' in c.domain)

# 4. prepare payload (format: session::::{expires_at}::::{value})
payload = f"session::::{session_cookie.expires}::::{session_cookie.value}"

# 5. encrypt with RSA public key
public_key = serialization.load_pem_public_key(public_key_pem.encode())
encrypted = public_key.encrypt(
    payload.encode(),
    padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
)

# 6. token is the base64 of the ciphertext
token = base64.b64encode(encrypted).decode()
```

#### 4. use token in API requests

include your generated token in the `Authorization` header and your `__ddg` cookies in the `Cookie` header:

```bash
curl http://localhost:8787/nyaa/v1/user/me/uploads \
  -H "Authorization: Bearer <your_generated_token>" \
  -H "Cookie: __ddg1_=...; __ddg8_=..."
```

### authentication endpoints

- `GET /auth/public-key` - get RSA-4096 public key for encryption
- `GET /auth/validate` - validate and decrypt your token
- `GET /:site/v1/auth/public-key` - alias for `/auth/public-key`
- `GET /:site/v1/auth/validate` - alias for `/auth/validate`
- `GET /:site/v1/auth/whoami` - check currently logged-in user

---

## deployment

> [!WARNING]
> while we provide Cloudflare's wrangler config, Nyaa.si uses DDoS-Guard and firewalls that often block Cloudflare's IP ranges, so deployment to Cloudflare Worker is highly limited. this may result in HTTP errors when running as a Worker.

### local development

1. `npm install`
2. generate RSA keypair:
   ```bash
   npm run keygen
   ```
3. create `.env` and set `NYAA_PUBLIC_KEY_PEM` and `NYAA_PRIVATE_KEY_PEM`.
4. `npm run dev`
   - runs at `http://localhost:8787`

---

## license

see LICENSE file.

> [!CAUTION]
> this is an unofficial API, use responsibly.

---

## testing

the project uses `vitest` with the Cloudflare Workers pool for testing.

- **unit tests:** covers core authentication logic and RSA-4096 token decryption.
- **integration tests:** covers worker request handling, routing, and OpenAPI delivery.

- run all tests: `npm test`
- run tests in watch mode: `npx vitest dev`
