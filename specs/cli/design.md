# CLI — design

Satisfies [requirements](./requirements.md).

## 1. Structure

```
src/cli/
  main.ts                         # shell: argv → runOnce | runSession
  io/
    console-io.ts                 # ConsoleIo port: print, printError, ask, askHidden, confirm
    create-console-io.ts          # TTY implementation (raw mode for hidden input)
    create-line-io.ts             # non-TTY implementation (plain lines)      AC-1.4
    read-hidden-line.ts           # raw-mode reader: Enter ends, Backspace edits, Ctrl+C aborts  AC-1.3/1.5
    split-command-line.ts         # "set key value with spaces" → tokens (quotes honoured)
  config/
    cli-config.ts                 # { serverUrl?, token? }
    resolve-config-path.ts        # AC-2.2 (pure, takes env + platform)
    create-config-store.ts        # read/write JSON file
  api/
    api-client.ts                 # port: me, keys, read, save, share, link, remove, settings, revokeToken
    create-api-client.ts          # fetch + bearer; maps 401 → AuthError, 4xx → ApiError
  commands/
    command.ts                    # Command = { name, usage, run(ctx, args) => Promise<Outcome> }
    commands.ts                   # strategy map name → Command                    AC-3.5
    share.ts set.ts get.ts link.ts list.ts rm.ts ttl.ts login.ts logout.ts whoami.ts help.ts
    print-issued-link.ts          # AC-3.1 (same text as buildLinkMessage)
  run-command.ts                  # dispatch + error → exit code mapping           AC-2.5/2.6/3.2
  run-session.ts                  # REPL loop                                       AC-1.1
```

`Outcome = { kind: 'ok' } | { kind: 'error'; message; code }`; `run-command` prints
and returns the exit code. In argument mode `main` exits with it; in the session it
prints and continues (AC-3.2).

## 2. Hidden input (AC-1.3, 1.5)

`readHiddenLine(stdin, stdout)`:
`stdin.setRawMode(true)`; consume bytes; `\r`/`\n` → resolve; `` (Ctrl+C) →
reject `Aborted`; ``/`\b` → drop last char; everything else appended.
Nothing is echoed; a newline is written on completion. Raw mode is always restored
in `finally`. `create-line-io` (no TTY) reads a plain line instead, so tests and
pipes work (AC-1.4).

`ask` for visible prompts uses `node:readline` `question`. The session uses one
readline interface for command lines and pauses it while a hidden read runs.

## 3. Config (AC-2.x)

`resolveConfigPath({ platform, env })`: `win32` → `%APPDATA%\secret-manager\config.json`;
otherwise `$XDG_CONFIG_HOME ?? ~/.config` + `/secret-manager/config.json`. File is
written with mode `0o600` where supported. Build-time default server:
`bun build --compile --define SECRET_MANAGER_URL=…`; read via
`globalThis.SECRET_MANAGER_URL` guarded by `typeof` (AC-4.2).

## 4. Command context

```ts
type CommandContext = {
  readonly io: ConsoleIo;
  readonly config: ConfigStore;
  readonly client: (config: CliConfig) => ApiClient;   // built per command from current config
  readonly readStdin: () => Promise<string>;          // for "-" values (AC-3.3)
};
```

`requireClient(ctx)` returns `ApiClient` or throws `NotLoggedIn` (→ code 2).

## 5. Tests

- Pure: `split-command-line`, `resolve-config-path`, `print-issued-link`,
  `commands` map completeness, error → exit-code mapping.
- Commands run against a fake `ApiClient` and a scripted `ConsoleIo` (queued
  answers, captured output) — AC-1.3 (prompt called when value omitted), AC-2.1,
  2.5, 2.6, 3.1–3.5.
- `run-session` with a scripted line source — AC-1.1, 1.2.
- Integration: spawn `bun src/cli/main.ts` with piped stdin against a `dev-web`
  server — AC-1.4 end to end.
- Manual: run `dist/secret.exe` in a real Windows terminal; hidden input verified
  by eye.
