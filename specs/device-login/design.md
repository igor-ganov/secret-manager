# Device login — design

Satisfies [requirements](./requirements.md).

## 1. Data

```sql
device_requests(code_hash PK, poll_hash UNIQUE, kind ('cli'|'telegram'), label, subject,
                callback, status ('pending'|'approved'|'denied'), account_id,
                issued_token, grant_code, expires_at)
telegram_links(telegram_user_id PK, account_id, linked_at)
```

Ports `LoginRequestStore` and `TelegramLinkStore` (sqlite + D1). `login_requests`
is dropped and recreated as `device_requests` because SQLite cannot add columns
idempotently; requests live ten minutes, so nothing is lost.

Three secrets per request (AC-2.4): the **code** (in the link the owner opens) and
the **device secret** (only the requesting device holds it), both 32 random bytes
stored hashed; and after approval the short **grant** (8 characters, typed by hand
when the redirect fails), which only works together with the device secret. The
clear token sits in the row between approval and the claim, then is cleared.

## 2. Routes

| Method | Path                       | Auth | Purpose                                              |
| ------ | -------------------------- | ---- | ---------------------------------------------------- |
| POST   | /api/device/start          | none, limited | `{ label, callback? }` → `{ url, deviceSecret, expiresAt }`; callback must be a loopback http url |
| POST   | /api/device/claim          | none, limited, header `x-device-secret` | `{ grant }` → `{ token }` once, else 410 |
| GET    | /api/device/:code          | user | `{ kind, label, status, grant, callback }` or 404    |
| POST   | /api/device/:code/approve  | user | approve → `{ kind, grant, callback }` (AC-3.2, AC-1.2) |
| POST   | /api/device/:code/deny     | user | deny (AC-3.3)                                        |
| GET    | /api/devices               | user | `{ passkeys, telegram: { linked }, tokens }` (AC-4.1)|
| DELETE | /api/telegram              | user | unlink the chat                                      |

Approval strategy by kind (strategy map, no branching in the route):

- `cli`: `tokens.create(accountId, label)`, mint a grant, store both on the request,
  answer `{ grant, callback }`.
- `telegram`: `telegramLinks.link(subject, accountId)`, then
  `secrets.reassign(subject, accountId)` and `settings.reassign(subject, accountId)`
  (no-ops when nothing is stored), then `notifyTelegram(subject, 'Linked …')` through
  the Bot API (`sendMessage` via fetch; the worker already holds `BOT_TOKEN`).

Link url: `<origin>/#link=<code>`.

## 3. Bot

`createBot` gains `deviceLogin`, `enrollmentIssuer`, `telegramLinks`. A
`requireOwner` gate maps `ctx.from.id` → account id; when there is none it replies
with the login link and stops (AC-1.1). `/start` shows help plus, when unlinked, the
link. `/device` → enrollment url (AC-1.4); `/logout` → unlink (AC-1.5). Callback
queries from an unlinked user just get the link too.

## 4. CLI

`login`: server url prompt → `Bun.serve` on `127.0.0.1:0` serving
`GET /callback?grant=…` (answers a "you can close this window" page) →
`POST /api/device/start` with label = `Console on <hostname>` and that callback →
prints the url and opens it (`cmd /c start`, `open`, `xdg-open`; best effort) →
races the callback against `io.ask('Code: ', signal)` and the expiry. The ask takes
an `AbortSignal`: the terminal prompt is dropped when the callback wins, and the
piped line reader keeps an unconsumed line for the next prompt. Then
`POST /api/device/claim` with the device secret → store, print `whoami`.

## 5. Site

`#link=<code>` is a standalone page (no workspace): on load the passkey ceremony
runs at once, whatever the session state (approving re-authenticates), then
`approve`. For a CLI request the page shows the grant as the fallback and
navigates to `callback?grant=…`; reopened later, `GET /api/device/:code` returns
the grant so the code screen comes back. A failed prompt leaves "Continue with
passkey" to retry. Telegram requests end with "return to Telegram".

## 6. Tests

- Store tests; request-level tests for every route including "code alone never
  yields a token", "claim needs the device secret and the grant", "claim works once",
  loopback-only callbacks.
- Bot tests: unlinked user gets the link and no secret is stored; linked user acts
  as the account; `/device`, `/logout`.
- CLI: `login` against fake clients — callback wins, typed code wins, expiry; the
  piped-process integration test approves through the API and hits the callback.
- E2E: open `#link=<code>` with a virtual authenticator; the page approves, shows
  the grant and redirects to a local listener; the claim yields a working token.
  Without a callback the code alone (typed) claims the token.
