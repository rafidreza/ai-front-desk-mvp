import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelSendService } from '../channels/channel-send.service';
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
    const channelSend = {
      sendText: vi.fn(async () => ({
        mode: 'dry-run' as const,
        channel: 'whatsapp' as const,
        recipientId: '8801712345678',
        text: 'P1 support alert',
      })),
    } as unknown as ChannelSendService;
    const service = new UrgentTicketNotificationService(channelSend);

    const result = await service.notifyP1({ client, ticket: p1Ticket });

    expect(result.mode).toBe('dry-run');
    expect(result.recipient).toBe('8801712345678');
    expect(result.text).toContain('P1 support alert');
    expect(channelSend.sendText).toHaveBeenCalledWith(expect.objectContaining({ channel: 'whatsapp', purpose: 'p1-ticket-alert' }));
  });

  it('skips when no POC phone number is configured', async () => {
    const service = new UrgentTicketNotificationService();

    const result = await service.notifyP1({ client: { ...client, whatsappPoc: undefined }, ticket: p1Ticket });

    expect(result).toMatchObject({ mode: 'skipped', reason: 'missing_whatsapp_poc' });
  });

  it('returns sent mode from the shared channel sender', async () => {
    const channelSend = {
      sendText: vi.fn(async () => ({
        mode: 'sent' as const,
        channel: 'whatsapp' as const,
        recipientId: '8801712345678',
        text: 'P1 support alert',
      })),
    } as unknown as ChannelSendService;
    const service = new UrgentTicketNotificationService(channelSend);

    const result = await service.notifyP1({ client, ticket: p1Ticket });

    expect(result.mode).toBe('sent');
    expect(channelSend.sendText).toHaveBeenCalledOnce();
  });
});
