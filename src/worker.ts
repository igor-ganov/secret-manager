import { webhookCallback } from 'grammy';
import { createD1AccountStore } from './features/accounts/create-d1-account-store.ts';
import { createD1ApiTokenStore } from './features/api-tokens/create-d1-api-token-store.ts';
import { createAppRequestHandler } from './features/app/create-app-request-handler.ts';
import { BOT_COMMANDS, createBot } from './features/bot/create-bot.ts';
import { createD1PendingSetStore } from './features/bot/create-d1-pending-set-store.ts';
import type { D1Database } from './features/cloudflare/d1-types.ts';
import { createDeviceLogin } from './features/device-login/create-device-login.ts';
import { createD1LoginRequestStore } from './features/device-login/create-d1-login-request-store.ts';
import { createD1TelegramLinkStore } from './features/device-login/create-d1-telegram-link-store.ts';
import { createTelegramNotifier } from './features/device-login/telegram-notifier.ts';
import { createD1EnrollmentStore } from './features/enrollment/create-d1-enrollment-store.ts';
import { createApiRequestHandler } from './features/http-api/create-api-request-handler.ts';
import { createEnrollmentIssuer } from './features/http-api/enrollment-routes.ts';
import { createLinkRequestHandler, LINK_PATH_PREFIX } from './features/one-time-links/create-link-request-handler.ts';
import { createD1OneTimeLinkStore } from './features/one-time-links/create-d1-one-time-link-store.ts';
import { createToken } from './features/one-time-links/create-token.ts';
import { createD1ChallengeStore } from './features/passkeys/create-d1-challenge-store.ts';
import { createD1PasskeyStore } from './features/passkeys/create-d1-passkey-store.ts';
import { createPasskeyCeremonies } from './features/passkeys/create-passkey-ceremonies.ts';
import { webAuthnConfigFromUrl } from './features/passkeys/webauthn-config.ts';
import { createD1SecretStore } from './features/secrets/create-d1-secret-store.ts';
import { createD1SettingsStore } from './features/settings/create-d1-settings-store.ts';
import { createSharingService } from './features/sharing/create-sharing-service.ts';

export const WEBHOOK_PATH = '/webhook';

export type WorkerEnv = {
  readonly DB: D1Database;
  readonly BOT_TOKEN: string;
  readonly WEBHOOK_SECRET: string;
  /* Public origin of the site: relying party for passkeys and base of every
     link the worker hands out. Configuration, never the request. */
  readonly ORIGIN: string;
  readonly LINK_TTL_MINUTES?: string;
};

type App = {
  readonly handleWebhook: (request: Request) => Promise<Response>;
  readonly handleRequest: (request: Request) => Promise<Response>;
  readonly registerCommands: () => Promise<void>;
};

type ExecutionContext = { readonly waitUntil: (promise: Promise<unknown>) => void };

let cachedApp: App | undefined;
/* Telegram stores the command menu server-side, so registering it once per
   isolate is enough; a failed attempt resets the flag to retry. */
let commandsRegistered = false;

const createApp = (env: WorkerEnv): App => {
  const now = Date.now;
  const linkTtlMinutes = Number(env.LINK_TTL_MINUTES ?? '5');
  const webAuthn = webAuthnConfigFromUrl(env.ORIGIN);
  const links = createD1OneTimeLinkStore({ database: env.DB, ttlMs: linkTtlMinutes * 60 * 1000, now, createToken });
  const secrets = createD1SecretStore(env.DB);
  const settings = createD1SettingsStore(env.DB);
  const sharing = createSharingService({
    secrets,
    links,
    settings,
    buildLinkUrl: (token) => `${webAuthn.origin}${LINK_PATH_PREFIX}${token}`,
    linkTtlMinutes,
  });
  const tokens = createD1ApiTokenStore({ database: env.DB, now });
  const telegramLinks = createD1TelegramLinkStore(env.DB);
  const enrollments = createD1EnrollmentStore({ database: env.DB, now });
  const loginRequests = createD1LoginRequestStore({ database: env.DB, now });
  const deviceLogin = createDeviceLogin(loginRequests, webAuthn.origin, now);
  const bot = createBot({
    token: env.BOT_TOKEN,
    sharing,
    pendingSets: createD1PendingSetStore(env.DB),
    linkTtlMinutes,
    telegramLinks,
    deviceLogin,
    enrollmentIssuer: createEnrollmentIssuer(enrollments, webAuthn.origin, now),
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
    handleRequest: createAppRequestHandler({
      api: createApiRequestHandler({
        sharing,
        tokens,
        accounts: createD1AccountStore(env.DB),
        passkeys: createD1PasskeyStore(env.DB),
        challenges: createD1ChallengeStore({ database: env.DB, now }),
        ceremonies: createPasskeyCeremonies(webAuthn),
        enrollments,
        loginRequests,
        deviceLogin,
        telegramLinks,
        moveLegacyData: async (from, to) => {
          await secrets.reassign(from, to);
          await settings.reassign(from, to);
        },
        notifyTelegram: createTelegramNotifier(env.BOT_TOKEN),
        siteOrigin: webAuthn.origin,
        now,
      }),
      links: createLinkRequestHandler(links),
    }),
    registerCommands,
  };
};

export default {
  fetch: async (request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> => {
    const url = new URL(request.url);
    const app = (cachedApp ??= createApp(env));
    if (!commandsRegistered) {
      commandsRegistered = true;
      ctx.waitUntil(app.registerCommands());
    }
    if (request.method === 'POST' && url.pathname === WEBHOOK_PATH) {
      return app.handleWebhook(request);
    }
    return app.handleRequest(request);
  },
};
