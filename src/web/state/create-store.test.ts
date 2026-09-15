import { describe, expect, test } from 'bun:test';
import { createStore } from './create-store.ts';
import { withoutKey } from './without-key.ts';

describe('createStore', () => {
  test('notifies subscribers immediately and after each patch', () => {
    const store = createStore({ count: 0, label: 'a' });
    const seen: number[] = [];
    store.subscribe((state) => seen.push(state.count));
    store.patch({ count: 1 });
    store.patch({ label: 'b' });
    expect(seen).toEqual([0, 1, 1]);
    expect(store.get()).toEqual({ count: 1, label: 'b' });
  });
});

describe('withoutKey', () => {
  test('drops one entry and leaves the rest', () => {
    expect(withoutKey({ a: 1, b: 2 }, 'a')).toEqual({ b: 2 });
    expect(withoutKey({ a: 1 }, 'missing')).toEqual({ a: 1 });
  });
});
