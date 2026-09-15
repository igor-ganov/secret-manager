import { expect, test, type Page } from '@playwright/test';

/* Locator contract with src/web (labels and headings are the UI's public API). */
const UI = {
  loginButton: 'Log in with Telegram',
  logoutButton: 'Log out',
  userName: 'Dev User',
  share: { key: 'Key (optional)', value: 'Value', submit: 'Get one-time link' },
  result: { copyLink: 'Copy link', copyCurl: 'Copy curl' },
  keys: { heading: 'Saved keys', empty: 'You have no saved keys yet.' },
  settings: { group: 'Link lifetime' },
  tokens: { label: 'Token label', submit: 'New token', copy: 'Copy token' },
} as const;

/* Each test signs in as a distinct user so parallel workers never share keys. */
const signIn = async (page: Page, userId: number): Promise<void> => {
  await page.goto(`/dev/login?user=${userId}`);
  await expect(page.getByText(UI.userName)).toBeVisible();
};

const shareValue = async (page: Page, key: string, value: string): Promise<void> => {
  await page.getByLabel(UI.share.key).fill(key);
  await page.getByLabel(UI.share.value, { exact: true }).fill(value);
  await page.getByRole('button', { name: UI.share.submit }).click();
};

test.describe('signed out', () => {
  test('offers Telegram login and nothing else (AC-1.1)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: UI.loginButton })).toHaveAttribute(
      'href',
      /^https:\/\/oauth\.telegram\.org\/auth\?bot_id=\d+&origin=http%3A%2F%2F127\.0\.0\.1%3A3999&request_access=write&return_to=/,
    );
    await expect(page.getByRole('heading', { name: UI.keys.heading })).toHaveCount(0);
  });

  test('a failed Telegram callback shows the error (AC-1.3)', async ({ page }) => {
    const forged = btoa(JSON.stringify({ id: 1, auth_date: 1, hash: 'nope' }));
    await page.goto(`/#tgAuthResult=${forged}`);
    await expect(page.getByRole('alert')).toContainText('could not be verified');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: UI.loginButton })).toBeVisible();
  });
});

test.describe('signed in', () => {
  test('logs out (AC-1.4)', async ({ page }) => {
    await signIn(page, 101);
    await page.getByRole('button', { name: UI.logoutButton }).click();
    await expect(page.getByRole('link', { name: UI.loginButton })).toBeVisible();
    await expect(page.getByText(UI.userName)).toHaveCount(0);
  });

  test('shares an unsaved value (AC-2.2, AC-2.5)', async ({ page }) => {
    await signIn(page, 102);
    await shareValue(page, '', 'ephemeral-secret');
    const result = page.getByRole('status');
    await expect(result).toContainText('/s/');
    await expect(result).toContainText('curl -X POST');
    await expect(result).toContainText('Valid for 5 minutes, opens once.');
    await expect(page.getByRole('button', { name: UI.result.copyLink })).toBeVisible();
    await expect(page.getByRole('button', { name: UI.result.copyCurl })).toBeVisible();
    await expect(page.getByLabel(UI.share.value, { exact: true })).toHaveValue('');
    await expect(page.getByText(UI.keys.empty)).toBeVisible();
  });

  test('saves a pair, then links, sets and deletes it (AC-2.3, AC-3.x)', async ({ page }) => {
    await signIn(page, 103);
    await expect(page.getByText(UI.keys.empty)).toBeVisible();
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
    await expect(row).toContainText('Delete “db-password”?');
    await row.getByRole('button', { name: 'Cancel' }).click();
    await expect(row).not.toContainText('Delete “db-password”?');
    await row.getByRole('button', { name: 'Delete' }).click();
    await row.getByRole('button', { name: 'Yes, delete' }).click();
    await expect(page.getByText(UI.keys.empty)).toBeVisible();
  });

  test('rejects an invalid key next to the form (AC-2.4)', async ({ page }) => {
    await signIn(page, 104);
    await shareValue(page, 'a'.repeat(63), 'v');
    await expect(page.getByRole('alert')).toContainText('Key must be');
  });

  test('changes the link lifetime (AC-4.1)', async ({ page }) => {
    await signIn(page, 105);
    const group = page.getByRole('radiogroup', { name: UI.settings.group });
    await expect(group.getByRole('radio', { name: '5 min', exact: true })).toBeChecked();
    await group.getByRole('radio', { name: '30 min', exact: true }).check();
    await expect(page.getByRole('status')).toContainText('30 minutes');
    await shareValue(page, '', 'v');
    await expect(page.getByRole('status')).toContainText('Valid for 30 minutes, opens once.');
  });

  test('creates and revokes a CLI token (AC-5.1, AC-5.2)', async ({ page }) => {
    await signIn(page, 106);
    const current = page.getByRole('listitem').filter({ hasText: 'web' });
    await expect(current).toContainText('current session');
    await expect(current.getByRole('button', { name: /Revoke/ })).toHaveCount(0);

    await page.getByLabel(UI.tokens.label).fill('laptop');
    await page.getByRole('button', { name: UI.tokens.submit }).click();
    const fresh = page.getByRole('status');
    await expect(fresh).toContainText(/[0-9a-f]{64}/);
    await expect(fresh).toContainText('secret login');
    await expect(page.getByRole('button', { name: UI.tokens.copy })).toBeVisible();

    const row = page.getByRole('listitem').filter({ hasText: 'laptop' });
    await row.getByRole('button', { name: 'Revoke laptop' }).click();
    await expect(row).toHaveCount(0);
  });

  test('is operable with the keyboard alone (AC-6.1)', async ({ page }) => {
    await signIn(page, 107);
    await page.getByLabel(UI.share.value, { exact: true }).focus();
    await page.keyboard.type('typed-secret');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: UI.share.submit })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('/s/');
  });
});
