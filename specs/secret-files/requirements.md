# Secret files — requirements

## Overview

One-time links carry text today: a password, a token, a key. People also need
to hand over **files**: a certificate bundle, a `.env`, a key store, a database
dump. This spec lets every part of the product — the HTTP API, the web site,
the console utility, its MCP server and the Telegram bot — send a file of up to
**100 MiB** (104 857 600 bytes) through the same kind of one-time link and
receive one back.

A file link behaves like a text link: it opens exactly once, lives the chosen
number of minutes, a `GET` only shows a confirmation page (link previews cannot
burn it), and the server keeps nothing once it is opened or expired.

Builds on [http-api](../http-api/requirements.md) (routes, auth, CSRF gate),
[mcp](../mcp/requirements.md) (anonymous drops, rate limiting, the MCP server),
[web-quick-start](../web-quick-start/requirements.md) and
[cli](../cli/requirements.md).

## User stories

### US-1 Upload a file in parts

As a client (site, utility, MCP server, script), I want to upload a file in
parts, so that a file larger than one request body still becomes one link.

- AC-1.1 WHEN a signed-in client POSTs `/api/files` with `{ name, size,
  contentType? }`, THE SYSTEM SHALL open an upload session whose link will
  honour the account's link lifetime and respond `201 { uploadId, partSize,
  partCount, expiresAt }` with `partSize` = 8 MiB (8 388 608 bytes).
- AC-1.2 WHEN any client POSTs `/api/file-drops` with `{ name, size,
  contentType?, ttlMinutes }` and no credentials, THE SYSTEM SHALL open an
  upload session as in AC-1.1 whose link lives `ttlMinutes` minutes; the route
  SHALL be rate-limited per client address like `/api/drops` (mcp AC-1.5) and
  SHALL keep the drop lifetime bounds (1–1440 minutes, mcp AC-1.4).
- AC-1.3 IF `size` is not a whole number between 1 and 104 857 600, THEN THE
  SYSTEM SHALL respond `400 { error }` naming the 100 MiB limit.
- AC-1.4 IF `name` is empty, longer than 255 bytes, or contains a path
  separator or a control character, THEN THE SYSTEM SHALL respond `400 { error }`.
- AC-1.5 WHEN a client PUTs part `n` (1-based) of a live session to
  `/api/uploads/:uploadId/parts/:n` with the raw bytes, THE SYSTEM SHALL store
  it and respond `204`; every part except the last SHALL be exactly `partSize`
  bytes and the last SHALL hold the remainder, otherwise `400 { error }`.
- AC-1.6 WHEN a client POSTs `/api/uploads/:uploadId/complete` after every part
  has been stored, THE SYSTEM SHALL assemble the file, issue the one-time link
  and respond `201 { url, curl, ttlMinutes }` — the shape of every other link
  (http-api AC-4.1) — where `curl` downloads the file under its own name; a
  session with missing parts SHALL respond `400 { error }`.
- AC-1.7 WHEN a client DELETEs `/api/uploads/:uploadId`, THE SYSTEM SHALL
  abort the session and discard its parts (`204`).
- AC-1.8 IF the upload id is unknown, completed, aborted or older than one
  hour, THEN THE SYSTEM SHALL respond `404 { error }` to every upload route.
- AC-1.9 The upload id SHALL be a 256-bit random value; it is the only
  credential the part, complete and abort routes need, so a session opened by
  an account can be finished by the same client without re-sending its token.

### US-2 Open a file link once

As the recipient, I want a file link to download the file exactly once, so
that the file cannot be fetched again by anybody.

- AC-2.1 WHEN a browser GETs `/s/<token>` of a live file link, THE SYSTEM
  SHALL show a page with the file name, its size and a **Download file**
  button that POSTs to the same url, without consuming the link.
- AC-2.2 WHEN anybody POSTs `/s/<token>` of a live file link, THE SYSTEM SHALL
  claim the link atomically (one open only, also under concurrent requests),
  then respond `200` with the file as `application/octet-stream` and
  `Content-Disposition: attachment` carrying the original name (an ASCII
  `filename` and an RFC 5987 `filename*`), so `curl -X POST -OJ <url>` saves
  it under its own name.
- AC-2.3 WHEN the response has been streamed (or the client went away), THE
  SYSTEM SHALL delete the stored file.
- AC-2.4 WHEN a client GETs `/s/<token>` with `Accept: application/json`, THE
  SYSTEM SHALL answer `{ kind: 'text' }` or `{ kind: 'file', name, size }`
  without consuming the link, and `410` for a dead one, so programs can decide
  how to receive a link before opening it.
- AC-2.5 A consumed, expired or unknown file link SHALL respond `410` like a
  text link; text links keep working unchanged.

### US-3 Expiry

- AC-3.1 THE SYSTEM SHALL delete expired file links and their stored files and
  abort upload sessions older than one hour at least every 15 minutes.
- AC-3.2 Storage SHALL carry its own backstop: objects older than two days are
  deleted and incomplete multipart uploads older than one day are aborted.

### US-4 Web site

As a visitor or a signed-in user, I want to pick or drop a file where I paste
a secret, so that I get a link to a file the same way I get one to text.

- AC-4.1 The quick start and the signed-in **Share a secret** form SHALL offer
  a **File** picker and accept a file dropped onto the form; a chosen file is
  shown with its name and size and a **Remove file** control, and replaces the
  text field until removed.
- AC-4.2 IF the chosen file is larger than 100 MiB or empty, THEN THE SYSTEM
  SHALL refuse it before any request and show the reason as an alert.
- AC-4.3 WHEN the form is submitted with a file, THE SYSTEM SHALL upload it in
  parts (quick start: anonymous drop with the chosen lifetime; signed in: the
  account's lifetime), show an accessible progress indicator in the status
  region, and then show the link exactly like a text link (web-app AC-2.2).
- AC-4.4 IF the upload fails, THEN THE SYSTEM SHALL abort the session, show the
  error as an alert and keep the file chosen.

### US-5 Console utility

- AC-5.1 WHEN `secret share --file <path>` runs, THE SYSTEM SHALL upload the
  file under the account's link lifetime, report progress on stderr and print
  the link lines as `share` does; `share [value|-]` is unchanged.
- AC-5.2 WHEN `secret fetch <link> [-o <path>]` runs, THE SYSTEM SHALL open the
  link: a file is saved to `-o <path>` or, without it, under its original name
  in the current folder (never overwriting an existing file: a free name such
  as `name (1).ext` is chosen); a text value is written to `-o <path>`, or
  printed only when standard output is not a terminal.
- AC-5.3 IF `fetch` would print a text value to a terminal, THEN THE SYSTEM
  SHALL refuse before opening the link (it stays valid) and exit 64.
- AC-5.4 `fetch` SHALL need no login; `help` SHALL list `share --file` and
  `fetch`; a dead link exits 1 with the server's message.
- AC-5.5 IF the file is missing, empty or larger than 100 MiB, THEN THE SYSTEM
  SHALL refuse before any request and exit 64.

### US-6 MCP server

- AC-6.1 THE SYSTEM SHALL expose a tool `create_one_time_file_link { path,
  ttlMinutes }` that uploads the local file as an anonymous drop and returns
  the link as text and as `{ url, curl, ttlMinutes, expiresAt, fileName,
  sizeBytes }`.
- AC-6.2 THE SYSTEM SHALL expose a tool `fetch_one_time_link { url, outPath }`
  that opens a text or file link into the local file `outPath` (never
  overwriting an existing one) and returns only `{ path, kind, name,
  sizeBytes }` — never the content.
- AC-6.3 The server instructions SHALL tell the assistant to use these tools
  for files and never to read a fetched secret back into the conversation
  unless the person asks.

### US-7 Telegram bot

- AC-7.1 WHEN a linked user sends the bot a document of at most 20 MB (the Bot
  API download limit), THE SYSTEM SHALL download it, reply with a one-time
  file link under the account's lifetime and delete the incoming message.
- AC-7.2 IF the document is larger than 20 MB, THEN THE SYSTEM SHALL reply
  that the bot can only take files up to 20 MB and point to the site and the
  console utility (up to 100 MiB).

### US-8 Quality

- AC-8.1 The file picker, drop area, progress indicator and results are
  operable with the keyboard alone and announced through `role="status"` /
  `role="alert"`.
- AC-8.2 File contents never appear in logs, URLs, or (MCP) tool results.
- AC-8.3 Everything above SHALL behave the same on the Cloudflare Worker (D1 +
  R2) and on the local Bun server (in-memory stores), so tests need no cloud.
