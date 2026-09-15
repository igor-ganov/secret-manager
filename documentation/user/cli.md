# Console utility (`secret.exe`)

A single Windows executable that acts for your account on the same server as the
web site and the bot. It never asks for a password or a token: it asks the account
owner — you — to approve it on the web site.

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
Server URL [https://…]: ⏎        ← Enter keeps the built-in default
Open this link if the browser did not open by itself:
https://<server>/#link=…
Waiting for the browser to come back. If it does not, type the code shown on the page.
Code: ▌
Logged in as My account (…). Config: C:\Users\you\AppData\Roaming\secret-manager\config.json
```

The utility opens the link in your browser. The page asks for your passkey right
away; once confirmed, the browser is sent back to the utility (a loopback address
on this machine) and `login` finishes on its own. If that return does not happen —
the link was opened on another device, or the browser blocked it — the page shows
a short code: type it at the `Code:` prompt. The code is useless without the
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
```

`SECRET_MANAGER_URL` (environment) and `SECRET_MANAGER_CONFIG` (config file path)
also work at run time.
