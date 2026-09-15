/* Bot-less entry for working on the site: serves the page and the API over
   SQLite. `GET /dev/login` signs the browser in as DEV_LOGIN_USER_ID so the
   UI can be exercised without a linked Telegram domain. This route exists
   only here — never in `main.ts` or `worker.ts`. */
import { loadConfig } from './config/load-config.ts';
import { createLocalApp } from './features/app/create-local-app.ts';
import { buildSessionCookie, isSecureRequest } from './features/http-api/session-cookie.ts';
import site from './web/index.html';

const DEV_LOGIN_PATH = '/dev/login';
const DEV_BOT_TOKEN = '1:development';

const config = loadConfig({ BOT_TOKEN: DEV_BOT_TOKEN, ...Bun.env });
const devUserId = Number(Bun.env['DEV_LOGIN_USER_ID'] ?? '1');

const app = createLocalApp(config);

/* `?user=<id>` lets parallel E2E workers sign in as distinct users. */
const devLogin = async (request: Request): Promise<Response> => {
  const requested = Number(new URL(request.url).searchParams.get('user'));
  const userId = Number.isInteger(requested) && requested > 0 ? requested : devUserId;
  const { token } = await app.tokens.create(userId, 'web');
  await app.users.saveName(userId, 'Dev User');
  return new Response(undefined, {
    status: 303,
    headers: { location: '/', 'set-cookie': buildSessionCookie(token, isSecureRequest(request)) },
  });
};

const server = Bun.serve({
  port: config.port,
  routes: { '/': site, [DEV_LOGIN_PATH]: devLogin },
  fetch: app.handleRequest,
});

console.log(`Dev site listening on ${server.url} (login: ${server.url}dev/login)`);
