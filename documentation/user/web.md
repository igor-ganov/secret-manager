# Web site

The site does everything the Telegram bot does, from a browser, on the same
account. It is served from the same address as the one-time links (the Worker's
root URL).

## Log in

1. Open the site and press **Log in with Telegram**.
2. Telegram asks you to confirm; you come back signed in as the same user the bot
   knows, so your saved keys are already there.
3. **Log out** ends the browser session; the bot and other devices are unaffected.

## Share a secret

- **Value only** — press *Get one-time link*. Nothing is saved; you get the link, a
  ready-to-copy `curl` snippet and the lifetime.
- **Key + value** — the pair is saved to your account *and* a link is created. Keys
  are up to 62 bytes with no spaces.

Each result has **Copy link** / **Copy curl** buttons. The link opens exactly once:
the recipient sees a confirmation page and presses *Reveal secret*; scripts run the
`curl` snippet instead.

## Saved keys

Every key has three controls:

| Control | What it does                                                    |
| ------- | --------------------------------------------------------------- |
| Link    | Creates a fresh one-time link to the stored value               |
| Set     | Opens an inline field to overwrite the value (Save / Cancel)    |
| Delete  | Asks "Delete “key”?" — *Yes, delete* removes it, *Cancel* keeps |

## Settings

Pick how long new links stay valid: 1, 5, 15, 30, 60 minutes or 1 day. The choice
is saved immediately and applies to links made from the site, the bot and the CLI.

## CLI tokens

The console utility needs a token to act on your behalf:

1. Type a label (for example `laptop`) and press **New token**.
2. Copy the token — it is shown once.
3. Run `secret login` on the machine and paste it when asked.

Revoke a token here whenever a device is lost or no longer used; the current web
session is listed too but is ended with *Log out*.

## Keyboard and screen readers

Everything is reachable with Tab/Enter/Space. Results and confirmations are
announced through a live status region; errors are announced as alerts.
