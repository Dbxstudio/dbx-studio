import { test, expect } from '@playwright/test';

test('Deployed site: sign-in email form is reachable', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Sign in with Email' }).click();

  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('Deployed site: marketing page theme toggle works', async ({ page }) => {
  await page.goto('/');

  const toggle = page.getByRole('button', { name: 'Toggle theme' });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await toggle.click();
});