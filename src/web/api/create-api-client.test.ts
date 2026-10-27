import { describe, expect, test } from 'bun:test';
import { createApiClient } from './create-api-client.ts';
import type { BytesSender } from './create-bytes-sender.ts';
import type { JsonRequester } from './create-json-requester.ts';

type Call = { readonly method: string; readonly path: string; readonly body: unknown };

const build = () => {
  const calls: Call[] = [];
  const request: JsonRequester = async (method, path, _decode, body) => {
    calls.push({ method, path, body });
    return { ok: false, error: 'stub' };
  };
  const sendBytes: BytesSender = async (method, path, bytes) => {
    calls.push({ method, path, body: new TextDecoder().decode(bytes) });
    return { ok: false, error: 'stub' };
  };
  return { client: createApiClient(request, sendBytes), calls };
};

describe('createApiClient', () => {
  test('maps every operation to its route and encodes path parts', async () => {
    const { client, calls } = build();
    await client.share('k', 'v');
    await client.drop('v', 15);
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
      { method: 'POST', path: '/api/drops', body: { value: 'v', ttlMinutes: 15 } },
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

describe('createApiClient files (secret-files AC-1.1, AC-1.2, AC-1.5–1.7)', () => {
  test('maps the chunked upload to its routes; parts go as raw bytes', async () => {
    const { client, calls } = build();
    await client.beginFile('a.txt', 3, 'text/plain');
    await client.dropFile('a.txt', 3, 'text/plain', 15);
    await client.putPart('u/1', 2, new TextEncoder().encode('abc'));
    await client.completeUpload('u/1');
    await client.abortUpload('u/1');
    expect(calls).toEqual([
      { method: 'POST', path: '/api/files', body: { name: 'a.txt', size: 3, contentType: 'text/plain' } },
      { method: 'POST', path: '/api/file-drops', body: { name: 'a.txt', size: 3, contentType: 'text/plain', ttlMinutes: 15 } },
      { method: 'PUT', path: '/api/uploads/u%2F1/parts/2', body: 'abc' },
      { method: 'POST', path: '/api/uploads/u%2F1/complete', body: undefined },
      { method: 'DELETE', path: '/api/uploads/u%2F1', body: undefined },
    ]);
  });
});
