import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalApp } from '../features/app/create-local-app.ts';
import { createFakeCeremonies } from '../features/passkeys/create-fake-ceremonies.ts';

/* The CLI as a separate process, driven through a pipe, against the real
   HTTP API over SQLite: the device-login handshake end to end, then the
   non-TTY session (device-login AC-2.x, cli AC-1.4). */
const app = createLocalApp(
  { botToken: '1:integration', port: 0, baseUrl: 'http://127.0.0.1', databasePath: ':memory:', linkTtlMinutes: 5 },
  { ceremonies: createFakeCeremonies() },
);
const server = Bun.serve({ port: 0, fetch: app.handleRequest });
afterAll(() => server.stop(true));

const ACCOUNT = 2 ** 40 + 9;
await app.accounts.create({ id: ACCOUNT, name: 'Integration User', userHandle: 'h', recoveryHash: 'r', createdAt: 0 });
const { token: ownerToken } = await app.tokens.create(ACCOUNT, 'web');
const configDir = await mkdtemp(join(tmpdir(), 'secret-cli-'));
const configPath = join(configDir, 'config.json');

const run = (args: readonly string[], input: string) => {
  const proc = Bun.spawn(['bun', 'run', 'src/cli/main.ts', ...args], {
    cwd: process.cwd(),
    stdin: new TextEncoder().encode(input),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, SECRET_MANAGER_CONFIG: configPath },
  });
  const finished = Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]).then(
    ([stdout, stderr, code]) => ({ stdout, stderr, code }),
  );
  return { proc, finished };
};

/* Plays the account owner: waits for the CLI to print its link, then
   approves the request through the API as a signed-in browser would. */
const approveWhenPrinted = async (stdoutChunks: () => string): Promise<void> => {
  for (;;) {
    const match = /#link=([A-Za-z0-9_-]+)/.exec(stdoutChunks());
    if (match?.[1] !== undefined) {
      const approve = await fetch(`${server.url.origin}/api/device/${match[1]}/approve`, {
        method: 'POST',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(approve.status).toBe(204);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

describe('secret CLI over a pipe', () => {
  test('login links the device through the site and the session then works', async () => {
    const proc = Bun.spawn(['bun', 'run', 'src/cli/main.ts'], {
      cwd: process.cwd(),
      stdin: new TextEncoder().encode(`login\n${server.url.origin}\nwhoami\nset api-key\npiped-secret\nlist\nget api-key\nexit\n`),
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, SECRET_MANAGER_CONFIG: configPath },
    });
    let collected = '';
    const reading = (async () => {
      for await (const chunk of proc.stdout) {
        collected += new TextDecoder().decode(chunk);
      }
    })();
    await approveWhenPrinted(() => collected);
    await reading;
    const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    expect(stderr).toBe('');
    expect(code).toBe(0);
    const lines = collected.trim().split('\n');
    expect(lines[0]).toBe('Open this link, sign in with your passkey and approve this device:');
    expect(lines[3]).toMatch(/^Logged in as Integration User/);
    expect(lines[4]).toBe(`Integration User (${ACCOUNT})`);
    expect(lines[5]).toBe('Saved “api-key”.');
    expect(lines[6]).toMatch(/^http:\/\/127\.0\.0\.1\/s\/[0-9a-f]{64}$/);
    expect(lines[9]).toBe('api-key');
    expect(lines[10]).toBe('piped-secret');
  }, 20_000);

  test('argument mode prints a raw value and exits with the command code', async () => {
    expect(await run(['get', 'api-key'], '').finished).toMatchObject({ stdout: 'piped-secret\n', code: 0 });
    expect(await run(['get', 'missing'], '').finished).toMatchObject({ stderr: 'No such key.\n', code: 1 });
    expect((await run(['nope'], '').finished).code).toBe(64);
  });
});
