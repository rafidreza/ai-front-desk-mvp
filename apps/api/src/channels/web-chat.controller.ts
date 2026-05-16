import { Body, Controller, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { ConversationService } from '../conversations/conversation.service';
import { IncomingMessage } from '../types/domain';

const WebChatMessageSchema = z.object({
  clientId: z.string().trim().min(2),
  visitorId: z.string().trim().min(2).max(160),
  text: z.string().trim().min(1).max(1000),
  messageId: z.string().trim().min(2).max(180).optional(),
});

@Controller('web-chat')
export class WebChatController {
  constructor(private readonly conversations: ConversationService) {}

  @Post('messages')
  async receiveMessage(@Body() body: unknown) {
    const parsed = WebChatMessageSchema.parse(body);
    const message: IncomingMessage = {
      id: parsed.messageId ?? `web:${parsed.visitorId}:${randomUUID()}`,
      clientId: parsed.clientId,
      channel: 'web',
      externalConversationId: parsed.visitorId,
      externalSenderId: parsed.visitorId,
      text: parsed.text,
      receivedAt: new Date().toISOString(),
    };

    const result = await this.conversations.handleIncomingMessage(message);
    return {
      conversationId: result.conversation.id,
      reply: result.reply,
      ticket: result.ticket,
      alreadyProcessed: result.alreadyProcessed ?? false,
    };
  }
}
