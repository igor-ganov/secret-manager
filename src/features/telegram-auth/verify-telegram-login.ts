import { hmacSha256Hex } from '../crypto/hmac-sha256-hex.ts';
import { timingSafeEqual } from '../crypto/timing-safe-equal.ts';
import type { TelegramLoginPayload } from './telegram-login-payload.ts';

export type TelegramUser = {
  readonly id: number;
  readonly name: string;
};

export type TelegramLoginVerification =
  | { readonly ok: true; readonly user: TelegramUser }
  | { readonly ok: false; readonly reason: 'bad-signature' | 'expired' };

export type TelegramLoginVerifierOptions = {
  readonly botToken: string;
  /* Milliseconds since the epoch. */
  readonly now: () => number;
};

const MAX_AGE_SECONDS = 24 * 60 * 60;

const encoder = new TextEncoder();

/* Telegram Login contract: sign every field except `hash`, sorted, as
   key=value lines, with SHA-256(bot token) as the HMAC key. */
export const buildDataCheckString = (payload: TelegramLoginPayload): string =>
  Object.entries(payload)
    .filter(([field]) => field !== 'hash')
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([field, value]) => `${field}=${value}`)
    .join('\n');

const displayName = (payload: TelegramLoginPayload): string => {
  const fullName = [payload['first_name'], payload['last_name']]
    .filter((part): part is string => typeof part === 'string' && part !== '')
    .join(' ');
  const username = payload['username'];
  return fullName || (typeof username === 'string' ? username : '') || `User ${payload.id}`;
};

export const createTelegramLoginVerifier =
  ({ botToken, now }: TelegramLoginVerifierOptions) =>
  async (payload: TelegramLoginPayload): Promise<TelegramLoginVerification> => {
    const secretKey = await crypto.subtle.digest('SHA-256', encoder.encode(botToken));
    const expected = await hmacSha256Hex(secretKey, buildDataCheckString(payload));
    if (!timingSafeEqual(expected, payload.hash)) {
      return { ok: false, reason: 'bad-signature' };
    }
    if (now() / 1000 - payload.auth_date > MAX_AGE_SECONDS) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, user: { id: payload.id, name: displayName(payload) } };
  };
