import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { describe, expect, test } from 'bun:test';
import type { Actions } from './actions.ts';
import { formatDate } from './format-date.ts';
import { createH } from './h.ts';
import { renderApp } from './render-app.ts';
import { renderDevices } from './render-devices.ts';
import { renderKeys } from './render-keys.ts';
import { renderLinkCard } from './render-link-card.ts';
import { renderNotice } from './render-notice.ts';
import { renderSettings } from './render-settings.ts';
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
  continueWithPasskey: record('continueWithPasskey'),
  signUp: record('signUp'),
  recover: record('recover'),
  enrollHere: record('enrollHere'),
  approveDevice: record('approveDevice'),
  denyDevice: record('denyDevice'),
  addPasskeyHere: record('addPasskeyHere'),
  removePasskey: record('removePasskey'),
  createEnrollment: record('createEnrollment'),
  unlinkTelegram: record('unlinkTelegram'),
  revokeToken: record('revokeToken'),
  logout: record('logout'),
  share: record('share'),
  linkFor: record('linkFor'),
  setRowMode: (key, mode) => {
    calls.push(`setRowMode:${key},${mode}`);
  },
  saveValue: record('saveValue'),
  confirmDelete: record('confirmDelete'),
  setTtl: record('setTtl'),
  copy: record('copy'),
};

const container = (nodes: readonly Node[]) => h('div', {}, ...nodes);
const signedIn = { ...initialState, session: { kind: 'signed-in' as const, user: { id: 1, name: 'Ada' } } };

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

describe('renderDevices (device-login AC-4.1)', () => {
  test('lists passkeys (no Remove on the last one), Telegram state and sessions', () => {
    const one = renderDevices(h, actions, { passkeys: [{ id: 'p1', label: 'Laptop', createdAt: 0, backedUp: true }], telegram: { linked: true }, tokens: [{ id: 't', label: 'web', createdAt: 0, current: true }] }, 'Chrome');
    expect(one.querySelectorAll('button[aria-label^="Remove passkey"]')).toHaveLength(0);
    expect(one.textContent).toContain('synced');
    expect(one.textContent).toContain('Unlink Telegram');
    expect(one.textContent).toContain('this browser session');
    const two = renderDevices(h, actions, { passkeys: [{ id: 'p1', label: 'Laptop', createdAt: 0, backedUp: false }, { id: 'p2', label: 'Phone', createdAt: 0, backedUp: false }], telegram: { linked: false }, tokens: [] }, 'Chrome');
    expect(two.querySelectorAll('button[aria-label^="Remove passkey"]')).toHaveLength(2);
    expect(two.textContent).toContain('not linked');
    two.querySelector<HTMLButtonElement>('[aria-label="Remove passkey Phone"]')?.click();
    expect(calls.splice(0)).toEqual(['removePasskey:p2']);
  });
});

describe('renderLinkCard and renderNotice', () => {
  test('shows the asking device with Approve/Deny only on the link route', () => {
    const card = container(renderLinkCard(h, actions, { kind: 'link', code: 'c' }, { kind: 'cli', label: 'laptop' }));
    expect(card.textContent).toContain('The console utility “laptop” asks to use your account.');
    card.querySelector<HTMLButtonElement>('button')?.click();
    expect(calls.splice(0)).toEqual(['approveDevice:c']);
    expect(container(renderLinkCard(h, actions, { kind: 'link', code: 'c' }, undefined)).textContent).toContain('expired');
    expect(renderLinkCard(h, actions, { kind: 'home' }, undefined)).toHaveLength(0);
  });

  test('renders recovery codes and enrollment links with a QR image', () => {
    expect(renderNotice(h, actions, { kind: 'recovery', code: 'abcd-efgh' }).textContent).toContain('abcd-efgh');
    const enrollment = renderNotice(h, actions, { kind: 'enrollment', enrollment: { url: 'https://x/#enroll=c', qr: 'data:image/svg+xml;base64,AA==', expiresAt: 0 } });
    expect(enrollment.querySelector('img')?.getAttribute('src')).toBe('data:image/svg+xml;base64,AA==');
    expect(enrollment.textContent).toContain('https://x/#enroll=c');
  });
});

describe('renderApp', () => {
  test('renders the login card while anonymous, the enroll page on that route, and the workspace when signed in', () => {
    const anonymous = container(renderApp(h, actions, { ...initialState, session: { kind: 'anonymous' } }));
    expect(anonymous.textContent).toContain('Continue with passkey');
    expect(anonymous.textContent).not.toContain('Create a new account');
    expect(anonymous.textContent).toContain('Lost every device?');
    const afterPrompt = container(renderApp(h, actions, { ...initialState, session: { kind: 'anonymous' }, loginAttempted: true }));
    /* The recovery submit is a form submission (not exercised by click here). */
    afterPrompt.querySelectorAll<HTMLButtonElement>('button[type="button"]').forEach((button) => button.click());
    expect(calls.splice(0)).toEqual(['continueWithPasskey:', 'signUp:']);
    const enroll = container(renderApp(h, actions, { ...initialState, session: { kind: 'anonymous' }, route: { kind: 'enroll', code: 'c' }, enrollmentInfo: { accountName: 'Ada' } }));
    expect(enroll.textContent).toContain('account “Ada”');
    const workspace = container(renderApp(h, actions, { ...signedIn, error: 'boom' }));
    expect(workspace.textContent).toContain('Ada');
    expect(workspace.textContent).toContain('Devices');
    expect(workspace.querySelector('[role="alert"]')?.textContent).toBe('boom');
  });
});
