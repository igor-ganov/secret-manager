import { decodeDeviceClaim, decodeDeviceStart } from '../../features/http-api/decoders/decode-device.ts';
import { decodeDevices } from '../../features/http-api/decoders/decode-devices.ts';
import { decodeEmpty } from '../../features/http-api/decoders/decode-empty.ts';
import { decodeIssuedLink } from '../../features/http-api/decoders/decode-issued-link.ts';
import { decodeKeys } from '../../features/http-api/decoders/decode-keys.ts';
import { decodeMe } from '../../features/http-api/decoders/decode-me.ts';
import { decodeSettings } from '../../features/http-api/decoders/decode-settings.ts';
import { decodeValue } from '../../features/http-api/decoders/decode-value.ts';
import type { Decoder } from '../../features/http-api/decoders/decoder.ts';
import { readErrorMessage } from '../../features/http-api/read-error-message.ts';
import type { ApiClient, ApiCredentials, ApiResult, DeviceClient } from './api-client.ts';

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

const UNEXPECTED = 'Unexpected response from the server.';

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return undefined;
  }
};

const decodeResponse = async <T>(response: Response, decode: Decoder<T>): Promise<ApiResult<T>> => {
  const body = parseJson(await response.text());
  if (response.status === 401) {
    return { ok: false, error: { kind: 'unauthorized' } };
  }
  if (!response.ok) {
    return { ok: false, error: { kind: 'rejected', message: readErrorMessage(body, response.status) } };
  }
  const value = decode(body);
  return value === undefined
    ? { ok: false, error: { kind: 'rejected', message: UNEXPECTED } }
    : { ok: true, value };
};

const describeFailure = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type Caller = <T>(
  method: string,
  path: string,
  decode: Decoder<T>,
  body?: unknown,
  headers?: Readonly<Record<string, string>>,
) => Promise<ApiResult<T>>;

const createCaller =
  (fetchFn: FetchFn, serverUrl: string, baseHeaders: Readonly<Record<string, string>>): Caller =>
  async (method, path, decode, body, headers = {}) => {
    const base = serverUrl.replace(/\/+$/, '');
    const init: RequestInit = {
      method,
      headers: { ...baseHeaders, 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
    try {
      return await decodeResponse(await fetchFn(`${base}${path}`, init), decode);
    } catch (error) {
      return { ok: false, error: { kind: 'unreachable', message: `Cannot reach ${base}: ${describeFailure(error)}` } };
    }
  };

const secretPath = (key: string): string => `/api/secrets/${encodeURIComponent(key)}`;

export const createApiClient =
  (fetchFn: FetchFn) =>
  ({ serverUrl, token }: ApiCredentials): ApiClient => {
    const call = createCaller(fetchFn, serverUrl, { authorization: `Bearer ${token}` });
    return {
      me: () => call('GET', '/api/me', decodeMe),
      keys: () => call('GET', '/api/secrets', decodeKeys),
      read: (key) => call('GET', secretPath(key), decodeValue),
      share: (key, value) => call('POST', '/api/links', decodeIssuedLink, { key, value }),
      linkFor: (key) => call('POST', `${secretPath(key)}/link`, decodeIssuedLink),
      remove: (key) => call('DELETE', secretPath(key), decodeEmpty),
      settings: () => call('GET', '/api/settings', decodeSettings),
      saveSettings: (linkTtlMinutes) => call('PUT', '/api/settings', decodeEmpty, { linkTtlMinutes }),
      devices: () => call('GET', '/api/devices', decodeDevices),
      revokeToken: (id) => call('DELETE', `/api/tokens/${encodeURIComponent(id)}`, decodeEmpty),
    };
  };

export const createDeviceClient =
  (fetchFn: FetchFn) =>
  (serverUrl: string): DeviceClient => {
    const call = createCaller(fetchFn, serverUrl, {});
    return {
      start: (label, callback) => call('POST', '/api/device/start', decodeDeviceStart, { label, callback }),
      claim: (deviceSecret, grant) =>
        call('POST', '/api/device/claim', decodeDeviceClaim, { grant }, { 'x-device-secret': deviceSecret }),
    };
  };
