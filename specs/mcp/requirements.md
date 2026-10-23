# MCP — requirements

## Overview

An AI assistant (Claude Code, any MCP client) regularly ends up holding a
credential it has to hand to a person: a generated password, a freshly minted
token, a connection string. Writing it into the chat leaves it in transcripts,
logs and context windows. This spec lets the assistant hand it over through a
**one-time link** instead: the assistant calls one tool with the value and a
lifetime, posts the link, and the person opens it once.

For now the assistant acts **without an account**: the link is a *drop* — an
anonymous one-time link with its own lifetime, saved nowhere, exactly like the
bot's unsaved `value` message but without a user behind it. Binding drops to an
account (so they show up in the site and honour its settings) is a later spec.

Depends on [http-api](../http-api/requirements.md) (transport, rate limiting)
and [cli](../cli/requirements.md) (the `secret` executable hosts the server).

## User stories

### US-1 Anonymous drop over HTTP

As an MCP server (or any script), I want to turn a value into a one-time link
without logging in, so that an assistant can hand over a credential from any
machine with the executable alone.

- AC-1.1 WHEN a client POSTs `/api/drops` with `{ value, ttlMinutes }` and no
  credentials, THE SYSTEM SHALL issue a one-time link that lives `ttlMinutes`
  minutes and respond `201 { url, curl, ttlMinutes }` (the shape of
  http-api AC-4.1) without saving anything else.
- AC-1.2 WHEN the link is opened (`POST /s/<token>`), THE SYSTEM SHALL serve
  the value exactly once, as for every other one-time link.
- AC-1.3 IF `value` is missing, empty, or longer than 16 384 bytes, THEN THE
  SYSTEM SHALL respond `400 { error }`.
- AC-1.4 IF `ttlMinutes` is missing, not an integer, below 1 or above 1440,
  THEN THE SYSTEM SHALL respond `400 { error }`.
- AC-1.5 THE SYSTEM SHALL rate-limit `/api/drops` per client address like the
  ceremony endpoints (http-api), answering `429` past the limit.
- AC-1.6 THE SYSTEM SHALL accept a drop over a bearer token or a same-origin
  session too (the route is public, not forbidden to signed-in callers), and
  SHALL apply the cookie CSRF gate of http-api AC-2.3 to cookie-borne calls.

### US-2 MCP server in the executable

As a person using an AI assistant, I want `secret mcp` to be an MCP server over
stdio, so that the assistant I already run can hand me credentials through links.

- AC-2.1 WHEN `secret mcp [server-url]` runs, THE SYSTEM SHALL speak the Model
  Context Protocol over stdin/stdout (nothing else is written to stdout) until
  the client closes the connection, using the given url, else the built-in /
  `SECRET_MANAGER_URL` server, else the url stored by `login`.
- AC-2.2 THE SYSTEM SHALL expose one tool, `create_one_time_link`, taking
  `value` (string, 1–16 384 bytes) and `ttlMinutes` (integer 1–1440), and its
  description SHALL tell the assistant to answer with the link and never with
  the value.
- AC-2.3 WHEN the tool is called with valid arguments, THE SYSTEM SHALL POST
  `/api/drops`, and return the link as text (`url`, `curl`, "Valid for N
  minutes, opens once.") and as structured content `{ url, curl, ttlMinutes,
  expiresAt }`.
- AC-2.4 IF the server rejects the drop or cannot be reached, THEN THE SYSTEM
  SHALL return a tool error (`isError: true`) carrying the server's message, so
  the assistant can tell the person instead of inventing a link.
- AC-2.5 `mcp` SHALL need no login; `secret help` SHALL list it; typed inside
  the interactive session it SHALL explain that it runs in argument mode (exit 64).
- AC-2.6 IF no server url can be resolved, THEN `secret mcp` SHALL print
  `A server URL is required: mcp <server-url>` to stderr and exit 64.

### US-3 Installation

As the person, I want the server registered once, so that every session of the
assistant has the tool.

- AC-3.1 `documentation/user/mcp.md` SHALL give the one-line registration for
  Claude Code (`claude mcp add --scope user secret-links -- secret mcp`) and the
  equivalent JSON for other clients, and SHALL state that the installer
  (`secret-setup.exe`) is all that has to be on the machine.
- AC-3.2 WHEN the release is installed and registered, `claude mcp list` SHALL
  show `secret-links` as connected and a tool call SHALL yield a working link.
