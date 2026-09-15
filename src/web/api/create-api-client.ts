import type { ApiClient } from './api-client.ts';
import type { JsonRequester } from './create-json-requester.ts';
import { decodeAuthConfig } from '../../features/http-api/decoders/decode-auth-config.ts';
import { decodeCreatedToken } from '../../features/http-api/decoders/decode-created-token.ts';
import { decodeEmpty } from '../../features/http-api/decoders/decode-empty.ts';
import { decodeIssuedLink } from '../../features/http-api/decoders/decode-issued-link.ts';
import { decodeKeys } from '../../features/http-api/decoders/decode-keys.ts';
import { decodeMe } from '../../features/http-api/decoders/decode-me.ts';
import { decodeSettings } from '../../features/http-api/decoders/decode-settings.ts';
import { decodeTokens } from '../../features/http-api/decoders/decode-tokens.ts';

const secretPath = (key: string): string => `/api/secrets/${encodeURIComponent(key)}`;

export const createApiClient = (request: JsonRequester): ApiClient => ({
  authConfig: () => request('GET', '/api/auth/config', decodeAuthConfig),
  me: () => request('GET', '/api/me', decodeMe),
  loginTelegram: (payload) => request('POST', '/api/auth/telegram', decodeMe, payload),
  logout: () => request('POST', '/api/auth/logout', decodeEmpty),
  keys: () => request('GET', '/api/secrets', decodeKeys),
  share: (key, value) => request('POST', '/api/links', decodeIssuedLink, { key, value }),
  save: (key, value) => request('PUT', secretPath(key), decodeEmpty, { value }),
  linkFor: (key) => request('POST', `${secretPath(key)}/link`, decodeIssuedLink),
  remove: (key) => request('DELETE', secretPath(key), decodeEmpty),
  settings: () => request('GET', '/api/settings', decodeSettings),
  saveSettings: (linkTtlMinutes) =>
    request('PUT', '/api/settings', decodeEmpty, { linkTtlMinutes }),
  tokens: () => request('GET', '/api/tokens', decodeTokens),
  createToken: (label) => request('POST', '/api/tokens', decodeCreatedToken, { label }),
  revokeToken: (id) => request('DELETE', `/api/tokens/${encodeURIComponent(id)}`, decodeEmpty),
});
