import { afterAll, describe, expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalApp } from '../features/app/create-local-app.ts';
import { isRecord } from '../features/http-api/guards/is-record.ts';
import { isString } from '../features/http-api/guards/is-string.ts';
import { createFakeCeremonies } from '../features/passkeys/create-fake-ceremonies.ts';
import { FETCH_TOOL_NAME, FILE_TOOL_NAME, TOOL_NAME } from './mcp/create-mcp-server.ts';

const urlOf = (structured: unknown): string => (isRecord(structured) && isString(structured['url']) ? structured['url'] : '');

/* `secret mcp` as a separate process behind the SDK's stdio client, against
   the real HTTP API over SQLite: the assistant's call ends as a link the
   person opens once (mcp AC-2.1, AC-2.3, AC-2.6). */
const app = createLocalApp(
  { botToken: '1:mcp', port: 0, baseUrl: 'http://127.0.0.1', databasePath: ':memory:', linkTtlMinutes: 5 },
  { ceremonies: createFakeCeremonies() },
);
const server = Bun.serve({ port: 0, fetch: (request) => app.handleRequest(request) });
afterAll(() => server.stop(true));

const configPath = join(await mkdtemp(join(tmpdir(), 'secret-mcp-')), 'config.json');
/* No baked-in server and no stored one: the url must come from the argument. */
const env = { ...process.env, SECRET_MANAGER_CONFIG: configPath, SECRET_MANAGER_URL: '' };

describe('secret mcp over stdio', () => {
  test('the tool call becomes a one-time link that opens once', async () => {
    const transport = new StdioClientTransport({ command: 'bun', args: ['run', 'src/cli/main.ts', 'mcp', server.url.origin], cwd: process.cwd(), env });
    const client = new Client({ name: 'integration', version: '0.0.0' });
    await client.connect(transport);
    try {
      const result = await client.callTool({ name: TOOL_NAME, arguments: { value: 'piped-credential', ttlMinutes: 7 } });
      expect(result.isError).toBeUndefined();
      const url = new URL(urlOf(result.structuredContent));
      expect(url.href).toMatch(/^http:\/\/127\.0\.0\.1\/s\/[0-9a-f]{64}$/);
      expect(result.structuredContent).toMatchObject({ ttlMinutes: 7, curl: `curl -X POST ${url.href}` });
      const opened = await fetch(`${server.url.origin}${url.pathname}`, { method: 'POST' });
      expect(await opened.text()).toBe('piped-credential\n');
      expect((await fetch(`${server.url.origin}${url.pathname}`, { method: 'POST' })).status).toBe(410);
    } finally {
      await client.close();
    }
  }, 20_000);

  test('without any server url it says so and exits 64', async () => {
    const proc = Bun.spawn(['bun', 'run', 'src/cli/main.ts', 'mcp'], { cwd: process.cwd(), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', env });
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    expect(stdout).toBe('');
    expect(stderr).toBe('A server URL is required: mcp <server-url>\n');
    expect(code).toBe(64);
  });
});

describe('secret files through secret mcp (secret-files US-6)', () => {
  test('a local file becomes a link, and fetch_one_time_link saves links to disk without returning their content', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'secret-mcp-files-'));
    const source = join(folder, 'id_ed25519');
    await Bun.write(source, 'private-key-material');
    const transport = new StdioClientTransport({ command: 'bun', args: ['run', 'src/cli/main.ts', 'mcp', server.url.origin], cwd: process.cwd(), env });
    const client = new Client({ name: 'integration', version: '0.0.0' });
    await client.connect(transport);
    const local = (url: string): string => url.replace('http://127.0.0.1', server.url.origin);
    try {
      const shared = await client.callTool({ name: FILE_TOOL_NAME, arguments: { path: source, ttlMinutes: 7 } });
      expect(shared.structuredContent).toMatchObject({ fileName: 'id_ed25519', sizeBytes: 20, ttlMinutes: 7 });
      const fileOut = join(folder, 'received');
      const fetched = await client.callTool({ name: FETCH_TOOL_NAME, arguments: { url: local(urlOf(shared.structuredContent)), outPath: fileOut } });
      expect(fetched.structuredContent).toEqual({ path: fileOut, kind: 'file', name: 'id_ed25519', sizeBytes: 20 });
      expect(await Bun.file(fileOut).text()).toBe('private-key-material');

      const text = await client.callTool({ name: TOOL_NAME, arguments: { value: 'hunter2', ttlMinutes: 1 } });
      const textOut = join(folder, 'pass.txt');
      const opened = await client.callTool({ name: FETCH_TOOL_NAME, arguments: { url: local(urlOf(text.structuredContent)), outPath: textOut } });
      expect(JSON.stringify(opened)).not.toContain('hunter2');
      expect(await Bun.file(textOut).text()).toBe('hunter2');
      const refused = await client.callTool({ name: FETCH_TOOL_NAME, arguments: { url: local(urlOf(text.structuredContent)), outPath: textOut } });
      expect(refused).toMatchObject({ isError: true });
    } finally {
      await client.close();
    }
  }, 20_000);
});
