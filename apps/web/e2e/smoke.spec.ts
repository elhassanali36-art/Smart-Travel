import { expect, test } from '@playwright/test';

test('root redirects to /en without a redirect loop', async ({ page }) => {
  const res = await page.goto('/');
  expect(page.url()).toMatch(/\/en\/?$/);
  expect(res?.status()).toBeLessThan(400);
});

test('English is LTR and Arabic is RTL', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.goto('/ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});

test('unknown locales are 404', async ({ page }) => {
  const res = await page.goto('/fr');
  expect(res?.status()).toBe(404);
});

test('protected pages ask for login instead of crashing', async ({ page }) => {
  await page.goto('/en/profile');
  await expect(page.getByRole('link', { name: 'Go to login' })).toBeVisible();
  await page.goto('/ar/bookings');
  await expect(page.getByRole('link', { name: 'الذهاب إلى تسجيل الدخول' })).toBeVisible();
});

test('register -> profile -> reload (silent refresh) -> logout (needs the API and database)', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto('/en/register');
  await page.getByLabel('Name').fill('E2E User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password (min 8 characters)').fill('Str0ng-Passw0rd');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/en\/profile/);
  await page.reload(); // the access token is memory-only: this exercises the HttpOnly-cookie refresh
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('eyJ'); // no JWT in storage
  await page.getByRole('link', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/en\/login/);
});
