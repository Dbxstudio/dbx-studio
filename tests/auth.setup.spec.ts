import { test } from '@playwright/test';

test('authenticate', async ({ page }) => {
  await page.goto('/');

  // Manually wait so you can login
  await page.pause();

  // After login is successful
  await page.context().storageState({ path: 'auth.json' });
});
