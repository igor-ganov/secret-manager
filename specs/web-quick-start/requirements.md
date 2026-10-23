# Web quick start — requirements

## Overview

The site's front page is a **quick start**: paste a secret, pick how long the
link lives, get a one-time link. No account, no sign-in, nothing saved. The
account (saved keys, devices, Telegram bot, console utility) stays available but
becomes **opt-in**: a visitor who only wants a link never meets a passkey prompt.

Reuses the anonymous *drop* of [mcp](../mcp/requirements.md) US-1
(`POST /api/drops`) and the link rendering of [web-app](../web-app/requirements.md)
AC-2.2. Amends [passkey-accounts](../passkey-accounts/requirements.md) AC-2.1:
"Continue with passkey" remains the single sign-in entry point, but it lives in
the opt-in account section instead of being the page.

## User stories

### US-1 Quick start

As a visitor, I want to paste a secret and get a one-time link at once, so that
I can hand a credential to someone without creating anything first.

- AC-1.1 WHILE signed out, THE SYSTEM SHALL show the quick-start form first:
  a required multi-line **Secret** field, a **Link lifetime** radio group with
  the shared presets (1, 5, 15, 30, 60 minutes, 1 day; 5 minutes selected
  initially) and a **Get one-time link** control.
- AC-1.2 WHEN the form is submitted, THE SYSTEM SHALL POST `/api/drops` with the
  value and the chosen lifetime and show the result as in web-app AC-2.2: the
  link, the `curl` snippet, "Valid for N minutes, opens once." and Copy
  controls, announced through the status region.
- AC-1.3 WHEN a link is shown, THE SYSTEM SHALL clear the Secret field and keep
  the chosen lifetime selected for the next secret.
- AC-1.4 IF the server rejects the drop (400, 429, network), THEN THE SYSTEM
  SHALL show the error text as an alert and keep the typed secret in the field.
- AC-1.5 WHEN the issued link is opened, THE SYSTEM SHALL serve the secret
  exactly once (mcp AC-1.2); the site stores nothing about it.

### US-2 Opt-in account

As a visitor, I want the account to stay out of my way until I ask for it, so
that the page never prompts for a passkey on its own.

- AC-2.1 WHILE signed out, THE SYSTEM SHALL present the account as a collapsed
  section below the quick start, summarised as optional, naming what it adds
  (saved keys, devices, the Telegram bot, the console utility).
- AC-2.2 WHEN the section is expanded, THE SYSTEM SHALL offer exactly one
  "Continue with passkey" control (passkey-accounts AC-2.1) and the collapsed
  recovery form (AC-4.1 there); no passkey ceremony starts before that control
  is pressed.
- AC-2.3 WHILE signed in, THE SYSTEM SHALL show the workspace as before
  (web-app US-2–US-4, device-login US-4); the share form there keeps the
  account's lifetime setting.

### US-3 Quality

- AC-3.1 The quick start is operable with the keyboard alone: Secret, lifetime,
  submit, then Copy; the result is announced through `role="status"`.
- AC-3.2 The page works at 400 px width with the form and result readable.
- AC-3.3 The secret never appears in the URL, history or logs (web-app AC-6.4).
