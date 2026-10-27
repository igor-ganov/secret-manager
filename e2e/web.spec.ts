import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* Locator contract with src/web (labels and headings are the UI's public API). */
const UI = {
  continue: 'Continue with passkey',
  account: 'Account (optional)',
  quick: { secret: 'Secret', lifetime: 'Link lifetime', submit: 'Get one-time link' },
  recoveryHeading: 'Lost every device?',
  recoveryCode: 'Recovery code',
  recover: 'Recover with code',
  logout: 'Log out',
  share: { key: 'Key (optional)', value: 'Value', submit: 'Get one-time link' },
  keys: { heading: 'Saved keys', empty: 'You have no saved keys yet.' },
  settings: { group: 'Link lifetime' },
  devices: { addDevice: 'Add a device', addHere: 'Add a passkey here', passkeyName: 'Passkey name', enrollHere: 'Add passkey on this device' },
} as const;

type Authenticator = { readonly replace: () => Promise<void>; readonly remove: () => Promise<void> };

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
    remove: () => cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: current }),
  };
};

/* Accounts are named "My account"; every test signs up a fresh one. */
const NAME = 'My account';

/* The single entry point: with no passkey on this authenticator the login
   prompt ends without a credential and the account is created right away. */
const signUp = async (page: Page): Promise<{ code: string; authenticator: Authenticator }> => {
  const authenticator = await addAuthenticator(page);
  await page.goto('/');
  /* The account is opt-in: the passkey button sits in a collapsed section. */
  await page.getByText(UI.account).click();
  await page.getByRole('button', { name: UI.continue }).click();
  await expect(page.getByRole('status')).toContainText('Your recovery code');
  const code = (await page.getByRole('status').locator('pre').textContent()) ?? '';
  await expect(page.getByText(NAME, { exact: true })).toBeVisible();
  return { code, authenticator };
};

const shareValue = async (page: Page, key: string, value: string): Promise<void> => {
  await page.getByLabel(UI.share.key).fill(key);
  await page.getByLabel(UI.share.value, { exact: true }).fill(value);
  await page.getByRole('button', { name: UI.share.submit }).click();
};

test.describe('accounts (passkey-accounts)', () => {
  test('signup shows a recovery code once; logout and passkey login work (AC-1.1, AC-1.2, AC-2.1)', async ({ page }) => {
    const { code } = await signUp(page);
    expect(code).toMatch(/^([a-z0-9]{4}-){6}[a-z0-9]{4}$/);
    await page.getByRole('button', { name: UI.logout }).click();
    /* Logging out lands on the quick start; the account section is collapsed again. */
    await expect(page.getByLabel(UI.quick.secret, { exact: true })).toBeVisible();
    await page.getByText(UI.account).click();
    await page.getByRole('button', { name: UI.continue }).click();
    await expect(page.getByText(NAME, { exact: true })).toBeVisible();
    /* The live region is hidden while empty, so the code is gone for good. */
    await expect(page.locator('[role="status"]')).not.toContainText('recovery code');
  });

  test('a signed-out visitor sees one sign-in entry point, behind the opt-in account section (AC-2.1, web-quick-start AC-2.1–2.2)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: UI.continue })).toBeHidden();
    await page.getByText(UI.account).click();
    await expect(page.getByRole('button', { name: UI.continue })).toBeVisible();
    /* The recovery form stays collapsed: one passkey button, nothing else to sign in with. */
    await expect(page.getByRole('button', { name: UI.continue })).toHaveCount(1);
    await expect(page.getByRole('button', { name: UI.recover })).toBeHidden();
    await expect(page.getByRole('heading', { name: UI.keys.heading })).toHaveCount(0);
  });

  test('recovery with the shown code enrols a new passkey and rotates the code (AC-4.1)', async ({ page }) => {
    const { code, authenticator } = await signUp(page);
    await page.getByRole('button', { name: UI.logout }).click();
    /* Every device is lost: the old key is gone, a new one will be created. */
    await authenticator.replace();
    await page.getByText(UI.account).click();
    await page.getByText(UI.recoveryHeading).click();
    await page.getByLabel(UI.recoveryCode).fill(code.toUpperCase());
    await page.getByRole('button', { name: UI.recover }).click();
    await expect(page.getByText(NAME, { exact: true })).toBeVisible();
    const fresh = (await page.getByRole('status').locator('pre').textContent()) ?? '';
    expect(fresh).not.toBe(code);
    await expect(page.getByRole('list').filter({ hasText: 'Recovered device' })).toBeVisible();
  });

  test('adds a passkey here and can remove all but the last (AC-3.4)', async ({ page }) => {
    const { authenticator } = await signUp(page);
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
    await signUp(page);
    await page.getByRole('button', { name: UI.devices.addDevice }).click();
    const status = page.getByRole('status');
    await expect(status.getByRole('img', { name: 'QR code of the enrollment link' })).toBeVisible();
    const url = (await status.locator('pre').textContent()) ?? '';
    expect(url).toMatch(/#enroll=[A-Za-z0-9_-]{43}$/);

    const other: BrowserContext = await browser.newContext();
    const phone = await other.newPage();
    await addAuthenticator(phone);
    await phone.goto(url);
    await expect(phone.getByText(`account “${NAME}”`)).toBeVisible();
    await phone.getByLabel('Device name').fill('Phone');
    await phone.getByRole('button', { name: UI.devices.enrollHere }).click();
    await expect(phone.getByText(NAME, { exact: true })).toBeVisible();
    await expect(phone.getByRole('status')).toContainText('This device now has a passkey');
    await expect(phone.getByRole('button', { name: 'Remove passkey Phone' })).toBeVisible();

    const again = await other.newPage();
    await again.goto(url);
    await expect(again.getByRole('heading', { name: 'Add this device' })).toBeVisible();
    await expect(again.getByRole('button', { name: UI.devices.enrollHere })).toHaveCount(0);
    await other.close();
  });
});

const isAddressInfo = (value: unknown): value is AddressInfo => value instanceof Object && 'port' in value;

/* Stands in for the console utility's loopback listener. */
const listen = async (): Promise<{ callback: string; grant: Promise<string>; close: () => void }> => {
  let settle: (grant: string) => void = () => undefined;
  const grant = new Promise<string>((resolve) => {
    settle = resolve;
  });
  const server = createServer((req, res) => {
    settle(new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('grant') ?? '');
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<title>Device linked</title><h1>Device linked</h1>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = isAddressInfo(address) ? address.port : 0;
  return { callback: `http://127.0.0.1:${port}/callback`, grant, close: () => server.close() };
};

test.describe('device login (device-login)', () => {
  test('the link asks for the passkey at once, approves, shows the code and returns to the device (AC-2.x, AC-3.x)', async ({ page, request }) => {
    const listener = await listen();
    const started = await request.post('/api/device/start', { data: { label: 'laptop', callback: listener.callback } });
    const { url, deviceSecret } = await started.json();

    const { authenticator } = await signUp(page);
    /* Already signed in: no passkey is needed, so no authenticator either. */
    await authenticator.remove();
    await page.goto(url);
    /* No button pressed: the page approved on load and moved on to the device. */
    await expect(page.getByRole('heading', { name: 'Device linked' })).toBeVisible();
    const grant = await listener.grant;
    expect(grant).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    listener.close();

    const claimed = await request.post('/api/device/claim', { data: { grant }, headers: { 'x-device-secret': deviceSecret } });
    expect(claimed.status()).toBe(200);
    const { token } = await claimed.json();
    const me = await request.get('/api/me', { headers: { authorization: `Bearer ${token}` } });
    expect((await me.json()).name).toBe(NAME);

    /* Coming back to the link shows the fallback code again. */
    await page.goto(url);
    await expect(page.getByText('Approved: “laptop” can use your account.')).toBeVisible();
    await expect(page.locator('pre')).toHaveText(grant);
  });

  test('without a session the link asks for the passkey; without a callback the code on the page is the way back (AC-3.1, AC-3.2)', async ({ page, request }) => {
    const { url, deviceSecret } = await (await request.post('/api/device/start', { data: { label: 'laptop' } })).json();
    await signUp(page);
    await page.getByRole('button', { name: UI.logout }).click();
    await page.goto(url);
    await expect(page.getByText('Approved: “laptop” can use your account.')).toBeVisible();
    const grant = (await page.locator('pre').textContent()) ?? '';
    const claimed = await request.post('/api/device/claim', { data: { grant: grant.toUpperCase() }, headers: { 'x-device-secret': deviceSecret } });
    expect(claimed.status()).toBe(200);
    expect((await request.post('/api/device/claim', { data: { grant }, headers: { 'x-device-secret': deviceSecret } })).status()).toBe(410);
  });

  test('a visitor without a passkey on this device gets a retry button, nothing else (AC-3.1)', async ({ page, request }) => {
    const { url } = await (await request.post('/api/device/start', { data: { label: 'laptop' } })).json();
    await addAuthenticator(page);
    await page.goto(url);
    await expect(page.getByRole('button', { name: 'Continue with passkey' })).toBeVisible();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});

test.describe('workspace (web-app)', () => {
  test('shares an unsaved value (AC-2.2, AC-2.5)', async ({ page }) => {
    await signUp(page);
    await shareValue(page, '', 'ephemeral-secret');
    const result = page.getByRole('status');
    await expect(result).toContainText('/s/');
    await expect(result).toContainText('curl -X POST');
    await expect(result).toContainText('Valid for 5 minutes, opens once.');
    await expect(page.getByLabel(UI.share.value, { exact: true })).toHaveValue('');
    await expect(page.getByText(UI.keys.empty)).toBeVisible();
  });

  test('saves a pair, then links, sets and deletes it (AC-2.3, AC-3.x)', async ({ page }) => {
    await signUp(page);
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
    await signUp(page);
    await shareValue(page, 'a'.repeat(63), 'v');
    await expect(page.getByRole('alert')).toContainText('Key must be');
    const group = page.getByRole('radiogroup', { name: UI.settings.group });
    await group.getByRole('radio', { name: '30 min', exact: true }).check();
    await expect(page.getByRole('status')).toContainText('30 minutes');
    await shareValue(page, '', 'v');
    await expect(page.getByRole('status')).toContainText('Valid for 30 minutes, opens once.');
  });

  test('is operable with the keyboard alone (AC-6.1)', async ({ page }) => {
    await signUp(page);
    await page.getByLabel(UI.share.value, { exact: true }).focus();
    await page.keyboard.type('typed-secret');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: UI.share.submit })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('/s/');
  });
});

const quickStart = async (page: Page, secret: string, lifetime: string): Promise<void> => {
  await page.getByLabel(UI.quick.secret, { exact: true }).fill(secret);
  await page.getByRole('radiogroup', { name: UI.quick.lifetime }).getByRole('radio', { name: lifetime, exact: true }).check();
  await page.getByRole('button', { name: UI.quick.submit }).click();
};

test.describe('quick start (web-quick-start)', () => {
  test('a visitor gets a link that opens once, with the chosen lifetime kept (AC-1.1–1.3, AC-1.5)', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.getByLabel(UI.quick.secret, { exact: true })).toBeVisible();
    const lifetime = page.getByRole('radiogroup', { name: UI.quick.lifetime });
    await expect(lifetime.getByRole('radio', { name: '5 min', exact: true })).toBeChecked();
    await quickStart(page, 'quick-secret', '15 min');
    const result = page.getByRole('status');
    await expect(result).toContainText('Valid for 15 minutes, opens once.');
    await expect(page.getByLabel(UI.quick.secret, { exact: true })).toHaveValue('');
    await expect(lifetime.getByRole('radio', { name: '15 min', exact: true })).toBeChecked();
    const url = (await result.locator('pre').first().textContent()) ?? '';
    expect(url).toContain('/s/');
    const opened = await request.post(url);
    expect(opened.status()).toBe(200);
    expect(await opened.text()).toContain('quick-secret');
    expect((await request.post(url)).status()).toBe(410);
  });

  test('a rejected drop shows the error and keeps the draft (AC-1.4)', async ({ page }) => {
    await page.goto('/');
    await page.route('**/api/drops', (route) => route.fulfill({ status: 400, json: { error: 'Value must be a non-empty string.' } }));
    await quickStart(page, 'kept-draft', '1 min');
    await expect(page.getByRole('alert')).toContainText('Value must be');
    await expect(page.getByLabel(UI.quick.secret, { exact: true })).toHaveValue('kept-draft');
  });

  test('is operable with the keyboard alone (AC-3.1)', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(UI.quick.secret, { exact: true }).focus();
    await page.keyboard.type('typed-secret');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radiogroup', { name: UI.quick.lifetime }).getByRole('radio', { name: '5 min', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: UI.quick.submit })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('/s/');
  });
});

/* Locators of the file feature (secret-files design §6). */
const FILES = {
  pick: 'Attach a file',
  remove: 'Remove file',
  progress: /^Uploading /,
  download: 'Download file',
  quickForm: 'Quick start',
} as const;

const MIB = 1024 * 1024;
/* Two parts: 8 MiB and the rest, so the multi-part path runs end to end. */
const twoPartFile = (): Buffer => {
  const content = Buffer.alloc(9 * MIB, 7);
  content.write('first-part', 0);
  content.write('last-part', 9 * MIB - 9);
  return content;
};

test.describe('secret files (secret-files)', () => {
  test('a visitor uploads a file in parts with progress; the link downloads it once under its own name (AC-2.1–2.3, AC-4.1, AC-4.3)', async ({ page, browser, request }) => {
    const content = twoPartFile();
    await page.goto('/');
    await page.getByLabel(FILES.pick).setInputFiles({ name: 'backup.bin', mimeType: 'application/octet-stream', buffer: content });
    await expect(page.getByText('backup.bin (9.0 MiB)')).toBeVisible();
    /* The file replaces the text field until it is removed. */
    await expect(page.getByLabel(UI.quick.secret, { exact: true })).toHaveCount(0);
    await page.getByRole('radiogroup', { name: UI.quick.lifetime }).getByRole('radio', { name: '15 min', exact: true }).check();

    /* Hold the second part until the first one shows up in the progress bar. */
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/parts/2', async (route) => {
      await gate;
      await route.continue();
    });
    await page.getByRole('button', { name: UI.quick.submit }).click();
    const bar = page.getByRole('status').getByRole('progressbar', { name: FILES.progress });
    await expect(bar).toHaveAttribute('value', String(8 * MIB));
    await expect(bar).toHaveAttribute('max', String(9 * MIB));
    release();

    const result = page.getByRole('status');
    await expect(result).toContainText('Valid for 15 minutes, opens once.');
    await expect(result).toContainText('curl -X POST -OJ');
    await expect(page.getByText('backup.bin (9.0 MiB)')).toHaveCount(0);
    const url = (await result.locator('pre').first().textContent()) ?? '';
    expect(url).toContain('/s/');

    const recipient = await (await browser.newContext()).newPage();
    await recipient.goto(url);
    await expect(recipient.getByText('backup.bin')).toBeVisible();
    await expect(recipient.getByText('9.0 MiB')).toBeVisible();
    const downloading = recipient.waitForEvent('download');
    await recipient.getByRole('button', { name: FILES.download }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('backup.bin');
    const saved = await download.path();
    const received = await readFile(saved);
    expect(received.equals(content)).toBe(true);
    expect((await request.post(url)).status()).toBe(410);
  });

  test('a file dropped onto the form becomes the secret (AC-4.1)', async ({ page, request }) => {
    await page.goto('/');
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['dropped-content'], 'dropped.txt', { type: 'text/plain' }));
      return transfer;
    });
    await page.getByRole('form', { name: FILES.quickForm }).dispatchEvent('drop', { dataTransfer });
    await expect(page.getByText('dropped.txt (15 B)')).toBeVisible();
    await page.getByRole('button', { name: UI.quick.submit }).click();
    const url = (await page.getByRole('status').locator('pre').first().textContent()) ?? '';
    const opened = await request.post(url);
    expect(opened.headers()['content-disposition']).toContain('filename="dropped.txt"');
    expect(await opened.text()).toBe('dropped-content');
  });

  test('a file over 100 MiB is refused before any request; Remove file brings the text field back (AC-4.1, AC-4.2)', async ({ page }) => {
    const folder = await mkdtemp(join(tmpdir(), 'secret-e2e-'));
    const path = join(folder, 'huge.iso');
    /* Sparse: 100 MiB + 1 byte without writing them. */
    const handle = await open(path, 'w');
    await handle.truncate(100 * MIB + 1);
    await handle.close();
    const uploads: string[] = [];
    page.on('request', (sent) => {
      uploads.push(...(sent.url().includes('/api/file') ? [sent.url()] : []));
    });
    await page.goto('/');
    await page.getByLabel(FILES.pick).setInputFiles(path);
    await expect(page.getByRole('alert')).toContainText('larger than 100 MiB');
    await expect(page.getByText('huge.iso')).toHaveCount(0);
    await page.getByLabel(FILES.pick).setInputFiles({ name: 'small.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await page.getByRole('button', { name: FILES.remove }).click();
    await expect(page.getByLabel(UI.quick.secret, { exact: true })).toBeVisible();
    expect(uploads).toEqual([]);
    await rm(folder, { recursive: true });
  });

  test('a failed upload is aborted, the error shown and the file kept (AC-4.4)', async ({ page }) => {
    await page.goto('/');
    await page.route('**/complete', (route) => route.fulfill({ status: 500, json: { error: 'Storage is unavailable.' } }));
    const aborted = page.waitForRequest((sent) => sent.method() === 'DELETE' && sent.url().includes('/api/uploads/'));
    await page.getByLabel(FILES.pick).setInputFiles({ name: 'keep.txt', mimeType: 'text/plain', buffer: Buffer.from('keep me') });
    await page.getByRole('button', { name: UI.quick.submit }).click();
    await aborted;
    await expect(page.getByRole('alert')).toContainText('Storage is unavailable.');
    await expect(page.getByText('keep.txt (7 B)')).toBeVisible();
  });

  test('a signed-in user shares a file under the account lifetime (AC-4.1, AC-4.3)', async ({ page, request }) => {
    await signUp(page);
    await page.getByLabel(FILES.pick).setInputFiles({ name: 'id_ed25519', mimeType: 'application/octet-stream', buffer: Buffer.from('private-key') });
    await expect(page.getByLabel(UI.share.value, { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: UI.share.submit }).click();
    const result = page.getByRole('status');
    await expect(result).toContainText('Valid for 5 minutes, opens once.');
    const url = (await result.locator('pre').first().textContent()) ?? '';
    expect(await (await request.post(url)).text()).toBe('private-key');
    await expect(page.getByText(UI.keys.empty)).toBeVisible();
  });
});
