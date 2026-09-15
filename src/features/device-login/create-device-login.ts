import { randomBase64url } from '../crypto/base64url.ts';
import { sha256Hex } from '../crypto/sha256-hex.ts';
import type { LoginRequestKind, LoginRequestStore } from './login-request-store.ts';

export const LOGIN_REQUEST_TTL_MS = 10 * 60 * 1000;

export type StartedLoginRequest = {
  readonly url: string;
  readonly pollToken: string;
  readonly expiresAt: number;
};

/* Shared by the CLI route and the bot: mints the two secrets of a request
   and returns the link the owner will open. */
export type DeviceLogin = {
  readonly start: (kind: LoginRequestKind, label: string, subject: string) => Promise<StartedLoginRequest>;
};

export const buildLoginRequestUrl = (siteOrigin: string, code: string): string => `${siteOrigin}/#link=${code}`;

export const createDeviceLogin = (
  requests: LoginRequestStore,
  siteOrigin: string,
  now: () => number,
): DeviceLogin => ({
  start: async (kind, label, subject) => {
    const code = randomBase64url(32);
    const pollToken = randomBase64url(32);
    const expiresAt = now() + LOGIN_REQUEST_TTL_MS;
    await requests.create({
      codeHash: await sha256Hex(code),
      pollHash: await sha256Hex(pollToken),
      kind,
      label,
      subject,
      expiresAt,
    });
    return { url: buildLoginRequestUrl(siteOrigin, code), pollToken, expiresAt };
  },
});
