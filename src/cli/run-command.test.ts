import { describe, expect, test } from 'bun:test';
import type { ApiClient, ApiCredentials, ApiResult, DeviceClient } from './api/api-client.ts';
import type { CommandContext } from './commands/command.ts';
import { NOT_LOGGED_IN } from './commands/require-client.ts';
import { TOKEN_REJECTED } from './commands/to-outcome.ts';
import type { CliConfig } from './config/cli-config.ts';
import type { ConsoleIo } from './io/console-io.ts';
import { runCommand } from './run-command.ts';
import { runSession } from './run-session.ts';

const LINK = { url: 'https://s/s/t', curl: 'curl -X POST https://s/s/t', ttlMinutes: 5 };
const LOGIN_URL = 'https://s/#link=code';

const ok = <T>(value: T): ApiResult<T> => ({ ok: true, value });
const unauthorized: ApiResult<never> = { ok: false, error: { kind: 'unauthorized' } };

type Harness = {
  readonly context: CommandContext;
  readonly out: string[];
  readonly err: string[];
  readonly hiddenPrompts: string[];
  readonly calls: string[];
  readonly configFile: { value: CliConfig };
};

type HarnessOptions = {
  readonly config?: CliConfig;
  /* How many polls answer "pending" before approval; -1 means denied. */
  readonly pollsBeforeApproval?: number;
};

const build = (answers: readonly string[], { config = { serverUrl: 'https://s', token: 't' }, pollsBeforeApproval = 0 }: HarnessOptions = {}): Harness => {
  const queue = [...answers];
  const out: string[] = [];
  const err: string[] = [];
  const hiddenPrompts: string[] = [];
  const calls: string[] = [];
  const configFile = { value: config };
  let polls = 0;
  const io: ConsoleIo = {
    interactive: true,
    print: (text) => out.push(text),
    printError: (text) => err.push(text),
    ask: async () => queue.shift(),
    askHidden: async (prompt) => {
      hiddenPrompts.push(prompt);
      return queue.shift();
    },
  };
  const fakeClient = (credentials: ApiCredentials): ApiClient => ({
    me: async () => (credentials.token === 'bad' ? unauthorized : ok({ id: 1, name: 'Ada' })),
    keys: async () => ok({ keys: ['a', 'b'] }),
    read: async (key) => ok({ value: `value-of-${key}` }),
    share: async (key, value) => {
      calls.push(`share:${key}:${value}`);
      return ok(LINK);
    },
    linkFor: async () => ok(LINK),
    remove: async (key) => {
      calls.push(`remove:${key}`);
      return ok(true);
    },
    settings: async () => ok({ linkTtlMinutes: 5, presets: [1, 5] }),
    saveSettings: async (minutes) => (minutes === 30 ? ok(true) : { ok: false, error: { kind: 'rejected', message: 'Bad ttl.' } }),
    devices: async () =>
      ok({ passkeys: [], telegram: { linked: false }, tokens: [{ id: 'x', label: 'cli', createdAt: 0, current: true }] }),
    revokeToken: async (id) => {
      calls.push(`revoke:${id}`);
      return ok(true);
    },
  });
  const fakeDeviceClient = (serverUrl: string): DeviceClient => ({
    start: async (label) => {
      calls.push(`start:${serverUrl}:${label}`);
      return ok({ url: LOGIN_URL, pollToken: 'poll', expiresAt: Date.now() + 60_000 });
    },
    poll: async (pollToken) => {
      calls.push(`poll:${pollToken}`);
      polls += 1;
      if (pollsBeforeApproval < 0) {
        return { ok: false, error: { kind: 'rejected', message: 'gone' } };
      }
      return polls > pollsBeforeApproval ? ok({ status: 'approved', token: 'fresh-token' }) : ok({ status: 'pending' });
    },
  });
  const context: CommandContext = {
    io,
    config: {
      path: '/tmp/config.json',
      read: async () => configFile.value,
      write: async (next) => {
        configFile.value = next;
      },
    },
    createClient: fakeClient,
    createDeviceClient: fakeDeviceClient,
    readStdin: async () => 'from-stdin\n',
    defaultServerUrl: 'https://default',
    deviceLabel: 'Console on box',
    sleep: async () => undefined,
  };
  return { context, out, err, hiddenPrompts, calls, configFile };
};

describe('runCommand', () => {
  test('share prompts hidden for the value when it is omitted (AC-1.3, AC-3.1)', async () => {
    const { context, out, hiddenPrompts, calls } = build(['typed-secret']);
    expect(await runCommand(context, ['share'])).toBe(0);
    expect(hiddenPrompts).toEqual(['Value: ']);
    expect(calls).toEqual(['share::typed-secret']);
    expect(out).toEqual([LINK.url, LINK.curl, 'Valid for 5 minutes, opens once.']);
  });

  test('set reads the value from stdin with "-" (AC-3.3)', async () => {
    const { context, calls } = build([]);
    expect(await runCommand(context, ['set', 'k', '-'])).toBe(0);
    expect(calls).toEqual(['share:k:from-stdin']);
  });

  test('get prints only the value (AC-3.4)', async () => {
    const { context, out } = build([]);
    expect(await runCommand(context, ['get', 'k'])).toBe(0);
    expect(out).toEqual(['value-of-k']);
  });

  test('list prints keys one per line', async () => {
    const { context, out } = build([]);
    await runCommand(context, ['list']);
    expect(out).toEqual(['a', 'b']);
  });

  test('rm asks for confirmation and honours -y', async () => {
    const { context, calls } = build(['n', 'y']);
    expect(await runCommand(context, ['rm', 'k'])).toBe(1);
    expect(await runCommand(context, ['rm', 'k'])).toBe(0);
    expect(await runCommand(context, ['rm', 'j', '-y'])).toBe(0);
    expect(calls).toEqual(['remove:k', 'remove:j']);
  });

  test('ttl shows and sets the lifetime; server rejections exit 1 (AC-3.2)', async () => {
    const { context, out, err } = build([]);
    expect(await runCommand(context, ['ttl'])).toBe(0);
    expect(out[0]).toBe('Links stay valid for 5 minutes.');
    expect(await runCommand(context, ['ttl', '30'])).toBe(0);
    expect(await runCommand(context, ['ttl', '7'])).toBe(1);
    expect(err).toEqual(['Bad ttl.']);
  });

  test('commands needing a token fail with code 2 when not logged in (AC-2.5)', async () => {
    const { context, err } = build([], { config: {} });
    expect(await runCommand(context, ['list'])).toBe(2);
    expect(err).toEqual([NOT_LOGGED_IN]);
  });

  test('a rejected token fails with code 2 (AC-2.6)', async () => {
    const { context, err } = build([], { config: { serverUrl: 'https://s', token: 'bad' } });
    expect(await runCommand(context, ['whoami'])).toBe(2);
    expect(err).toEqual([TOKEN_REJECTED]);
  });

  test('unknown commands exit 64 (AC-3.5)', async () => {
    const { context } = build([]);
    expect(await runCommand(context, ['bogus'])).toBe(64);
    expect(await runCommand(context, [])).toBe(64);
  });

  test('login prints the approval link, polls until approved and stores the token (device-login AC-2.1, AC-2.2)', async () => {
    const { context, out, calls, configFile } = build([''], { config: {}, pollsBeforeApproval: 2 });
    expect(await runCommand(context, ['login'])).toBe(0);
    expect(calls).toEqual(['start:https://default:Console on box', 'poll:poll', 'poll:poll', 'poll:poll']);
    expect(out[1]).toBe(LOGIN_URL);
    expect(configFile.value).toEqual({ serverUrl: 'https://default', token: 'fresh-token' });
    expect(out.at(-1)).toContain('Logged in as Ada (1)');
  });

  test('login exits 2 when the request is denied or expires (AC-2.3)', async () => {
    const { context, configFile, err } = build(['https://srv'], { config: {}, pollsBeforeApproval: -1 });
    expect(await runCommand(context, ['login'])).toBe(2);
    expect(configFile.value).toEqual({});
    expect(err[0]).toContain('expired or was denied');
  });

  test('logout revokes the current token and drops it from the config (AC-2.3)', async () => {
    const { context, calls, configFile } = build([]);
    expect(await runCommand(context, ['logout'])).toBe(0);
    expect(calls).toEqual(['revoke:x']);
    expect(configFile.value).toEqual({ serverUrl: 'https://s' });
  });
});

describe('runSession (AC-1.1, AC-1.2)', () => {
  test('runs commands line by line until exit, surviving errors', async () => {
    const { context, out, err } = build(['list', 'bogus', 'set k "two words"', 'exit', 'list']);
    expect(await runSession(context)).toBe(0);
    expect(out).toEqual(['Interactive session. Type help for commands, exit to leave.', 'a', 'b', 'Saved “k”.', LINK.url, LINK.curl, 'Valid for 5 minutes, opens once.']);
    expect(err).toEqual(['Unknown command. Run: help']);
  });

  test('ends quietly at end of input', async () => {
    const { context } = build(['whoami']);
    expect(await runSession(context)).toBe(0);
  });
});
