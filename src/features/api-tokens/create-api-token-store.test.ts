import { describe, expect, test } from 'bun:test';
import { createApiTokenStore } from './create-api-token-store.ts';

const build = () => {
  let counter = 0;
  return createApiTokenStore({
    databasePath: ':memory:',
    now: () => 1000 + counter,
    createToken: () => `token-${(counter += 1)}`,
  });
};

describe('createApiTokenStore', () => {
  test('creates a token that resolves to its user (AC-2.1, AC-3.1)', async () => {
    const store = build();
    const { token, record } = await store.create(1, 'cli');
    expect(token).toBe('token-1');
    expect(record.label).toBe('cli');
    expect(await store.resolve(token)).toEqual({ userId: 1, id: record.id });
  });

  test('stores only a hash, never the clear token (AC-2.4)', async () => {
    const store = build();
    const { token, record } = await store.create(1, 'cli');
    expect(record.id).not.toContain(token);
    expect(record.id).toMatch(/^[0-9a-f]{64}$/);
    const [listed] = await store.list(1);
    expect(JSON.stringify(listed)).not.toContain(token);
  });

  test('unknown tokens do not resolve', async () => {
    const store = build();
    expect(await store.resolve('nope')).toBeUndefined();
  });

  test('lists tokens per user in creation order (AC-3.2)', async () => {
    const store = build();
    await store.create(1, 'first');
    await store.create(2, 'other-user');
    await store.create(1, 'second');
    expect((await store.list(1)).map((record) => record.label)).toEqual(['first', 'second']);
  });

  test('revokes only tokens owned by the caller (AC-3.3)', async () => {
    const store = build();
    const { token, record } = await store.create(1, 'cli');
    expect(await store.revoke(2, record.id)).toBe(false);
    expect(await store.resolve(token)).toBeDefined();
    expect(await store.revoke(1, record.id)).toBe(true);
    expect(await store.resolve(token)).toBeUndefined();
    expect(await store.revoke(1, record.id)).toBe(false);
  });
});
