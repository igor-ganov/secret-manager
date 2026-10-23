# MCP server for AI assistants (`secret mcp`)

An assistant that holds a credential for you — a password it generated, a token
it minted, a connection string it assembled — should not paste it into the chat:
chats are logged, quoted and kept in context windows. With this server the
assistant hands it over through a **one-time link** instead: it calls one tool
with the value and a lifetime, posts the link, you open it once.

No account is involved for now: the assistant sends an anonymous *drop* to the
server, exactly like sending the bot a value without a key, and the link is
saved nowhere. Binding drops to your account is a later step.

## Install

1. Install the console utility with
   [secret-setup.exe](https://github.com/igor-ganov/secret-manager/releases/latest/download/secret-setup.exe)
   (see [cli.md](cli.md)). It puts `secret` on your PATH, and the production
   server is built in; no `secret login` is needed for the MCP server.
2. Register the server with your assistant. Claude Code, for every project:

   ```sh
   claude mcp add --scope user secret-links -- secret mcp
   ```

   Any other MCP client takes the same command in its JSON configuration:

   ```json
   { "mcpServers": { "secret-links": { "command": "secret", "args": ["mcp"] } } }
   ```

`claude mcp list` then shows `secret-links` as connected. To point the server
elsewhere (your own deployment), pass the url: `secret mcp https://<server>`; it
falls back to `SECRET_MANAGER_URL` and then to the url stored by `login`.

## The tool

`create_one_time_link` takes:

| Argument     | Meaning                                                      |
| ------------ | ------------------------------------------------------------ |
| `value`      | the secret, verbatim (1–16 384 bytes)                        |
| `ttlMinutes` | how long the unopened link lives, whole minutes, 1–1440      |

and returns the same three lines the bot and the utility print — the link, a
`curl -X POST …` line for scripts, "Valid for N minutes, opens once." — plus the
structured fields `url`, `curl`, `ttlMinutes`, `expiresAt`. The tool's own
description tells the assistant to reply with the link and never with the value.
When the server refuses or cannot be reached, the tool reports the error instead
of inventing a link.

Opening the link shows a confirmation page; the secret appears only after
**Reveal secret**, so link previews cannot burn it. Afterwards the url answers
`410 Gone`.

## Limits

The endpoint behind the tool (`POST /api/drops`) is public, so it is bounded:
30 drops per minute per address, 16 KiB per value, at most one day of life. The
value is kept only until the link is opened or expires.
