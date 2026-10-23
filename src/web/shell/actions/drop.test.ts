import { describe, expect, test } from 'bun:test';
import type { AppState } from '../../state/app-state.ts';
import { createStore } from '../../state/create-store.ts';
import { initialState } from '../../state/initial-state.ts';
import { drop, type DropDeps } from './drop.ts';

const LINK = { url: 'https://x/s/t', curl: 'curl -X POST https://x/s/t', ttlMinutes: 15 };

const build = (ok: boolean) => {
  const store = createStore<AppState>({ ...initialState, session: { kind: 'anonymous' }, quickDraft: 'typed' });
  const calls: unknown[] = [];
  const deps: DropDeps = {
    store,
    api: {
      drop: async (value, ttlMinutes) => {
        calls.push([value, ttlMinutes]);
        return ok ? { ok: true, value: LINK } : { ok: false, error: 'Too many requests.' };
      },
    },
  };
  return { store, calls, action: drop(deps) };
};

describe('drop (web-quick-start AC-1.2–1.4)', () => {
  test('posts the drop, shows the link, clears the draft and keeps the lifetime', async () => {
    const { store, calls, action } = build(true);
    await action('typed', 15);
    expect(calls).toEqual([['typed', 15]]);
    const state = store.get();
    expect(state.notice).toEqual({ kind: 'link', intro: 'One-time link (nothing was saved):', link: LINK });
    expect(state.quickDraft).toBe('');
    expect(state.quickTtlMinutes).toBe(15);
    expect(state.error).toBeUndefined();
  });

  test('on failure shows the error and keeps the draft', async () => {
    const { store, action } = build(false);
    await action('typed', 15);
    expect(store.get().error).toBe('Too many requests.');
    expect(store.get().quickDraft).toBe('typed');
    expect(store.get().notice).toEqual({ kind: 'idle' });
  });
});
