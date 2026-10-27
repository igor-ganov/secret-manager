# secret-manager

Share secrets and files through one-time links and keep per-user key/value pairs — from a
Telegram bot, a web site, or a Windows console utility, all on the same account.

**Live bot: [@secret_manager_bot](https://t.me/secret_manager_bot)** ·
**Site: [secret-manager.igor-ganov.workers.dev](https://secret-manager.igor-ganov.workers.dev)** ·
**Windows CLI: [installer](https://github.com/igor-ganov/secret-manager/releases/latest/download/secret-setup.exe) · [portable](https://github.com/igor-ganov/secret-manager/releases/latest/download/secret.exe)**

## One account, three devices

| Client          | Where                      | Access                                                        |
| --------------- | -------------------------- | ------------------------------------------------------------- |
| Web site        | the Worker's root URL      | **passkey** — the account lives here                          |
| Telegram bot    | `@secret_manager_bot`      | a *device*: the bot sends a link, you approve it on the site  |
| `secret.exe`    | GitHub release             | a *device*: `secret login` opens the site, your passkey approves it, the browser returns to the utility (or you type the code it shows) |

Another browser or phone joins through a one-time link or QR code from the
**Devices** section (or `/device` in the bot). A recovery code, shown once at
signup, replaces every lost device.

User guides: [web](documentation/user/web.md) · [CLI](documentation/user/cli.md) ·
[MCP server for AI assistants](documentation/user/mcp.md).

## How to use

1. Open the site, paste a secret, pick a lifetime and press **Get one-time link** — no account needed. Everything below is optional.
2. For saved keys, devices and the bot, expand **Account (optional)** and press **Continue with passkey**: an existing passkey signs you in, otherwise creating one creates the account. Save the recovery code it shows.
3. Open [@secret_manager_bot](https://t.me/secret_manager_bot), press **Start**, open the link the bot replies with and press **Approve** on the site.
4. Send the bot a value (or `key value` to also save it) — it replies with a one-time link and a ready-to-copy `curl` snippet.
5. Share the link. Opening it shows a confirmation page; the secret is revealed only after pressing **Reveal secret** (a `POST` to the same url), so link-preview crawlers cannot burn it. Scripts can skip the page entirely: `curl -X POST <link>`.
6. Files work the same way: attach or drop one (up to 100 MiB) on the site, run `secret share --file <path>`, or send the bot a document. The recipient presses **Download file**, runs `curl -X POST -OJ <link>`, or `secret fetch <link>`.

## What it does

- Send the bot `key value` — the pair is saved for your Telegram account and the bot replies with a **one-time link** to the value.
- Send a single `value` (no key) — a one-time link is generated, **nothing is saved**.
- Every link lives **5 minutes** (configurable per user) and can be opened **exactly once**; after that the page responds `410 Gone`.
- Press **List** (or `/list`) to manage saved keys: **get** a fresh link, **set** a new value, **✕** delete.
- `/settings` picks the link lifetime, `/device` hands out an enrollment link for a new passkey, `/logout` unlinks the chat.
- Send a **file** (as a document, up to 20 MB — Telegram's limit for bots) — the bot replies with a one-time link that downloads it once. The site, the console utility and the MCP server take files of up to **100 MiB**.
- Fully multi-user: secrets are scoped to the Telegram user id; users never see each other's keys.

The web site opens on a **quick start** (paste a secret, get a one-time link, no
account) and, once signed in, offers the same actions plus the **Devices** section (passkeys, the
Telegram chat, console logins); the console utility offers them as commands and,
above all, as an **interactive session with hidden input** so secrets never land in
shell history.

Existing bot users keep everything: the first time a chat is approved, the secrets
and settings stored under its Telegram id move to the account.

## Stack

- [Bun](https://bun.sh) runtime, TypeScript (strict, no emit).
- [grammY](https://grammy.dev) for the Telegram bot.
- Web site: plain TypeScript + DOM, no framework, bundled by `bun build` from an HTML entrypoint; passkeys through the browser's WebAuthn JSON API, verified server-side with [`@simplewebauthn/server`](https://simplewebauthn.dev).
- Two runtimes behind the same domain logic (ports + adapters):
  - **Local** (`src/main.ts`): long polling, `bun:sqlite`, in-memory one-time tokens, `Bun.serve` (site + API + links).
  - **Cloudflare Workers** (`src/worker.ts`): webhook, D1 for everything, static assets for the site.

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) and copy the token.
2. Copy the environment file and fill it in:

   ```sh
   cp .env.example .env
   ```

   | Variable           | Default                 | Purpose                                  |
   | ------------------ | ----------------------- | ---------------------------------------- |
   | `BOT_TOKEN`        | — (required)            | Telegram bot token                       |
   | `PORT`             | `3000`                  | HTTP port for the site, API and links    |
   | `BASE_URL`         | `http://localhost:PORT` | Public base URL used in generated links  |
   | `DATABASE_PATH`    | `secrets.sqlite`        | SQLite file for saved secrets            |
   | `LINK_TTL_MINUTES` | `5`                     | Default one-time link lifetime           |

   For links to work outside your machine, expose the port publicly (reverse proxy or a tunnel such as `cloudflared`) and set `BASE_URL` to that public URL.

3. Install and run:

   ```sh
   bun install
   bun start        # or: bun run dev (hot reload)
   ```

4. Passkeys are bound to the site's origin: locally that is `BASE_URL`
   (`localhost` works), in production the `ORIGIN` variable in `wrangler.toml`.
   Change both together with a custom domain.

## Cloudflare deployment

The bot runs in production as a Cloudflare Worker with a D1 database (webhook mode, no polling). One-time links, the JSON API and the web site are served from the same worker, so `BASE_URL` is not needed — the worker derives its public origin from the incoming request.

```sh
bunx wrangler d1 create secret-manager          # once; put database_id into wrangler.toml
bunx wrangler r2 bucket create secret-manager-files                     # once; secret files (binding FILES)
bunx wrangler r2 bucket lifecycle add secret-manager-files expire-leftovers --expire-days 2 --abort-multipart-days 1 -y
bun run db:migrate                              # apply schema.sql to remote D1
bunx wrangler secret put BOT_TOKEN              # telegram token
bunx wrangler secret put WEBHOOK_SECRET         # random string, also passed to setWebhook
bun run deploy                                  # builds public/ then wrangler deploy
```

Then point Telegram at the worker:

```sh
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  -d '{"url":"https://<worker>.workers.dev/webhook","secret_token":"<WEBHOOK_SECRET>","drop_pending_updates":true}'
```

Local long-polling mode (`bun start`) and the webhook cannot run at the same time: setting the webhook disables polling. To go back to local development, call `deleteWebhook` first.

Pushes to `main` run tests, lint, type-check and the browser E2E suite, then migrate D1 and deploy (`.github/workflows/deploy.yml`).

## Console utility

Ready-made builds, published by `.github/workflows/release.yml` on every `v*` tag
with the production server baked in:

- [secret-setup.exe](https://github.com/igor-ganov/secret-manager/releases/latest/download/secret-setup.exe)
  — installer (Inno Setup): per-user, no admin prompt, adds `secret` to PATH, Start
  menu entry, uninstaller.
- [secret.exe](https://github.com/igor-ganov/secret-manager/releases/latest/download/secret.exe)
  — portable, the same program without installation.

From source:

```sh
bun run build:cli                                        # → dist/secret.exe (Windows x64)
bun run build:installer                                  # → dist/secret-setup.exe (needs Inno Setup 6)
SECRET_MANAGER_URL=https://<worker>.workers.dev bun run build:cli   # with the server baked in
bun run cli -- list                                      # run from source
```

See [documentation/user/cli.md](documentation/user/cli.md).

## MCP server for AI assistants

`secret mcp` turns the same executable into a [Model Context Protocol](https://modelcontextprotocol.io)
server over stdio with three tools: `create_one_time_link` (`value`, `ttlMinutes`),
`create_one_time_file_link` (`path`, `ttlMinutes`) and `fetch_one_time_link`
(`url`, `outPath`). An assistant that has to hand you a credential or a secret
file posts a one-time link instead of the content, and a link you give it is
opened straight into a local file, so the result carries only the path, name and
size. It needs no login — links are anonymous *drops* through `POST /api/drops`
and `POST /api/file-drops` — and the tool descriptions tell the assistant never
to repeat a secret in the chat.

```sh
claude mcp add --scope user secret-links -- secret mcp     # Claude Code, every project
```

See [documentation/user/mcp.md](documentation/user/mcp.md).

## HTTP API

All routes live under `/api/`, answer JSON, and (except the ceremonies and drops) require
either the `session` cookie or `Authorization: Bearer <token>`. Cookie-based
mutations must carry a same-origin `Origin` header; ceremony and code endpoints
are rate-limited per client address.

| Method | Path                     | Purpose                                            |
| ------ | ------------------------ | -------------------------------------------------- |
| POST   | `/api/passkeys/{register,login,add}/{options,verify}` | WebAuthn ceremonies (signup, login, extra passkey) |
| POST   | `/api/enrollments`; GET/POST `/api/enrollments/:code[/options, /verify]` | one-time link / QR for another device |
| POST   | `/api/recovery/{options,verify}` | new passkey from a recovery code               |
| POST   | `/api/device/start`; GET `/api/device/poll` | device-login handshake (CLI)            |
| GET/POST | `/api/device/:code[/approve, /deny]` | review and answer a device request (site)      |
| GET    | `/api/devices`; DELETE `/api/passkeys/:id`, `/api/telegram`, `/api/tokens/:id` | devices overview and revocation |
| POST   | `/api/auth/logout`       | revoke the session                                 |
| GET    | `/api/me`                | `{ id, name }`                                     |
| POST   | `/api/links`             | `{ value, key? }` → `{ url, curl, ttlMinutes }`    |
| POST   | `/api/drops`             | public, rate-limited: `{ value, ttlMinutes }` → same shape, saved nowhere (MCP) |
| GET    | `/api/secrets`           | `{ keys }`                                         |
| GET/PUT/DELETE | `/api/secrets/:key` | read `{ value }`, overwrite `{ value }`, delete |
| POST   | `/api/secrets/:key/link` | fresh one-time link to the stored value            |
| GET/PUT | `/api/settings`         | `{ linkTtlMinutes, presets }` / `{ linkTtlMinutes }`|
| POST   | `/api/files`             | signed in: `{ name, size, contentType? }` → `{ uploadId, partSize, partCount, expiresAt }` |
| POST   | `/api/file-drops`        | public, rate-limited: the same plus `ttlMinutes` (anonymous file) |
| PUT    | `/api/uploads/:id/parts/:n` | raw bytes of part *n* (8 MiB each, the last one the remainder) |
| POST   | `/api/uploads/:id/complete` | → `{ url, curl, ttlMinutes }`, `curl` being `curl -X POST -OJ <url>` |
| DELETE | `/api/uploads/:id`       | abort the upload                                   |

A file link (`/s/<token>`) answers `GET` with a page naming the file and its size
and a **Download file** button; `POST` streams the file once as an attachment
(`curl -X POST -OJ <link>` keeps its name) and deletes it from storage. `GET` with
`Accept: application/json` says what any link holds (`{ kind: 'text' }` or
`{ kind: 'file', name, size }`) without opening it. Files are up to 100 MiB.
Session and device tokens are 256-bit random values; only their SHA-256 is stored.
Account ids start at 2^40 so they never collide with Telegram ids in the shared
`user_id` columns.

## Scripts

```sh
bun test               # unit + integration tests (src/**)
bun run e2e            # Playwright against the bot-less dev server
bun run lint           # ESLint (branch-free rules for src/web)
bun run typecheck      # tsc --noEmit
bun start              # bot + site + API + links
bun run dev            # same with hot reload
bun run dev:web        # site + API only, with GET /dev/login for UI work
bun run build:web      # bundle the site into public/
bun run build:cli      # compile dist/secret.exe
```

## Architecture

Feature-based layout, functional style (closures, no classes), dependencies injected at the entry points. Specs live in `specs/` (requirements → design → tasks).

```
src/
  main.ts                 # local composition root: config → stores → server → bot
  worker.ts               # Cloudflare composition root: D1 stores, webhook, assets
  dev-web.ts              # bot-less dev server for the site
  config/                 # env parsing
  features/
    sharing/              # application service shared by bot, API, site, CLI
    secrets/ settings/ one-time-links/ api-tokens/ accounts/ enrollment/ device-login/   # ports + sqlite/D1 adapters
    passkeys/             # passkey store, challenges, WebAuthn ceremonies (@simplewebauthn/server)
    http-api/             # JSON routes, auth/CSRF gate, wire types + decoders
    app/                  # request routing shared by both runtimes
    bot/                  # grammY input port
  web/                    # site client: api → state → view (pure) → shell
  cli/                    # console utility: io → config → api → commands; mcp/ = the MCP server mode
```

Notes:

- One-time tokens are 256-bit random values; locally they are kept **in memory only** — a restart invalidates outstanding links, which is the safe failure mode for a secret sharer.
- Secret files ([spec](specs/secret-files/requirements.md)): bytes in R2, metadata in D1, uploaded in 8 MiB parts (a Worker request body is capped at 100 MB). A cron trigger every 15 minutes deletes expired files and aborts stale uploads; the bucket's lifecycle rule removes anything older than two days as a backstop. Locally files live in memory like text links.
- The secret page is rendered with HTML escaping and `no-store` / `noindex` / `no-referrer` headers; the site ships a `default-src 'self'` CSP.
- Key length is capped at 62 bytes because Telegram callback data is limited to 64 bytes; the store is shared, so the cap applies to every client.
- An end-to-end test against the real Telegram API is intentionally absent: it requires a live bot token. Core logic is covered by unit tests, the API by request-level tests (with a fake WebAuthn layer), the site by Playwright with a CDP virtual authenticator (real ceremonies), the CLI by a piped-process test that performs the device-login handshake.
