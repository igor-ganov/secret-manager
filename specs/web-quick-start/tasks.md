# Web quick start — tasks

- [x] T1 Failing E2E in `e2e/web.spec.ts`: quick start issues a link that opens
      once, keeps the lifetime, keeps the draft on error, hides the passkey
      button until the account section is expanded (AC-1.1–1.5, AC-2.1–2.2,
      AC-3.1).
- [x] T2 Failing unit tests: `create-api-client.test.ts` (drop route),
      `view.test.ts` (visitor home: form, collapsed account, one passkey button,
      submit → `drop`), `shell/actions/drop.test.ts` (success/failure patches).
- [x] T3 `ApiClient.drop`; `AppState.quickTtlMinutes` + `quickDraft`;
      `actions.drop` (failure hands the draft back). (AC-1.2–1.4)
- [x] T4 Views: `render-ttl-choices.ts` shared with Settings, `render-quick-start.ts`,
      `render-account-card.ts`, `render-visitor-home.ts`; `render-app.ts` uses
      it; `render-login-card.ts` removed. (AC-1.1, AC-2.1–2.2, AC-3.1–3.2)
- [x] T5 Unit tests, lint, typecheck green; E2E green; screenshots at desktop
      and 400 px.
- [ ] T6 Docs: `documentation/user/web.md` (Quick start first), README "How to
      use"; passkey-accounts AC-2.1 note. PR, merge, CI green, production check.
