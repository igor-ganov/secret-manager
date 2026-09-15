import { describe, expect, test } from 'bun:test';
import { createEnrollmentStore } from '../enrollment/create-enrollment-store.ts';
import { createLoginRequestStore } from '../device-login/create-login-request-store.ts';
import { createTelegramLinkStore } from '../device-login/create-telegram-link-store.ts';
import { createChallengeStore } from '../passkeys/create-challenge-store.ts';
import { createPasskeyStore } from '../passkeys/create-passkey-store.ts';
import type { PasskeyRecord } from '../passkeys/passkey-store.ts';
import { createSecretStore } from '../secrets/create-secret-store.ts';
import { createSettingsStore } from '../settings/create-settings-store.ts';
import { createAccountStore } from './create-account-store.ts';

const ACCOUNT = 2 ** 40 + 5;
const clock = { now: 1000 };
const now = () => clock.now;

const passkey = (credentialId: string, accountId = ACCOUNT): PasskeyRecord => ({
  credentialId,
  accountId,
  publicKey: 'pk',
  counter: 0,
  transports: ['internal'],
  backedUp: false,
  label: 'Chrome',
  createdAt: 1,
});

describe('account and passkey stores (AC-1.1, AC-2.2, AC-4.1)', () => {
  test('stores accounts, handles and recovery hashes', async () => {
    const accounts = createAccountStore(':memory:');
    await accounts.create({ id: ACCOUNT, name: 'Ada', userHandle: 'h', recoveryHash: 'r1', createdAt: 1 });
    expect(await accounts.get(ACCOUNT)).toEqual({ id: ACCOUNT, name: 'Ada' });
    expect(await accounts.userHandleOf(ACCOUNT)).toBe('h');
    expect(await accounts.findByRecoveryHash('r1')).toBe(ACCOUNT);
    await accounts.setRecoveryHash(ACCOUNT, 'r2');
    expect(await accounts.findByRecoveryHash('r1')).toBeUndefined();
    expect(await accounts.findByRecoveryHash('r2')).toBe(ACCOUNT);
    expect(await accounts.get(1)).toBeUndefined();
  });

  test('stores passkeys per account, updates counters, removes only owned ones', async () => {
    const passkeys = createPasskeyStore(':memory:');
    await passkeys.add(passkey('c1'));
    await passkeys.add(passkey('c2', ACCOUNT + 1));
    expect(await passkeys.find('c1')).toEqual(passkey('c1'));
    expect((await passkeys.listByAccount(ACCOUNT)).map((record) => record.credentialId)).toEqual(['c1']);
    await passkeys.updateCounter('c1', 7, true);
    expect(await passkeys.find('c1')).toMatchObject({ counter: 7, backedUp: true });
    expect(await passkeys.remove(ACCOUNT, 'c2')).toBe(false);
    expect(await passkeys.remove(ACCOUNT, 'c1')).toBe(true);
    expect(await passkeys.find('c1')).toBeUndefined();
  });
});

describe('challenge store (AC-2.3)', () => {
  test('challenges are single-use and expire', async () => {
    const challenges = createChallengeStore({ databasePath: ':memory:', now });
    await challenges.put({ challenge: 'a', flow: 'register', accountId: undefined, payload: '{}', expiresAt: 2000 });
    await challenges.put({ challenge: 'b', flow: 'add', accountId: ACCOUNT, payload: '{}', expiresAt: 1500 });
    expect(await challenges.take('a')).toMatchObject({ flow: 'register', accountId: undefined });
    expect(await challenges.take('a')).toBeUndefined();
    clock.now = 1600;
    expect(await challenges.take('b')).toBeUndefined();
  });
});

describe('enrollment store (AC-3.1–3.3)', () => {
  test('links are consumed once and expire', async () => {
    clock.now = 1000;
    const enrollments = createEnrollmentStore({ databasePath: ':memory:', now });
    await enrollments.create('h1', ACCOUNT, 2000);
    expect(await enrollments.peek('h1')).toBe(ACCOUNT);
    expect(await enrollments.consume('h1')).toBe(ACCOUNT);
    expect(await enrollments.consume('h1')).toBeUndefined();
    await enrollments.create('h2', ACCOUNT, 1200);
    clock.now = 1300;
    expect(await enrollments.peek('h2')).toBeUndefined();
  });
});

describe('login request store (device-login AC-2.4, AC-3.2, AC-3.3)', () => {
  const request = { codeHash: 'code', pollHash: 'poll', kind: 'cli' as const, label: 'laptop', subject: 'laptop', expiresAt: 2000 };

  test('approval hands the token to the poller exactly once', async () => {
    clock.now = 1000;
    const requests = createLoginRequestStore({ databasePath: ':memory:', now });
    await requests.create(request);
    expect(await requests.peek('code')).toEqual({ kind: 'cli', label: 'laptop', subject: 'laptop', status: 'pending' });
    expect(await requests.poll('poll')).toEqual({ status: 'pending' });
    expect(await requests.approve('code', ACCOUNT, 'tok')).toBe(true);
    expect(await requests.approve('code', ACCOUNT, 'tok')).toBe(false);
    expect(await requests.poll('poll')).toEqual({ status: 'approved', token: 'tok' });
    expect(await requests.poll('poll')).toBeUndefined();
    expect(await requests.poll('code')).toBeUndefined();
  });

  test('denied and expired requests vanish for the poller', async () => {
    clock.now = 1000;
    const requests = createLoginRequestStore({ databasePath: ':memory:', now });
    await requests.create(request);
    expect(await requests.deny('code')).toBe(true);
    expect(await requests.poll('poll')).toBeUndefined();
    expect(await requests.peek('code')).toMatchObject({ status: 'denied' });
    await requests.create({ ...request, codeHash: 'c2', pollHash: 'p2', expiresAt: 1100 });
    clock.now = 1200;
    expect(await requests.poll('p2')).toBeUndefined();
    expect(await requests.approve('c2', ACCOUNT, 't')).toBe(false);
  });
});

describe('telegram links and legacy migration (device-login AC-1.2)', () => {
  test('links a chat and moves legacy rows to the account', async () => {
    const links = createTelegramLinkStore(':memory:');
    const secrets = createSecretStore(':memory:');
    const settings = createSettingsStore(':memory:');
    await secrets.save(123, 'k', 'legacy');
    await secrets.save(ACCOUNT, 'k', 'account-wins');
    await secrets.save(123, 'only-legacy', 'v');
    await settings.setTtlMinutes(123, 30);

    await links.link(123, ACCOUNT, 5);
    await secrets.reassign(123, ACCOUNT);
    await settings.reassign(123, ACCOUNT);

    expect(await links.accountFor(123)).toBe(ACCOUNT);
    expect(await links.telegramUserFor(ACCOUNT)).toBe(123);
    expect(await secrets.list(ACCOUNT)).toEqual(['k', 'only-legacy']);
    expect(await secrets.read(ACCOUNT, 'k')).toBe('account-wins');
    expect(await settings.getTtlMinutes(ACCOUNT)).toBe(30);
    await links.unlink(123);
    expect(await links.accountFor(123)).toBeUndefined();
  });
});
