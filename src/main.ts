import { loadConfig } from './config/load-config.ts';
import { createLocalApp } from './features/app/create-local-app.ts';
import { BOT_COMMANDS, createBot } from './features/bot/create-bot.ts';
import { createPendingSetStore } from './features/bot/create-pending-set-store.ts';
import site from './web/index.html';

const config = loadConfig(Bun.env);

const app = createLocalApp(config);

const server = Bun.serve({
  port: config.port,
  routes: { '/': site },
  fetch: app.handleRequest,
});

const bot = createBot({
  token: config.botToken,
  sharing: app.sharing,
  pendingSets: createPendingSetStore(),
  linkTtlMinutes: config.linkTtlMinutes,
  telegramLinks: app.telegramLinks,
  deviceLogin: app.deviceLogin,
  enrollmentIssuer: app.enrollmentIssuer,
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

console.log(`Site and link server listening on ${server.url}`);
console.log('Starting Telegram bot (long polling)…');
await bot.start();
