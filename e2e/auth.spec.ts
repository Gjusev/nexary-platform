import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page).toHaveTitle(/Nexary/);
    await expect(page.locator('h1')).toContainText('Sign in');
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/en/login');

    // Try to submit without filling the form
    await page.click('button[type="submit"]');

    // Check for validation errors
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (will redirect to login if not authenticated)
    await page.goto('/en/dashboard');
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display dashboard when authenticated', async ({ page }) => {
    // TODO: Add authentication setup for E2E tests
    // For now, just verify the page loads
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate to different pages', async ({ page }) => {
    // Test homepage
    await page.goto('/en');
    await expect(page).toHaveURL(/\/en/);

    // Test about page or other public pages
    await page.goto('/en/login');
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe('Performance', () => {
  test('should load homepage within performance budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Homepage should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have no console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/en');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });
});
