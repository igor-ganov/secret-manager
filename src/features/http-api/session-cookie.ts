export const SESSION_COOKIE = 'session';

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const attributes = (secure: boolean): string =>
  `Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;

export const readSessionCookie = (request: Request): string | undefined =>
  (request.headers.get('cookie') ?? '')
    .split(';')
    .map((pair) => pair.trim())
    .filter((pair) => pair.startsWith(`${SESSION_COOKIE}=`))
    .map((pair) => pair.slice(SESSION_COOKIE.length + 1))
    .find((value) => value !== '');

export const isSecureRequest = (request: Request): boolean =>
  new URL(request.url).protocol === 'https:';

export const buildSessionCookie = (token: string, secure: boolean): string =>
  `${SESSION_COOKIE}=${token}; Max-Age=${MAX_AGE_SECONDS}; ${attributes(secure)}`;

export const buildClearedSessionCookie = (secure: boolean): string =>
  `${SESSION_COOKIE}=; Max-Age=0; ${attributes(secure)}`;
