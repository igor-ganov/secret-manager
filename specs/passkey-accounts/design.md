# Passkey accounts — design

Satisfies [requirements](./requirements.md). Supersedes the Telegram-login parts of
[http-api](../http-api/design.md) §3–4.

## 1. Identity model

- **Account id** is a number ≥ 2^40 (2^40 + 48 random bits). Telegram user ids are
  below 2^40, so the existing `user_id INTEGER` columns of `secrets`, `user_settings`
  and `api_tokens` hold account ids unchanged, and a Telegram id can never collide
  with an account id. `reassign(from, to)` on the secret and settings stores moves
  legacy rows to an account on first link (device-login AC-1.2).
- **User handle** (WebAuthn `user.id`) is 32 random bytes, base64url, stored on the
  account, never PII (AC-1.3).

```sql
accounts(account_id PK, name, user_handle UNIQUE, recovery_hash, created_at)
passkeys(credential_id PK, account_id, public_key, counter, transports, backed_up, label, created_at)
challenges(challenge PK, flow, account_id NULL, payload, expires_at)
enrollments(code_hash PK, account_id, expires_at)
```

Ports: `AccountStore`, `PasskeyStore`, `ChallengeStore`, `EnrollmentStore`, each with
a `bun:sqlite` and a D1 adapter, like the existing stores.

## 2. Ceremonies (AC-1.x, 2.x)

`@simplewebauthn/server` v14 (WebCrypto only, runs on Workers and Bun). Wrapped in
`features/passkeys/create-passkey-ceremonies.ts`:

| step                | library call                                           |
| ------------------- | ------------------------------------------------------ |
| register options    | `generateRegistrationOptions` — `residentKey: 'required'`, `userVerification: 'required'`, `attestationType: 'none'`, `excludeCredentials` = account's passkeys |
| register verify     | `verifyRegistrationResponse` — `requireUserVerification`, expected origin/rpID from config |
| login options       | `generateAuthenticationOptions` — empty `allowCredentials` (discoverable) |
| login verify        | `verifyAuthenticationResponse` with the stored credential; counter rule AC-2.2; persist `newCounter` |

`WebAuthnConfig = { rpId, origin, rpName }` comes from configuration: worker `[vars]
RP_ID`/`ORIGIN`, local `BASE_URL` (AC-2.4).

Challenges (AC-2.3): the library's random challenge (32 bytes) is the primary key of
`challenges`; `take(challenge)` deletes and returns the row atomically; rows carry
`flow` (`register` | `login` | `add` | `enroll` | `recovery`), optional `account_id`
and a JSON `payload` (pending account name, enrollment code hash, recovery hash) so
nothing about a half-finished ceremony lives in memory.

## 3. Routes

| Method | Path                               | Auth | Purpose                                   |
| ------ | ---------------------------------- | ---- | ----------------------------------------- |
| POST   | /api/passkeys/register/options     | none | `{ name }` → creation options (AC-1.1)    |
| POST   | /api/passkeys/register/verify      | none | `{ response }` → account + session + recovery code (AC-1.1, 1.2) |
| POST   | /api/passkeys/login/options        | none | request options (AC-2.1)                  |
| POST   | /api/passkeys/login/verify         | none | `{ response }` → session                  |
| POST   | /api/passkeys/add/options          | user | creation options for the current browser (AC-3.4) |
| POST   | /api/passkeys/add/verify           | user | `{ response, label }`                     |
| DELETE | /api/passkeys/:id                  | user | remove, refused for the last one (AC-3.4) |
| POST   | /api/enrollments                   | user | → `{ url, qr, expiresAt }` (AC-3.1)       |
| GET    | /api/enrollments/:code             | none | `{ accountName }` or 404 (AC-3.3)         |
| POST   | /api/enrollments/:code/options     | none | creation options bound to the account     |
| POST   | /api/enrollments/:code/verify      | none | `{ response }` → passkey added, code consumed, session (AC-3.2) |
| POST   | /api/recovery/options              | none | `{ code }` → creation options (AC-4.1)    |
| POST   | /api/recovery/verify               | none | `{ code, response }` → session + new code |
| POST   | /api/auth/logout, GET /api/me      | user | unchanged; `me` = `{ id, name }` from accounts |

Enrollment link: `<origin>/#enroll=<code>`; the code (32 random bytes, base64url)
travels only in the fragment. The QR is rendered server-side with
`qrcode-generator` into an SVG data URL returned as `qr`; the page shows it in an
`<img>` (no HTML injection). CSP gains `img-src 'self' data:`.

Recovery code: 16 random bytes → base32, grouped `xxxx-xxxx-…`; stored as SHA-256
(AC-4.2). Comparison through the hash lookup is inherently constant-time.

Rate limiting (AC-5.2): `createRateLimiter({ limit, windowMs })` in memory keyed by
`cf-connecting-ip` (fallback `x-forwarded-for`, then `local`), applied to every
route flagged `limited: true`. Best effort per isolate; the random codes carry the
real security margin.

Rejected: PRF-based client-side encryption — the server must hold plaintext to
serve one-time links to third parties and to the bot, so end-to-end encryption
would remove the product's core feature.

## 4. Client (site)

Hash routes: `#enroll=<code>` (enrollment page), `#link=<code>` (device-login
approval, see device-login design). `web/auth/webauthn.ts` wraps
`PublicKeyCredential.parseCreationOptionsFromJSON` / `parseRequestOptionsFromJSON`
and `credential.toJSON()` (no library on the client). Anonymous view offers *Log in
with passkey*, *Create account* (name field) and *Use a recovery code*. After
signup or recovery the notice region shows the recovery code once with a copy
button. The workspace gains a **Devices** section (passkeys with Remove, "Add a
passkey here", "Add a device" → URL + QR).

## 5. Tests

- Store tests (sqlite `:memory:`) per port.
- `create-api-request-handler.test.ts` extended with the ceremony routes using a
  fake ceremony implementation injected into the handler (the library itself is
  exercised end-to-end in Playwright with a CDP virtual authenticator:
  `WebAuthn.enable` + `addVirtualAuthenticator({ hasResidentKey, hasUserVerification,
  isUserVerified })`). `dev-web.ts` loses `/dev/login`.
- E2E: signup → recovery code shown → logout → login with the same virtual
  authenticator; add-device link opened in a second context with its own
  authenticator; recovery with the shown code.
