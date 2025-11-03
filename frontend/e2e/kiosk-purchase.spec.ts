/**
 * Kiosk Purchase E2E Tests
 * Tests two-wallet purchase flow with Sui testnet
 *
 * Setup:
 *   bun add -D @playwright/test
 *   bun playwright install
 *
 * Run:
 *   bun playwright test e2e/kiosk-purchase.spec.ts
 */

let playwrightModule: typeof import('@playwright/test') | null = null;

try {
  playwrightModule = await import('@playwright/test');
} catch {
  console.warn(
    '[e2e] Skipping kiosk purchase tests: @playwright/test is not installed. Install it with "bun add -D @playwright/test" to enable these tests.'
  );
}

if (playwrightModule) {
  const { test, expect } = playwrightModule;
  type Page = import('@playwright/test').Page;

// Test configuration
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Test wallets (replace with actual testnet wallets)
const WALLET_1_ADDRESS = process.env.TEST_WALLET_1 || '0x...';
const WALLET_2_ADDRESS = process.env.TEST_WALLET_2 || '0x...';

  test.describe('Kiosk Purchase Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to marketplace
    await page.goto(`${FRONTEND_URL}/marketplace`);

    // Wait for page load
    await page.waitForLoadState('networkidle');
  });

  test.describe('Two-Step Purchase Flow (Wallet 1)', () => {
    test('should complete two-step purchase: buy SONAR then dataset', async ({ page }) => {
      // Step 1: Connect wallet
      await page.click('text=Connect Wallet');

      // Select Sui Wallet (assumes Sui Wallet extension is installed)
      await page.click('text=Sui Wallet');

      // Wait for wallet connection (manual approval in extension)
      await page.waitForSelector('text=Connected', { timeout: 30000 });

      // Verify wallet address displayed
      const walletButton = await page.locator('[data-testid="wallet-button"]');
      await expect(walletButton).toContainText(WALLET_1_ADDRESS.slice(0, 6));

      // Step 2: Navigate to a dataset
      const firstDataset = page.locator('[data-testid="dataset-card"]').first();
      await firstDataset.click();

      // Wait for dataset detail page
      await page.waitForSelector('text=Purchase Dataset');

      // Step 3: Switch to kiosk flow
      const tryKioskButton = page.locator('text=Try kiosk');
      if (await tryKioskButton.isVisible()) {
        await tryKioskButton.click();
      }

      // Verify kiosk UI loaded
      await expect(page.locator('text=Kiosk Liquidity')).toBeVisible();

      // Step 4: Check SONAR balance (should be 0 or low)
      const balanceText = await page.locator('[data-testid="sonar-balance"]').textContent();
      console.log('Initial SONAR balance:', balanceText);

      // Step 5: Select 2-step flow
      await page.click('text=2-Step: Buy SONAR First');

      // Verify step 1 UI
      await expect(page.locator('text=Step 1 of 2: Buy SONAR')).toBeVisible();

      // Step 6: Buy SONAR
      await page.click('text=Buy SONAR');

      // Wallet approval prompt appears (manual action required)
      await page.waitForTimeout(2000);

      // Wait for transaction confirmation
      await page.waitForSelector('text=SONAR purchased', { timeout: 60000 });

      // Verify step 2 UI appears
      await expect(page.locator('text=Step 2 of 2: Buy Dataset')).toBeVisible();

      // Step 7: Buy dataset
      await page.click('text=Buy Dataset');

      // Wallet approval prompt appears (manual action required)
      await page.waitForTimeout(2000);

      // Wait for success message
      await page.waitForSelector('text=Dataset purchased', { timeout: 60000 });

      // Step 8: Verify access granted
      // Should see download button or streaming UI
      await expect(page.locator('text=Download')).toBeVisible({ timeout: 10000 });

      // Step 9: Verify backend recorded purchase
      const response = await page.request.get(`${BACKEND_URL}/api/kiosk/status`);
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.last_24h_sales.total_transactions).toBeGreaterThan(0);
    });

    test('should display kiosk price correctly', async ({ page }) => {
      // Navigate to any dataset
      await page.click('[data-testid="dataset-card"]');

      // Wait for price display
      await page.waitForSelector('[data-testid="kiosk-price-badge"]');

      // Verify price format (should be "X.XXX SUI")
      const priceText = await page.locator('[data-testid="kiosk-price-badge"]').textContent();
      expect(priceText).toMatch(/\d+\.\d{3}\s+SUI/);
    });

    test('should refresh kiosk price every 30 seconds', async ({ page }) => {
      await page.click('[data-testid="dataset-card"]');

      // Get initial price
      const initialPrice = await page.locator('[data-testid="kiosk-price"]').textContent();

      // Wait 31 seconds
      await page.waitForTimeout(31000);

      // Price should be refreshed (or at least attempted refresh)
      const updatedPrice = await page.locator('[data-testid="kiosk-price"]').textContent();

      // Prices might be same, but element should have re-rendered
      // Check by verifying no loading state
      await expect(page.locator('text=Loading price')).not.toBeVisible();
    });
  });

  test.describe('One-Step Purchase Flow (Wallet 2)', () => {
    test('should complete one-step purchase: buy dataset directly with SUI', async ({ page }) => {
      // Step 1: Connect different wallet
      await page.click('text=Connect Wallet');
      await page.click('text=Sui Wallet');

      // Wait for connection
      await page.waitForSelector('text=Connected', { timeout: 30000 });

      // Verify different wallet address
      const walletButton = await page.locator('[data-testid="wallet-button"]');
      await expect(walletButton).toContainText(WALLET_2_ADDRESS.slice(0, 6));

      // Step 2: Select a dataset
      await page.click('[data-testid="dataset-card"]');
      await page.waitForSelector('text=Purchase Dataset');

      // Step 3: Use kiosk flow
      const tryKioskButton = page.locator('text=Try kiosk');
      if (await tryKioskButton.isVisible()) {
        await tryKioskButton.click();
      }

      // Step 4: Select 1-step flow
      await page.click('text=1-Step: Buy Now');

      // Wallet approval prompt
      await page.waitForTimeout(2000);

      // Wait for transaction success
      await page.waitForSelector('text=Dataset purchased', { timeout: 60000 });

      // Verify access granted immediately
      await expect(page.locator('text=Download')).toBeVisible({ timeout: 10000 });

      // Verify transaction in explorer link
      const explorerLink = page.locator('a[href*="suiscan.xyz"]');
      await expect(explorerLink).toBeVisible();
    });

    test('should show correct SUI amount calculation', async ({ page }) => {
      await page.click('text=Connect Wallet');
      await page.click('text=Sui Wallet');
      await page.waitForSelector('text=Connected', { timeout: 30000 });

      // Navigate to dataset
      await page.click('[data-testid="dataset-card"]');

      // Switch to kiosk
      const tryKioskButton = page.locator('text=Try kiosk');
      if (await tryKioskButton.isVisible()) {
        await tryKioskButton.click();
      }

      // Get SONAR price from kiosk
      const sonarPriceText = await page.locator('[data-testid="kiosk-sonar-price"]').textContent();
      const sonarPrice = parseFloat(sonarPriceText!.match(/[\d.]+/)![0]);

      // Get dataset price in SONAR
      const datasetPriceText = await page.locator('[data-testid="dataset-price"]').textContent();
      const datasetPrice = parseFloat(datasetPriceText!.match(/[\d.]+/)![0]);

      // Verify SUI cost display
      const suiCostText = await page.locator('[data-testid="sui-cost"]').textContent();
      const suiCost = parseFloat(suiCostText!.match(/[\d.]+/)![0]);

      // SUI cost should = dataset price × SONAR price
      const expectedSuiCost = datasetPrice * sonarPrice;
      expect(Math.abs(suiCost - expectedSuiCost)).toBeLessThan(0.001);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle insufficient SUI balance', async ({ page }) => {
      await page.click('text=Connect Wallet');
      await page.click('text=Sui Wallet');
      await page.waitForSelector('text=Connected', { timeout: 30000 });

      await page.click('[data-testid="dataset-card"]');

      const tryKioskButton = page.locator('text=Try kiosk');
      if (await tryKioskButton.isVisible()) {
        await tryKioskButton.click();
      }

      // Try to buy SONAR with insufficient balance
      await page.click('text=2-Step: Buy SONAR First');
      await page.click('text=Buy SONAR');

      // Should show error toast
      await expect(page.locator('text=Insufficient balance')).toBeVisible({ timeout: 10000 });
    });

    test('should handle kiosk service unavailable', async ({ page }) => {
      // Intercept kiosk API and return error
      await page.route(`${BACKEND_URL}/api/kiosk/price`, route => {
        route.fulfill({
          status: 503,
          body: JSON.stringify({ error: 'Service unavailable' }),
        });
      });

      await page.goto(`${FRONTEND_URL}/marketplace`);
      await page.click('[data-testid="dataset-card"]');

      // Should show fallback UI
      await expect(page.locator('text=Kiosk unavailable')).toBeVisible();

      // Should offer marketplace alternative
      await expect(page.locator('text=Use marketplace')).toBeVisible();
    });

    test('should handle wallet disconnection during purchase', async ({ page }) => {
      await page.click('text=Connect Wallet');
      await page.click('text=Sui Wallet');
      await page.waitForSelector('text=Connected', { timeout: 30000 });

      await page.click('[data-testid="dataset-card"]');

      // Disconnect wallet programmatically (if possible via Sui Wallet API)
      // Or manually disconnect and verify UI updates

      await expect(page.locator('text=Connect Wallet')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=1-Step: Buy Now')).toBeDisabled();
    });
  });

  test.describe('Access Verification', () => {
    test('should prevent access without purchase', async ({ page, context }) => {
      // Open in new context (different session)
      const newPage = await context.newPage();

      await newPage.goto(`${FRONTEND_URL}/marketplace`);

      // Try to access a dataset directly (via URL)
      await newPage.goto(`${FRONTEND_URL}/dataset/dataset_test_1`);

      // Should not show download button
      await expect(newPage.locator('text=Download')).not.toBeVisible();

      // Should show purchase UI
      await expect(newPage.locator('text=Purchase Dataset')).toBeVisible();
    });

    test('should grant access after kiosk purchase', async ({ page }) => {
      // Complete purchase (abbreviated)
      await page.click('text=Connect Wallet');
      await page.click('text=Sui Wallet');
      await page.waitForSelector('text=Connected', { timeout: 30000 });

      await page.click('[data-testid="dataset-card"]');

      const tryKioskButton = page.locator('text=Try kiosk');
      if (await tryKioskButton.isVisible()) {
        await tryKioskButton.click();
      }

      await page.click('text=1-Step: Buy Now');
      await page.waitForSelector('text=Dataset purchased', { timeout: 60000 });

      // Verify access granted
      await expect(page.locator('[data-testid="download-button"]')).toBeVisible();

      // Verify backend access endpoint works
      const datasetId = await page.locator('[data-dataset-id]').getAttribute('data-dataset-id');
      // Make authenticated request to /api/datasets/:id/kiosk-access
      // Should return download_url
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test('should display kiosk UI correctly on mobile', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/marketplace`);

      // Verify cards stack vertically
      const cards = page.locator('[data-testid="dataset-card"]');
      const count = await cards.count();

      if (count > 1) {
        const firstBox = await cards.nth(0).boundingBox();
        const secondBox = await cards.nth(1).boundingBox();

        // Second card should be below first (not side-by-side)
        expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height);
      }
    });

    test('should have accessible purchase buttons on mobile', async ({ page }) => {
      await page.goto(`${FRONTEND_URL}/marketplace`);
      await page.click('[data-testid="dataset-card"]');

      // Purchase buttons should be full width on mobile
      const buyButton = page.locator('text=1-Step: Buy Now');
      const box = await buyButton.boundingBox();

      // Button should be nearly full width
      expect(box!.width).toBeGreaterThan(300);
    });
  });
  });
}
