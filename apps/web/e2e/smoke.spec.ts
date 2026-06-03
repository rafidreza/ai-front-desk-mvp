import { expect, test } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';

const internalSessionSecret =
  process.env.INTERNAL_CONSOLE_SESSION_SECRET ?? 'dev-internal-console-session-secret-only-for-smoke-tests';

function base64Url(input: string) {
  return Buffer.from(input).toString('base64url');
}

function signedInternalSessionCookie() {
  const payload = base64Url(
    JSON.stringify({
      sub: 'internal-console',
      userId: 'ops-admin',
      label: 'Admin',
      email: 'admin@daemion.local',
      role: 'admin',
      nonce: randomUUID(),
      exp: Date.now() + 1000 * 60 * 60,
    }),
  );
  const signature = createHmac('sha256', internalSessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

async function mockInternalBackend(page: import('@playwright/test').Page) {
  await page.route('**/api/internal-session', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'ops-admin', label: 'Admin', email: 'admin@daemion.local', role: 'admin' },
      }),
    }),
  );
  await page.route('**/api/backend/**', (route) => {
    const url = new URL(route.request().url());
    const backendPath = url.pathname.replace('/api/backend', '') || '/';
    const now = new Date().toISOString();

    if (backendPath === '/health/db') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', database: { enabled: true, ok: true, latencyMs: 8 } }),
      });
    }
    if (backendPath === '/health/ai') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          isDegraded: false,
          failureCount: 0,
          windowMinutes: 5,
          threshold: 3,
          fallbackActive: false,
          message: 'AI provider ready.',
        }),
      });
    }
    if (backendPath === '/clients') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          clients: [
            {
              id: 'pilot-client',
              businessName: 'Pilot Boutique',
              pageId: 'pilot-page',
              status: 'active',
              onboardingStatus: 'ready',
              lifecycleStage: 'shadow',
              defaultLanguage: 'english',
              tone: 'warm',
              escalationKeywords: [],
              channels: [],
            },
          ],
        }),
      });
    }
    if (backendPath === '/tickets') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          tickets: [
            {
              id: 'ticket-1',
              clientId: 'pilot-client',
              conversationId: 'conv-1',
              version: 1,
              priority: 'P1',
              status: 'open',
              reason: 'refund escalation',
              customerMessage: 'Customer is upset about refund timing.',
              suggestedReply: 'We will check and update you.',
              salesRecoveredEstimate: 0,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
      });
    }
    if (backendPath === '/conversations/calibration-queue') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          filter: 'all',
          conversations: [
            {
              id: 'conv-1',
              clientId: 'pilot-client',
              channel: 'messenger',
              externalConversationId: 'thread-1',
              externalSenderId: 'customer-1',
              messages: [{ id: 'm1', direction: 'inbound', text: 'Where is my refund?', createdAt: now }],
              ticketId: 'ticket-1',
              lastConfidence: 0.32,
              hallucinationFlag: false,
              autoQaGrade: 'fail',
              autoQaDefects: ['escalation_needed'],
              autoQaReason: 'Low confidence on refund question.',
              autoQaAt: now,
            },
          ],
          summary: { total: 1, ungraded: 1, failed: 1, review: 0, hallucinationRisk: 0, escalationRisk: 1 },
        }),
      });
    }
    if (backendPath === '/internal/knowledge-requests') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          requests: [
            {
              id: 'kb-1',
              clientId: 'pilot-client',
              requestType: 'create',
              status: 'submitted',
              urgency: 'urgent',
              proposedTitle: 'Refund timeline',
              proposedAnswer: 'Refunds are usually reviewed within two business days.',
              proposedKeywords: ['refund'],
              proposedCategory: 'support',
              submittedBy: 'client-portal',
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
      });
    }

    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'mock missing' }) });
  });
}

test.describe('web smoke checks', () => {
  test('renders the public landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Daemion/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Autonomous support operations/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Customer login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();

    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: /How Daemion handles support data/i })).toBeVisible();
    await expect(page.getByText(/Last updated: May 31, 2026/i)).toBeVisible();
  });

  test('renders signup and login entry points', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('link', { name: 'Daemion' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Open a workspace/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create workspace and send code/i })).toBeVisible();

    await page.goto('/client/login');
    await expect(page.getByRole('link', { name: 'Daemion' })).toBeVisible();
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

  test('renders the internal improvement board for signed-in operators', async ({ page, context, baseURL }) => {
    await context.addCookies([
      {
        name: 'afd_internal_session',
        value: signedInternalSessionCookie(),
        url: baseURL,
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
    await mockInternalBackend(page);

    await page.goto('/internal/improvement');
    await expect(page.getByRole('heading', { name: /Weekly QA and launch fixes/i })).toBeVisible();
    await expect(page.getByText('Pilot Boutique').first()).toBeVisible();
    await expect(page.getByText('Refund timeline')).toBeVisible();
    await expect(page.getByText('Review risky replies')).toBeVisible();
  });
});
