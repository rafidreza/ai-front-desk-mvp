import { describe, expect, it, vi } from 'vitest';
import { ConversationService } from '../conversations/conversation.service';
import { WebChatController } from './web-chat.controller';

describe('WebChatController', () => {
  it('routes public web chat messages through the conversation engine', async () => {
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
    } as unknown as ConversationService;
    const controller = new WebChatController(conversations);

    const result = await controller.receiveMessage({
      clientId: 'pilot-client',
      visitorId: 'visitor-1',
      text: 'delivery charge koto?',
      messageId: 'web-message-1',
    });

    expect(result.conversationId).toBe('conversation-1');
    expect(result.reply.text).toBe('Delivery is BDT 80.');
    expect(conversations.handleIncomingMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'web-message-1',
        clientId: 'pilot-client',
        channel: 'web',
        externalConversationId: 'visitor-1',
        text: 'delivery charge koto?',
      }),
    );
  });
});
