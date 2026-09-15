# Web site

The site is where your account lives. You sign in with a **passkey** (Face ID,
Windows Hello, a fingerprint, a security key — whatever your device offers). The
Telegram bot and the console utility are **devices** that you approve from here;
they never see a password or a key.

## Continue with passkey

There is one button. Press **Continue with passkey**:

- If this device already holds a passkey for the site, you are signed in.
- If not, your device asks you to create a passkey; confirming it creates the
  account in the same step. The page then shows a **recovery code** once. Copy it
  somewhere safe: it is the only way back in if you lose every device.

Nothing to type, no password, no e-mail.

## Share a secret

- **Value only** — press *Get one-time link*. Nothing is saved; you get the link, a
  ready-to-copy `curl` snippet and the lifetime.
- **Key + value** — the pair is saved to your account *and* a link is created. Keys
  are up to 62 bytes with no spaces.

Each result has **Copy link** / **Copy curl** buttons. The link opens exactly once:
the recipient sees a confirmation page and presses *Reveal secret*; scripts run the
`curl` snippet instead.

## Saved keys

| Control | What it does                                                    |
| ------- | --------------------------------------------------------------- |
| Link    | Creates a fresh one-time link to the stored value               |
| Set     | Opens an inline field to overwrite the value (Save / Cancel)    |
| Delete  | Asks "Delete “key”?" — *Yes, delete* removes it, *Cancel* keeps |

## Settings

Pick how long new links stay valid: 1, 5, 15, 30, 60 minutes or 1 day. The choice
applies to links made from the site, the bot and the console utility.

## Devices

- **Passkeys** — every passkey that can open the account, with the date it was
  added. Remove any except the last one.
- **Add a passkey here** — for a browser you signed into with another device's key
  (for example your phone through the QR prompt) and want to keep.
- **Add a device** — shows a one-time link and a QR code (valid 10 minutes). Open
  the link or scan the code on the other phone or computer and press *Add passkey
  on this device*; that device is then signed in with its own passkey.
- **Telegram** — whether the bot chat is linked. To link it, send the bot anything:
  it replies with a link; open it here and press **Approve**. *Unlink Telegram*
  cuts the chat off; `/logout` in the bot does the same.
- **Sessions and console logins** — browser sessions and console utilities that
  hold a token. **Revoke** any you no longer use.

## Approving a device

When the bot or the console utility asks for access, it gives you a link. Opening it
here shows *what* is asking (for example "The console utility “Console on
LAPTOP” asks to use your account") with **Approve** and **Deny**. If you are not
signed in yet, sign in first; the request is still there afterwards.

## Lost every device?

On the sign-in page, enter your recovery code under *Lost every device?* and create
a passkey on the current device. The old code stops working and a new one is shown
once. If you still have the Telegram bot linked, `/device` in the bot gives you an
enrollment link instead, without spending the code.

## Keyboard and screen readers

Everything is reachable with Tab/Enter/Space. Results and confirmations are
announced through a live status region; errors are announced as alerts.
