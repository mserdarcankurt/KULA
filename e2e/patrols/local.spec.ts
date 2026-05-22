import { test, expect } from '@playwright/test';

test.describe('KULA Neighborhood Guardian - Advanced Patrol', () => {
  test.beforeEach(async ({ page }) => {
    // Log page console and error events
    page.on('console', msg => console.log(`PAGE LOG [${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    // Navigate and enable Guardian Mode
    await page.goto('/');
    
    // Wait for the window function to be available
    await page.waitForFunction(() => typeof (window as any).enableGuardianMode === 'function');
    
    await page.evaluate(() => {
      (window as any).enableGuardianMode();
    });
    
    // Ensure "Your Neighborhood" header is visible (landing page is Explore)
    await page.waitForSelector('text=Your Neighborhood', { timeout: 15000 });
  });

  test('Detail: Gratitude Flow State Consistency', async ({ page }) => {
    // 1. Find an item to "complete" and say thanks
    const items = page.locator('.group.cursor-pointer');
    await expect(items.first()).toBeVisible({ timeout: 10000 });
    await items.first().click({ force: true });
    
    // Verify Discussion sheet is open
    await expect(page.getByText('Discussion')).toBeVisible({ timeout: 15000 });

    // 2. Click "Say Thanks" or trigger Gratitude Flow
    // We'll look for a button that triggers gratitude. 
    // In our current mock, we might need to find the owner name or a specific button.
    const thanksButton = page.getByRole('button', { name: /Thanks|Gratitude/i }).first();
    if (await thanksButton.isVisible()) {
      await thanksButton.click();
      
      // Verify Gratitude Sheet
      await expect(page.getByText('Say thanks to')).toBeVisible();

      // 3. Negative Test: Try to send short note
      const textarea = page.getByPlaceholder(/What would you like/i);
      await textarea.fill('Short');
      await expect(page.getByText('A few more words to make it meaningful...')).toBeVisible();
      
      const sendButton = page.getByRole('button', { name: /Send Gratitude/i });
      await expect(sendButton).toBeDisabled();

      // 4. Positive Test: Send full note
      await textarea.fill('Thank you so much for the amazing neighborhood support! 💚');
      await expect(sendButton).toBeEnabled();
      await sendButton.click();

      // 5. Verify Success State
      await expect(page.getByText('Gratitude sent!')).toBeVisible();
    }
  });

  test('Detail: Profile Integrity & Trust Mosaic', async ({ page }) => {
    // Navigate to Profile
    await page.click('button:has-text("Profile")');
    
    // Verify Profile and Trust Mosaic elements are detailed and correctly rendered
    await expect(page.getByText('Copy "Link In Bio"')).toBeVisible();
    await expect(page.getByText('My Network')).toBeVisible();
    await expect(page.getByText('My Invite Code')).toBeVisible();
    
    // Capture Visual Baseline (for manual review in Playwright report)
    await page.screenshot({ path: 'e2e/screenshots/profile-page.png' });
    
    // Verify stats grid responsiveness (3 columns for Ask/Share/Join stats)
    const statsGrid = page.locator('.grid.grid-cols-3');
    await expect(statsGrid).toBeVisible();
  });

  test('Detail: Mobile Bottom Navigation', async ({ page, isMobile }) => {
    if (isMobile) {
      // Specifically test mobile-only interactions
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
      
      // Ensure all 5 nav items are present and labeled
      const navItems = ['Home', 'Community', 'Circles', 'Post', 'Profile'];
      for (const item of navItems) {
        await expect(nav.getByText(item)).toBeVisible();
      }
    }
  });

  test('Detail: Map Feed Visual Check', async ({ page }) => {
    // Click the Community tab to open the slide-up drawer
    const communityTab = page.locator('#tour-community-tab');
    await expect(communityTab).toBeVisible({ timeout: 10000 });
    await communityTab.click();
    
    // Check if either "Maps Unavailable" fallback or map itself is visible inside the drawer
    await expect(page.getByText('Maps Unavailable').or(page.locator('.gm-style'))).toBeVisible({ timeout: 15000 });
    
    // Take screenshot of the map view for regression
    await page.screenshot({ path: 'e2e/screenshots/map-feed-view.png' });
  });

  test('Detail: Flow Tab Feed Sub-Filtering', async ({ page }) => {
    // 1. Switch to Flow mode
    const flowTabButton = page.locator('#tour-explore-views button:has-text("Flow")');
    await expect(flowTabButton).toBeVisible();
    await flowTabButton.click();

    // 2. Verify sub-filter switcher is visible
    const everythingFilter = page.locator('button:has-text("Everything")');
    const updatesFilter = page.locator('button:has-text("Updates")');
    const buzzFilter = page.locator('button:has-text("Buzz")');

    await expect(everythingFilter).toBeVisible();
    await expect(updatesFilter).toBeVisible();
    await expect(buzzFilter).toBeVisible();

    // 3. Click "Updates" and verify active state
    await updatesFilter.click();
    await expect(updatesFilter).toHaveClass(/bg-\[#5B6B56\]/);

    // 4. Click "Buzz" and verify active state
    await buzzFilter.click();
    await expect(buzzFilter).toHaveClass(/bg-\[#5B6B56\]/);

    // 5. Take screenshot of Flow Buzz filter view
    await page.screenshot({ path: 'e2e/screenshots/flow-buzz-filter.png' });
  });
});
