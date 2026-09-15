import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { describe, expect, test } from 'bun:test';
import type { Actions } from './actions.ts';
import { formatDate } from './format-date.ts';
import { createH } from './h.ts';
import { renderApp } from './render-app.ts';
import { renderKeys } from './render-keys.ts';
import { renderSettings } from './render-settings.ts';
import { renderTokens } from './render-tokens.ts';
import { ttlLabel } from './ttl-label.ts';
import { initialState } from '../state/initial-state.ts';

GlobalRegistrator.register();
const h = createH(globalThis.document);

const calls: string[] = [];
const record =
  (name: string) =>
  (...args: readonly unknown[]) => {
    calls.push(`${name}:${args.join(',')}`);
    return Promise.resolve();
  };
const actions: Actions = {
  logout: record('logout'),
  share: record('share'),
  linkFor: record('linkFor'),
  setRowMode: (key, mode) => {
    calls.push(`setRowMode:${key},${mode}`);
  },
  saveValue: record('saveValue'),
  confirmDelete: record('confirmDelete'),
  setTtl: record('setTtl'),
  createToken: record('createToken'),
  revokeToken: record('revokeToken'),
  copy: record('copy'),
};

const container = (nodes: readonly Node[]) => h('div', {}, ...nodes);

describe('pure view helpers', () => {
  test('ttlLabel names a day and otherwise minutes', () => {
    expect(ttlLabel(1440)).toBe('1 day');
    expect(ttlLabel(15)).toBe('15 min');
  });

  test('formatDate renders a calendar date', () => {
    expect(formatDate(Date.UTC(2026, 0, 15, 12))).toMatch(/2026/);
  });
});

describe('renderKeys', () => {
  test('shows the empty message with no keys (AC-3.1)', () => {
    expect(renderKeys(h, actions, [], {}).textContent).toContain('You have no saved keys yet.');
  });

  test('renders a row per key with link, set and delete controls', () => {
    const section = renderKeys(h, actions, ['a', 'b'], {});
    expect(section.querySelectorAll('li')).toHaveLength(2);
    section.querySelector<HTMLButtonElement>('[aria-label="Link for a"]')?.click();
    section.querySelector<HTMLButtonElement>('[aria-label="Delete b"]')?.click();
    expect(calls.splice(0)).toEqual(['linkFor:a', 'setRowMode:b,deleting']);
  });

  test('renders the delete confirmation and the inline set form (AC-3.3, AC-3.4)', () => {
    const section = renderKeys(h, actions, ['a', 'b'], { a: 'deleting', b: 'setting' });
    expect(section.textContent).toContain('Delete “a”?');
    expect(section.querySelector('#set-b')).not.toBeUndefined();
  });
});

describe('renderSettings', () => {
  test('checks the current preset (AC-4.1)', () => {
    const section = renderSettings(h, actions, { linkTtlMinutes: 30, presets: [5, 30] });
    const checked = section.querySelectorAll<HTMLInputElement>('input[checked]');
    expect(checked).toHaveLength(1);
    expect(checked[0]?.value).toBe('30');
  });
});

describe('renderTokens', () => {
  test('marks the current session and offers revoke for the rest (AC-5.1)', () => {
    const section = renderTokens(h, actions, [
      { id: '1', label: 'web', createdAt: 0, current: true },
      { id: '2', label: 'laptop', createdAt: 0, current: false },
    ]);
    expect(section.textContent).toContain('current session');
    expect(section.querySelectorAll('button[aria-label^="Revoke"]')).toHaveLength(1);
  });
});

describe('renderApp', () => {
  test('renders the login link while anonymous and the workspace when signed in', () => {
    const anonymous = container(renderApp(h, actions, { ...initialState, session: { kind: 'anonymous', botId: 3 } }, 'https://x.test'));
    expect(anonymous.querySelector('a')?.getAttribute('href')).toContain('bot_id=3');
    const signedIn = container(
      renderApp(
        h,
        actions,
        { ...initialState, session: { kind: 'signed-in', botId: 3, user: { id: 1, name: 'Ada' } }, error: 'boom' },
        'https://x.test',
      ),
    );
    expect(signedIn.textContent).toContain('Ada');
    expect(signedIn.querySelector('[role="alert"]')?.textContent).toBe('boom');
    expect(signedIn.querySelector('[role="status"]')).not.toBeUndefined();
  });
});
