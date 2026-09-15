import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import type { TelegramLinkStore } from '../device-login/telegram-link-store.ts';
import type { PasskeyStore } from '../passkeys/passkey-store.ts';
import type { DevicesResponse } from './api-types.ts';
import { jsonResponse, noContent, notFound } from './json-response.ts';
import { toPasskeyResponse } from './passkey-routes.ts';
import type { Route } from './route.ts';

export type DevicesRouteDeps = {
  readonly passkeys: PasskeyStore;
  readonly telegramLinks: TelegramLinkStore;
  readonly tokens: ApiTokenStore;
};

/* Everything attached to the account, in one call, for the Devices section. */
export const createDevicesRoutes = ({ passkeys, telegramLinks, tokens }: DevicesRouteDeps): readonly Route[] => [
  {
    method: 'GET',
    pattern: '/api/devices',
    auth: 'user',
    handle: async ({ principal }) => {
      const [owned, telegramUser, records] = await Promise.all([
        passkeys.listByAccount(principal.userId),
        telegramLinks.telegramUserFor(principal.userId),
        tokens.list(principal.userId),
      ]);
      const body: DevicesResponse = {
        passkeys: owned.map(toPasskeyResponse),
        telegram: { linked: telegramUser !== undefined },
        tokens: records.map((record) => ({ ...record, current: record.id === principal.tokenId })),
      };
      return jsonResponse(body);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/telegram',
    auth: 'user',
    handle: async ({ principal }) => {
      const telegramUser = await telegramLinks.telegramUserFor(principal.userId);
      if (telegramUser === undefined) {
        return notFound('No Telegram chat is linked.');
      }
      await telegramLinks.unlink(telegramUser);
      return noContent();
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/tokens/:id',
    auth: 'user',
    handle: async ({ params, principal }) =>
      (await tokens.revoke(principal.userId, params['id'] ?? '')) ? noContent() : notFound('No such token.'),
  },
];
