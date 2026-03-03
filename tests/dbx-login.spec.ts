import { test, expect } from '@playwright/test';

test('Signup works', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('test123@gmail.com');
  await page.getByRole('textbox', { name: 'First Name *' }).fill('test');
  await page.getByRole('textbox', { name: 'Last Name *' }).fill('user');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('testuser123');
  await page.getByRole('textbox', { name: 'Confirm password' }).fill('testuser123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.locator('body')).toBeVisible();
});
