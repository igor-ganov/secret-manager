import { describe, expect, test } from 'bun:test';
import { createSettingsStore } from './create-settings-store.ts';

const createStore = () => createSettingsStore(':memory:');

describe('createSettingsStore', () => {
  test('returns undefined before the user sets a lifetime', async () => {
    const store = createStore();
    expect(await store.getTtlMinutes(1)).toBeUndefined();
  });

  test('stores and reads back the chosen lifetime', async () => {
    const store = createStore();
    await store.setTtlMinutes(1, 15);
    expect(await store.getTtlMinutes(1)).toBe(15);
  });

  test('overwrites a previously chosen lifetime', async () => {
    const store = createStore();
    await store.setTtlMinutes(1, 5);
    await store.setTtlMinutes(1, 60);
    expect(await store.getTtlMinutes(1)).toBe(60);
  });

  test('isolates settings between users', async () => {
    const store = createStore();
    await store.setTtlMinutes(1, 5);
    await store.setTtlMinutes(2, 30);
    expect(await store.getTtlMinutes(1)).toBe(5);
    expect(await store.getTtlMinutes(2)).toBe(30);
  });
});
