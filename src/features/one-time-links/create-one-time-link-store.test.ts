import { describe, expect, test } from 'bun:test';
import { createOneTimeLinkStore } from './create-one-time-link-store.ts';

const createFixture = () => {
  let currentTime = 0;
  let tokenCounter = 0;
  const store = createOneTimeLinkStore({
    ttlMs: 5 * 60 * 1000,
    now: () => currentTime,
    createToken: () => `token-${(tokenCounter += 1)}`,
  });
  const advance = (ms: number): void => {
    currentTime += ms;
  };
  return { store, advance };
};

describe('createOneTimeLinkStore', () => {
  test('issues a token and returns the value exactly once', async () => {
    const { store } = createFixture();
    const token = await store.issue('my-secret');
    expect(await store.consume(token)).toBe('my-secret');
    expect(await store.consume(token)).toBeUndefined();
  });

  test('returns undefined for an unknown token', async () => {
    const { store } = createFixture();
    expect(await store.consume('missing')).toBeUndefined();
  });

  test('expires values after the ttl', async () => {
    const { store, advance } = createFixture();
    const token = await store.issue('short-lived');
    advance(5 * 60 * 1000);
    expect(await store.consume(token)).toBeUndefined();
  });

  test('keeps values alive strictly before the ttl boundary', async () => {
    const { store, advance } = createFixture();
    const token = await store.issue('still-alive');
    advance(5 * 60 * 1000 - 1);
    expect(await store.consume(token)).toBe('still-alive');
  });

  test('isolates independently issued tokens', async () => {
    const { store } = createFixture();
    const first = await store.issue('first');
    const second = await store.issue('second');
    expect(await store.consume(second)).toBe('second');
    expect(await store.consume(first)).toBe('first');
  });

  test('peek reports a live token without consuming it', async () => {
    const { store } = createFixture();
    const token = await store.issue('still-here');
    expect(await store.peek(token)).toBe(true);
    expect(await store.peek(token)).toBe(true);
    expect(await store.consume(token)).toBe('still-here');
  });

  test('peek reports false for unknown, consumed and expired tokens', async () => {
    const { store, advance } = createFixture();
    expect(await store.peek('missing')).toBe(false);

    const consumed = await store.issue('used');
    await store.consume(consumed);
    expect(await store.peek(consumed)).toBe(false);

    const expired = await store.issue('old');
    advance(5 * 60 * 1000);
    expect(await store.peek(expired)).toBe(false);
  });

  test('sweeps expired entries from memory', async () => {
    const { store, advance } = createFixture();
    await store.issue('a');
    await store.issue('b');
    advance(5 * 60 * 1000);
    expect(store.size()).toBe(0);
  });
});
