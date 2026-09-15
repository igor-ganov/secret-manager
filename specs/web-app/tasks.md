# Web app — tasks

- [x] T1 Tooling: `happy-dom` for DOM unit tests, `@playwright/test`, ESLint config
      enforcing no-`if`/ternary + max-lines on `src/web/**`; scripts `build:web`,
      `dev:web`, `lint`, `e2e`. (AC-6.x)
- [x] T2 `src/dev-web.ts` bot-less entry with `/dev/login`. (E2E harness)
- [x] T3 Failing E2E `e2e/web.spec.ts` for AC-1.4, 2.2–2.5, 3.1–3.4, 4.1, 5.1–5.2.
- [x] T4 `auth/` pure functions + tests. (AC-1.1, 1.2)
- [x] T5 `api/` wrappers over `request-json` + tests with a fake `fetch`. (AC-2–5)
- [x] T6 `state/` types, store, reducers + tests.
- [x] T7 `view/` builder and sections + tests. (AC-2.1, 3.1, 4.1, 5.1, 6.1)
- [x] T8 `shell/` + `app.ts`, `index.html`, `styles.css`, `_headers`. (AC-6.2–6.4)
- [x] T9 Serve the site from `main.ts`; `wrangler.toml` assets; CI builds `public/`.
- [x] T10 E2E green; manual check in the MCP browser (console + network clean).
- [x] T11 README + `documentation/user/web.md`.
