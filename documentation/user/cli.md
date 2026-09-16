# Console utility (`secret`)

A Windows program that acts for your account on the same server as the web site
and the bot. It never asks for a password or a token: it asks the account owner —
you — to approve it on the web site.

## Install

- **Installer** — download and run
  [secret-setup.exe](https://github.com/igor-ganov/secret-manager/releases/latest/download/secret-setup.exe).
  It installs for the current user (no administrator prompt) into
  `%LOCALAPPDATA%\Programs\secret-manager`, adds that folder to your PATH and creates
  a Start menu entry plus an uninstaller (*Settings → Apps → Secret manager CLI*).
  Open a **new** terminal afterwards: `secret` works from any folder.
- **Portable** — download
  [secret.exe](https://github.com/igor-ganov/secret-manager/releases/latest/download/secret.exe)
  and run it from wherever you put it. Same program, nothing is registered.

Windows SmartScreen may warn about an unsigned program the first time; choose
*More info → Run anyway*.

## Why an interactive mode

Terminals and shells remember what you type. A secret passed as an argument ends
up in PowerShell history, `doskey` buffers and terminal scrollback. The utility is
therefore built to be **started and typed into**:

```text
> secret
Interactive session. Type help for commands, exit to leave.
secret> set db-password
Value for db-password: ▌        ← nothing is echoed while you type
Saved “db-password”.
https://<server>/s/…
curl -X POST https://<server>/s/…
Valid for 5 minutes, opens once.
secret> exit
```

Values entered at the hidden prompt never appear on screen or in any history.
Ctrl+C during a hidden prompt aborts without printing what was typed.

## First run: link the device

```text
> secret login
Open this link if the browser did not open by itself:
https://<server>/#link=…
Waiting for the browser to come back. If it does not, type the code shown on the page.
Code: ▌
Logged in as My account (…). Config: C:\Users\you\AppData\Roaming\secret-manager\config.json
```

The utility opens the link in your browser at once (the server address is built
in; `login <url>` points it elsewhere). The page asks for your passkey only if the
browser is not signed in yet, approves the device, and sends the browser back to
the utility (a loopback address on this machine), where a page shows the short
fallback code; `login` finishes on its own. If that return does not happen — the
link was opened on another device, or the browser blocked it — the same code is on
the site's page: type it at the `Code:` prompt. The code is useless without the
secret the utility holds, so it can be read out loud.

The token is stored in that config file; `secret logout` removes it and revokes it
on the server. Requests expire after 10 minutes. Set `SECRET_MANAGER_NO_BROWSER=1`
to keep the utility from launching a browser (the link is always printed).

## Commands

Inside the session or as arguments (`secret <command> …`):

| Command               | Effect                                                        |
| --------------------- | ------------------------------------------------------------- |
| `share [value]`       | One-time link to a value that is not saved                    |
| `set <key> [value]`   | Save the pair and print a one-time link                       |
| `get <key>`           | Print only the stored value (capture it: `$v = secret get k`) |
| `link <key>`          | Fresh one-time link to a stored value                         |
| `list`                | Saved keys, one per line                                      |
| `rm <key> [-y]`       | Delete a key; asks first unless `-y`                          |
| `ttl [minutes]`       | Show or set link lifetime (1, 5, 15, 30, 60, 1440)            |
| `login` / `logout`    | Link / unlink this device                                     |
| `whoami`              | Which account the device acts for                             |
| `help`, `exit`        |                                                               |

When `[value]` is omitted it is asked for hidden. When it is `-` it is read from
standard input, so files and pipes work without touching the command line:

```powershell
Get-Content .\cert.pem -Raw | secret set tls-cert -
```

Values with spaces inside the session go in quotes: `set note "two words"`.

## Piped use and scripts

Without a terminal (input redirected) prompts are not printed and every prompt,
hidden or not, reads the next input line — so the same commands can be scripted.

Exit codes: `0` done, `1` the server rejected the request, `2` not linked, token
rejected or approval expired, `64` usage error.

## Building

```sh
bun run build:cli                                        # → dist/secret.exe
SECRET_MANAGER_URL=https://<server> bun run build:cli    # bake in the server URL
bun run build:installer                                  # → dist/secret-setup.exe (Inno Setup 6)
```

`SECRET_MANAGER_URL` (environment) and `SECRET_MANAGER_CONFIG` (config file path)
also work at run time.
