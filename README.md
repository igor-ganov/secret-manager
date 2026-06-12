# secret-manager

Telegram bot for sharing secrets through one-time links, with per-user secret storage.

## What it does

- Send the bot `key value` — the pair is saved for your Telegram account and the bot replies with a **one-time link** to the value.
- Send a single `value` (no key) — a one-time link is generated, **nothing is saved**.
- Every link lives **5 minutes** (configurable) and can be opened **exactly once**; after that the page responds `410 Gone`.
- Press the **List** button (or `/list`) to manage saved keys. Each key row has:
  - **get** — generates a fresh one-time link to the stored value;
  - **set** — asks for a new value (with a Cancel button) and overwrites the stored one;
  - **✕** — asks for confirmation, then deletes the key.
- Fully multi-user: secrets are scoped to the Telegram user id; users never see each other's keys.

## Stack

- [Bun](https://bun.sh) runtime, TypeScript (strict, no emit).
- [grammY](https://grammy.dev) for the Telegram bot.
- Two runtimes behind the same domain logic (ports + adapters):
  - **Local** (`src/main.ts`): long polling, `bun:sqlite`, in-memory one-time tokens, `Bun.serve`.
  - **Cloudflare Workers** (`src/worker.ts`): webhook, D1 for everything (secrets, one-time links, pending set contexts).

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) and copy the token.
2. Copy the environment file and fill it in:

   ```sh
   cp .env.example .env
   ```

   | Variable           | Default                 | Purpose                                  |
   | ------------------ | ----------------------- | ---------------------------------------- |
   | `BOT_TOKEN`        | — (required)            | Telegram bot token                       |
   | `PORT`             | `3000`                  | HTTP port for the link server            |
   | `BASE_URL`         | `http://localhost:PORT` | Public base URL used in generated links  |
   | `DATABASE_PATH`    | `secrets.sqlite`        | SQLite file for saved secrets            |
   | `LINK_TTL_MINUTES` | `5`                     | One-time link lifetime                   |

   For links to work outside your machine, expose the port publicly (reverse proxy or a tunnel such as `cloudflared`) and set `BASE_URL` to that public URL.

3. Install and run:

   ```sh
   bun install
   bun start        # or: bun run dev (hot reload)
   ```

## Cloudflare deployment

The bot runs in production as a Cloudflare Worker with a D1 database (webhook mode, no polling). One-time links are served from the same worker, so `BASE_URL` is not needed — the worker derives its public origin from the incoming request.

```sh
bunx wrangler d1 create secret-manager          # once; put database_id into wrangler.toml
bun run db:migrate                              # apply schema.sql to remote D1
bunx wrangler secret put BOT_TOKEN              # telegram token
bunx wrangler secret put WEBHOOK_SECRET         # random string, also passed to setWebhook
bun run deploy
```

Then point Telegram at the worker:

```sh
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "content-type: application/json" \
  -d '{"url":"https://<worker>.workers.dev/webhook","secret_token":"<WEBHOOK_SECRET>","drop_pending_updates":true}'
```

Local long-polling mode (`bun start`) and the webhook cannot run at the same time: setting the webhook disables polling. To go back to local development, call `deleteWebhook` first.

## Scripts

```sh
bun test               # unit tests
bun run typecheck      # tsc --noEmit
bun start              # run the bot + link server
bun run dev            # run with hot reload
```

## Architecture

Feature-based layout, functional style (closures, no classes), dependencies injected at the entry point:

```
src/
  main.ts                       # composition root: config → stores → server → bot
  config/load-config.ts         # env parsing and validation
  features/
    secrets/                    # persistent per-user key/value storage (bun:sqlite)
    one-time-links/             # token store (TTL, single use), HTTP handler, HTML pages
    bot/                        # message parsing, callback data, keyboards, bot wiring
```

Notes:

- One-time tokens are 256-bit random values and are kept **in memory only** — a restart invalidates outstanding links, which is the safe failure mode for a secret sharer.
- The secret page is rendered with HTML escaping and `no-store` / `noindex` / `no-referrer` headers.
- Key length is capped at 62 bytes because Telegram callback data is limited to 64 bytes.
- An end-to-end test against the real Telegram API is intentionally absent: it requires a live bot token; core logic is covered by unit tests (`bun test`).
