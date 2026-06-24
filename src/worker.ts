import { webhookCallback } from 'grammy';
import { BOT_COMMANDS, createBot } from './features/bot/create-bot.ts';
import { createD1PendingSetStore } from './features/bot/create-d1-pending-set-store.ts';
import type { D1Database } from './features/cloudflare/d1-types.ts';
import {
  createLinkRequestHandler,
  LINK_PATH_PREFIX,
} from './features/one-time-links/create-link-request-handler.ts';
import { createD1OneTimeLinkStore } from './features/one-time-links/create-d1-one-time-link-store.ts';
import { createToken } from './features/one-time-links/create-token.ts';
import { createD1SecretStore } from './features/secrets/create-d1-secret-store.ts';
import { createD1SettingsStore } from './features/settings/create-d1-settings-store.ts';

export const WEBHOOK_PATH = '/webhook';

export type WorkerEnv = {
  readonly DB: D1Database;
  readonly BOT_TOKEN: string;
  readonly WEBHOOK_SECRET: string;
  readonly LINK_TTL_MINUTES?: string;
};

type App = {
  readonly handleWebhook: (request: Request) => Promise<Response>;
  readonly handleLink: (request: Request) => Promise<Response>;
  readonly registerCommands: () => Promise<void>;
};

type ExecutionContext = { readonly waitUntil: (promise: Promise<unknown>) => void };

/* The worker learns its own public origin from the incoming request,
   so generated links need no BASE_URL configuration. */
let currentOrigin = '';
let cachedApp: App | undefined;
/* Telegram stores the command menu server-side, so registering it once per
   isolate is enough; a failed attempt resets the flag to retry. */
let commandsRegistered = false;

const createApp = (env: WorkerEnv): App => {
  const linkTtlMinutes = Number(env.LINK_TTL_MINUTES ?? '5');
  const links = createD1OneTimeLinkStore({
    database: env.DB,
    ttlMs: linkTtlMinutes * 60 * 1000,
    now: Date.now,
    createToken,
  });
  const bot = createBot({
    token: env.BOT_TOKEN,
    secrets: createD1SecretStore(env.DB),
    links,
    pendingSets: createD1PendingSetStore(env.DB),
    settings: createD1SettingsStore(env.DB),
    buildLinkUrl: (token) => `${currentOrigin}${LINK_PATH_PREFIX}${token}`,
    linkTtlMinutes,
  });
  const registerCommands = async (): Promise<void> => {
    try {
      await bot.api.setMyCommands([...BOT_COMMANDS]);
    } catch (error) {
      commandsRegistered = false;
      console.error('Failed to register bot commands:', error);
    }
  };

  return {
    handleWebhook: webhookCallback(bot, 'std/http', { secretToken: env.WEBHOOK_SECRET }),
    handleLink: createLinkRequestHandler(links),
    registerCommands,
  };
};

export default {
  fetch: async (request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> => {
    const url = new URL(request.url);
    currentOrigin = url.origin;
    const app = (cachedApp ??= createApp(env));
    if (!commandsRegistered) {
      commandsRegistered = true;
      ctx.waitUntil(app.registerCommands());
    }
    if (request.method === 'POST' && url.pathname === WEBHOOK_PATH) {
      return app.handleWebhook(request);
    }
    return app.handleLink(request);
  },
};
