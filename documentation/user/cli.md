# Console utility (`secret.exe`)

A single Windows executable that talks to the same server and account as the bot
and the web site.

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

## First run

```text
> secret login
Server URL [https://…]: ⏎        ← Enter keeps the default, if one is built in
API token: ▌                    ← hidden; create it on the web site → CLI tokens
Logged in as Ada (12345). Config: C:\Users\you\AppData\Roaming\secret-manager\config.json
```

The token is stored in that file; `secret logout` removes it and revokes it on the
server.

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
| `login` / `logout`    | Store / forget the token                                      |
| `whoami`              | Who the token belongs to                                      |
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

Exit codes: `0` done, `1` the server rejected the request, `2` not logged in or
token rejected, `64` usage error.

## Building

```sh
bun run build:cli                                  # → dist/secret.exe
SECRET_MANAGER_URL=https://<server> bun run build:cli   # bake in the server URL
```

`SECRET_MANAGER_URL` (environment) and `SECRET_MANAGER_CONFIG` (config file path)
also work at run time.
