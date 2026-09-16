# CLI — requirements

## Overview

A console utility for Windows (single `secret.exe` built with `bun build --compile`)
offering the bot's actions over the HTTP API. Because shells and terminals persist
command history, the utility must be usable **interactively**: run it, type
commands at its own prompt, and enter secret values through hidden input. Argument
mode exists for scripts, but nothing forces a secret onto the command line.

Depends on [http-api](../http-api/requirements.md).

## User stories

### US-1 Interactive session

- AC-1.1 WHEN `secret` starts without arguments, THE SYSTEM SHALL open an
  interactive session with a `secret>` prompt, accept one command per line, and
  keep running until `exit`, `quit`, or end of input.
- AC-1.2 WHILE in the session, THE SYSTEM SHALL support the same commands as
  argument mode (US-3) with identical output.
- AC-1.3 WHEN a command needs a secret value (`share`, `set`, `login`) and it was
  not supplied on the line, THE SYSTEM SHALL prompt for it with input hidden
  (nothing echoed).
- AC-1.4 WHEN the session runs without a TTY (piped input), THE SYSTEM SHALL read
  the same prompts as plain lines so it stays scriptable and testable.
- AC-1.5 WHEN Ctrl+C is pressed during hidden input, THE SYSTEM SHALL abort the
  current command without printing the partial value.

### US-2 Login and configuration

- AC-2.1 WHEN `login` runs, THE SYSTEM SHALL ask for the server URL (showing the
  remembered or built-in default) and the API token (hidden), verify them with
  `GET /api/me`, and on success store both in the user config file.
- AC-2.2 THE SYSTEM SHALL store the config at `%APPDATA%\secret-manager\config.json`
  on Windows and `$XDG_CONFIG_HOME/secret-manager/config.json` (default
  `~/.config/…`) elsewhere.
- AC-2.3 WHEN `logout` runs, THE SYSTEM SHALL delete the stored token (and revoke
  it on the server when reachable).
- AC-2.4 WHEN `whoami` runs, THE SYSTEM SHALL print the signed-in user's name and
  id.
- AC-2.5 IF a command needs a token and none is stored, THEN THE SYSTEM SHALL print
  "Not logged in. Run: login" and exit with code 2.
- AC-2.6 IF the server answers 401, THEN THE SYSTEM SHALL print that the token was
  rejected and exit with code 2.

### US-3 Commands (bot parity)

| Command                  | Behaviour                                                    |
| ------------------------ | ------------------------------------------------------------ |
| `share [value]`          | one-time link for an unsaved value (prompts if omitted)      |
| `set <key> [value]`      | save the pair, print a one-time link (prompts if omitted)    |
| `get <key>`              | print the stored value (raw, no newline decoration)          |
| `link <key>`             | print a one-time link to the stored value                    |
| `list`                   | print keys, one per line                                     |
| `rm <key>`               | delete the key (asks "Delete “key”? [y/N]" in a TTY)         |
| `ttl [minutes]`          | show or set link lifetime (presets only)                     |
| `login` / `logout` / `whoami` | see US-2                                                |
| `help`                   | list commands                                                |

- AC-3.1 WHEN a link is printed, THE SYSTEM SHALL print the URL, the `curl`
  snippet and "Valid for N minutes, opens once." — the same content as the bot.
- AC-3.2 IF the server answers 4xx with `{ error }`, THEN THE SYSTEM SHALL print
  the error and exit with code 1 (in the session: print and continue).
- AC-3.3 WHEN a value is `-`, THE SYSTEM SHALL read the value from stdin (pipe).
- AC-3.4 WHEN `get` succeeds, THE SYSTEM SHALL write only the value to stdout so
  it can be captured (`$env:X = secret get key`).
- AC-3.5 IF an unknown command is given, THEN THE SYSTEM SHALL print usage and exit
  with code 64.

### US-4 Packaging

- AC-4.1 `bun run build:cli` SHALL produce `dist/secret.exe` for Windows x64 (and
  `bun run cli -- <args>` runs it from source).
- AC-4.3 `bun run build:installer` SHALL produce `dist/secret-setup.exe`, a per-user
  installer that puts the program on the user's PATH, adds a Start menu entry and
  an uninstaller that removes the PATH entry again; every release SHALL publish
  both the installer and the portable executable.
- AC-4.2 The default server URL is baked in at build time from
  `SECRET_MANAGER_URL` when present; otherwise `login` asks for it.
