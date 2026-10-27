# Secret files — design

Satisfies [requirements](./requirements.md). Section headings reference the
acceptance criteria they implement.

## 1. Layering (AC-8.3)

```
src/features/secret-files/
  file-limits.ts              100 MiB, 8 MiB parts, name / size / content-type rules
  file-object-store.ts        port: blob storage with multipart upload
  create-memory-file-object-store.ts   adapter: Map (local server, tests)
  create-r2-file-object-store.ts       adapter: Cloudflare R2 (binding FILES)
  file-link-store.ts          port: upload sessions + one-time file links
  create-file-link-store.ts            adapter: memory (local, like one-time links)
  create-d1-file-link-store.ts         adapter: D1
  create-file-sharing-service.ts       application service (begin, part, complete,
                                       abort, peek, open, sweep, shareBytes)
  upload-in-parts.ts          client algorithm shared by CLI, MCP and site
  content-disposition.ts      attachment header with RFC 5987 filename*
src/features/http-api/file-routes.ts   /api/files, /api/file-drops, /api/uploads/…
src/features/one-time-links/…          /s/<token> learns the file branch
```

The text path (`OneTimeLinkStore`, `SharingService`) is untouched: a file link
is a second kind of one-time link with its own store, so text links keep their
code, table and tests (AC-2.5).

## 2. Storage: R2 + D1 (AC-1.x, AC-3.x)

Blobs live in R2 (`secret-manager-files`, binding `FILES`); metadata in D1:

```sql
CREATE TABLE IF NOT EXISTS file_uploads (
  upload_id TEXT PRIMARY KEY,      -- 256-bit capability handed to the client
  object_key TEXT NOT NULL,        -- random, never derived from the name
  multipart_id TEXT NOT NULL,      -- R2's own upload id
  file_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  ttl_minutes INTEGER NOT NULL,    -- lifetime of the link once completed
  expires_at INTEGER NOT NULL      -- session deadline (now + 1 hour)
);
CREATE TABLE IF NOT EXISTS file_upload_parts (
  upload_id TEXT NOT NULL,
  part_number INTEGER NOT NULL,
  etag TEXT NOT NULL,
  PRIMARY KEY (upload_id, part_number)
);
CREATE TABLE IF NOT EXISTS one_time_files (
  token TEXT PRIMARY KEY,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
```

Parts get their own table so parallel `PUT`s never race on one row
(`INSERT OR REPLACE` per part). Completion removes the session with
`DELETE … RETURNING`, so a session completes at most once even if two
`complete` calls race.

Rejected: keeping the file bytes in D1 — rows are capped at 2 MB. Rejected: a
presigned R2 URL handed to the client — it needs R2 API credentials as Worker
secrets and a CORS policy on the bucket; parts through the Worker need nothing
but the binding.

## 3. Chunked upload (AC-1.1–1.9)

A Worker request body is capped at 100 MB on the Free/Pro plans, and R2
multipart parts must be at least 5 MiB (except the last) and **all the same
size** except the last. Hence a fixed `partSize` of 8 MiB, chosen by the
server, and an exact length check per part:

```
expected(n) = n < partCount ? partSize : size − (partCount − 1) · partSize
```

| Method | Path                               | Auth            | AC       |
| ------ | ---------------------------------- | --------------- | -------- |
| POST   | /api/files                         | user            | 1.1      |
| POST   | /api/file-drops                    | none, limited   | 1.2      |
| PUT    | /api/uploads/:uploadId/parts/:n    | upload id       | 1.5      |
| POST   | /api/uploads/:uploadId/complete    | upload id       | 1.6      |
| DELETE | /api/uploads/:uploadId             | upload id       | 1.7      |

Parts are `application/octet-stream`; the route reads at most `partSize`
bytes (`content-length` above it is refused before reading). The part,
complete and abort routes are `auth: 'none'` with the cookie CSRF gate of
http-api AC-2.3: the upload id is the credential (AC-1.9) and a cross-site
page cannot learn it. They are not rate-limited — one 100 MiB file is 13 parts
and the limiter counts 30 per minute — the session itself (one hour, fixed
size) bounds them. On any failure while assembling, the service aborts the R2
upload and forgets the session.

## 4. Download (AC-2.1–2.5)

`createLinkRequestHandler({ links, files })` keeps the text branch first and
falls back to files:

- `GET` → text confirm page, else file confirm page (name, size, **Download
  file** form posting to the same url), else 410. `Accept: application/json`
  answers `{ kind, name?, size? }` instead (AC-2.4) — the CLI and MCP use it to
  decide where the content goes before burning the link.
- `POST` → consume text, else `claim` the file row
  (`DELETE … WHERE token = ? AND expires_at > ? RETURNING …`, atomic), open the
  R2 object and stream it through an identity `TransformStream`; the
  `pipeTo(…)` promise, followed by deleting the object, is handed to
  `background` — the Worker's `ctx.waitUntil` — so the object disappears once
  the stream ends or the client cancels (AC-2.3).

The response is always `application/octet-stream` with `x-content-type-options:
nosniff`, whatever type the uploader claimed, so a hostile upload can never be
rendered by the browser; the claimed type is stored for display only.
`Content-Disposition: attachment; filename="<ascii fallback>";
filename*=UTF-8''<percent-encoded>` (RFC 6266 / RFC 5987). The `curl` snippet of
a file link is `curl -X POST -OJ <url>` (`-J` honours the header).

`RequestHandler` gains an optional second argument, `background: (work) =>
void`; the Worker passes `ctx.waitUntil`, Bun passes a function that only logs
failures.

## 5. Expiry (AC-3.1, AC-3.2)

`wrangler.toml` `[triggers] crons = ["*/15 * * * *"]`; the Worker's
`scheduled` handler calls `fileSharing.sweep()`: delete expired `one_time_files`
rows `RETURNING object_key` → delete those objects; delete expired
`file_uploads` `RETURNING` → abort their multipart uploads and drop their
parts. The bucket has a lifecycle rule `expire-leftovers` (objects after 2
days, incomplete multipart uploads after 1 day) for anything a crashed
isolate leaves behind. The memory adapters sweep on every call.

## 6. Clients

`uploadInParts(transport, readRange, size, onProgress)` is the one upload
algorithm: begin → parts in order (each retried up to three times) → complete;
on any failure it calls `abort` and returns the failure as a `Result`.

- **Site** (AC-4.x): `AppState.quickFile` / `shareFile` hold the chosen `File`
  (a file input cannot be re-filled after the full re-render, so the state is
  the source of truth and the input only picks); `Notice.upload` renders a
  `<progress>` with a text percentage inside the existing `role="status"`
  region. Drag-and-drop is a `drop` listener on the form. `ApiClient` gains
  `beginFile`, `dropFile`, `putPart` (raw bytes through a second requester),
  `completeUpload`, `abortUpload`.
- **CLI** (AC-5.x): `CommandContext.files` (stat / read range / write stream /
  exists) and `CommandContext.links` (peek / open an absolute link url) are
  ports implemented in `main.ts` with Bun. `fetch` peeks first, so refusing
  a text value on a terminal never burns the link (AC-5.3).
- **MCP** (AC-6.x): the two new tools reuse the CLI helpers `uploadLocalFile`
  and `saveLink`; results carry metadata only (AC-8.2).
- **Bot** (AC-7.x): `message:document` → size check against 20 MB →
  `ctx.getFile()` → download through an injected `downloadFile(filePath)` →
  `fileSharing.shareBytes(owner, name, type, bytes)` (a single `put`, no
  multipart) → link message with the `-OJ` snippet.

## 7. Tests (traceability)

- `file-limits.test.ts`, `content-disposition.test.ts` — AC-1.3, 1.4, 2.2.
- `create-file-sharing-service.test.ts` (memory adapters) — AC-1.1–1.8, 2.2,
  2.3, 3.1.
- `create-d1-file-link-store.test.ts` (D1 adapter over `bun:sqlite` with
  `schema.sql`) — AC-1.8, 2.2, 3.1.
- `create-api-request-handler.test.ts` (files section) — AC-1.1–1.9, 2.x.
- `create-link-request-handler.test.ts` (files section) — AC-2.1–2.5.
- `upload-in-parts.test.ts` — AC-1.5, 1.6, 4.4.
- CLI: `run-command.test.ts` (share --file, fetch) and
  `cli.integration.test.ts` — AC-5.x; MCP: `create-mcp-server.test.ts` and
  `mcp.integration.test.ts` — AC-6.x; bot: `create-bot.test.ts` — AC-7.x.
- Site: `view.test.ts`, `drop-file.test.ts`, and Playwright `e2e/web.spec.ts`
  (*secret files*) — AC-4.x, 8.1.

## 8. Decisions taken during implementation

- **Link shape.** The brief named `{ url, curl, expiresAt }`; every existing
  link route answers `{ url, curl, ttlMinutes }` (http-api AC-4.1) and every
  client decodes that, so file links use it too. The MCP tool adds `expiresAt`
  as `create_one_time_link` already does.
- **Picker placement.** The file picker sits after the submit button ("or
  attach a file"), so the keyboard order of the text flow (Secret → lifetime →
  submit, web-quick-start AC-3.1) is unchanged; once a file is chosen, focus
  moves to **Remove file**.
- **Bot limit.** 20 MB is taken as 20 000 000 bytes, the conservative reading
  of the Bot API's "up to 20 MB".
- **Writing downloads in the utility.** `Bun.write(path, new Response(stream))`
  never settles for a multi-megabyte network stream in Bun 1.3.14; downloads
  are written chunk by chunk through a `FileSink` instead.
- **Rate limit.** `/api/file-drops` has its own 30-per-minute bucket per
  address (the limiter keys on the route), not a share of `/api/drops`'.
