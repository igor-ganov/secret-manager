# Passkey accounts — tasks

- [x] T1 Schema + ports + sqlite/D1 adapters: accounts, passkeys, challenges,
      enrollments; `reassign` on secrets/settings; store tests. (AC-1.1, 2.2, 2.3, 3.1)
- [x] T2 `features/passkeys`: ids, recovery code, ceremonies wrapper, rate limiter +
      tests. (AC-1.3, 2.2, 4.2, 5.2)
- [x] T3 Routes: passkeys, enrollments, recovery; remove Telegram login + users;
      request-level tests with a fake ceremony. (AC-1.x, 2.x, 3.x, 4.x, 5.x)
- [x] T4 Worker/local config: `RP_ID`, `ORIGIN`, `notifyTelegram`; `dev-web` without
      `/dev/login`; CSP `img-src data:`.
- [x] T5 Client: webauthn wrapper, anonymous view (login / signup / recovery),
      enrollment page, Devices section, recovery-code notice + unit tests.
- [x] T6 E2E with a virtual authenticator: signup, login, add device via link,
      recovery, remove passkey.
- [x] T7 Docs: README, `documentation/user/web.md`; specs http-api marked superseded.
