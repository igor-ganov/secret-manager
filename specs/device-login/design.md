# Device login — design

Satisfies [requirements](./requirements.md).

## 1. Data

```sql
login_requests(code_hash PK, poll_hash, kind ('cli'|'telegram'), label, subject,
               status ('pending'|'approved'|'denied'), account_id NULL,
               issued_token NULL, expires_at)
telegram_links(telegram_user_id PK, account_id, linked_at)
```

Ports `LoginRequestStore` and `TelegramLinkStore` (sqlite + D1). The clear
`issued_token` sits in the row between approval and the device's next poll
(seconds, ≤10 min), then is cleared on read; the row expires regardless.

Two secrets per request (AC-2.4): the **code** (in the link the owner opens) and
the **poll token** (only the requesting device has it). Both 32 random bytes,
stored hashed.

## 2. Routes

| Method | Path                       | Auth | Purpose                                              |
| ------ | -------------------------- | ---- | ---------------------------------------------------- |
| POST   | /api/device/start          | none, limited | `{ label }` → `{ url, pollToken, expiresAt }` (CLI) |
| GET    | /api/device/poll           | none, header `x-poll-token` | `{ status: 'pending' }` \| `{ status: 'approved', token }` \| 410 |
| GET    | /api/device/:code          | user | `{ kind, label }` or 404 (AC-3.1)                    |
| POST   | /api/device/:code/approve  | user | approve (AC-3.2, AC-1.2)                             |
| POST   | /api/device/:code/deny     | user | deny (AC-3.3)                                        |
| GET    | /api/devices               | user | `{ passkeys, telegram: { linked }, tokens }` (AC-4.1)|
| DELETE | /api/telegram              | user | unlink the chat                                      |

Approval strategy by kind (strategy map, no branching in the route):

- `cli`: `tokens.create(accountId, label)` → store clear token on the request.
- `telegram`: `telegramLinks.link(subject, accountId)`, then
  `secrets.reassign(subject, accountId)` and `settings.reassign(subject, accountId)`
  (no-ops when nothing is stored), then `notifyTelegram(subject, 'Linked …')` through
  the Bot API (`sendMessage` via fetch; the worker already holds `BOT_TOKEN`).

Link url: `<origin>/#link=<code>`.

## 3. Bot

`createBot` gains `deviceLogin: { loginUrlFor(telegramUserId, label) }`,
`enrollment: { enrollmentUrlFor(accountId) }`, `telegramLinks`. A `resolveOwner`
middleware maps `ctx.from.id` → account id; when there is none it replies with the
login link and stops (AC-1.1). `/start` shows help plus, when unlinked, the link.
`/device` → enrollment url (AC-1.4); `/logout` → unlink (AC-1.5). Callback queries
from an unlinked user just get the link too.

## 4. CLI

`login`: server url prompt as before → `POST /api/device/start` with label =
`os.hostname()` → prints the url → polls every 2 s (`context.sleep`, injectable)
until `approved` (store token, print `whoami`), or 410 (expired/denied → code 2).
The token paste path is removed.

## 5. Site

`#link=<code>` route: signed-out visitors see the normal anonymous view with a
banner "Sign in to approve a device"; once signed in, the approval card shows kind
and label with Approve / Deny; after approval the hash is cleared. **Devices**
section lists passkeys, the Telegram chat (Unlink) and tokens (Revoke).

## 6. Tests

- Store tests; request-level tests for every route including "code alone never
  yields a token" and "poll consumes the token once".
- Bot tests: unlinked user gets the link and no secret is stored; linked user acts
  as the account; `/device`, `/logout`.
- CLI: `login` against a fake client whose poll resolves after N calls; the
  piped-process integration test approves through the in-process API.
- E2E: open `#link=<code>` signed in, approve, then `GET /api/device/poll` returns a
  token that authenticates `/api/me`.
