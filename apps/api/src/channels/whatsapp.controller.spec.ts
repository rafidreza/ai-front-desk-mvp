import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { PilotClientService } from '../clients/pilot-client.service';
import { ConversationService } from '../conversations/conversation.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { ChannelSendService } from './channel-send.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppSignatureService } from './whatsapp-signature.service';

function createController() {
  const clients = {
    findByWhatsAppIdentifier: vi.fn(async () => ({
      id: 'pilot-client',
      businessName: 'Pilot Commerce',
      pageId: 'phone-number-id',
      onboardingStatus: 'active',
      defaultLanguage: 'mixed',
      tone: 'friendly',
      escalationKeywords: ['refund'],
    })),
  } as unknown as PilotClientService;
  const conversations = {
    handleIncomingMessage: vi.fn(async () => ({
      conversation: { id: 'conversation-1' },
      reply: {
        text: 'Delivery is BDT 80.',
        confidence: 0.9,
        matchedKnowledgeIds: ['delivery-charge'],
        shouldEscalate: false,
      },
    })),
    captureCsatFromChannel: vi.fn(async () => ({ id: 'conversation-1' })),
  } as unknown as ConversationService;
  const channelSend = {
    sendText: vi.fn(async () => ({
      mode: 'dry-run' as const,
      channel: 'whatsapp' as const,
      recipientId: '8801712345678',
      text: 'Delivery is BDT 80.',
    })),
  } as unknown as ChannelSendService;
  const signatures = {
    verify: vi.fn(() => ({ mode: 'skipped' as const })),
  } as unknown as WhatsAppSignatureService;
  const logger = {
    event: vi.fn(),
  } as unknown as StructuredLoggerService;

  return {
    channelSend,
    clients,
    conversations,
    controller: new WhatsAppController(clients, conversations, channelSend, signatures, logger),
  };
}

const request = {} as Request & { rawBody?: Buffer };

const webhookPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'waba-id',
      changes: [
        {
          value: {
            metadata: {
              phone_number_id: 'phone-number-id',
              display_phone_number: '15551234567',
            },
            messages: [
              {
                from: '8801712345678',
                id: 'wamid-1',
                timestamp: '1710000000',
                type: 'text',
                text: { body: 'delivery charge koto?' },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('WhatsAppController', () => {
  it('verifies webhook challenge with the configured token', () => {
    const original = process.env.WHATSAPP_VERIFY_TOKEN;
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-token';
    const { controller } = createController();

    expect(controller.verifyWebhook('subscribe', 'verify-token', 'challenge-1')).toBe('challenge-1');
    expect(() => controller.verifyWebhook('subscribe', 'wrong', 'challenge-1')).toThrow(UnauthorizedException);

    if (original === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = original;
  });

  it('routes inbound WhatsApp text through the conversation engine and shared sender', async () => {
    const { channelSend, clients, conversations, controller } = createController();

    const result = await controller.receiveMessage(webhookPayload, undefined, request);

    expect(result.processedCount).toBe(1);
    expect(clients.findByWhatsAppIdentifier).toHaveBeenCalledWith('phone-number-id');
    expect(conversations.handleIncomingMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'wamid-1',
        channel: 'whatsapp',
        externalConversationId: '8801712345678',
        text: 'delivery charge koto?',
      }),
    );
    expect(channelSend.sendText).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        recipientId: '8801712345678',
        text: 'Delivery is BDT 80.',
        purpose: 'whatsapp.reply',
      }),
    );
  });

  it('captures CSAT payloads without generating a reply', async () => {
    const { channelSend, conversations, controller } = createController();
    const payload = structuredClone(webhookPayload);
    payload.entry[0].changes[0].value.messages[0].text.body = 'CSAT_5';

    const result = await controller.receiveMessage(payload, undefined, request);

    expect(result.processed[0]).toMatchObject({ type: 'csat', score: 5 });
    expect(conversations.captureCsatFromChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'whatsapp',
        externalConversationId: '8801712345678',
        score: 5,
      }),
    );
    expect(channelSend.sendText).not.toHaveBeenCalled();
  });
});
