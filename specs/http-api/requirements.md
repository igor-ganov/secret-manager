# HTTP API — requirements

> **Superseded in part.** Telegram Login (US-1, and token creation in US-3) was replaced by
> passkey accounts and device approval; see [passkey-accounts](../passkey-accounts/requirements.md)
> and [device-login](../device-login/requirements.md). US-2 and US-4–US-6 still apply.

## Overview

The Telegram bot is one input port over a shared domain (per-user secrets, one-time
links, per-user link lifetime). The web site and the CLI need the same capabilities
over HTTP. This spec defines a JSON API served by the existing worker / local server,
an authentication model that reuses Telegram identity (so bot, site and CLI share one
secret store per user), and revocable API tokens for non-browser clients.

Related specs: [web-app](../web-app/requirements.md) (browser client),
[cli](../cli/requirements.md) (console client).

## User stories

### US-1 Log in with Telegram

As a bot user, I want to log in to the site with my Telegram account, so that the
site shows the same secrets the bot manages.

- AC-1.1 WHEN a client POSTs `/api/auth/telegram` with the payload Telegram returns
  from its login flow (`id`, `auth_date`, `hash`, optional `first_name`, `last_name`,
  `username`, `photo_url`) and the `hash` verifies against the bot token, THE SYSTEM
  SHALL create a session token bound to that Telegram user id, set it as an
  `HttpOnly` cookie, and respond `200` with `{ id, name }`.
- AC-1.2 IF the `hash` does not verify, THEN THE SYSTEM SHALL respond `401` and set
  no cookie.
- AC-1.3 IF `auth_date` is older than 24 hours, THEN THE SYSTEM SHALL respond `401`.
- AC-1.4 WHEN a client POSTs `/api/auth/logout` with a valid session, THE SYSTEM
  SHALL revoke that session token and clear the cookie.
- AC-1.5 WHEN a client GETs `/api/auth/config`, THE SYSTEM SHALL respond with the
  numeric bot id needed to start the Telegram login flow.

### US-2 Authenticate requests

As a client (browser or CLI), I want every request authenticated by a token, so that
only the owner can reach their secrets.

- AC-2.1 WHEN a request carries `Authorization: Bearer <token>` or a `session`
  cookie that resolves to a stored token, THE SYSTEM SHALL execute it as that user.
- AC-2.2 IF neither resolves, THEN THE SYSTEM SHALL respond `401 { error }` for every
  `/api/*` route except the auth routes in US-1.
- AC-2.3 IF the request is cookie-authenticated, mutating (non-GET), and its `Origin`
  header is absent or differs from the request origin, THEN THE SYSTEM SHALL respond
  `403` (CSRF gate).
- AC-2.4 THE SYSTEM SHALL store only a SHA-256 hash of each token; the clear token is
  returned exactly once at creation.

### US-3 Manage API tokens

As a user, I want to create and revoke tokens for the CLI, so that a leaked token can
be cut off without affecting other devices.

- AC-3.1 WHEN a user POSTs `/api/tokens` with `{ label }`, THE SYSTEM SHALL create a
  token labelled so and respond `201 { id, label, createdAt, token }`.
- AC-3.2 WHEN a user GETs `/api/tokens`, THE SYSTEM SHALL list their tokens as
  `{ id, label, createdAt, current }` without the clear token; `current` marks the
  token the request itself used.
- AC-3.3 WHEN a user DELETEs `/api/tokens/:id` they own, THE SYSTEM SHALL revoke it
  and respond `204`; a foreign or unknown id responds `404`.

### US-4 Share and store secrets (bot parity)

As a user, I want the same actions the bot offers.

- AC-4.1 WHEN a user POSTs `/api/links` with `{ value }`, THE SYSTEM SHALL issue a
  one-time link honouring the user's link lifetime and respond
  `201 { url, curl, ttlMinutes }` without saving anything.
- AC-4.2 WHEN a user POSTs `/api/links` with `{ key, value }`, THE SYSTEM SHALL save
  the pair for that user and respond as in AC-4.1.
- AC-4.3 IF `key` is empty, contains whitespace, or exceeds 62 bytes, THEN THE
  SYSTEM SHALL respond `400 { error }`.
- AC-4.4 WHEN a user GETs `/api/secrets`, THE SYSTEM SHALL respond `{ keys }` sorted.
- AC-4.5 WHEN a user GETs `/api/secrets/:key`, THE SYSTEM SHALL respond `{ value }`
  or `404`.
- AC-4.6 WHEN a user PUTs `/api/secrets/:key` with `{ value }`, THE SYSTEM SHALL
  overwrite the stored value and respond `204` (no link is issued).
- AC-4.7 WHEN a user POSTs `/api/secrets/:key/link`, THE SYSTEM SHALL issue a
  one-time link to the stored value (`201`, same shape as AC-4.1) or respond `404`.
- AC-4.8 WHEN a user DELETEs `/api/secrets/:key`, THE SYSTEM SHALL remove it and
  respond `204`.
- AC-4.9 Secrets are scoped by user id: a user never sees another user's keys.

### US-5 Link lifetime settings

- AC-5.1 WHEN a user GETs `/api/settings`, THE SYSTEM SHALL respond
  `{ linkTtlMinutes, presets }` where `presets` are the bot's presets.
- AC-5.2 WHEN a user PUTs `/api/settings` with `{ linkTtlMinutes }` equal to one of
  the presets, THE SYSTEM SHALL persist it and respond `204`; any other value
  responds `400`.

### US-6 Transport hygiene

- AC-6.1 Every `/api/*` response SHALL carry `cache-control: no-store`.
- AC-6.2 Mutating requests SHALL require `content-type: application/json` when a
  body is expected; malformed JSON responds `400`.
- AC-6.3 THE SYSTEM SHALL behave identically on the Cloudflare Worker (D1) and the
  local Bun server (SQLite); the domain and HTTP layers are runtime-agnostic.
