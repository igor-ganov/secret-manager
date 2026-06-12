import { Bot, type Context, type Filter, type InlineKeyboard } from 'grammy';
import type { OneTimeLinkStore } from '../one-time-links/one-time-link-store.ts';
import type { SecretStore } from '../secrets/secret-store.ts';
import { buildLinkMessage, type LinkMessage } from './build-link-message.ts';
import { parseCallbackData, type CallbackAction } from './callback-data.ts';
import { isValidKey } from './is-valid-key.ts';
import {
  buildCancelSetKeyboard,
  buildDeleteConfirmKeyboard,
  buildListKeyboard,
  LIST_BUTTON_LABEL,
  mainKeyboard,
} from './keyboards.ts';
import { parseTextMessage } from './parse-text-message.ts';
import type { PendingSetStore } from './pending-set-store.ts';

export type BotDependencies = {
  readonly token: string;
  readonly secrets: SecretStore;
  readonly links: OneTimeLinkStore;
  readonly pendingSets: PendingSetStore;
  readonly buildLinkUrl: (token: string) => string;
  readonly linkTtlMinutes: number;
};

const HELP_TEXT = [
  'Send me `key value` — I will save the pair and reply with a one-time link to the value.',
  'Send me a single `value` — I will reply with a one-time link without saving anything.',
  `Every link lives ${'%TTL%'} minutes and can be opened exactly once.`,
  `Press “${LIST_BUTTON_LABEL}” or use /list to manage your saved keys.`,
].join('\n');

export const createBot = ({
  token,
  secrets,
  links,
  pendingSets,
  buildLinkUrl,
  linkTtlMinutes,
}: BotDependencies): Bot => {
  const bot = new Bot(token);

  const linkReply = async (intro: string, value: string): Promise<LinkMessage> =>
    buildLinkMessage(intro, buildLinkUrl(await links.issue(value)), linkTtlMinutes);

  type ListReplyOptions = Readonly<{ reply_markup?: InlineKeyboard }>;

  const sendList = async (
    reply: (text: string, options: ListReplyOptions) => Promise<unknown>,
    userId: number,
  ): Promise<void> => {
    const keys = await secrets.list(userId);
    if (keys.length === 0) {
      await reply('You have no saved keys yet. Send "key value" to create one.', {});
      return;
    }
    await reply('Your keys:', { reply_markup: buildListKeyboard(keys) });
  };

  bot.command('start', async (ctx) => {
    await ctx.reply(HELP_TEXT.replace('%TTL%', String(linkTtlMinutes)), {
      parse_mode: 'Markdown',
      reply_markup: mainKeyboard,
    });
  });

  bot.command('list', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) {
      return;
    }
    await sendList((text, options) => ctx.reply(text, options), userId);
  });

  bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (text.toLowerCase() === LIST_BUTTON_LABEL.toLowerCase()) {
      await sendList((body, options) => ctx.reply(body, options), userId);
      return;
    }

    const pendingKey = await pendingSets.take(userId);
    if (pendingKey !== undefined) {
      await secrets.save(userId, pendingKey, text);
      await ctx.reply(`Value of “${pendingKey}” has been updated.`);
      return;
    }

    const parsed = parseTextMessage(text);
    switch (parsed.kind) {
      case 'pair': {
        if (!isValidKey(parsed.key)) {
          await ctx.reply('This key is too long. Please use a key under 62 bytes.');
          return;
        }
        await secrets.save(userId, parsed.key, parsed.value);
        const { text: pairText, entities: pairEntities } = await linkReply(
          `Saved “${parsed.key}”. One-time link to the value:`,
          parsed.value,
        );
        await ctx.reply(pairText, { entities: [...pairEntities] });
        return;
      }
      case 'single': {
        const { text: singleText, entities: singleEntities } = await linkReply(
          'One-time link (nothing was saved):',
          parsed.value,
        );
        await ctx.reply(singleText, { entities: [...singleEntities] });
        return;
      }
      case 'empty':
        return;
    }
  });

  const handleCallback = async (
    ctx: Filter<Context, 'callback_query:data'>,
    action: CallbackAction,
    userId: number,
  ): Promise<void> => {
    switch (action.kind) {
      case 'noop': {
        await ctx.answerCallbackQuery();
        return;
      }
      case 'get': {
        const value = await secrets.read(userId, action.key);
        if (value === undefined) {
          await ctx.answerCallbackQuery({ text: 'This key no longer exists.' });
          return;
        }
        await ctx.answerCallbackQuery();
        const { text, entities } = await linkReply(`One-time link to “${action.key}”:`, value);
        await ctx.reply(text, { entities: [...entities] });
        return;
      }
      case 'set': {
        await pendingSets.begin(userId, action.key);
        await ctx.answerCallbackQuery();
        await ctx.reply(`Send the new value for “${action.key}”:`, {
          reply_markup: buildCancelSetKeyboard(),
        });
        return;
      }
      case 'cancel-set': {
        await pendingSets.cancel(userId);
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
        await secrets.remove(userId, action.key);
        await ctx.answerCallbackQuery({ text: 'Deleted.' });
        await ctx.editMessageText(`“${action.key}” has been deleted.`);
        await sendList((text, options) => ctx.reply(text, options), userId);
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
    if (action === undefined) {
      await ctx.answerCallbackQuery();
      return;
    }
    await handleCallback(ctx, action, ctx.from.id);
  });

  bot.catch(({ error, ctx }) => {
    console.error(`Error while handling update ${ctx.update.update_id}:`, error);
  });

  return bot;
};
