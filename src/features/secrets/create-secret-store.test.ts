import { describe, expect, test } from 'bun:test';
import { createSecretStore } from './create-secret-store.ts';

const createStore = () => createSecretStore(':memory:');

describe('createSecretStore', () => {
  test('saves and reads a value', async () => {
    const store = createStore();
    await store.save(1, 'api-key', 'value-1');
    expect(await store.read(1, 'api-key')).toBe('value-1');
  });

  test('returns undefined for a missing key', async () => {
    const store = createStore();
    expect(await store.read(1, 'missing')).toBeUndefined();
  });

  test('overwrites an existing value', async () => {
    const store = createStore();
    await store.save(1, 'api-key', 'old');
    await store.save(1, 'api-key', 'new');
    expect(await store.read(1, 'api-key')).toBe('new');
  });

  test('lists keys sorted alphabetically', async () => {
    const store = createStore();
    await store.save(1, 'zebra', 'z');
    await store.save(1, 'alpha', 'a');
    expect(await store.list(1)).toEqual(['alpha', 'zebra']);
  });

  test('removes a key', async () => {
    const store = createStore();
    await store.save(1, 'api-key', 'value');
    await store.remove(1, 'api-key');
    expect(await store.read(1, 'api-key')).toBeUndefined();
    expect(await store.list(1)).toEqual([]);
  });

  test('isolates secrets between users', async () => {
    const store = createStore();
    await store.save(1, 'shared-key', 'belongs-to-user-1');
    await store.save(2, 'shared-key', 'belongs-to-user-2');
    await store.save(2, 'extra', 'only-user-2');
    expect(await store.read(1, 'shared-key')).toBe('belongs-to-user-1');
    expect(await store.read(2, 'shared-key')).toBe('belongs-to-user-2');
    expect(await store.list(1)).toEqual(['shared-key']);
    expect(await store.list(2)).toEqual(['extra', 'shared-key']);
    await store.remove(1, 'shared-key');
    expect(await store.read(2, 'shared-key')).toBe('belongs-to-user-2');
  });
});
