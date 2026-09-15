# Device login — requirements

## Overview

The Telegram bot and the console utility never hold a password or passkey. They
obtain access by asking the account owner to approve them **on the web site**: the
device shows a one-time link, the owner opens it (signing in with a passkey if
needed), sees what is asking, and approves. Depends on
[passkey-accounts](../passkey-accounts/requirements.md).

## User stories

### US-1 Link a Telegram chat

- AC-1.1 WHEN a Telegram user whose chat is not linked sends anything to the bot,
  THE SYSTEM SHALL reply with a login link to the site and act on nothing else.
- AC-1.2 WHEN the owner opens that link and approves, THE SYSTEM SHALL link the
  Telegram user id to the account, move any secrets and settings stored under the
  Telegram id to the account, and send the chat a confirmation message.
- AC-1.3 WHILE linked, every bot action SHALL use the account as owner, so the bot,
  site and CLI show the same keys.
- AC-1.4 WHEN a linked user sends `/device`, THE SYSTEM SHALL reply with an
  enrollment link (passkey-accounts US-3), so a lost browser can be replaced from
  the phone.
- AC-1.5 WHEN a linked user sends `/logout`, THE SYSTEM SHALL unlink the chat.

### US-2 Log the console utility in

- AC-2.1 WHEN `login` runs, THE SYSTEM SHALL start a local callback listener on
  the loopback address, register the request with that callback, open the login
  link in the browser (printing it as well), and wait for whichever comes first:
  the browser calling back with the grant, or the person typing the grant code
  shown on the page.
- AC-2.2 WHEN a grant arrives, THE SYSTEM SHALL exchange it — together with the
  secret only this device holds — for an API token labelled with the device label
  (host name by default), store it with the server URL, and print who it is logged
  in as.
- AC-2.3 IF the request expires, is denied, or the grant is wrong, THEN THE SYSTEM
  SHALL say so and exit with code 2.
- AC-2.4 The grant SHALL be useless without the device secret; the link code alone
  SHALL never yield a token. Callbacks SHALL be accepted only on loopback hosts.

### US-3 Approve on the site

- AC-3.1 WHEN the site is opened with a login-request link, THE SYSTEM SHALL
  immediately ask for the passkey (no button), and on success approve the request
  in the same step; a failed or dismissed prompt leaves a button to try again.
- AC-3.2 Approving a CLI request SHALL create an API token for the account, mint a
  short grant code, show it on the page as the fallback, and redirect the browser to
  the device's callback with the grant. Returning to the link later SHALL show the
  code again.
- AC-3.3 The device SHALL be able to claim the token exactly once; denial, expiry
  or reuse leave no token behind.
- AC-3.4 Approving a Telegram request SHALL link the chat and tell the person to
  return to Telegram.

### US-4 Devices overview

- AC-4.1 WHILE signed in, THE SYSTEM SHALL list the account's passkeys, linked
  Telegram chat and API tokens (web sessions and CLI devices) with revoke controls;
  the token creation form is removed.
