import { Bot, type Context, type Filter, type InlineKeyboard } from 'grammy';
import type { BotCommand, UserFromGetMe } from 'grammy/types';
import type { DeviceLogin } from '../device-login/create-device-login.ts';
import type { TelegramLinkStore } from '../device-login/telegram-link-store.ts';
import type { EnrollmentIssuer } from '../http-api/enrollment-routes.ts';
import { isValidKey } from '../sharing/is-valid-key.ts';
import type { IssuedLink, SharingService } from '../sharing/sharing-service.ts';
import { buildLinkMessage, type LinkMessage } from './build-link-message.ts';
import { parseCallbackData, type CallbackAction } from './callback-data.ts';
import {
  buildCancelSetKeyboard,
  buildDeleteConfirmKeyboard,
  buildListKeyboard,
  buildSettingsKeyboard,
} from './keyboards.ts';
import { parseTextMessage } from './parse-text-message.ts';
import type { PendingSetStore } from './pending-set-store.ts';

/* Registered with Telegram so the commands appear in the native command
   menu and the Menu button; the bot has no reply keyboard. */
export const BOT_COMMANDS: readonly BotCommand[] = [
  { command: 'start', description: 'Show help' },
  { command: 'list', description: 'List your saved keys' },
  { command: 'settings', description: 'Set how long one-time links stay valid' },
  { command: 'device', description: 'Add a passkey on another device' },
  { command: 'logout', description: 'Unlink this chat from your account' },
];

export type BotDependencies = {
  readonly token: string;
  readonly sharing: SharingService;
  readonly pendingSets: PendingSetStore;
  /* Default link lifetime, quoted in the help text. */
  readonly linkTtlMinutes: number;
  readonly telegramLinks: TelegramLinkStore;
  readonly deviceLogin: DeviceLogin;
  readonly enrollmentIssuer: EnrollmentIssuer;
  /* Supplying a known bot identity skips the getMe call; production omits it
     (grammY initializes lazily), tests pass it to drive updates offline. */
  readonly botInfo?: UserFromGetMe;
};

const HELP_TEXT = [
  'Send me `key value` — I will save the pair and reply with a one-time link to the value.',
  'Send me a single `value` — I will reply with a one-time link without saving anything.',
  `Every link lives ${'%TTL%'} minutes by default and can be opened exactly once.`,
  'For your safety, I delete your message right after reading it, so the secret never lingers in this chat.',
  'Use /list to manage your saved keys.',
  'Use /settings to change how long links stay valid.',
  'Use /device to add a passkey on another device, /logout to unlink this chat.',
].join('\n');

const LOGIN_TEXT = 'This chat is not linked to an account yet. Open the link, sign in with your passkey and approve it:';

export const createBot = ({
  token,
  sharing,
  pendingSets,
  linkTtlMinutes,
  telegramLinks,
  deviceLogin,
  enrollmentIssuer,
  botInfo,
}: BotDependencies): Bot => {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  const linkReply = (intro: string, link: IssuedLink): LinkMessage =>
    buildLinkMessage(intro, link.url, link.ttlMinutes);

  /* The incoming message holds the secret in clear text; delete it so the value
     does not linger in the chat. Bots may delete incoming messages in private
     chats; a failure (e.g. message older than 48h) must not abort the reply. */
  const purgeIncoming = async (ctx: Context): Promise<void> => {
    try {
      await ctx.deleteMessage();
    } catch (error) {
      console.error('Failed to delete incoming secret message:', error);
    }
  };

  /* The chat acts for an account only once its owner approved it on the
     site; until then every update is answered with the login link. */
  const requireOwner = async (ctx: Context): Promise<number | undefined> => {
    const telegramUserId = ctx.from?.id;
    if (telegramUserId === undefined) {
      return undefined;
    }
    const owner = await telegramLinks.accountFor(telegramUserId);
    if (owner !== undefined) {
      return owner;
    }
    const label = ctx.from?.username !== undefined ? `@${ctx.from.username}` : (ctx.from?.first_name ?? 'Telegram');
    const { url } = await deviceLogin.start('telegram', `Telegram chat ${label}`, String(telegramUserId));
    await ctx.reply(`${LOGIN_TEXT}\n${url}`);
    return undefined;
  };

  type ReplyOptions = Readonly<{ reply_markup?: InlineKeyboard }>;
  type Reply = (text: string, options: ReplyOptions) => Promise<unknown>;

  const sendList = async (reply: Reply, owner: number): Promise<void> => {
    const keys = await sharing.list(owner);
    if (keys.length === 0) {
      await reply('You have no saved keys yet. Send "key value" to create one.', {});
      return;
    }
    await reply('Your keys:', { reply_markup: buildListKeyboard(keys) });
  };

  const settingsText = (minutes: number): string =>
    `One-time links currently stay valid for ${minutes} minutes.\nPick how long they should last:`;

  const sendSettings = async (reply: Reply, owner: number): Promise<void> => {
    const minutes = await sharing.getTtlMinutes(owner);
    await reply(settingsText(minutes), { reply_markup: buildSettingsKeyboard(minutes) });
  };

  bot.command('start', async (ctx) => {
    await ctx.reply(HELP_TEXT.replace('%TTL%', String(linkTtlMinutes)), {
      parse_mode: 'Markdown',
      /* Clear the legacy persistent keyboard for users who still have it. */
      reply_markup: { remove_keyboard: true },
    });
    await requireOwner(ctx);
  });

  bot.command('list', async (ctx) => {
    const owner = await requireOwner(ctx);
    if (owner !== undefined) {
      await sendList((text, options) => ctx.reply(text, options), owner);
    }
  });

  bot.command('settings', async (ctx) => {
    const owner = await requireOwner(ctx);
    if (owner !== undefined) {
      await sendSettings((text, options) => ctx.reply(text, options), owner);
    }
  });

  bot.command('device', async (ctx) => {
    const owner = await requireOwner(ctx);
    if (owner !== undefined) {
      const { url } = await enrollmentIssuer(owner);
      await ctx.reply(`Open this link on the new device to add a passkey (valid 10 minutes, once):\n${url}`);
    }
  });

  bot.command('logout', async (ctx) => {
    const telegramUserId = ctx.from?.id;
    if (telegramUserId !== undefined) {
      await telegramLinks.unlink(telegramUserId);
      await pendingSets.cancel(telegramUserId);
      await ctx.reply('This chat is no longer linked to an account.');
    }
  });

  bot.on('message:text', async (ctx) => {
    const owner = await requireOwner(ctx);
    if (owner === undefined) {
      await purgeIncoming(ctx);
      return;
    }
    const telegramUserId = ctx.from.id;
    const text = ctx.message.text;

    const pendingKey = await pendingSets.take(telegramUserId);
    if (pendingKey !== undefined) {
      await sharing.save(owner, pendingKey, text);
      await ctx.reply(`Value of “${pendingKey}” has been updated.`);
      await purgeIncoming(ctx);
      return;
    }

    const parsed = parseTextMessage(text);
    switch (parsed.kind) {
      case 'pair': {
        if (!isValidKey(parsed.key)) {
          await ctx.reply('This key is too long. Please use a key under 62 bytes.');
          return;
        }
        const { text: pairText, entities: pairEntities } = linkReply(
          `Saved “${parsed.key}”. One-time link to the value:`,
          await sharing.saveAndShare(owner, parsed.key, parsed.value),
        );
        await ctx.reply(pairText, { entities: [...pairEntities] });
        await purgeIncoming(ctx);
        return;
      }
      case 'single': {
        const { text: singleText, entities: singleEntities } = linkReply(
          'One-time link (nothing was saved):',
          await sharing.share(owner, parsed.value),
        );
        await ctx.reply(singleText, { entities: [...singleEntities] });
        await purgeIncoming(ctx);
        return;
      }
      case 'empty':
        return;
    }
  });

  const handleCallback = async (
    ctx: Filter<Context, 'callback_query:data'>,
    action: CallbackAction,
    owner: number,
    telegramUserId: number,
  ): Promise<void> => {
    switch (action.kind) {
      case 'noop': {
        await ctx.answerCallbackQuery();
        return;
      }
      case 'get': {
        const link = await sharing.linkFor(owner, action.key);
        if (link === undefined) {
          await ctx.answerCallbackQuery({ text: 'This key no longer exists.' });
          return;
        }
        await ctx.answerCallbackQuery();
        const { text, entities } = linkReply(`One-time link to “${action.key}”:`, link);
        await ctx.reply(text, { entities: [...entities] });
        return;
      }
      case 'set': {
        await pendingSets.begin(telegramUserId, action.key);
        await ctx.answerCallbackQuery();
        await ctx.reply(`Send the new value for “${action.key}”:`, {
          reply_markup: buildCancelSetKeyboard(),
        });
        return;
      }
      case 'set-ttl': {
        const previous = await sharing.getTtlMinutes(owner);
        await sharing.setTtlMinutes(owner, action.minutes);
        await ctx.answerCallbackQuery({ text: `Saved: ${action.minutes} minutes.` });
        /* Editing to identical content makes Telegram answer 400; the menu
           already shows this value, so only redraw when it actually changed. */
        if (action.minutes !== previous) {
          await ctx.editMessageText(settingsText(action.minutes), {
            reply_markup: buildSettingsKeyboard(action.minutes),
          });
        }
        return;
      }
      case 'cancel-set': {
        await pendingSets.cancel(telegramUserId);
        await ctx.answerCallbackQuery({ text: 'Cancelled.' });
        await ctx.editMessageText('Value update cancelled.');
        return;
      }
      case 'delete-request': {
        await ctx.answerCallbackQuery();
        await ctx.reply(`Delete “${action.key}”? This cannot be undone.`, {
          reply_markup: buildDeleteConfirmKeyboard(action.key),
        });
        return;
      }
      case 'delete-confirm': {
        await sharing.remove(owner, action.key);
        await ctx.answerCallbackQuery({ text: 'Deleted.' });
        await ctx.editMessageText(`“${action.key}” has been deleted.`);
        await sendList((text, options) => ctx.reply(text, options), owner);
        return;
      }
      case 'cancel-delete': {
        await ctx.answerCallbackQuery({ text: 'Cancelled.' });
        await ctx.editMessageText('Deletion cancelled.');
        return;
      }
    }
  };

  bot.on('callback_query:data', async (ctx) => {
    const action = parseCallbackData(ctx.callbackQuery.data);
    const owner = action === undefined ? undefined : await requireOwner(ctx);
    if (action === undefined || owner === undefined) {
      await ctx.answerCallbackQuery();
      return;
    }
    await handleCallback(ctx, action, owner, ctx.from.id);
  });

  bot.catch(({ error, ctx }) => {
    console.error(`Error while handling update ${ctx.update.update_id}:`, error);
  });

  return bot;
};
