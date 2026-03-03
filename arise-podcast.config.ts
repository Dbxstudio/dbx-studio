import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config dedicated to external UI/Responsiveness testing of
 * https://staging.arise-ai.org/podcast
 *
 * Run with:
 *   npx playwright test --config=arise-podcast.config.ts
 */
export default defineConfig({
    testDir: './tests',
    testMatch: '**/arise-podcast-ui.spec.ts',
    fullyParallel: false,   // run sequentially for cleaner output
    retries: 1,
    workers: 2,
    timeout: 60_000,        // 60 s per test (external site may be slow)
    reporter: [
        ['list'],
        ['html', { outputFolder: 'arise-podcast-report', open: 'never' }],
    ],
    use: {
        baseURL: 'https://staging.arise-ai.org',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'off',
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },
    outputDir: 'test-results/arise-podcast',
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // No webServer – we're testing an already-deployed external URL
});
