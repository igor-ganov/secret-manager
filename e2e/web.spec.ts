import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/* Locator contract with src/web (labels and headings are the UI's public API). */
const UI = {
  login: 'Log in with passkey',
  accountName: 'Account name',
  createAccount: 'Create account',
  recoveryCode: 'Recovery code',
  recover: 'Recover with code',
  logout: 'Log out',
  share: { key: 'Key (optional)', value: 'Value', submit: 'Get one-time link' },
  keys: { heading: 'Saved keys', empty: 'You have no saved keys yet.' },
  settings: { group: 'Link lifetime' },
  devices: { addDevice: 'Add a device', addHere: 'Add a passkey here', passkeyName: 'Passkey name', enrollHere: 'Add passkey on this device' },
} as const;

type Authenticator = { readonly replace: () => Promise<void> };

const OPTIONS = {
  protocol: 'ctap2',
  transport: 'internal',
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  automaticPresenceSimulation: true,
} as const;

/* A CTAP2 virtual authenticator with discoverable credentials and user
   verification, so the real WebAuthn code path runs without a person.
   `replace` swaps in an empty one — "a different device's key". */
const addAuthenticator = async (page: Page): Promise<Authenticator> => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const add = async (): Promise<string> =>
    (await cdp.send('WebAuthn.addVirtualAuthenticator', { options: OPTIONS })).authenticatorId;
  let current = await add();
  return {
    replace: async () => {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: current });
      current = await add();
    },
  };
};

const signUp = async (page: Page, name: string): Promise<{ code: string; authenticator: Authenticator }> => {
  const authenticator = await addAuthenticator(page);
  await page.goto('/');
  await page.getByLabel(UI.accountName).fill(name);
  await page.getByRole('button', { name: UI.createAccount }).click();
  await expect(page.getByRole('status')).toContainText('Your recovery code');
  const code = (await page.getByRole('status').locator('pre').textContent()) ?? '';
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  return { code, authenticator };
};

const shareValue = async (page: Page, key: string, value: string): Promise<void> => {
  await page.getByLabel(UI.share.key).fill(key);
  await page.getByLabel(UI.share.value, { exact: true }).fill(value);
  await page.getByRole('button', { name: UI.share.submit }).click();
};

test.describe('accounts (passkey-accounts)', () => {
  test('signup shows a recovery code once; logout and passkey login work (AC-1.1, AC-1.2, AC-2.1)', async ({ page }) => {
    const { code } = await signUp(page, 'Ada');
    expect(code).toMatch(/^([a-z0-9]{4}-){6}[a-z0-9]{4}$/);
    await page.getByRole('button', { name: UI.logout }).click();
    await expect(page.getByRole('button', { name: UI.login })).toBeVisible();
    await page.getByRole('button', { name: UI.login }).click();
    await expect(page.getByText('Ada', { exact: true })).toBeVisible();
    /* The live region is hidden while empty, so the code is gone for good. */
    await expect(page.locator('[role="status"]')).not.toContainText('recovery code');
  });

  test('a signed-out visitor sees only the sign-in choices (AC-2.1)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: UI.login })).toBeVisible();
    await expect(page.getByRole('heading', { name: UI.keys.heading })).toHaveCount(0);
  });

  test('recovery with the shown code enrols a new passkey and rotates the code (AC-4.1)', async ({ page }) => {
    const { code, authenticator } = await signUp(page, 'Grace');
    await page.getByRole('button', { name: UI.logout }).click();
    /* Every device is lost: the old key is gone, a new one will be created. */
    await authenticator.replace();
    await page.getByLabel(UI.recoveryCode).fill(code.toUpperCase());
    await page.getByRole('button', { name: UI.recover }).click();
    await expect(page.getByText('Grace', { exact: true })).toBeVisible();
    const fresh = (await page.getByRole('status').locator('pre').textContent()) ?? '';
    expect(fresh).not.toBe(code);
    await expect(page.getByRole('list').filter({ hasText: 'Recovered device' })).toBeVisible();
  });

  test('adds a passkey here and can remove all but the last (AC-3.4)', async ({ page }) => {
    const { authenticator } = await signUp(page, 'Linus');
    /* A second authenticator: the first one already holds a key for this
       account and correctly refuses a duplicate (excludeCredentials). */
    await authenticator.replace();
    await page.getByLabel(UI.devices.passkeyName).fill('Second key');
    await page.getByRole('button', { name: UI.devices.addHere }).click();
    await expect(page.getByRole('status')).toContainText('Passkey “Second key” added.');
    await page.getByRole('button', { name: 'Remove passkey Second key' }).click();
    await expect(page.getByRole('button', { name: /Remove passkey/ })).toHaveCount(0);
  });

  test('another device joins through the one-time link with a QR code (AC-3.1–3.3)', async ({ page, browser }) => {
    await signUp(page, 'Margaret');
    await page.getByRole('button', { name: UI.devices.addDevice }).click();
    const status = page.getByRole('status');
    await expect(status.getByRole('img', { name: 'QR code of the enrollment link' })).toBeVisible();
    const url = (await status.locator('pre').textContent()) ?? '';
    expect(url).toMatch(/#enroll=[A-Za-z0-9_-]{43}$/);

    const other: BrowserContext = await browser.newContext();
    const phone = await other.newPage();
    await addAuthenticator(phone);
    await phone.goto(url);
    await expect(phone.getByText('account “Margaret”')).toBeVisible();
    await phone.getByLabel('Device name').fill('Phone');
    await phone.getByRole('button', { name: UI.devices.enrollHere }).click();
    await expect(phone.getByText('Margaret', { exact: true })).toBeVisible();
    await expect(phone.getByRole('status')).toContainText('This device now has a passkey');
    await expect(phone.getByRole('button', { name: 'Remove passkey Phone' })).toBeVisible();

    const again = await other.newPage();
    await again.goto(url);
    await expect(again.getByRole('heading', { name: 'Add this device' })).toBeVisible();
    await expect(again.getByRole('button', { name: UI.devices.enrollHere })).toHaveCount(0);
    await other.close();
  });
});

test.describe('device login (device-login)', () => {
  test('a CLI request is approved on the site and only then yields a token (AC-2.x, AC-3.x)', async ({ page, request }) => {
    const started = await request.post('/api/device/start', { data: { label: 'laptop' } });
    const { url, pollToken } = await started.json();
    const poll = () => request.get('/api/device/poll', { headers: { 'x-poll-token': pollToken } });
    expect(await (await poll()).json()).toEqual({ status: 'pending' });

    await signUp(page, 'Ada');
    await page.goto(url);
    await expect(page.getByText('The console utility “laptop” asks to use your account.')).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByRole('status')).toContainText('Device approved');
    await expect(page).toHaveURL(/\/$/);

    const approved = await (await poll()).json();
    expect(approved.status).toBe('approved');
    const me = await request.get('/api/me', { headers: { authorization: `Bearer ${approved.token}` } });
    expect((await me.json()).name).toBe('Ada');
    await expect(page.getByRole('button', { name: 'Revoke laptop' })).toBeVisible();
  });

  test('a signed-out visitor is told to sign in first (AC-3.1)', async ({ page, request }) => {
    const { url } = await (await request.post('/api/device/start', { data: { label: 'laptop' } })).json();
    await page.goto(url);
    await expect(page.getByText('A device is asking for access. Sign in to review and approve it.')).toBeVisible();
  });
});

test.describe('workspace (web-app)', () => {
  test('shares an unsaved value (AC-2.2, AC-2.5)', async ({ page }) => {
    await signUp(page, 'Ada');
    await shareValue(page, '', 'ephemeral-secret');
    const result = page.getByRole('status');
    await expect(result).toContainText('/s/');
    await expect(result).toContainText('curl -X POST');
    await expect(result).toContainText('Valid for 5 minutes, opens once.');
    await expect(page.getByLabel(UI.share.value, { exact: true })).toHaveValue('');
    await expect(page.getByText(UI.keys.empty)).toBeVisible();
  });

  test('saves a pair, then links, sets and deletes it (AC-2.3, AC-3.x)', async ({ page }) => {
    await signUp(page, 'Ada');
    await shareValue(page, 'db-password', 'hunter2');
    const row = page.getByRole('listitem').filter({ hasText: 'db-password' });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Link' }).click();
    await expect(page.getByRole('status')).toContainText('/s/');
    await row.getByRole('button', { name: 'Set' }).click();
    await row.getByLabel('New value for db-password').fill('hunter3');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('“db-password” has been updated.');
    await row.getByRole('button', { name: 'Delete' }).click();
    await row.getByRole('button', { name: 'Yes, delete' }).click();
    await expect(page.getByText(UI.keys.empty)).toBeVisible();
  });

  test('rejects an invalid key and changes the link lifetime (AC-2.4, AC-4.1)', async ({ page }) => {
    await signUp(page, 'Ada');
    await shareValue(page, 'a'.repeat(63), 'v');
    await expect(page.getByRole('alert')).toContainText('Key must be');
    const group = page.getByRole('radiogroup', { name: UI.settings.group });
    await group.getByRole('radio', { name: '30 min', exact: true }).check();
    await expect(page.getByRole('status')).toContainText('30 minutes');
    await shareValue(page, '', 'v');
    await expect(page.getByRole('status')).toContainText('Valid for 30 minutes, opens once.');
  });

  test('is operable with the keyboard alone (AC-6.1)', async ({ page }) => {
    await signUp(page, 'Ada');
    await page.getByLabel(UI.share.value, { exact: true }).focus();
    await page.keyboard.type('typed-secret');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: UI.share.submit })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('/s/');
  });
});
