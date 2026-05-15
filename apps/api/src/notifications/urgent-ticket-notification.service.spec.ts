import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientProfile, Ticket } from '../types/domain';
import { UrgentTicketNotificationService } from './urgent-ticket-notification.service';

const client: ClientProfile = {
  id: 'pilot-client',
  businessName: 'Pilot Commerce',
  pageId: 'pilot-page',
  onboardingStatus: 'active',
  defaultLanguage: 'mixed',
  tone: 'friendly',
  escalationKeywords: ['refund'],
  whatsappPoc: '+8801712345678',
};

const p1Ticket: Ticket = {
  id: 'ticket-1',
  clientId: 'pilot-client',
  conversationId: 'conversation-1',
  version: 0,
  priority: 'P1',
  status: 'open',
  reason: 'Matched escalation keyword: refund',
  customerMessage: 'I want a refund',
  suggestedReply: 'The team will check.',
  salesRecoveredEstimate: 2500,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('UrgentTicketNotificationService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('dry-runs P1 WhatsApp pings when provider credentials are missing', async () => {
    const service = new UrgentTicketNotificationService();

    const result = await service.notifyP1({ client, ticket: p1Ticket });

    expect(result.mode).toBe('dry-run');
    expect(result.recipient).toBe('8801712345678');
    expect(result.text).toContain('P1 support alert');
  });

  it('skips when no POC phone number is configured', async () => {
    const service = new UrgentTicketNotificationService();

    const result = await service.notifyP1({ client: { ...client, whatsappPoc: undefined }, ticket: p1Ticket });

    expect(result).toMatchObject({ mode: 'skipped', reason: 'missing_whatsapp_poc' });
  });

  it('sends through WhatsApp Cloud API when credentials exist', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-number-id';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new UrgentTicketNotificationService();

    const result = await service.notifyP1({ client, ticket: p1Ticket });

    expect(result.mode).toBe('sent');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v20.0/phone-number-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });
});
