import { describe, expect, test } from 'bun:test';
import type { Transformer } from 'grammy';
import type { Update, UserFromGetMe } from 'grammy/types';
import { createBot } from './create-bot.ts';
import type { PendingSetStore } from './pending-set-store.ts';
import type { TelegramLinkStore } from '../device-login/telegram-link-store.ts';
import type { OneTimeLinkStore } from '../one-time-links/one-time-link-store.ts';
import type { SecretStore } from '../secrets/secret-store.ts';
import type { SettingsStore } from '../settings/settings-store.ts';
import { createSharingService } from '../sharing/create-sharing-service.ts';

const BOT_INFO: UserFromGetMe = {
  id: 1,
  is_bot: true,
  first_name: 'Secret',
  username: 'secret_manager_bot',
  can_join_groups: false,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  can_manage_bots: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
};

const USER_ID = 100;
const ACCOUNT = 2 ** 40 + 1;
const LOGIN_URL = 'https://site.test/#link=code';
const ENROLL_URL = 'https://site.test/#enroll=code';

type ApiCall = { readonly method: string; readonly payload: Record<string, unknown> };

const createFakes = (linked: boolean) => {
  let pendingKey: string | undefined;
  const settingsByUser = new Map<number, number>();
  const issuedTtlsMs: number[] = [];
  const saved: string[] = [];
  const links = new Map<number, number>(linked ? [[USER_ID, ACCOUNT]] : []);
  const loginRequests: string[] = [];
  const sharedFiles: string[] = [];
  const downloads: string[] = [];
  const secrets: SecretStore = {
    save: async (userId, key) => {
      saved.push(`${userId}:${key}`);
    },
    read: async () => 'stored-value',
    list: async () => [],
    remove: async () => undefined,
    reassign: async () => undefined,
  };
  const oneTimeLinks: OneTimeLinkStore = {
    issue: async (_value, ttlMs) => {
      issuedTtlsMs.push(ttlMs ?? -1);
      return 'token-123';
    },
    peek: async () => true,
    consume: async () => undefined,
  };
  const settings: SettingsStore = {
    getTtlMinutes: async (userId) => settingsByUser.get(userId),
    setTtlMinutes: async (userId, minutes) => {
      settingsByUser.set(userId, minutes);
    },
    reassign: async () => undefined,
  };
  const pendingSets: PendingSetStore = {
    begin: async (_userId, key) => {
      pendingKey = key;
    },
    take: async () => {
      const key = pendingKey;
      pendingKey = undefined;
      return key;
    },
    cancel: async () => {
      pendingKey = undefined;
    },
  };
  const telegramLinks: TelegramLinkStore = {
    accountFor: async (id) => links.get(id),
    telegramUserFor: async () => undefined,
    link: async (id, account) => {
      links.set(id, account);
    },
    unlink: async (id) => {
      links.delete(id);
    },
  };
  return {
    secrets,
    oneTimeLinks,
    pendingSets,
    settings,
    telegramLinks,
    issuedTtlsMs,
    settingsByUser,
    saved,
    links,
    loginRequests,
    sharedFiles,
    downloads,
    primePending: (key: string) => (pendingKey = key),
  };
};

const buildBot = (linked = true) => {
  const fakes = createFakes(linked);
  const bot = createBot({
    token: '12345:TEST',
    sharing: createSharingService({
      secrets: fakes.secrets,
      links: fakes.oneTimeLinks,
      settings: fakes.settings,
      buildLinkUrl: (token) => `https://example.test/s/${token}`,
      linkTtlMinutes: 5,
    }),
    pendingSets: fakes.pendingSets,
    linkTtlMinutes: 5,
    telegramLinks: fakes.telegramLinks,
    deviceLogin: {
      start: async ({ kind, label, subject }) => {
        fakes.loginRequests.push(`${kind}:${label}:${subject}`);
        return { url: LOGIN_URL, deviceSecret: 'p', expiresAt: 0 };
      },
    },
    enrollmentIssuer: async () => ({ url: ENROLL_URL, qr: '', expiresAt: 0 }),
    files: {
      shareBytes: async (userId, { name, contentType }, bytes) => {
        fakes.sharedFiles.push(`${String(userId)}:${name}:${contentType}:${new TextDecoder().decode(bytes)}`);
        return { ok: true, value: { url: 'https://example.test/s/file-token', ttlMinutes: 5 } };
      },
    },
    downloadFile: async (filePath) => {
      fakes.downloads.push(filePath);
      return new TextEncoder().encode('file-content');
    },
    botInfo: BOT_INFO,
  });

  const calls: ApiCall[] = [];
  const record: Transformer = (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    const result = method === 'getFile' ? { file_id: 'doc-1', file_unique_id: 'u-1', file_path: 'documents/file_1.pem' } : true;
    return Promise.resolve({ ok: true, result: result as never });
  };
  bot.api.config.use(record);

  return { bot, calls, fakes };
};

const textUpdate = (text: string, messageId = 42): Update => ({
  update_id: 1,
  message: {
    message_id: messageId,
    date: 0,
    chat: { id: USER_ID, type: 'private', first_name: 'U' },
    from: { id: USER_ID, is_bot: false, first_name: 'U', username: 'ada' },
    text,
  },
});

const deleteCalls = (calls: readonly ApiCall[]) =>
  calls.filter((call) => call.method === 'deleteMessage');

const callbackUpdate = (data: string): Update => ({
  update_id: 3,
  callback_query: {
    id: 'cb-1',
    from: { id: USER_ID, is_bot: false, first_name: 'U' },
    chat_instance: 'ci-1',
    data,
    message: {
      message_id: 200,
      date: 0,
      chat: { id: USER_ID, type: 'private', first_name: 'U' },
      from: BOT_INFO,
      text: 'settings',
    },
  },
});

const callbackDataValues = (call: ApiCall | undefined): readonly string[] => {
  const markup = call?.payload['reply_markup'] as
    | { readonly inline_keyboard?: ReadonlyArray<ReadonlyArray<{ readonly callback_data?: string }>> }
    | undefined;
  return (markup?.inline_keyboard ?? [])
    .flat()
    .map((button) => button.callback_data)
    .filter((value): value is string => value !== undefined);
};

const commandUpdate = (text: string): Update => ({
  update_id: 4,
  message: {
    message_id: 6,
    date: 0,
    chat: { id: USER_ID, type: 'private', first_name: 'U' },
    from: { id: USER_ID, is_bot: false, first_name: 'U', username: 'ada' },
    text,
    entities: [{ type: 'bot_command', offset: 0, length: text.length }],
  },
});

const messageCalls = (calls: readonly ApiCall[]) =>
  calls.filter((call) => call.method === 'sendMessage');

describe('createBot device-login gate (device-login AC-1.1, AC-1.3)', () => {
  test('an unlinked chat gets a login link and nothing is stored', async () => {
    const { bot, calls, fakes } = buildBot(false);
    await bot.handleUpdate(textUpdate('mykey super-secret', 77));

    expect(messageCalls(calls)[0]?.payload['text']).toContain(LOGIN_URL);
    expect(fakes.loginRequests).toEqual([`telegram:Telegram chat @ada:${USER_ID}`]);
    expect(fakes.saved).toEqual([]);
    expect(deleteCalls(calls)).toHaveLength(1);
  });

  test('an unlinked callback query only gets the link', async () => {
    const { bot, calls, fakes } = buildBot(false);
    await bot.handleUpdate(callbackUpdate('t:30'));
    expect(messageCalls(calls)[0]?.payload['text']).toContain(LOGIN_URL);
    expect(fakes.settingsByUser.size).toBe(0);
  });

  test('a linked chat acts as the account', async () => {
    const { bot, fakes } = buildBot();
    await bot.handleUpdate(textUpdate('mykey super-secret', 77));
    expect(fakes.saved).toEqual([`${ACCOUNT}:mykey`]);
  });

  test('/device replies with an enrollment link and /logout unlinks (AC-1.4, AC-1.5)', async () => {
    const { bot, calls, fakes } = buildBot();
    await bot.handleUpdate(commandUpdate('/device'));
    expect(messageCalls(calls)[0]?.payload['text']).toContain(ENROLL_URL);
    await bot.handleUpdate(commandUpdate('/logout'));
    expect(fakes.links.has(USER_ID)).toBe(false);
  });
});

describe('createBot incoming-secret cleanup', () => {
  test('deletes the incoming message after saving a key/value pair', async () => {
    const { bot, calls } = buildBot();
    await bot.handleUpdate(textUpdate('mykey super-secret', 77));

    const deletions = deleteCalls(calls);
    expect(deletions).toHaveLength(1);
    expect(deletions[0]?.payload).toMatchObject({ chat_id: USER_ID, message_id: 77 });
  });

  test('deletes the incoming message after a single unsaved value', async () => {
    const { bot, calls } = buildBot();
    await bot.handleUpdate(textUpdate('lonely-secret', 88));

    const deletions = deleteCalls(calls);
    expect(deletions).toHaveLength(1);
    expect(deletions[0]?.payload).toMatchObject({ message_id: 88 });
  });

  test('deletes the incoming message after supplying a pending set value', async () => {
    const { bot, calls, fakes } = buildBot();
    fakes.primePending('mykey');
    await bot.handleUpdate(textUpdate('the-new-value', 99));

    const deletions = deleteCalls(calls);
    expect(deletions).toHaveLength(1);
    expect(deletions[0]?.payload).toMatchObject({ message_id: 99 });
  });

  test('does not delete command messages that carry no secret', async () => {
    const { bot, calls } = buildBot();
    await bot.handleUpdate(commandUpdate('/list'));
    expect(deleteCalls(calls)).toHaveLength(0);
  });
});

describe('createBot link-lifetime settings', () => {
  test('the /settings command shows the current default and the preset choices', async () => {
    const { bot, calls } = buildBot();
    await bot.handleUpdate(commandUpdate('/settings'));

    const reply = messageCalls(calls)[0];
    expect(reply?.payload['text']).toContain('5 minutes');
    expect(callbackDataValues(reply)).toEqual(['t:1', 't:5', 't:15', 't:30', 't:60', 't:1440']);
  });

  test('a typed "Settings" message is a secret now, not a menu shortcut', async () => {
    const { bot, calls } = buildBot();
    await bot.handleUpdate(textUpdate('Settings'));

    const reply = messageCalls(calls)[0];
    expect(reply?.payload['text']).toContain('One-time link');
    expect(callbackDataValues(reply)).toEqual([]);
  });

  test('choosing a preset persists the new lifetime for the account and refreshes the menu', async () => {
    const { bot, calls, fakes } = buildBot();
    await bot.handleUpdate(callbackUpdate('t:30'));

    expect(await fakes.settings.getTtlMinutes(ACCOUNT)).toBe(30);
    const edit = calls.find((call) => call.method === 'editMessageText');
    expect(edit?.payload['text']).toContain('30 minutes');
  });

  test('issued links honor the account-configured lifetime', async () => {
    const { bot, fakes } = buildBot();
    fakes.settingsByUser.set(ACCOUNT, 30);
    await bot.handleUpdate(textUpdate('lonely-secret', 88));

    expect(fakes.issuedTtlsMs).toEqual([30 * 60 * 1000]);
  });

  test('issued links fall back to the default lifetime when unset', async () => {
    const { bot, fakes } = buildBot();
    await bot.handleUpdate(textUpdate('lonely-secret', 88));

    expect(fakes.issuedTtlsMs).toEqual([5 * 60 * 1000]);
  });
});

const documentUpdate = (fileSize: number, messageId = 55): Update => ({
  update_id: 5,
  message: {
    message_id: messageId,
    date: 0,
    chat: { id: USER_ID, type: 'private', first_name: 'U' },
    from: { id: USER_ID, is_bot: false, first_name: 'U', username: 'ada' },
    document: { file_id: 'doc-1', file_unique_id: 'u-1', file_name: 'server.pem', mime_type: 'application/x-pem-file', file_size: fileSize },
  },
});

describe('createBot secret files (secret-files US-7)', () => {
  test('a document of up to 20 MB becomes a one-time file link and the message is deleted (AC-7.1)', async () => {
    const { bot, calls, fakes } = buildBot();
    await bot.handleUpdate(documentUpdate(12, 55));
    expect(calls.find((call) => call.method === 'getFile')?.payload).toMatchObject({ file_id: 'doc-1' });
    expect(fakes.downloads).toEqual(['documents/file_1.pem']);
    expect(fakes.sharedFiles).toEqual([`${String(ACCOUNT)}:server.pem:application/x-pem-file:file-content`]);
    const reply = String(messageCalls(calls)[0]?.payload['text']);
    expect(reply).toContain('https://example.test/s/file-token');
    expect(reply).toContain('curl -X POST -OJ https://example.test/s/file-token');
    expect(reply).toContain('server.pem');
    expect(deleteCalls(calls)[0]?.payload).toMatchObject({ message_id: 55 });
  });

  test('a larger document is explained and pointed to the site and the utility (AC-7.2)', async () => {
    const { bot, calls, fakes } = buildBot();
    await bot.handleUpdate(documentUpdate(20 * 1000 * 1000 + 1));
    expect(calls.some((call) => call.method === 'getFile')).toBe(false);
    expect(fakes.sharedFiles).toEqual([]);
    const reply = String(messageCalls(calls)[0]?.payload['text']);
    expect(reply).toContain('20 MB');
    expect(reply).toContain('100 MiB');
    expect(reply).toContain('secret share --file');
  });

  test('an unlinked chat sending a document only gets the login link (device-login AC-1.1)', async () => {
    const { bot, calls, fakes } = buildBot(false);
    await bot.handleUpdate(documentUpdate(12));
    expect(messageCalls(calls)[0]?.payload['text']).toContain(LOGIN_URL);
    expect(fakes.downloads).toEqual([]);
    expect(deleteCalls(calls)).toHaveLength(1);
  });
});
