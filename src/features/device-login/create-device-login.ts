import { randomBase64url } from '../crypto/base64url.ts';
import { sha256Hex } from '../crypto/sha256-hex.ts';
import type { LoginRequestKind, LoginRequestStore } from './login-request-store.ts';

export const LOGIN_REQUEST_TTL_MS = 10 * 60 * 1000;

export type StartedLoginRequest = {
  readonly url: string;
  /* Only the requesting device holds this; needed to claim the token. */
  readonly deviceSecret: string;
  readonly expiresAt: number;
};

export type StartLoginRequest = {
  readonly kind: LoginRequestKind;
  readonly label: string;
  readonly subject: string;
  readonly callback: string;
};

/* Shared by the CLI route and the bot: mints the secrets of a request and
   returns the link the owner will open. */
export type DeviceLogin = {
  readonly start: (request: StartLoginRequest) => Promise<StartedLoginRequest>;
};

export const buildLoginRequestUrl = (siteOrigin: string, code: string): string => `${siteOrigin}/#link=${code}`;

export const createDeviceLogin = (
  requests: LoginRequestStore,
  siteOrigin: string,
  now: () => number,
): DeviceLogin => ({
  start: async ({ kind, label, subject, callback }) => {
    const code = randomBase64url(32);
    const deviceSecret = randomBase64url(32);
    const expiresAt = now() + LOGIN_REQUEST_TTL_MS;
    await requests.create({
      codeHash: await sha256Hex(code),
      pollHash: await sha256Hex(deviceSecret),
      kind,
      label,
      subject,
      callback,
      expiresAt,
    });
    return { url: buildLoginRequestUrl(siteOrigin, code), deviceSecret, expiresAt };
  },
});
