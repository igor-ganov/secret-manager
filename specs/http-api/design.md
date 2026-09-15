# HTTP API — design

Satisfies [requirements](./requirements.md). Section headings reference the
acceptance criteria they implement.

## 1. Layering (AC-6.3)

```
src/features/
  secrets/            SecretStore port (existing)          ─┐
  one-time-links/     OneTimeLinkStore port (existing)      │ ports + adapters
  settings/           SettingsStore port (existing)         │ (sqlite / D1)
  api-tokens/         ApiTokenStore port (new)             ─┘
  sharing/            createSharingService — application service shared by
                      bot, HTTP API (and therefore site + CLI)
  http-api/           createApiRequestHandler — JSON routes, auth, CSRF gate
  telegram-auth/      verifyTelegramLogin — pure verification of login payload
  app/                createAppRequestHandler — composes /api, /s, 404
```

The bot keeps its own input port (`features/bot`) but is refactored to call the
sharing service instead of duplicating "resolve ttl → issue link → build url".

## 2. Sharing service (AC-4.x, AC-5.x)

```ts
type IssuedLink = { readonly url: string; readonly ttlMinutes: number };
type SharingService = {
  share(userId, value): Promise<IssuedLink>;            // AC-4.1
  save(userId, key, value): Promise<void>;              // AC-4.6
  saveAndShare(userId, key, value): Promise<IssuedLink>;// AC-4.2
  linkFor(userId, key): Promise<IssuedLink | undefined>;// AC-4.7
  read / list / remove                                  // AC-4.4/4.5/4.8
  getTtlMinutes(userId): Promise<number>;               // AC-5.1
  setTtlMinutes(userId, minutes): Promise<void>;        // AC-5.2
};
```

Dependencies: `secrets`, `links`, `settings`, `buildLinkUrl`, `linkTtlMinutes`
(default). Key validation (`isValidKey`) moves from `features/bot` to
`features/sharing` because it is a domain rule (the 62-byte cap comes from Telegram
callback data, but the store is shared, so the cap applies everywhere).
`TTL_PRESETS_MINUTES` likewise moves to `features/settings`.

## 3. API tokens (AC-2.4, AC-3.x)

Table (both SQLite and D1, appended to `schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS api_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  label      TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS api_tokens_user ON api_tokens (user_id);
```

Port:

```ts
type ApiTokenRecord = { readonly id: string; readonly label: string; readonly createdAt: number };
type ApiTokenStore = {
  create(userId, label): Promise<{ token: string; record: ApiTokenRecord }>;
  resolve(token): Promise<{ userId: number; id: string } | undefined>;
  list(userId): Promise<readonly ApiTokenRecord[]>;
  revoke(userId, id): Promise<boolean>;
};
```

`id` is the hex SHA-256 of the token (`token_hash`): it identifies a row without
revealing the token. Tokens are `createToken()` values (256-bit). Hashing uses
WebCrypto (`crypto.subtle.digest`) so the same code runs on Bun and Workers; the
store takes `hashToken` as a dependency for testability.

Web sessions are ordinary API tokens labelled `web` and delivered as a cookie. One
mechanism, one table, one revocation path (AC-1.4 = revoke current token).

Rejected: signed cookies (JWT/HMAC). Would need a second secret to configure and a
separate revocation story; a hashed opaque token needs neither.

## 4. Telegram login verification (AC-1.1–1.3)

`verifyTelegramLogin({ botToken, now })(payload)` returns
`{ ok: true, user } | { ok: false, reason }`.

Algorithm (Telegram Login Widget contract):

1. `dataCheckString` = all fields except `hash`, as `key=value`, sorted by key,
   joined by `\n`.
2. `secretKey` = SHA-256(botToken).
3. `expected` = hex(HMAC-SHA256(secretKey, dataCheckString)).
4. constant-time compare with `hash`; reject if `now - auth_date > 86400`.

Bot id for `/api/auth/config` (AC-1.5) is the part of the bot token before `:`.

Login flow used by the site (no third-party script): the browser navigates to
`https://oauth.telegram.org/auth?bot_id=<id>&origin=<origin>&request_access=write&return_to=<origin>/`;
Telegram redirects back to `return_to#tgAuthResult=<base64url JSON>`. The client
decodes and POSTs it to `/api/auth/telegram`. The domain must be linked to the bot
via BotFather `/setdomain` (documented in README).

## 5. Request authentication and CSRF (AC-2.x)

```ts
type Principal = { readonly userId: number; readonly tokenId: string; readonly via: 'bearer' | 'cookie' };
authenticate(request): Promise<Principal | undefined>
```

Order: `Authorization: Bearer` first, then `session` cookie. For `via: 'cookie'` and
method ≠ GET/HEAD, require `Origin` header === `new URL(request.url).origin`
(AC-2.3). Bearer requests cannot be forged by a browser form, so no Origin check.
Cookie attributes: `HttpOnly; SameSite=Strict; Path=/; Max-Age=30d; Secure` when the
request is https.

## 6. Routing (AC-4.x, AC-5.x, AC-6.x)

Route table as data — `readonly Route[]` of `{ method, pattern, auth, handle }`
where `pattern` is a `URLPattern`-free manual matcher (`/api/secrets/:key` etc.),
because `URLPattern` is unavailable in Bun's runtime today. Keys in paths are
URL-encoded by the client and decoded by the router.

| Method | Path                       | AC    |
| ------ | -------------------------- | ----- |
| GET    | /api/auth/config           | 1.5   |
| POST   | /api/auth/telegram         | 1.1   |
| POST   | /api/auth/logout           | 1.4   |
| GET    | /api/me                    | 2.1   |
| GET    | /api/tokens                | 3.2   |
| POST   | /api/tokens                | 3.1   |
| DELETE | /api/tokens/:id            | 3.3   |
| POST   | /api/links                 | 4.1–3 |
| GET    | /api/secrets               | 4.4   |
| GET    | /api/secrets/:key          | 4.5   |
| PUT    | /api/secrets/:key          | 4.6   |
| DELETE | /api/secrets/:key          | 4.8   |
| POST   | /api/secrets/:key/link     | 4.7   |
| GET    | /api/settings              | 5.1   |
| PUT    | /api/settings              | 5.2   |

Responses: `json(body, status)` helper always adds `cache-control: no-store`
(AC-6.1). Body parsing: `readJsonObject(request)` → `Record<string, unknown> |
undefined` (undefined ⇒ 400) — validation happens per route with narrow type guards,
never casts. Link responses include `curl: "curl -X POST <url>"` so all clients show
the same snippet the bot shows.

## 7. Composition

- `createAppRequestHandler({ api, links })` — `/api/*` → api, `/s/*` → links, else
  404. Used by `worker.ts` (after the webhook check) and `main.ts`.
- `worker.ts` adds `createD1ApiTokenStore(env.DB)`; `main.ts` adds
  `createApiTokenStore(config.databasePath)`. `main.ts` additionally serves the
  built site (see web-app design).

## 8. Tests (traceability)

- `verify-telegram-login.test.ts` — AC-1.1, 1.2, 1.3 (hash computed in the test with
  `node:crypto`, an independent implementation).
- `create-api-token-store.test.ts` (sqlite `:memory:`) — AC-2.4, 3.1–3.3.
- `create-sharing-service.test.ts` — AC-4.1–4.3, 4.7, 5.1–5.2.
- `create-api-request-handler.test.ts` — in-memory stores through `fetch`-style
  `Request`s: every row of the table above, AC-2.1–2.3, 6.1–6.2.
- `create-bot.test.ts` keeps passing (bot refactor is behaviour-preserving).
