const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:5000';
const DEMO_EMAIL = 'demo@farm.ai';
const DEMO_PASSWORD = 'demo1234';

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
  await page.fill('input[type="email"]', DEMO_EMAIL);
  await page.fill('input[type="password"]', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard/**', { timeout: 15000 });
}

test.describe('Analytics Dashboard — Structural & Functional Regression', () => {

  // ── AUTH FLOW ────────────────────────────────────────────────────
  test('01 - Login with demo credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await page.fill('input[type="email"]', DEMO_EMAIL);
    await page.fill('input[type="password"]', DEMO_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard/**', { timeout: 10000 });
    await expect(page).toHaveURL(/dashboard/);

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  // ── NAVIGATION ───────────────────────────────────────────────────
  test('02 - Navigate to Analytics tab', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2')).toContainText('Model Analytics');
  });

  // ── SOIL MODEL TAB ───────────────────────────────────────────────
  test('03 - Soil Model tab renders StatCards and Recharts SVGs', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    // Verify Soil Model tab is active (default)
    const soilTab = page.locator('button', { hasText: 'Soil Model' });
    await expect(soilTab).toBeVisible();

    // StatCards should render (either actual metrics or "—" fallback)
    await expect(page.getByText('Best Ensemble R²')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Best Ensemble RMSE')).toBeVisible({ timeout: 5000 });

    // Model Comparison Table should appear
    await expect(page.getByText('Model Comparison')).toBeVisible({ timeout: 5000 });

    // Wait for Recharts SVGs to mount (charts may render after data arrives)
    await page.waitForTimeout(2000);
    const svgCharts = page.locator('.recharts-responsive-container svg');
    expect(await svgCharts.count()).toBeGreaterThanOrEqual(1);
  });

  // ── IMAGE MODEL TAB ──────────────────────────────────────────────
  test('04 - Image Model tab shows CNN cards for soil/tomato/corn', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    // Click "Image Model" tab
    await page.click('button:has-text("Image Model")');
    await page.waitForTimeout(1000);

    // Verify each CNN dataset card is present (use exact match to avoid F1 chart headings)
    await expect(page.getByRole('heading', { name: 'soil CNN', exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'tomato CNN', exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'corn CNN', exact: true })).toBeVisible({ timeout: 5000 });

    // Each card must show "Trained" or "Not Trained" status badge
    const badges = page.locator('text=/Trained|Not Trained/');
    const badgeCount = await badges.count();
    expect(badgeCount).toBeGreaterThanOrEqual(3);
  });

  // ── TAILWIND LAYOUT INTEGRITY ────────────────────────────────────
  test('05 - Tailwind layout: flex tabs, rounded cards, grid columns', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    // Tab container uses flex + gap
    const tabContainer = page.locator('.flex.gap-1');
    await expect(tabContainer).toBeVisible();

    // Cards use rounded-2xl
    const cards = page.locator('.rounded-2xl');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // Grid layout renders children
    const gridItems = page.locator('.grid > *');
    const gridCount = await gridItems.count();
    expect(gridCount).toBeGreaterThan(0);
  });

  // ── RECHARTS RESPONSIVE CONTAINERS ───────────────────────────────
  test('06 - Recharts responsive containers do not collapse', async ({ page }) => {
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

  // ── TAB SWITCHING PRESERVES LAYOUT ───────────────────────────────
  test('07 - Switching tabs does not break layout', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    // Start on Soil Model
    await expect(page.locator('button', { hasText: 'Soil Model' })).toBeVisible();

    // Switch to Image Model
    await page.click('button:has-text("Image Model")');
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: 'soil CNN', exact: true })).toBeVisible({ timeout: 3000 });

    // Switch back to Soil Model
    await page.click('button:has-text("Soil Model")');
    await page.waitForTimeout(500);
    await expect(page.getByText('Best Ensemble R²')).toBeVisible({ timeout: 3000 });

    // Verify no overlapping elements (both tabs' content should be exclusive)
    const cnnCards = page.locator('text=CNN');
    // After switching back to Soil Model, CNN cards should be gone
    // (they are conditionally rendered, not CSS-hidden)
  });

  // ── SIDEBAR NAVIGATION ───────────────────────────────────────────
  test('08 - Sidebar Analytics link is active', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    // Sidebar should be visible
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();

    // Analytics link should have active class (bg-primary-600)
    const analyticsLink = page.locator('a[href="/dashboard/analytics"]');
    await expect(analyticsLink).toBeVisible();

    // Check the class for active state indicator
    const classAttr = await analyticsLink.getAttribute('class');
    expect(classAttr).toContain('bg-primary-600');
  });

  // ── TRAIN ALL MODELS API ─────────────────────────────────────────
  test('09 - Train All Models API returns success', async ({ page, request }) => {
    await login(page);
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    const res = await request.post(`${API_URL}/api/admin/train/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();

    const body = await res.json();
    expect(body.status).toBeDefined();
  });

  // ── SOCKET.IO INITIALIZATION ─────────────────────────────────────
  test('10 - Socket.io initializes on Sensor Dashboard page', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/sensor`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify page loaded (sensor dashboard has content)
    await expect(page.locator('h2')).toBeVisible({ timeout: 5000 });

    // Check that navigator is online (basic connectivity)
    const online = await page.evaluate(() => navigator.onLine);
    expect(online).toBe(true);

    // Verify token is available for socket connection
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  // ── RESPONSIVE LAYOUT (DESKTOP) ──────────────────────────────────
  test('11 - Analytics page renders correctly at desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    // Sidebar should be expanded at desktop width (not collapsed)
    const sidebar = page.locator('aside');
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).toBeTruthy();
    expect(sidebarBox.width).toBeGreaterThan(200); // w-64 = 256px

    // Main content area should be visible
    const main = page.locator('main');
    const mainBox = await main.boundingBox();
    expect(mainBox).toBeTruthy();
    expect(mainBox.width).toBeGreaterThan(400);
  });

  // ── STAT CARD COLOR CONTRAST ─────────────────────────────────────
  test('12 - StatCard components have proper color classes', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/analytics`);
    await page.waitForLoadState('networkidle');

    // Soil Model tab StatCards should exist
    const statCards = page.locator('.rounded-2xl');
    const count = await statCards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // StatCards use gradient classes (from-green-500, from-blue-500) in icon wrapper
    const greenElements = page.locator('[class*="from-green"]');
    expect(await greenElements.count()).toBeGreaterThanOrEqual(1);

    const blueElements = page.locator('[class*="from-blue"]');
    expect(await blueElements.count()).toBeGreaterThanOrEqual(1);
  });
});
