import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalApp } from '../features/app/create-local-app.ts';

/* The CLI as a separate process, driven through a pipe, against the real
   HTTP API over SQLite: proves the non-TTY path end to end (AC-1.4). */
const app = createLocalApp({
  botToken: '1:integration',
  port: 0,
  baseUrl: 'http://127.0.0.1',
  databasePath: ':memory:',
  linkTtlMinutes: 5,
});
const server = Bun.serve({ port: 0, fetch: app.handleRequest });
afterAll(() => server.stop(true));

const { token } = await app.tokens.create(9, 'cli');
await app.users.saveName(9, 'Integration User');
const configDir = await mkdtemp(join(tmpdir(), 'secret-cli-'));
const configPath = join(configDir, 'config.json');
await writeFile(configPath, JSON.stringify({ serverUrl: server.url.origin, token }));

const run = async (args: readonly string[], input: string) => {
  const proc = Bun.spawn(['bun', 'run', 'src/cli/main.ts', ...args], {
    cwd: process.cwd(),
    stdin: new TextEncoder().encode(input),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, SECRET_MANAGER_CONFIG: configPath },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
};

describe('secret CLI over a pipe', () => {
  test('interactive session reads commands and hidden values as plain lines', async () => {
    const { stdout, stderr, code } = await run([], 'whoami\nset api-key\npiped-secret\nlist\nget api-key\nexit\n');
    expect(code).toBe(0);
    expect(stderr).toBe('');
    const lines = stdout.trim().split('\n');
    expect(lines[0]).toBe('Integration User (9)');
    expect(lines[1]).toBe('Saved “api-key”.');
    expect(lines[2]).toMatch(/^http:\/\/127\.0\.0\.1\/s\/[0-9a-f]{64}$/);
    expect(lines[3]).toMatch(/^curl -X POST /);
    expect(lines[4]).toBe('Valid for 5 minutes, opens once.');
    expect(lines[5]).toBe('api-key');
    expect(lines[6]).toBe('piped-secret');
  });

  test('argument mode prints a raw value and exits with the command code', async () => {
    expect(await run(['get', 'api-key'], '')).toMatchObject({ stdout: 'piped-secret\n', code: 0 });
    expect(await run(['get', 'missing'], '')).toMatchObject({ stderr: 'No such key.\n', code: 1 });
    expect((await run(['nope'], '')).code).toBe(64);
  });
});
