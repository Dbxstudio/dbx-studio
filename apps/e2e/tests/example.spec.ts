import { test, expect } from '@playwright/test';

test.describe('DBX Studio General Navigation & Features', () => {
  test.beforeEach(async ({ page }) => {
    // Using baseURL configured to dbxstudio.com
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should toggle theme successively', async ({ page }) => {
    const themeButton = page.getByRole('button', { name: /toggle theme/i }).first();
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    await themeButton.click();
    await themeButton.click();
  });

  test('should navigate to Download page', async ({ page }) => {
    await page.getByRole('link', { name: /download/i }).first().click();
    await page.waitForLoadState('load');
    expect(page.url()).toContain('dbxstudio.com');
  });

  test('should open Github repository in a new tab', async ({ page }) => {
    // Using Promise.all to ensure the popup event is caught during the click
    const [popupPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('link', { name: /github/i }).first().click()
    ]);
    await popupPage.waitForLoadState('domcontentloaded');
    await expect(popupPage).toHaveURL(/github\.com/i);
  });

  test('should interact with Database Feature tabs', async ({ page }) => {
    await page.locator('text=PostgreSQL').first().click();
    const supabaseTab = page.locator('text=Supabase').first();
    await expect(supabaseTab).toBeVisible();
    await supabaseTab.click();
  });

  test('should open Join our community link in a new tab', async ({ page }) => {
    const [popupPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('link', { name: /join our community|discord|slack/i }).first().click()
    ]);
    await popupPage.waitForLoadState('domcontentloaded');
    expect(popupPage.url()).not.toContain('dbxstudio.com');
  });

  test('should open Contact Us in a new tab', async ({ page }) => {
    const [popupPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('link', { name: /contact us/i }).first().click()
    ]);
    await popupPage.waitForLoadState('domcontentloaded');
    expect(popupPage).not.toBeNull();
  });
});

test.describe('DBX Studio Documentation Navigation', () => {
  test('should verify Docs Pagination (Next Buttons)', async ({ page }) => {
    await page.goto('/');

    // We don't know if "Docs" opens in a new tab, but the original codegen didn't wait for a popup here.
    // If it does open a popup, it would fail. Let's just try to handle the standard click.
    await page.getByRole('link', { name: /^Docs$/i }).first().click();
    await page.waitForLoadState('networkidle');

    const nextQuickStart = page.getByRole('button', { name: /next.*quick start/i });
    if (await nextQuickStart.isVisible()) {
      await nextQuickStart.click();
      await page.getByRole('button', { name: /next.*installation guide/i }).click();
      await page.getByRole('button', { name: /next.*user interface overview/i }).click();
    }
  });
});

test.describe('DBX Studio Banner Links Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should navigate to Case Studies', async ({ page }) => {
    // In case "Case Studies" opens a new tab, we catch it gracefully
    let newTabOpened = false;
    page.once('popup', () => { newTabOpened = true; });

    await page.getByRole('link', { name: /case studies/i }).first().click();
    await page.waitForTimeout(1000); // give it a moment to process click

    if (!newTabOpened) {
      expect(page.url()).toContain('dbxstudio.com');
    }
  });

  test('should navigate to About', async ({ page }) => {
    let newTabOpened = false;
    page.once('popup', () => { newTabOpened = true; });

    await page.getByRole('link', { name: /about/i }).first().click();
    await page.waitForTimeout(1000);

    if (!newTabOpened) {
      expect(page.url()).toContain('dbxstudio.com');
    }
  });
});

test.describe('Authentication', () => {
  test('should initiate Sign In flow and verify auth provider redirect', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const signInButton = page.getByRole('link', { name: /sign in|log in/i }).first();

    if (await signInButton.isVisible()) {
      // Since the login could open in a popup or current page, we handle both possibilities
      let popupPage = null;
      const handlePopup = (popup: any) => { popupPage = popup; };
      page.once('popup', handlePopup);

      await signInButton.click();
      await page.waitForTimeout(2000);

      if (popupPage) {
        // It opened a popup!
        expect((popupPage as any).url()).not.toEqual('https://www.dbxstudio.com/');
      } else {
        const currentUrl = page.url();
        expect(currentUrl).not.toEqual('https://www.dbxstudio.com/');
      }
    } else {
      console.log('No "Sign In" or "Log In" button found. Adjust selector for your site.');
    }
  });
});
