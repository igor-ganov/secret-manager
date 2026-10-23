# MCP — design

## Shape

Two small additions, one on each side of the existing HTTP API:

```
assistant ──MCP/stdio──▶ secret mcp ──POST /api/drops──▶ worker ──▶ one_time_links
                          (src/cli/mcp)                  (http-api/drop-routes)
person   ──POST /s/<token>────────────────────────────▶ worker (unchanged)
```

Nothing new is stored: a drop is a row in `one_time_links` with the lifetime
the caller asked for, which the existing store already supports
(`issue(value, ttlMs)`).

## Server side (US-1)

- `src/features/sharing/drop-limits.ts` — `DROP_MAX_VALUE_BYTES = 16 384`,
  `DROP_MAX_TTL_MINUTES = 1440`, `isValidDropValue`, `isValidDropTtl`. Shared
  by the route and by the MCP tool schema, so the two never disagree (AC-1.3,
  AC-1.4, AC-2.2).
- `SharingService.drop(value, ttlMinutes): Promise<IssuedLink>` — issues the
  link with that lifetime; no user id, no settings lookup (AC-1.1).
- `src/features/http-api/drop-routes.ts` — `POST /api/drops`, `auth: 'none'`,
  `limited: true`. Reads `{ value, ttlMinutes }` with the existing
  `readJsonObject` helpers, validates through `drop-limits`, answers with the
  same `linkResponse` shape as `/api/links` (`IssuedLinkResponse`, so the CLI
  decoder `decodeIssuedLink` is reused). Mounted in
  `createApiRequestHandler` next to the secret routes.
- The public-route branch of the dispatcher already applies the cookie CSRF
  gate and the per-address limiter (AC-1.5, AC-1.6); nothing changes there.

Why a separate route rather than optional auth on `/api/links`: `/api/links`
is an account operation (settings-driven lifetime, optional `key` to save). A
drop has neither; making auth optional there would mean two validation paths
behind one url. A distinct route also gets its own rate-limit bucket.

Abuse bound: 30 drops per minute per address, 16 KiB each, at most a day of
storage, swept on every insert — the same order of magnitude as the bot
already allows any Telegram user.

## Client side (US-2)

- `PublicClient` (renamed from `DeviceClient`: the unauthenticated half of the
  API) gains `drop(value, ttlMinutes)` → `ApiResult<IssuedLinkResponse>`.
  `CommandContext.createPublicClient` follows the rename.
- `src/cli/mcp/create-mcp-server.ts` — `createMcpServer({ drop, now })`
  builds an `McpServer` (official `@modelcontextprotocol/sdk`) named
  `secret-manager`, with `instructions` and one `registerTool`:
  `create_one_time_link`, zod input schema from `drop-limits`, output schema
  `{ url, curl, ttlMinutes, expiresAt }`. The handler maps `ApiResult` to a
  `CallToolResult`: success → text (the three lines `printIssuedLink` prints)
  plus `structuredContent`; failure → `isError: true` with the message
  (AC-2.2–2.4). The transport is injected, so the unit test drives it through
  `InMemoryTransport.createLinkedPair()` with the SDK `Client`.
- `src/cli/mcp/serve-mcp.ts` — connects a `StdioServerTransport` and resolves
  when it closes (AC-2.1).
- `src/cli/mcp/run-mcp.ts` — resolves the server url (argument → default →
  stored config), builds the client and server, serves; exit 64 without a url
  (AC-2.6).
- `src/cli/main.ts` dispatches `mcp` **before** creating the console io: the
  piped io locks stdin through `Bun.stdin.stream().getReader()` at creation,
  and the MCP transport must own stdin and stdout alone (AC-2.1).
- `src/cli/commands/mcp.ts` — the `Command` listed by `help`; inside a session
  it only reports that `mcp` runs in argument mode, exit 64 (AC-2.5).

Rejected: hand-rolling the JSON-RPC framing. The protocol has versions,
capabilities and schema negotiation; the SDK is the reference implementation
and compiles into `secret.exe` with `bun build --compile` like everything else.

Rejected: a separate `secret-mcp.exe`. One executable, one installer, one
PATH entry; the MCP server is a mode of the program the person already has.

## Installation (US-3)

`secret-setup.exe` puts `secret` on PATH; registration is one command per
client. Claude Code, user scope (`~/.claude.json`):

```sh
claude mcp add --scope user secret-links -- secret mcp
```

## Tests

| Criterion | Test |
| --- | --- |
| AC-1.1, 1.2 | `create-sharing-service.test.ts` (`drop`), `create-api-request-handler.test.ts` (`/api/drops` → `/s/`) |
| AC-1.3, 1.4 | `create-api-request-handler.test.ts` (400s), `drop-limits.test.ts` |
| AC-1.5 | `create-api-request-handler.test.ts` (31st call → 429) |
| AC-1.6 | `create-api-request-handler.test.ts` (bearer ok, cross-site cookie 403) |
| AC-2.1, 2.3 | `mcp.integration.test.ts` (spawned `secret mcp` over stdio, link opened) |
| AC-2.2, 2.3, 2.4 | `create-mcp-server.test.ts` (in-memory transport) |
| AC-2.5, 2.6 | `run-command.test.ts` (`mcp` in session), `mcp.integration.test.ts` (no url) |
| AC-3.x | manual, recorded in the PR: `claude mcp list`, one real call |
