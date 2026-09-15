# Web app — requirements

## Overview

A single-page site, served from the same origin as the API and the one-time links,
that offers everything the Telegram bot offers: share a value through a one-time
link, save key/value pairs, manage saved keys (link / set / delete), change link
lifetime. It adds one thing the bot does not have: creating API tokens for the CLI.

Depends on [http-api](../http-api/requirements.md).

## User stories

### US-1 Sign in / out

- AC-1.1 WHILE signed out, THE SYSTEM SHALL show a short explanation and a
  "Log in with Telegram" control that starts the Telegram login flow.
- AC-1.2 WHEN the page loads with `#tgAuthResult=<payload>` in the URL, THE SYSTEM
  SHALL POST the decoded payload to `/api/auth/telegram`, remove the fragment from
  the address bar, and render the signed-in view.
- AC-1.3 IF the login POST fails, THEN THE SYSTEM SHALL show the error text and stay
  signed out.
- AC-1.4 WHILE signed in, THE SYSTEM SHALL show the user's name and a "Log out"
  control which revokes the session and returns to the signed-out view.

### US-2 Share a secret

- AC-2.1 WHILE signed in, THE SYSTEM SHALL show a form with an optional Key field
  and a required Value field.
- AC-2.2 WHEN the form is submitted with a value only, THE SYSTEM SHALL request a
  one-time link and show the link, the `curl` snippet and the lifetime text
  ("Valid for N minutes, opens once"), each with a Copy control.
- AC-2.3 WHEN the form is submitted with key and value, THE SYSTEM SHALL save the
  pair, show the link as in AC-2.2, and refresh the key list.
- AC-2.4 IF the API rejects the key (400), THEN THE SYSTEM SHALL show the error
  next to the form.
- AC-2.5 WHEN a link is shown, THE SYSTEM SHALL clear the Value field.

### US-3 Manage saved keys

- AC-3.1 WHILE signed in, THE SYSTEM SHALL list the user's keys sorted; with none it
  shows "You have no saved keys yet."
- AC-3.2 WHEN "Link" is pressed on a key, THE SYSTEM SHALL request a fresh
  one-time link and show it as in AC-2.2.
- AC-3.3 WHEN "Set" is pressed, THE SYSTEM SHALL show an inline value field with
  Save and Cancel; Save overwrites the value; Cancel discards.
- AC-3.4 WHEN "Delete" is pressed, THE SYSTEM SHALL ask for confirmation inline
  ("Delete “key”?" with Yes/Cancel); Yes removes the key and refreshes the list.

### US-4 Settings

- AC-4.1 THE SYSTEM SHALL show the current link lifetime and the presets as a
  radio group; choosing one persists it immediately and confirms with a status
  message.

### US-5 CLI tokens

- AC-5.1 THE SYSTEM SHALL list existing tokens (label, creation date) with a
  Revoke control; the current web session is marked and cannot be revoked here.
- AC-5.2 WHEN "New token" is submitted with a label, THE SYSTEM SHALL show the
  clear token once with a Copy control and the command `secret login`.

### US-6 Quality

- AC-6.1 All controls are native buttons/inputs with visible labels; status and
  errors are announced through a `role="status"` / `role="alert"` region; the page
  is usable with keyboard only.
- AC-6.2 The page works at 400 px width.
- AC-6.3 No third-party scripts; no inline event handlers; content security policy
  `default-src 'self'` compatible.
- AC-6.4 Secret values never appear in the URL, in browser history, or in logs.
