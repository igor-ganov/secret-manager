import { decodeCeremonyOptions } from '../../features/http-api/decoders/decode-ceremony-options.ts';
import { decodeLoginRequestInfo } from '../../features/http-api/decoders/decode-device.ts';
import { decodeDevices } from '../../features/http-api/decoders/decode-devices.ts';
import { decodeEmpty } from '../../features/http-api/decoders/decode-empty.ts';
import { decodeEnrollment, decodeEnrollmentInfo } from '../../features/http-api/decoders/decode-enrollment.ts';
import { decodeIssuedLink } from '../../features/http-api/decoders/decode-issued-link.ts';
import { decodeKeys } from '../../features/http-api/decoders/decode-keys.ts';
import { decodeMe } from '../../features/http-api/decoders/decode-me.ts';
import { decodeSettings } from '../../features/http-api/decoders/decode-settings.ts';
import { decodeSignedIn } from '../../features/http-api/decoders/decode-signed-in.ts';
import type { ApiClient } from './api-client.ts';
import type { JsonRequester } from './create-json-requester.ts';

const enc = encodeURIComponent;
const secretPath = (key: string): string => `/api/secrets/${enc(key)}`;

export const createApiClient = (request: JsonRequester): ApiClient => ({
  me: () => request('GET', '/api/me', decodeMe),
  logout: () => request('POST', '/api/auth/logout', decodeEmpty),
  keys: () => request('GET', '/api/secrets', decodeKeys),
  share: (key, value) => request('POST', '/api/links', decodeIssuedLink, { key, value }),
  save: (key, value) => request('PUT', secretPath(key), decodeEmpty, { value }),
  linkFor: (key) => request('POST', `${secretPath(key)}/link`, decodeIssuedLink),
  remove: (key) => request('DELETE', secretPath(key), decodeEmpty),
  settings: () => request('GET', '/api/settings', decodeSettings),
  saveSettings: (linkTtlMinutes) => request('PUT', '/api/settings', decodeEmpty, { linkTtlMinutes }),
  devices: () => request('GET', '/api/devices', decodeDevices),
  revokeToken: (id) => request('DELETE', `/api/tokens/${enc(id)}`, decodeEmpty),
  removePasskey: (id) => request('DELETE', `/api/passkeys/${enc(id)}`, decodeEmpty),
  unlinkTelegram: () => request('DELETE', '/api/telegram', decodeEmpty),
  registerOptions: (name) => request('POST', '/api/passkeys/register/options', decodeCeremonyOptions, { name }),
  registerVerify: (response, label) => request('POST', '/api/passkeys/register/verify', decodeSignedIn, { response, label }),
  loginOptions: () => request('POST', '/api/passkeys/login/options', decodeCeremonyOptions, {}),
  loginVerify: (response) => request('POST', '/api/passkeys/login/verify', decodeSignedIn, { response }),
  addOptions: () => request('POST', '/api/passkeys/add/options', decodeCeremonyOptions, {}),
  addVerify: (response, label) => request('POST', '/api/passkeys/add/verify', decodeEmpty, { response, label }),
  createEnrollment: () => request('POST', '/api/enrollments', decodeEnrollment, {}),
  enrollmentInfo: (code) => request('GET', `/api/enrollments/${enc(code)}`, decodeEnrollmentInfo),
  enrollOptions: (code) => request('POST', `/api/enrollments/${enc(code)}/options`, decodeCeremonyOptions, {}),
  enrollVerify: (code, response, label) =>
    request('POST', `/api/enrollments/${enc(code)}/verify`, decodeSignedIn, { response, label }),
  recoveryOptions: (code) => request('POST', '/api/recovery/options', decodeCeremonyOptions, { code }),
  recoveryVerify: (code, response) => request('POST', '/api/recovery/verify', decodeSignedIn, { code, response }),
  loginRequestInfo: (code) => request('GET', `/api/device/${enc(code)}`, decodeLoginRequestInfo),
  approveDevice: (code) => request('POST', `/api/device/${enc(code)}/approve`, decodeEmpty, {}),
  denyDevice: (code) => request('POST', `/api/device/${enc(code)}/deny`, decodeEmpty, {}),
});
