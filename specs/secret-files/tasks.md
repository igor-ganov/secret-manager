# Secret files — tasks

Each task: requirement(s) → verifying test(s). Tests are written first and
observed failing before the code that makes them pass.

- [x] T1 Failing unit tests: limits, content disposition, file sharing service,
      D1 file link store, API routes, link handler, `uploadInParts`.
      (AC-1.x, 2.x, 3.1)
- [x] T2 Failing E2E in `e2e/web.spec.ts` (*secret files*): quick start and
      workspace upload a multi-part file, the link downloads once under the
      original name, oversized files are refused, drag-and-drop works.
      (AC-2.1–2.3, 4.x, 8.1)
- [x] T3 `features/secret-files`: limits, ports, memory + D1 + R2 adapters,
      service, `uploadInParts`; `schema.sql`. (AC-1.x, 3.1)
- [x] T4 `http-api/file-routes.ts`, link handler file branch and JSON peek,
      `background` in `RequestHandler`; wire `create-local-app.ts` and
      `worker.ts` (R2 binding `FILES`, cron `scheduled`). (AC-1.x, 2.x, 3.1)
- [x] T5 R2 bucket `secret-manager-files` + lifecycle rule `expire-leftovers`;
      `wrangler.toml` binding and cron. (AC-3.2)
- [x] T6 Site: file picker, drag-and-drop, progress, actions and API client.
      (AC-4.x, 8.1)
- [x] T7 CLI: `share --file`, `fetch`, help; local file and link ports.
      (AC-5.x)
- [x] T8 MCP: `create_one_time_file_link`, `fetch_one_time_link`,
      instructions. (AC-6.x)
- [x] T9 Bot: documents up to 20 MB, larger ones explained. (AC-7.x)
- [x] T10 Docs: README, `documentation/user/{web,cli,mcp}.md`. Typecheck,
      lint, unit, build, E2E green; PR.
- [ ] T11 After merge: deploy (CI), tag a CLI release, verify a real file link
      in production.
