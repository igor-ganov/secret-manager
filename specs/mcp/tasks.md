# MCP — tasks

- [x] T1 `sharing/drop-limits.ts` + `SharingService.drop` + tests. (AC-1.1, 1.3, 1.4)
- [x] T2 `http-api/drop-routes.ts`, mounted; request-level tests incl. 400/429/CSRF. (AC-1.1–1.6)
- [x] T3 `PublicClient.drop` (rename from `DeviceClient`) + fake-fetch test. (AC-2.3)
- [x] T4 `cli/mcp/create-mcp-server.ts` + in-memory transport test. (AC-2.2–2.4)
- [x] T5 `cli/mcp/serve-mcp.ts`, `run-mcp.ts`, `commands/mcp.ts`, `main.ts` dispatch; session test. (AC-2.1, 2.5, 2.6)
- [x] T6 Integration test: spawned `secret mcp` over stdio against the local API. (AC-2.1, 2.3)
- [x] T7 README (API row, MCP section), `documentation/user/mcp.md`, `cli.md` row. (AC-3.1)
- [ ] T8 Release `v0.5.0`, install, `claude mcp add`, verify a real link. (AC-3.2)
