# HTTP API — tasks

Each task: requirement(s) → verifying test(s). Keep `bun test` and `bun run typecheck`
green between tasks.

- [x] T1 Move `isValidKey` to `features/sharing`, `TTL_PRESETS_MINUTES` to
      `features/settings`; update bot imports. (AC-4.3, 5.2 → existing tests)
- [x] T2 `features/sharing/create-sharing-service.ts` + test. (AC-4.1–4.3, 4.7,
      5.1–5.2 → `create-sharing-service.test.ts`)
- [x] T3 Refactor `create-bot.ts` to use the sharing service. (→ `create-bot.test.ts`
      unchanged and green)
- [x] T4 `features/api-tokens`: port, `hash-token.ts`, sqlite + D1 adapters, schema.
      (AC-2.4, 3.1–3.3 → `create-api-token-store.test.ts`)
- [x] T5 `features/telegram-auth/verify-telegram-login.ts` + test.
      (AC-1.1–1.3 → `verify-telegram-login.test.ts`)
- [x] T6 `features/http-api`: json helpers, body reader, auth/CSRF, route table,
      handler. (AC-1.x, 2.x, 3.x, 4.x, 5.x, 6.1–6.2 →
      `create-api-request-handler.test.ts`)
- [x] T7 `features/app/create-app-request-handler.ts`; wire `worker.ts` and
      `main.ts`; extend `schema.sql`. (AC-6.3 → typecheck + existing integration
      test)
- [x] T8 README: API section, `/setdomain` step. (docs)
