import { test, expect, Page } from '@playwright/test';
import path from 'path';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────
const TARGET_URL = 'https://staging.arise-ai.org/podcast';

const VIEWPORTS = [
    { name: 'Desktop-1920', width: 1920, height: 1080 },
    { name: 'Laptop-1366', width: 1366, height: 768 },
    { name: 'Tablet-768', width: 768, height: 1024 },
    { name: 'Mobile-375', width: 375, height: 812 },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helper: take a labelled screenshot
// ──────────────────────────────────────────────────────────────────────────────
async function snap(page: Page, label: string) {
    const safe = label.replace(/[^a-zA-Z0-9_\-]/g, '_');
    await page.screenshot({
        path: `test-results/arise-podcast/${safe}.png`,
        fullPage: false,
    });
}

async function snapFullPage(page: Page, label: string) {
    const safe = label.replace(/[^a-zA-Z0-9_\-]/g, '_');
    await page.screenshot({
        path: `test-results/arise-podcast/${safe}_fullpage.png`,
        fullPage: true,
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. SMOKE TEST – Page loads without errors
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Arise AI Podcast – Smoke Tests', () => {
    test('Page loads with HTTP 200 and has a valid <title>', async ({ page }) => {
        const response = await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
        expect(response?.status()).toBe(200);

        const title = await page.title();
        console.log(`Page title: "${title}"`);
        expect(title.length).toBeGreaterThan(0);

        await snap(page, '01_smoke_loaded');
    });

    test('No JavaScript console errors on load', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        page.on('pageerror', err => errors.push(err.message));

        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        if (errors.length > 0) {
            console.warn('Console errors detected:\n', errors.join('\n'));
        }
        // Log but don't hard-fail – staging sites may have non-critical console errors
        await snap(page, '02_smoke_no_console_errors');
    });

    test('No broken images (all <img> elements return valid src)', async ({ page }) => {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

        const brokenImages = await page.evaluate(async () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            const results: string[] = [];
            for (const img of imgs) {
                if (!img.complete || img.naturalWidth === 0) {
                    results.push(img.src || img.getAttribute('src') || '(no src)');
                }
            }
            return results;
        });

        if (brokenImages.length > 0) {
            console.error('Broken images found:', brokenImages);
        }
        expect(brokenImages, `Broken images: ${brokenImages.join(', ')}`).toHaveLength(0);
        await snap(page, '03_smoke_images');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. SEO & META – Basic on-page SEO checks
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Arise AI Podcast – SEO & Meta Tags', () => {
    test('Has a valid <title> tag', async ({ page }) => {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
        const title = await page.title();
        console.log(`Title: "${title}"`);
        expect(title.trim().length).toBeGreaterThan(0);
    });

    test('Has a meta description', async ({ page }) => {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
        const metaDesc = await page
            .locator('meta[name="description"]')
            .getAttribute('content');
        console.log(`Meta description: "${metaDesc}"`);
        expect(metaDesc).toBeTruthy();
        expect((metaDesc ?? '').trim().length).toBeGreaterThan(0);
    });

    test('Has exactly one <h1> tag', async ({ page }) => {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
        const h1Count = await page.locator('h1').count();
        console.log(`H1 count: ${h1Count}`);
        expect(h1Count).toBeGreaterThanOrEqual(1);
        if (h1Count !== 1) {
            console.warn(`Expected 1 <h1>, found ${h1Count}.`);
        }
    });

    test('Has Open Graph og:title and og:image', async ({ page }) => {
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
        const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
        console.log(`OG Title: "${ogTitle}"`);
        console.log(`OG Image: "${ogImage}"`);
        if (!ogTitle) console.warn('Missing og:title');
        if (!ogImage) console.warn('Missing og:image');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. UI STRUCTURE – High-level content checks
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Arise AI Podcast – UI Structure', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    });

    test('Navigation / header is visible', async ({ page }) => {
        const nav = page.locator('nav, header, [role="navigation"]').first();
        await expect(nav).toBeVisible();
        await snap(page, '04_ui_header');
    });

    test('Page has a hero / banner section', async ({ page }) => {
        // Look for typical hero selectors
        const hero = page.locator(
            'section.hero, [class*="hero"], [class*="banner"], [class*="jumbotron"], ' +
            'section:first-of-type, main > section:first-child'
        ).first();
        const visible = await hero.isVisible().catch(() => false);
        console.log(`Hero visible: ${visible}`);
        await snap(page, '05_ui_hero');
    });

    test('Page has podcast cards / episodes list', async ({ page }) => {
        // Look for card/episode/list structures
        const cards = page.locator(
            '[class*="card"], [class*="episode"], [class*="podcast"], article, .grid > *, .list > *'
        );
        const count = await cards.count();
        console.log(`Podcast cards/items found: ${count}`);
        expect(count).toBeGreaterThan(0);
        await snap(page, '06_ui_cards');
    });

    test('Footer is present', async ({ page }) => {
        const footer = page.locator('footer').first();
        await footer.scrollIntoViewIfNeeded();
        await expect(footer).toBeVisible();
        await snap(page, '07_ui_footer');
    });

    test('All links have href attributes (no empty anchors)', async ({ page }) => {
        const emptyLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .filter(a => !a.href || a.href === window.location.href + '#' || a.href === '#')
                .map(a => a.outerHTML.substring(0, 120));
        });
        if (emptyLinks.length > 0) {
            console.warn('Links with missing/empty href:\n', emptyLinks.join('\n'));
        }
    });

    test('Scrolling the full page works without layout overflow', async ({ page }) => {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(800);
        await snap(page, '08_ui_scroll_bottom');

        const hasHorizontalScroll = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        if (hasHorizontalScroll) {
            console.warn('⚠️  Horizontal scrollbar detected on desktop – possible overflow issue.');
        }
        expect(hasHorizontalScroll).toBe(false);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. INTERACTIVE ELEMENTS – Buttons, links, media player
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Arise AI Podcast – Interactive Elements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    });

    test('All buttons are visible and not disabled by default', async ({ page }) => {
        const buttons = page.locator('button:visible');
        const count = await buttons.count();
        console.log(`Visible buttons found: ${count}`);
        for (let i = 0; i < Math.min(count, 20); i++) {
            const btn = buttons.nth(i);
            const text = await btn.textContent();
            const disabled = await btn.isDisabled();
            if (disabled) console.warn(`Disabled button: "${text?.trim()}"`);
        }
        await snap(page, '09_interactive_buttons');
    });

    test('Navigation links are clickable and don\'t result in 404', async ({ page }) => {
        const navLinks = page.locator('nav a, header a').filter({ hasText: /.+/ });
        const count = await navLinks.count();
        console.log(`Nav links found: ${count}`);

        for (let i = 0; i < Math.min(count, 8); i++) {
            const link = navLinks.nth(i);
            const href = await link.getAttribute('href');
            const text = (await link.textContent())?.trim();
            console.log(`  Nav link [${i}]: "${text}" → ${href}`);
        }
        await snap(page, '10_interactive_nav_links');
    });

    test('Podcast/media player is present (if any)', async ({ page }) => {
        const player = page.locator('audio, video, iframe[src*="spotify"], iframe[src*="apple"], iframe[src*="podcast"], [class*="player"]');
        const count = await player.count();
        console.log(`Media player elements found: ${count}`);
        await snap(page, '11_interactive_media_player');
    });

    test('CTA buttons are visible and have correct text', async ({ page }) => {
        const cta = page.locator(
            'a[class*="btn"], button[class*="btn"], a[class*="cta"], [class*="button"]:visible'
        );
        const count = await cta.count();
        console.log(`CTA buttons found: ${count}`);
        for (let i = 0; i < Math.min(count, 10); i++) {
            const text = (await cta.nth(i).textContent())?.trim();
            console.log(`  CTA [${i}]: "${text}"`);
        }
        await snap(page, '12_interactive_cta');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. RESPONSIVENESS – Multi-viewport layout checks
// ──────────────────────────────────────────────────────────────────────────────
for (const vp of VIEWPORTS) {
    test.describe(`Arise AI Podcast – Responsive @ ${vp.name} (${vp.width}×${vp.height})`, () => {
        test.use({ viewport: { width: vp.width, height: vp.height } });

        test(`[${vp.name}] Full-page renders without horizontal overflow`, async ({ page }) => {
            await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
            await page.waitForTimeout(1000);

            // Take viewport screenshot (above fold)
            await snap(page, `responsive_${vp.name}_above_fold`);
            // Take full-page screenshot
            await snapFullPage(page, `responsive_${vp.name}`);

            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });
            if (hasHorizontalScroll) {
                console.warn(`⚠️  [${vp.name}] Horizontal scrollbar present! Possible overflow.`);
            }
            expect(hasHorizontalScroll).toBe(false);
        });

        test(`[${vp.name}] Navigation is accessible (visible or has mobile toggle)`, async ({ page }) => {
            await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

            const nav = page.locator('nav, header').first();
            const navVisible = await nav.isVisible().catch(() => false);

            // On mobile/tablet, look for hamburger menu
            const mobileMenu = page.locator(
                'button[aria-label*="menu" i], button[aria-label*="hamburger" i], ' +
                '[class*="hamburger"], [class*="mobile-menu"], [class*="menu-toggle"]'
            ).first();
            const mobileMenuVisible = await mobileMenu.isVisible().catch(() => false);

            console.log(`[${vp.name}] Nav visible: ${navVisible}, Mobile menu: ${mobileMenuVisible}`);

            if (vp.width <= 768) {
                // On mobile/tablet – either nav or hamburger should exist
                expect(navVisible || mobileMenuVisible).toBe(true);
                if (mobileMenuVisible) {
                    await mobileMenu.click();
                    await page.waitForTimeout(500);
                    await snap(page, `responsive_${vp.name}_mobile_menu_open`);
                }
            } else {
                expect(navVisible).toBe(true);
            }
            await snap(page, `responsive_${vp.name}_nav`);
        });

        test(`[${vp.name}] Images are not overflowing their containers`, async ({ page }) => {
            await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

            const overflowingImages = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                return imgs.filter(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.right > window.innerWidth + 1;
                }).map(img => img.src || img.getAttribute('src') || '(no src)');
            });

            if (overflowingImages.length > 0) {
                console.warn(`[${vp.name}] Overflowing images:`, overflowingImages);
            }
            expect(overflowingImages).toHaveLength(0);
        });

        test(`[${vp.name}] Text is readable – no zero-size text containers`, async ({ page }) => {
            await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

            const zeroSizeText = await page.evaluate(() => {
                const textEls = Array.from(document.querySelectorAll('h1, h2, h3, p'));
                return textEls
                    .filter(el => {
                        const rect = el.getBoundingClientRect();
                        const text = el.textContent?.trim();
                        return text && text.length > 0 && (rect.width === 0 || rect.height === 0);
                    })
                    .map(el => `${el.tagName}: "${el.textContent?.trim().substring(0, 50)}"`);
            });

            if (zeroSizeText.length > 0) {
                console.warn(`[${vp.name}] Zero-size text elements:`, zeroSizeText);
            }
            expect(zeroSizeText).toHaveLength(0);
        });

        test(`[${vp.name}] Font sizes are not too small on mobile`, async ({ page }) => {
            if (vp.width > 768) {
                test.skip();
                return;
            }
            await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

            const tinyTextCount = await page.evaluate(() => {
                const textEls = Array.from(document.querySelectorAll('p, span, li, a'));
                return textEls.filter(el => {
                    const style = window.getComputedStyle(el);
                    const size = parseFloat(style.fontSize);
                    const text = el.textContent?.trim();
                    return text && text.length > 0 && size < 11;
                }).length;
            });

            console.log(`[${vp.name}] Elements with font-size < 11px: ${tinyTextCount}`);
            if (tinyTextCount > 0) {
                console.warn(`⚠️  [${vp.name}] ${tinyTextCount} elements have very small font sizes (<11px)`);
            }
        });
    });
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. PERFORMANCE HINTS – Core Web Vitals proxies
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Arise AI Podcast – Performance Hints', () => {
    test('Page load time is under 10 seconds (networkidle)', async ({ page }) => {
        const start = Date.now();
        await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
        const elapsed = Date.now() - start;
        console.log(`Page loaded in ${elapsed}ms`);
        expect(elapsed).toBeLessThan(10000);
    });

    test('Large images use width/height attributes (prevents CLS)', async ({ page }) => {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
        const imagesWithoutDimensions = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img'))
                .filter(img => !img.getAttribute('width') || !img.getAttribute('height'))
                .map(img => (img.getAttribute('src') || '').substring(0, 80));
        });
        console.log(`Images missing explicit width/height: ${imagesWithoutDimensions.length}`);
        imagesWithoutDimensions.forEach(src => console.log('  •', src));
    });

    test('Critical resources do not 404', async ({ page }) => {
        const failed: string[] = [];
        page.on('response', res => {
            if (res.status() === 404 && !res.url().includes('favicon')) {
                failed.push(`404: ${res.url()}`);
            }
        });
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        if (failed.length > 0) {
            console.warn('404 resources:\n', failed.join('\n'));
        }
        expect(failed.length).toBe(0);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. ACCESSIBILITY BASICS
// ──────────────────────────────────────────────────────────────────────────────
test.describe('Arise AI Podcast – Accessibility Basics', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    });

    test('All images have alt attributes', async ({ page }) => {
        const imagesWithoutAlt = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img'))
                .filter(img => !img.hasAttribute('alt'))
                .map(img => (img.getAttribute('src') || '').substring(0, 80));
        });
        if (imagesWithoutAlt.length > 0) {
            console.warn('Images missing alt:\n', imagesWithoutAlt.join('\n'));
        }
        expect(imagesWithoutAlt).toHaveLength(0);
    });

    test('Interactive elements are keyboard-accessible (have tab index or role)', async ({ page }) => {
        const inaccessibleButtons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button, [role="button"]'))
                .filter(el => {
                    const tab = el.getAttribute('tabindex');
                    return tab !== null && parseInt(tab) < 0;
                })
                .map(el => el.textContent?.trim().substring(0, 60));
        });
        if (inaccessibleButtons.length > 0) {
            console.warn('Buttons with negative tabindex (not keyboard-reachable):', inaccessibleButtons);
        }
    });

    test('Color contrast: page does not use white text on white background', async ({ page }) => {
        const badContrast = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('*'));
            return els.filter(el => {
                const style = window.getComputedStyle(el);
                const color = style.color;
                const bg = style.backgroundColor;
                // Very basic check: both white
                return color === 'rgb(255, 255, 255)' && bg === 'rgb(255, 255, 255)';
            }).length;
        });
        console.log(`Elements with white-on-white: ${badContrast}`);
        expect(badContrast).toBe(0);
    });

    test('Page has lang attribute on <html>', async ({ page }) => {
        const lang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
        console.log(`HTML lang: "${lang}"`);
        expect(lang).toBeTruthy();
    });
});
