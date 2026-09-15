import type { AppConfig } from '../../config/load-config.ts';
import { createAccountStore } from '../accounts/create-account-store.ts';
import type { AccountStore } from '../accounts/account-store.ts';
import { createApiTokenStore } from '../api-tokens/create-api-token-store.ts';
import type { ApiTokenStore } from '../api-tokens/api-token-store.ts';
import { createDeviceLogin, type DeviceLogin } from '../device-login/create-device-login.ts';
import { createLoginRequestStore } from '../device-login/create-login-request-store.ts';
import { createTelegramLinkStore } from '../device-login/create-telegram-link-store.ts';
import type { TelegramLinkStore } from '../device-login/telegram-link-store.ts';
import { createTelegramNotifier } from '../device-login/telegram-notifier.ts';
import { createEnrollmentStore } from '../enrollment/create-enrollment-store.ts';
import { createApiRequestHandler } from '../http-api/create-api-request-handler.ts';
import { createEnrollmentIssuer, type EnrollmentIssuer } from '../http-api/enrollment-routes.ts';
import { createLinkRequestHandler, LINK_PATH_PREFIX } from '../one-time-links/create-link-request-handler.ts';
import { createOneTimeLinkStore } from '../one-time-links/create-one-time-link-store.ts';
import { createToken } from '../one-time-links/create-token.ts';
import { createChallengeStore } from '../passkeys/create-challenge-store.ts';
import { createPasskeyCeremonies } from '../passkeys/create-passkey-ceremonies.ts';
import { createPasskeyStore } from '../passkeys/create-passkey-store.ts';
import type { PasskeyCeremonies } from '../passkeys/passkey-ceremonies.ts';
import { webAuthnConfigFromUrl } from '../passkeys/webauthn-config.ts';
import { createSecretStore } from '../secrets/create-secret-store.ts';
import { createSettingsStore } from '../settings/create-settings-store.ts';
import { createSharingService } from '../sharing/create-sharing-service.ts';
import type { SharingService } from '../sharing/sharing-service.ts';
import { createAppRequestHandler, type RequestHandler } from './create-app-request-handler.ts';

export type LocalApp = {
  readonly sharing: SharingService;
  readonly tokens: ApiTokenStore;
  readonly accounts: AccountStore;
  readonly telegramLinks: TelegramLinkStore;
  readonly deviceLogin: DeviceLogin;
  readonly enrollmentIssuer: EnrollmentIssuer;
  readonly handleRequest: RequestHandler;
};

export type LocalAppOptions = {
  /* Lets tests swap the WebAuthn layer for a fake. */
  readonly ceremonies?: PasskeyCeremonies;
};

/* Composition of the SQLite-backed runtime (local bot, dev server, tests);
   the worker composes the same features over D1. */
export const createLocalApp = (config: AppConfig, { ceremonies }: LocalAppOptions = {}): LocalApp => {
  const now = Date.now;
  const path = config.databasePath;
  const webAuthn = webAuthnConfigFromUrl(config.baseUrl);
  const links = createOneTimeLinkStore({ ttlMs: config.linkTtlMinutes * 60 * 1000, now, createToken });
  const secrets = createSecretStore(path);
  const settings = createSettingsStore(path);
  const sharing = createSharingService({
    secrets,
    links,
    settings,
    buildLinkUrl: (token) => `${config.baseUrl}${LINK_PATH_PREFIX}${token}`,
    linkTtlMinutes: config.linkTtlMinutes,
  });
  const tokens = createApiTokenStore({ databasePath: path, now });
  const accounts = createAccountStore(path);
  const telegramLinks = createTelegramLinkStore(path);
  const enrollments = createEnrollmentStore({ databasePath: path, now });
  const loginRequests = createLoginRequestStore({ databasePath: path, now });
  const deviceLogin = createDeviceLogin(loginRequests, webAuthn.origin, now);
  const moveLegacyData = async (from: number, to: number): Promise<void> => {
    await secrets.reassign(from, to);
    await settings.reassign(from, to);
  };
  const handleRequest = createAppRequestHandler({
    api: createApiRequestHandler({
      sharing,
      tokens,
      accounts,
      passkeys: createPasskeyStore(path),
      challenges: createChallengeStore({ databasePath: path, now }),
      ceremonies: ceremonies ?? createPasskeyCeremonies(webAuthn),
      enrollments,
      loginRequests,
      deviceLogin,
      telegramLinks,
      moveLegacyData,
      notifyTelegram: createTelegramNotifier(config.botToken),
      siteOrigin: webAuthn.origin,
      now,
    }),
    links: createLinkRequestHandler(links),
  });
  return {
    sharing,
    tokens,
    accounts,
    telegramLinks,
    deviceLogin,
    enrollmentIssuer: createEnrollmentIssuer(enrollments, webAuthn.origin, now),
    handleRequest,
  };
};
