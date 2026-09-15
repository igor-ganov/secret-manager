# Passkey accounts — requirements

## Overview

The web site owns identity. An **account** is created and signed into with a
**passkey** (WebAuthn, discoverable credential, user verification required). The
Telegram chat, the console utility and additional browsers are **devices** attached
to an account: they never authenticate on their own, they are approved on the site
(see [device-login](../device-login/requirements.md)). A signed-in browser can add
another browser's passkey through a one-time link or QR code. Telegram login on the
site is removed.

Existing bot users keep their secrets: the first time a Telegram chat is linked to
an account, the secrets and settings stored under that Telegram user id move to the
account.

## User stories

### US-1 Create an account

- AC-1.1 WHEN a visitor presses "Continue with passkey", no stored credential is
  used, and the registration ceremony that follows completes, THE SYSTEM SHALL create an account, store the passkey
  (credential id, public key, counter, transports, backed-up flag, label) and sign
  the browser in.
- AC-1.2 THE SYSTEM SHALL show a recovery code exactly once after signup; only its
  hash is stored.
- AC-1.3 Registration options SHALL require a discoverable credential and user
  verification, request no attestation, and carry a random opaque user handle.
- AC-1.4 IF the ceremony fails or the challenge is unknown/expired/reused, THEN
  THE SYSTEM SHALL respond `400` without creating anything.

### US-2 Sign in

- AC-2.1 THE SYSTEM SHALL offer a single entry point, "Continue with passkey":
  WHEN the authentication ceremony completes with a stored credential, THE SYSTEM
  SHALL set a session and show the workspace; WHEN it ends without a login, THE
  SYSTEM SHALL start the registration ceremony at once (US-1) — the device's own
  passkey-creation dialog is the confirmation; nothing is created if it is dismissed.
- AC-2.2 THE SYSTEM SHALL persist the signature counter and reject an assertion
  whose counter is not greater than the stored one when both are non-zero.
- AC-2.3 Challenges SHALL be ≥16 random bytes, single-use (deleted on the first
  verify attempt, success or failure), expire after 5 minutes, and be bound to their
  flow (register / login / add-passkey / enroll / recovery) and, when known, account.
- AC-2.4 Every ceremony SHALL be verified against a configured RP id and origin,
  never against request headers.

### US-3 Add a passkey on another device (one-time link / QR)

- AC-3.1 WHILE signed in, WHEN the user presses "Add a device", THE SYSTEM SHALL
  mint a one-time enrollment link (≤10 min, single-use, only its hash stored) and
  show it as a copyable URL and a QR code.
- AC-3.2 WHEN the link is opened on another device, THE SYSTEM SHALL offer to
  register a passkey for that account; on success the passkey is added, the link is
  consumed and the new device is signed in.
- AC-3.3 IF the link is expired, consumed or unknown, THEN THE SYSTEM SHALL say so
  and offer nothing else.
- AC-3.4 WHILE signed in, the user SHALL also be able to add a passkey for the
  current browser directly ("Add a passkey here") and to remove any passkey except
  the last one.

### US-4 Recovery

- AC-4.1 WHEN a visitor enters a valid recovery code, THE SYSTEM SHALL let them
  register a new passkey for that account, sign them in, invalidate the used code
  and show a fresh one exactly once.
- AC-4.2 Recovery codes SHALL be ≥128-bit, shown grouped base32, compared in
  constant time; wrong codes get a uniform error.

### US-5 Sessions and hygiene

- AC-5.1 Sessions remain hashed random tokens in an `HttpOnly; SameSite=Strict`
  cookie (API tokens table, label `web`), revocable from the site.
- AC-5.2 Ceremony, enrollment, recovery and device endpoints SHALL be rate-limited
  per client address (best effort per isolate).
- AC-5.3 Errors SHALL not reveal whether a credential, account or code exists.
- AC-5.4 The Telegram-login routes and their code are removed.
