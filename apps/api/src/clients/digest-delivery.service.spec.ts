import { describe, expect, it, vi } from 'vitest';
import { EmailDeliveryService } from '../notifications/email-delivery.service';
import { ClientDashboardService } from './client-dashboard.service';
import { DigestDeliveryService } from './digest-delivery.service';
import { PilotClientService } from './pilot-client.service';

describe('DigestDeliveryService', () => {
  it('sends a digest to the configured digest email', async () => {
    const dashboard = {
      getDigestPreview: vi.fn(async () => ({
        cadence: 'daily',
        clientId: 'pilot-client',
        subject: 'Pilot Commerce daily support summary',
        generatedAt: '2026-05-16T00:00:00.000Z',
        summary: {
          conversations: 12,
          tickets: 3,
          openTickets: 1,
          resolvedTickets: 2,
          p1Tickets: 1,
          containmentRate: 75,
          averageConfidence: 88,
          averageCsat: 4.5,
          salesRecoveredEstimate: 5000,
        },
        narrative: '12 conversations handled, 1 open tickets, estimated BDT 5000 sales protected.',
      })),
    } as unknown as ClientDashboardService;
    const clients = {
      findById: vi.fn(async () => ({
        id: 'pilot-client',
        businessName: 'Pilot Commerce',
        pageId: 'pilot-page',
        onboardingStatus: 'active',
        defaultLanguage: 'mixed',
        tone: 'friendly',
        escalationKeywords: [],
        ownerEmail: 'owner@example.com',
        digestEmail: 'digest@example.com',
      })),
    } as unknown as PilotClientService;
    const email = {
      sendEmail: vi.fn(async () => ({
        mode: 'dry-run' as const,
        provider: 'postmark' as const,
        to: 'digest@example.com',
        subject: 'Pilot Commerce daily support summary',
      })),
    } as unknown as EmailDeliveryService;
    const service = new DigestDeliveryService(dashboard, clients, email);

    const result = await service.sendDigest('pilot-client', 'daily');

    expect(result.delivery.mode).toBe('dry-run');
    expect(result.destination).toBe('digest@example.com');
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'digest@example.com',
        subject: 'Pilot Commerce daily support summary',
        tag: 'daily-digest',
      }),
    );
  });
});
