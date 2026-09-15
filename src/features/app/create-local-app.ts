import type { AppConfig } from '../../config/load-config.ts';
import { createApiTokenStore } from '../api-tokens/create-api-token-store.ts';
import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import { createApiRequestHandler } from '../http-api/create-api-request-handler.ts';
import {
  createLinkRequestHandler,
  LINK_PATH_PREFIX,
} from '../one-time-links/create-link-request-handler.ts';
import { createOneTimeLinkStore } from '../one-time-links/create-one-time-link-store.ts';
import { createToken } from '../one-time-links/create-token.ts';
import { createSecretStore } from '../secrets/create-secret-store.ts';
import { createSettingsStore } from '../settings/create-settings-store.ts';
import { createSharingService } from '../sharing/create-sharing-service.ts';
import type { SharingService } from '../sharing/sharing-service.ts';
import { createUserStore } from '../users/create-user-store.ts';
import type { UserStore } from '../users/user-store.ts';
import { createAppRequestHandler, type RequestHandler } from './create-app-request-handler.ts';

export type LocalApp = {
  readonly sharing: SharingService;
  readonly tokens: ApiTokenStore;
  readonly users: UserStore;
  readonly handleRequest: RequestHandler;
};

/* Composition of the SQLite-backed runtime (local bot, dev server, tests);
   the worker composes the same features over D1. */
export const createLocalApp = (config: AppConfig): LocalApp => {
  const links = createOneTimeLinkStore({
    ttlMs: config.linkTtlMinutes * 60 * 1000,
    now: Date.now,
    createToken,
  });
  const sharing = createSharingService({
    secrets: createSecretStore(config.databasePath),
    links,
    settings: createSettingsStore(config.databasePath),
    buildLinkUrl: (token) => `${config.baseUrl}${LINK_PATH_PREFIX}${token}`,
    linkTtlMinutes: config.linkTtlMinutes,
  });
  const tokens = createApiTokenStore({ databasePath: config.databasePath, now: Date.now });
  const users = createUserStore(config.databasePath);
  const handleRequest = createAppRequestHandler({
    api: createApiRequestHandler({ sharing, tokens, users, botToken: config.botToken, now: Date.now }),
    links: createLinkRequestHandler(links),
  });
  return { sharing, tokens, users, handleRequest };
};
