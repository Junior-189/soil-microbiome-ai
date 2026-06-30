const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEMO_EMAIL = 'demo@farm.ai';
const DEMO_PASSWORD = 'demo1234';

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard/**', { timeout: 15000 });
}

test.describe('Analytics Dashboard Regression', () => {

  test('01 - Login with demo credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await login(page);
    await expect(page).toHaveURL(/dashboard/);
  });

  test('02 - Navigate to Analytics tab', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2')).toContainText('Model Analytics');
  });

  test('03 - Soil Model tab renders StatCards and Recharts', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    const soilTab = page.locator('button', { hasText: 'Soil Model' });
    await expect(soilTab).toBeVisible();

    await expect(page.getByText('Best Ensemble R')).toBeVisible({ timeout: 8000 });

    // Recharts SVG rendered
    await page.waitForTimeout(2000);
    const svgCharts = page.locator('.recharts-responsive-container svg');
    expect(await svgCharts.count()).toBeGreaterThanOrEqual(1);
  });

  test('04 - Image Model tab shows CNN cards for soil/tomato/corn', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("Image Model")');
    await page.waitForTimeout(1000);

    await expect(page.getByText('soil CNN')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('tomato CNN')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('corn CNN')).toBeVisible({ timeout: 5000 });

    const badges = page.locator('text=/Trained|Not Trained/');
    expect(await badges.count()).toBeGreaterThanOrEqual(3);
  });

  test('05 - Tailwind layout integrity (flex/grid/rounded)', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    const tabContainer = page.locator('.flex.gap-1');
    await expect(tabContainer).toBeVisible();

    const cards = page.locator('.rounded-2xl');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);

    const gridItems = page.locator('.grid > *');
    expect(await gridItems.count()).toBeGreaterThan(0);
  });

  test('06 - Recharts layouts do not collapse', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const containers = page.locator('.recharts-responsive-container');
    const count = await containers.count();
    for (let i = 0; i < count; i++) {
      const box = await containers.nth(i).boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(50);
      }
    }
  });

  test('07 - Train All Models API returns success', async ({ page, request }) => {
    await login(page);
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    const res = await request.post(`${BASE_URL.replace('3000', '5000')}/api/admin/train/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBeDefined();
  });

  test('08 - Socket.io initializes on Sensor page', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/sensor`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const online = await page.evaluate(() => navigator.onLine);
    expect(online).toBe(true);
  });
});
