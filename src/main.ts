import { loadConfig } from './config/load-config.ts';
import { BOT_COMMANDS, createBot } from './features/bot/create-bot.ts';
import { createPendingSetStore } from './features/bot/create-pending-set-store.ts';
import {
  createLinkRequestHandler,
  LINK_PATH_PREFIX,
} from './features/one-time-links/create-link-request-handler.ts';
import { createOneTimeLinkStore } from './features/one-time-links/create-one-time-link-store.ts';
import { createToken } from './features/one-time-links/create-token.ts';
import { createSecretStore } from './features/secrets/create-secret-store.ts';
import { createSettingsStore } from './features/settings/create-settings-store.ts';

const config = loadConfig(Bun.env);

const links = createOneTimeLinkStore({
  ttlMs: config.linkTtlMinutes * 60 * 1000,
  now: Date.now,
  createToken,
});

const secrets = createSecretStore(config.databasePath);
const pendingSets = createPendingSetStore();
const settings = createSettingsStore(config.databasePath);

const server = Bun.serve({
  port: config.port,
  fetch: createLinkRequestHandler(links),
});

const bot = createBot({
  token: config.botToken,
  secrets,
  links,
  pendingSets,
  settings,
  buildLinkUrl: (token) => `${config.baseUrl}${LINK_PATH_PREFIX}${token}`,
  linkTtlMinutes: config.linkTtlMinutes,
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`Received ${signal}, shutting down…`);
  await bot.stop();
  await server.stop();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await bot.api.setMyCommands([...BOT_COMMANDS]);

console.log(`Link server listening on ${server.url}`);
console.log('Starting Telegram bot (long polling)…');
await bot.start();
