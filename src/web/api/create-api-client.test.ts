import { describe, expect, test } from 'bun:test';
import { createApiClient } from './create-api-client.ts';
import type { JsonRequester } from './create-json-requester.ts';

type Call = { readonly method: string; readonly path: string; readonly body: unknown };

const build = () => {
  const calls: Call[] = [];
  const request: JsonRequester = async (method, path, _decode, body) => {
    calls.push({ method, path, body });
    return { ok: false, error: 'stub' };
  };
  return { client: createApiClient(request), calls };
};

describe('createApiClient', () => {
  test('maps every operation to its route and encodes path parts', async () => {
    const { client, calls } = build();
    await client.share('k', 'v');
    await client.save('a/b', 'v');
    await client.linkFor('a/b');
    await client.remove('a/b');
    await client.saveSettings(30);
    await client.revokeToken('abc');
    await client.removePasskey('c/d');
    await client.registerOptions('Ada');
    await client.registerVerify({ id: 'r' }, 'Laptop');
    await client.enrollVerify('c=', { id: 'r' }, 'Phone');
    await client.recoveryOptions('code');
    await client.approveDevice('x');
    expect(calls).toEqual([
      { method: 'POST', path: '/api/links', body: { key: 'k', value: 'v' } },
      { method: 'PUT', path: '/api/secrets/a%2Fb', body: { value: 'v' } },
      { method: 'POST', path: '/api/secrets/a%2Fb/link', body: undefined },
      { method: 'DELETE', path: '/api/secrets/a%2Fb', body: undefined },
      { method: 'PUT', path: '/api/settings', body: { linkTtlMinutes: 30 } },
      { method: 'DELETE', path: '/api/tokens/abc', body: undefined },
      { method: 'DELETE', path: '/api/passkeys/c%2Fd', body: undefined },
      { method: 'POST', path: '/api/passkeys/register/options', body: { name: 'Ada' } },
      { method: 'POST', path: '/api/passkeys/register/verify', body: { response: { id: 'r' }, label: 'Laptop' } },
      { method: 'POST', path: '/api/enrollments/c%3D/verify', body: { response: { id: 'r' }, label: 'Phone' } },
      { method: 'POST', path: '/api/recovery/options', body: { code: 'code' } },
      { method: 'POST', path: '/api/device/x/approve', body: {} },
    ]);
  });
});
