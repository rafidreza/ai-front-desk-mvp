import { expect, test } from '@playwright/test';

test.describe('web smoke checks', () => {
  test('renders the public landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Daemion/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /AI customer support/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Create client account/i })).toBeVisible();
  });

  test('renders signup and login entry points', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText('Daemion')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Open a workspace/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create workspace and send code/i })).toBeVisible();

    await page.goto('/client/login');
    await expect(page.getByText('Daemion')).toBeVisible();
    await expect(page.getByRole('button', { name: /Send code/i })).toBeVisible();

    await page.goto('/internal/login');
    await expect(page.getByRole('heading', { name: 'Daemion' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open console/i })).toBeDisabled();
  });

  test('protects internal and client pages from anonymous visitors', async ({ page }) => {
    await page.goto('/internal/tickets');
    await expect(page).toHaveURL(/\/internal\/login\?next=%2Finternal%2Ftickets/);

    await page.goto('/client/dashboard?clientId=pilot-client');
    await expect(page).toHaveURL(/\/client\/login\?next=%2Fclient%2Fdashboard%3FclientId%3Dpilot-client/);
    await expect(page.getByText(/Verify your access code to continue/i)).toBeVisible();
  });

  test('renders the embeddable widget consent gate', async ({ page }) => {
    await page.goto('/widget?clientId=pilot-client');
    await expect(page.getByLabel(/Daemion web chat/i)).toBeVisible();
    await expect(page.getByText(/Usually replies instantly/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Agree and start chat/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Type your message/i)).toBeHidden();
  });
});
