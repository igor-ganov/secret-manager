# Web app — design

Satisfies [requirements](./requirements.md).

## 1. Stack and hosting

- Plain TypeScript + DOM, no framework, no runtime dependency (AC-6.3). Source in
  `src/web/`; `index.html` references `app.ts` and `styles.css`.
- Build: `bun build src/web/index.html --outdir public --minify` (Bun bundles HTML
  entrypoints and hashes assets). `public/` is git-ignored and built in CI before
  `wrangler deploy`.
- Production: Cloudflare Workers static assets — `[assets] directory = "./public"`
  in `wrangler.toml`. Requests that match an asset are served as files; everything
  else (`/api`, `/s`, `/webhook`) reaches the worker script.
- Local: `main.ts` serves the same `index.html` through Bun's HTML import in
  `Bun.serve({ routes: { '/': index } })`, with the existing `fetch` handler as
  fallback. `dev-web.ts` is a bot-less entry for UI work: it serves site + API over
  SQLite and exposes `GET /dev/login` that creates a session for
  `DEV_LOGIN_USER_ID`. That route exists only in this entry file, never in
  `worker.ts` or `main.ts`.

Rejected: Angular — the user-level Angular conventions exist, but a framework for
one page adds a build pipeline and ~100 kB for no gain here. Rejected: Telegram's
`telegram-widget.js` — a third-party script on a secrets page (AC-6.3); the
underlying `oauth.telegram.org/auth` redirect is documented behaviour of the same
widget and needs no script.

## 2. Code organisation (functional-frontend rules)

One exported function per file, ≤ 50 lines excluding imports, no `if`/ternary —
choice is expressed with exhaustive `switch` over closed unions and strategy maps.
Effects (fetch, DOM, clipboard, location) live only in `shell/`.

```
src/web/
  index.html  styles.css  app.ts        # entry: wires shell + store + render
  api/                                   # one fetch wrapper per endpoint, returns Result
    request-json.ts  fetch-me.ts  login-telegram.ts  logout.ts  fetch-keys.ts
    share-value.ts  save-secret.ts  link-for-key.ts  delete-secret.ts
    fetch-settings.ts  save-settings.ts  fetch-tokens.ts  create-token.ts
    revoke-token.ts  fetch-auth-config.ts
  auth/       parse-tg-auth-result.ts  build-telegram-login-url.ts
  state/      app-state.ts (types)  create-store.ts  reducers/*.ts
  view/       h.ts (element builder)  render-app.ts  sections/*.ts
  shell/      copy-to-clipboard.ts  clear-hash.ts  main.ts
```

`Result<T> = { ok: true; value: T } | { ok: false; error: string }` — a local type
instead of Effect-TS: Effect would add ~60 kB to a page whose whole logic is a dozen
fetches; raised in the PR as the single deviation from the functional-frontend rule.

## 3. State

```ts
type Session = { kind: 'anonymous' } | { kind: 'loading' } | { kind: 'signed-in'; user: User };
type KeyRowMode = { kind: 'idle' } | { kind: 'setting' } | { kind: 'deleting' };
type AppState = {
  session: Session;
  botId: number | undefined;
  keys: readonly string[];
  rowModes: Readonly<Record<string, KeyRowMode>>;
  lastLink: IssuedLink | undefined;
  settings: { linkTtlMinutes: number; presets: readonly number[] } | undefined;
  tokens: readonly TokenRecord[];
  freshToken: string | undefined;
  status: { kind: 'idle' } | { kind: 'info'; text } | { kind: 'error'; text };
};
```

`createStore(initial)` → `{ get, dispatch(patch), subscribe }`; `render-app` is a
pure `(state, actions) => HTMLElement` re-rendered on every change into `#app`.
Focus is restored by `data-focus` ids after re-render (AC-6.1).

## 4. Visual design

Tokens (CSS custom properties), matching the existing link pages:

| token        | value                         |
| ------------ | ----------------------------- |
| `--bg`       | `#111`                        |
| `--surface`  | `#1c1c1c`                     |
| `--border`   | `#2a2a2a`                     |
| `--text`     | `#eee`                        |
| `--muted`    | `#999`                        |
| `--accent`   | `#2563eb` (hover `#1d4ed8`)   |
| `--danger`   | `#dc2626`                     |
| `--radius`   | `.5rem`                       |
| font         | `system-ui, sans-serif`       |

Layout: single column, `max-width: 44rem`, centred, `1.5rem` gutters; sections are
`<section>` cards with an `<h2>`. Key rows are a `<ul>` with `display: grid;
grid-template-columns: 1fr auto` and the action group wrapping under the key at
narrow widths (AC-6.2). Link result is a `<output>` block with monospace `<pre>`
lines and Copy buttons. Danger buttons (Delete/Revoke/Yes) use `--danger`. Focus
rings: `outline: 2px solid var(--accent); outline-offset: 2px`. No motion beyond
`:hover` colour.

Component states: buttons disabled while a request is in flight (`aria-busy` on the
section); status region `role="status"` for info, `role="alert"` for errors.

## 5. Security notes

- Session cookie is `HttpOnly`; the client never sees a token except the fresh CLI
  token it just created (AC-5.2).
- `#tgAuthResult` is stripped with `history.replaceState` before anything else runs
  (AC-1.2); the payload holds only public profile fields, no secret.
- `_headers` (copied to `public/`) sets `Content-Security-Policy: default-src 'self'`,
  `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` for the site (AC-6.3/6.4).

## 6. Tests

- Unit (bun test): every pure function — `parse-tg-auth-result`,
  `build-telegram-login-url`, reducers, `h`, section renderers (jsdom-free: they
  return DOM built through `h`; run under `bun test` with `happy-dom` registered).
- E2E (Playwright, `e2e/web.spec.ts`): against `dev-web.ts` on a random port with
  `DEV_LOGIN_USER_ID`. Covers AC-1.4, 2.2–2.5, 3.1–3.4, 4.1, 5.1–5.2; keyboard-only
  pass for AC-6.1. Event-driven waits only (locators/`expect`), no timeouts.
