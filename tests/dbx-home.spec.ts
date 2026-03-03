import { test, expect } from '@playwright/test';

test('DBX Homepage loads successfully', async ({ page }) => {
  await page.goto('/');

  // Check page loaded
  await expect(page).toHaveTitle(/DBX/);

  // Optional: check some visible text
  await expect(page.locator('body')).toBeVisible();
});
