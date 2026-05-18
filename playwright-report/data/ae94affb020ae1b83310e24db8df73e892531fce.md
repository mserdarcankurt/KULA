# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: patrols/cloud.spec.ts >> KULA Neighborhood Guardian - Cloud Patrol >> Cloud: Verify App Reachability & Branding
- Location: e2e/patrols/cloud.spec.ts:20:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('h1')
Expected pattern: /Neighborhood/i
Received string:  "KULA"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('h1')
    14 × locator resolved to <h1 class="serif text-6xl font-bold tracking-tight text-[#5A5A40]">KULA</h1>
       - unexpected value "KULA"

```

```yaml
- heading "KULA" [level=1]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | /**
  4  |  * Cloud Patrol: System Integrity Check
  5  |  * This test runs on the live Firebase instance.
  6  |  * It focuses on accessibility, latency, and read-only integrity 
  7  |  * to avoid polluting production data without a dedicated test user.
  8  |  */
  9  | 
  10 | test.describe('KULA Neighborhood Guardian - Cloud Patrol', () => {
  11 |   test.beforeEach(async ({ page }) => {
  12 |     // Navigate to the live instance
  13 |     await page.goto('/');
  14 |     
  15 |     // In cloud tests, we expect to see the landing page/onboarding 
  16 |     // unless we have a persistent session or specific auth setup.
  17 |     // For now, we'll verify the core app shell is reachable.
  18 |   });
  19 | 
  20 |   test('Cloud: Verify App Reachability & Branding', async ({ page }) => {
  21 |     // Check for KULA title or main branding
  22 |     await expect(page).toHaveTitle(/KULA/);
  23 |     
  24 |     // Verify that the landing page/onboarding elements are present
  25 |     const mainHeading = page.locator('h1');
  26 |     if (await mainHeading.isVisible()) {
> 27 |       await expect(mainHeading).toContainText(/Neighborhood/i);
     |                                 ^ Error: expect(locator).toContainText(expected) failed
  28 |     }
  29 |   });
  30 | 
  31 |   test('Cloud: Verify Discovery Radar Reachability', async ({ page }) => {
  32 |     // Check if we can reach the discovery state 
  33 |     // (Even if not logged in, some parts of the UI should respond)
  34 |     const discoveryHeader = page.locator('text=Discovery');
  35 |     // If we are gated by login, this might not be visible, 
  36 |     // but we can check for the presence of the auth sheet.
  37 |     const loginButton = page.locator('button:has-text("Sign in")');
  38 |     const welcomeText = page.locator('text=Welcome to your neighborhood');
  39 |     
  40 |     await expect(loginButton.or(welcomeText)).toBeVisible({ timeout: 15000 });
  41 |   });
  42 | 
  43 |   test('Cloud: Performance Integrity (Latency Check)', async ({ page }) => {
  44 |     const start = Date.now();
  45 |     await page.goto('/');
  46 |     await page.waitForLoadState('networkidle');
  47 |     const duration = Date.now() - start;
  48 |     
  49 |     console.log(`Cloud Patrol: Initial load took ${duration}ms`);
  50 |     
  51 |     // Expect load time to be reasonable for a production instance
  52 |     expect(duration).toBeLessThan(10000); 
  53 |   });
  54 | });
  55 | 
```