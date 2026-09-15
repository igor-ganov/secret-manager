/* Bot-less entry for working on the site: serves the page and the API over
   SQLite. Passkeys work against `localhost` as the relying party, so sign
   up with a real or virtual authenticator. */
import { loadConfig } from './config/load-config.ts';
import { createLocalApp } from './features/app/create-local-app.ts';
import site from './web/index.html';

const DEV_BOT_TOKEN = '1:development';

const config = loadConfig({ BOT_TOKEN: DEV_BOT_TOKEN, ...Bun.env });
const app = createLocalApp(config);

const server = Bun.serve({
  port: config.port,
  routes: { '/': site },
  fetch: app.handleRequest,
});

console.log(`Dev site listening on ${server.url}`);
