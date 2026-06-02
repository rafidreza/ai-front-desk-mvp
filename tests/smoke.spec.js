import { expect, test } from '@playwright/test';

const routes = [
  ['/', /Daemion builds cognition systems/i],
  ['/research', /Daemion studies autonomous cognition/i],
  ['/divisions', /Each addresses one layer/i],
  ['/products', /Cognition for individuals/i],
  ['/labs', /Internal research on architectural gaps/i],
  ['/company', /frontier intelligence company headquartered in Dhaka/i],
  ['/careers', /Deliberate hiring/i],
  ['/contact', /does not run a sales funnel/i],
  ['/privacy', /Privacy Policy/i],
  ['/terms', /Terms of Service/i],
  ['/data-deletion', /Data Deletion/i],
];

test.describe('Daemion public website', () => {
  for (const [path, heading] of routes) {
    test(`renders ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('link', { name: /Daemion home/i })).toBeVisible();
      await expect(page.getByText(heading).first()).toBeVisible();
    });
  }

  test('mobile menu opens and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: /menu/i }).click();
    await expect(page.getByRole('navigation', { name: /Primary navigation/i })).toHaveClass(/is-open/);
    await page.getByRole('navigation', { name: /Primary navigation/i }).getByRole('link', { name: 'Products' }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByText(/Four products/i).first()).toBeVisible();
  });
});
