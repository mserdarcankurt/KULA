import { test, expect } from '@playwright/test';

test('Check Network Tab inside Community Drawer', async ({ page }) => {
  // Capture page console logs and errors
  page.on('console', msg => console.log(`[CONSOLE] [${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[PAGE ERROR]:', err.message));

  await page.goto('http://localhost:5173/');
  
  // Wait for the window function to be available and enable Guardian Mode
  await page.waitForFunction(() => typeof (window as any).enableGuardianMode === 'function', { timeout: 10000 });
  await page.evaluate(() => {
    (window as any).enableGuardianMode();
  });

  // Wait for landing page loading
  await page.waitForSelector('text=Your Neighborhood', { timeout: 15000 });

  // Click the Community navigation tab to open the drawer
  const communityTab = page.locator('#tour-community-tab');
  await expect(communityTab).toBeVisible({ timeout: 10000 });
  await communityTab.click();

  // Wait for the drawer to open
  await page.waitForSelector('text=Community Landscape', { timeout: 10000 });

  // Click the "NETWORK" segment button in the drawer header
  const networkButton = page.locator('button:has-text("Network")');
  await expect(networkButton).toBeVisible({ timeout: 10000 });
  await networkButton.click();

  // Wait 3 seconds to let any lazy loading complete
  await page.waitForTimeout(3000);

  // Take a screenshot of the state to verify if it is indeed blank and what is there
  await page.screenshot({ path: '/Users/serdar/.gemini/antigravity/brain/f28f7e80-fab2-4ae3-a1e2-a11bc740c6ac/blank_page_error_1779279855410.png' });
});
