# Web quick start — design

Satisfies [requirements](./requirements.md). Everything stays inside the
existing `src/web/` architecture (web-app design §2–§5): pure views, a single
store, effects only in `shell/`.

## 1. Page composition (AC-1.1, AC-2.1)

`renderApp` keeps dispatching on `session.kind`; the `anonymous` branch renders
`renderVisitorHome` instead of the login card:

```
header   h1 "Secret manager"
section  Quick start        (renderQuickStart: lead line, Secret, Link lifetime, submit)
div      role=status        (renderNotice — the issued link)
p        toast              (copy feedback)
div      role=alert         (renderError)
details  Account (optional) (renderAccountCard: passkey button + recovery form)
```

The account card is a `<details class="card">`: collapsed by default, native
disclosure semantics, no script. Inside it the existing "Continue with passkey"
button and the recovery `<details>` are unchanged, so passkey-accounts AC-2.1
("one entry point") still holds once expanded, and nothing WebAuthn-related runs
before the button is pressed (AC-2.2). The signed-in workspace is untouched
(AC-2.3).

Rejected: a "Sign in" link to a separate route — a second page for one button,
and the fragment is reserved for device and enrollment codes. Rejected: the
passkey button beside the quick start — two primary actions on one screen, and
the point is that the account is optional.

## 2. Lifetime choice (AC-1.1, AC-1.3)

`renderTtlChoices(h, { name, current, onChange })` builds the radio group both
the Settings section and the quick start use; Settings passes `actions.setTtl`
as `onChange`, the quick start passes nothing and reads the value on submit.
Presets come from `TTL_PRESETS_MINUTES` (`src/features/settings/ttl-presets.ts`),
already shared with the bot and the API, so the site needs no request to learn
them. The chosen lifetime lives in `AppState.quickTtlMinutes` (initially 5, the
account default) and is patched on every successful drop, so the full re-render
after a result keeps the choice (AC-1.3).

## 3. Draft and data flow (AC-1.2–1.5)

The store re-renders the whole page on every patch, so a textarea built from
nothing would lose its text on the first error. The quick start therefore keeps
its draft in state, written only when a drop fails:

- `AppState.quickDraft: string` is rendered as the textarea's text. The action
  receives the typed value as its argument, so on failure it hands that value
  back through the state and the rebuilt field still shows it (AC-1.4); on
  success it clears it (AC-1.3). Nothing is patched while typing.
- `ApiClient.drop(value, ttlMinutes)` → `POST /api/drops` → `decodeIssuedLink`.
  The route is public and rate-limited (mcp AC-1.5) and answers the same
  `IssuedLinkResponse` as `/api/links`, so `renderLinkResult` renders it as is.
- `actions.drop(value, ttlMinutes)`: on success patch
  `{ notice: { kind: 'link', intro, link }, quickDraft: '', quickTtlMinutes, error: undefined }`
  (AC-1.2, AC-1.3); on failure patch `{ error, quickDraft: value, quickTtlMinutes }`
  (AC-1.4).

Rejected: patching the draft on every `input` event — the full re-render
rebuilds the textarea and the restored focus lands with the caret at the start,
so typing would come out reversed. Rejected: an error channel outside the store
that avoids re-rendering — it would be the only state outside the single cell
and break the full-re-render rule the whole client relies on. Known limit: a
patch that arrives while the next secret is being typed (a Copy toast) rebuilds
the field from the state; the field is empty after a success, so only text typed
between a result and a Copy press is affected.

Nothing is written client-side (no storage, no URL): AC-3.3. The link itself is
an ordinary drop; the server keeps no record once it is opened (AC-1.5).

## 4. Locators (E2E contract)

Labels are the public API, as in `e2e/web.spec.ts`: textarea **Secret**,
radiogroup **Link lifetime** (the quick start and Settings never render
together), button **Get one-time link**, summary **Account (optional)**.

## 5. Accessibility and layout (AC-3.1, AC-3.2)

Native `textarea`, `fieldset`/`legend` radio group, `button type=submit`; the
result goes into the existing `role="status"` region. The stylesheet already
flows every control full-width under 30 rem; the lead line is a `p.muted`.
