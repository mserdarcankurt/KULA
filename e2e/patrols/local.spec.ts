import { test, expect } from '@playwright/test';

test.describe('KULA Neighborhood Guardian - Advanced Patrol', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and enable Guardian Mode
    await page.goto('/');
    
    // Wait for the window function to be available
    await page.waitForFunction(() => typeof (window as any).enableGuardianMode === 'function');
    
    await page.evaluate(() => {
      (window as any).enableGuardianMode();
    });
    
    // Ensure we are in the Feed view of Explore
    const feedButton = page.locator('#tour-explore-feed-button');
    await expect(feedButton).toBeVisible({ timeout: 15000 });
    await feedButton.click();
    
    // Wait for the feed or empty state
    await page.waitForSelector('text=Neighborhood Feed', { timeout: 15000 });
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
    
    // Verify Trust Mosaic elements are detailed and correctly rendered
    await expect(page.getByText('Trust Mosaic')).toBeVisible();
    
    // Capture Visual Baseline (for manual review in Playwright report)
    await page.locator('.bg-white.rounded-3xl.shadow-xl.overflow-hidden').first().screenshot({ path: 'e2e/screenshots/trust-mosaic.png' });
    
    // Verify bento grid responsiveness (especially in mobile project)
    const bentoGrid = page.locator('.grid.grid-cols-2.gap-3');
    await expect(bentoGrid).toBeVisible();
  });

  test('Detail: Mobile Bottom Navigation', async ({ page, isMobile }) => {
    if (isMobile) {
      // Specifically test mobile-only interactions
      const nav = page.locator('nav.fixed.bottom-0');
      await expect(nav).toBeVisible();
      
      // Ensure all 5 nav items are present and labeled
      const navItems = ['Home', 'Circles', 'Post', 'Chats', 'Profile'];
      for (const item of navItems) {
        await expect(nav.getByText(item)).toBeVisible();
      }
    }
  });

  test('Detail: Discovery Radar Visual Check', async ({ page }) => {
    await page.click('button:has-text("Home")');
    // Ensure Discovery view
    const discoverToggle = page.getByRole('button', { name: /Discover/i });
    await discoverToggle.click();
    
    await expect(page.getByText('Discovery')).toBeVisible();
    
    // Verify Radar card exists
    const radarCard = page.locator('.relative.mx-1.sm\\:mx-4.bg-white.rounded-\\[2\\.5rem\\]');
    await expect(radarCard.first()).toBeVisible();
    
    // Take screenshot of the radar for regression
    await radarCard.first().screenshot({ path: 'e2e/screenshots/discovery-radar.png' });
  });
});
