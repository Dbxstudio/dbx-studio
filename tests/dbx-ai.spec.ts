import { test, expect } from '@playwright/test';

test('AI query response appears', async ({ page }) => {
  await page.goto('/');

  // Type natural language query
  await page.fill('#queryInput', 'Show all users');

  // Click Ask button
  await page.click('#askAI');

  // Wait for AI response
  await expect(page.locator('.ai-response')).toBeVisible();
});
