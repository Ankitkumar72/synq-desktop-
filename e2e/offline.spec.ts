import { test, expect } from '@playwright/test';

test.describe('PWA Offline Functionality', () => {
  test('should register service worker and show offline fallback when offline', async ({ page, context }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    // 1. Visit the home page while online
    await page.goto('/');
    
    // 2. Wait for the service worker to register and install
    // We check navigator.serviceWorker.ready
    await page.waitForFunction(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0 && regs[0].active;
    }, { timeout: 10000 }).catch(() => console.log('Timeout waiting for SW'));

    // 3. Navigate to a known cached route to ensure it works
    await page.goto('/login');
    await expect(page.locator('text=Sign In').first()).toBeVisible();

    // 4. Go offline!
    await context.setOffline(true);

    // 5. Navigate to a completely random/uncached URL that the service worker doesn't have
    // Use an un-pre-fetched URL
    await page.goto('/reports/some-random-id-12345');

    // 6. Verify that the custom ~offline fallback page is rendered instead of a browser error
    await expect(page.locator('text=You\'re Offline').first()).toBeVisible();
    await expect(page.locator('text=It looks like you\'ve lost your internet connection')).toBeVisible();

    // 7. Go back online
    await context.setOffline(false);
  });
});
