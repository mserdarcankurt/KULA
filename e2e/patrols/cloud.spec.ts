import { test, expect } from '@playwright/test';

/**
 * Cloud Patrol: System Integrity Check
 * This test runs on the live Firebase instance.
 * It focuses on accessibility, latency, and read-only integrity 
 * to avoid polluting production data without a dedicated test user.
 */

test.describe('KULA Neighborhood Guardian - Cloud Patrol', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the live instance
    await page.goto('/');
    
    // In cloud tests, we expect to see the landing page/onboarding 
    // unless we have a persistent session or specific auth setup.
    // For now, we'll verify the core app shell is reachable.
  });

  test('Cloud: Verify App Reachability & Branding', async ({ page }) => {
    // Check for KULA title or main branding
    await expect(page).toHaveTitle(/KULA/);
    
    // Verify that the landing page/onboarding elements are present
    const mainHeading = page.locator('h1');
    if (await mainHeading.isVisible()) {
      await expect(mainHeading).toContainText(/Neighborhood/i);
    }
  });

  test('Cloud: Verify Discovery Radar Reachability', async ({ page }) => {
    // Check if we can reach the discovery state 
    // (Even if not logged in, some parts of the UI should respond)
    const discoveryHeader = page.locator('text=Discovery');
    // If we are gated by login, check for "I was invited" button or welcome tagline
    const loginButton = page.locator('button:has-text("I was invited")');
    const welcomeText = page.locator('text=remember how to share');
    
    await expect(loginButton.or(welcomeText).first()).toBeVisible({ timeout: 15000 });
  });

  test('Cloud: Performance Integrity (Latency Check)', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('load');
    const duration = Date.now() - start;
    
    console.log(`Cloud Patrol: Initial load took ${duration}ms`);
    
    // Expect load time to be reasonable for a production instance
    expect(duration).toBeLessThan(10000); 
  });
});
