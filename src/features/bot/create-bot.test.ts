import { describe, expect, test } from 'bun:test';
import type { Transformer } from 'grammy';
import type { Update, UserFromGetMe } from 'grammy/types';
import { createBot } from './create-bot.ts';
import type { PendingSetStore } from './pending-set-store.ts';
import type { OneTimeLinkStore } from '../one-time-links/one-time-link-store.ts';
import type { SecretStore } from '../secrets/secret-store.ts';
import type { SettingsStore } from '../settings/settings-store.ts';

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

type ApiCall = { readonly method: string; readonly payload: Record<string, unknown> };

const createFakes = () => {
  let pendingKey: string | undefined;
  const settingsByUser = new Map<number, number>();
  const issuedTtlsMs: number[] = [];
  const secrets: SecretStore = {
    save: async () => undefined,
    read: async () => 'stored-value',
    list: async () => [],
    remove: async () => undefined,
  };
  const links: OneTimeLinkStore = {
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
  return {
    secrets,
    links,
    pendingSets,
    settings,
    issuedTtlsMs,
    settingsByUser,
    primePending: (key: string) => (pendingKey = key),
  };
};

const buildBot = () => {
  const fakes = createFakes();
  const bot = createBot({
    token: '12345:TEST',
    secrets: fakes.secrets,
    links: fakes.links,
    pendingSets: fakes.pendingSets,
    settings: fakes.settings,
    buildLinkUrl: (token) => `https://example.test/s/${token}`,
    linkTtlMinutes: 5,
    botInfo: BOT_INFO,
  });

  const calls: ApiCall[] = [];
  const record: Transformer = (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    return Promise.resolve({ ok: true, result: true as never });
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
    from: { id: USER_ID, is_bot: false, first_name: 'U' },
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
    from: { id: USER_ID, is_bot: false, first_name: 'U' },
    text,
    entities: [{ type: 'bot_command', offset: 0, length: text.length }],
  },
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
    await bot.handleUpdate({
      update_id: 2,
      message: {
        message_id: 5,
        date: 0,
        chat: { id: USER_ID, type: 'private', first_name: 'U' },
        from: { id: USER_ID, is_bot: false, first_name: 'U' },
        text: '/list',
        entities: [{ type: 'bot_command', offset: 0, length: 5 }],
      },
    });

    expect(deleteCalls(calls)).toHaveLength(0);
  });
});

const messageCalls = (calls: readonly ApiCall[]) =>
  calls.filter((call) => call.method === 'sendMessage');

describe('createBot link-lifetime settings', () => {
  test('the /settings command shows the current default and the preset choices', async () => {
    const { bot, calls } = buildBot();
    await bot.handleUpdate(commandUpdate('/settings'));

    const reply = messageCalls(calls)[0];
    expect(reply?.payload['text']).toContain('5 minutes');
    expect(callbackDataValues(reply)).toEqual(['t:1', 't:5', 't:15', 't:30', 't:60', 't:1440']);
  });

  test('the Settings button shows the menu just like the command', async () => {
    const { bot, calls } = buildBot();
    await bot.handleUpdate(textUpdate('Settings'));

    expect(callbackDataValues(messageCalls(calls)[0])).toContain('t:30');
  });

  test('choosing a preset persists the new lifetime and refreshes the menu', async () => {
    const { bot, calls, fakes } = buildBot();
    await bot.handleUpdate(callbackUpdate('t:30'));

    expect(await fakes.settings.getTtlMinutes(USER_ID)).toBe(30);
    const edit = calls.find((call) => call.method === 'editMessageText');
    expect(edit?.payload['text']).toContain('30 minutes');
  });

  test('issued links honor the user-configured lifetime', async () => {
    const { bot, fakes } = buildBot();
    fakes.settingsByUser.set(USER_ID, 30);
    await bot.handleUpdate(textUpdate('lonely-secret', 88));

    expect(fakes.issuedTtlsMs).toEqual([30 * 60 * 1000]);
  });

  test('issued links fall back to the default lifetime when unset', async () => {
    const { bot, fakes } = buildBot();
    await bot.handleUpdate(textUpdate('lonely-secret', 88));

    expect(fakes.issuedTtlsMs).toEqual([5 * 60 * 1000]);
  });
});
