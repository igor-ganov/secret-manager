import { describe, expect, test } from 'bun:test';
import { createPendingSetStore } from './create-pending-set-store.ts';

describe('createPendingSetStore', () => {
  test('begins and takes a pending set exactly once', async () => {
    const store = createPendingSetStore();
    await store.begin(1, 'api-key');
    expect(await store.take(1)).toBe('api-key');
    expect(await store.take(1)).toBeUndefined();
  });

  test('returns undefined when nothing is pending', async () => {
    const store = createPendingSetStore();
    expect(await store.take(1)).toBeUndefined();
  });

  test('cancel clears the pending set', async () => {
    const store = createPendingSetStore();
    await store.begin(1, 'api-key');
    await store.cancel(1);
    expect(await store.take(1)).toBeUndefined();
  });

  test('keeps pending sets isolated per user', async () => {
    const store = createPendingSetStore();
    await store.begin(1, 'key-of-user-1');
    await store.begin(2, 'key-of-user-2');
    expect(await store.take(2)).toBe('key-of-user-2');
    expect(await store.take(1)).toBe('key-of-user-1');
  });

  test('the latest begin wins for the same user', async () => {
    const store = createPendingSetStore();
    await store.begin(1, 'first');
    await store.begin(1, 'second');
    expect(await store.take(1)).toBe('second');
  });
});
