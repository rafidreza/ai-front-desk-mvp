import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { PilotClientService } from '../clients/pilot-client.service';
import { ConversationService } from '../conversations/conversation.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { IncomingMessage } from '../types/domain';
import { MessengerSendService } from './messenger-send.service';
import { MessengerSignatureService } from './messenger-signature.service';

const MessengerWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      messaging: z.array(
        z.object({
          sender: z.object({ id: z.string() }),
          recipient: z.object({ id: z.string() }),
          timestamp: z.number().optional(),
          message: z
            .object({
              mid: z.string().optional(),
              text: z.string().optional(),
            })
            .optional(),
        }),
      ),
    }),
  ),
});

@Controller('webhooks/messenger')
export class MessengerController {
  constructor(
    private readonly clients: PilotClientService,
    private readonly conversations: ConversationService,
    private readonly messengerSend: MessengerSendService,
    private readonly signatures: MessengerSignatureService,
    private readonly logger: StructuredLoggerService,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    const expectedToken = process.env.MESSENGER_VERIFY_TOKEN;
    if (
      expectedToken === undefined &&
      (process.env.NODE_ENV === 'production' || process.env.ENABLE_MESSENGER === 'true')
    ) {
      throw new UnauthorizedException('Messenger verification token is required.');
    }

    if (mode === 'subscribe' && verifyToken === expectedToken && challenge !== undefined) {
      return challenge;
    }

    throw new UnauthorizedException('Invalid Messenger verification token.');
  }

  @Post()
  @HttpCode(200)
  async receiveMessage(
    @Body() body: unknown,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    const signatureResult = this.signatures.verify({ signature, rawBody: request.rawBody });
    const parsed = MessengerWebhookSchema.parse(body);
    const processed = [];

    this.logger.event('messenger.webhook.received', {
      signatureMode: signatureResult.mode,
      entryCount: parsed.entry.length,
    });

    for (const entry of parsed.entry) {
      const client = await this.clients.findByPageId(entry.id);

      for (const event of entry.messaging) {
        if (event.message?.text === undefined) {
          continue;
        }

        const incoming: IncomingMessage = {
          id: event.message.mid ?? `${event.sender.id}:${event.timestamp ?? Date.now()}`,
          clientId: client.id,
          channel: 'messenger',
          externalConversationId: event.sender.id,
          externalSenderId: event.sender.id,
          text: event.message.text,
          receivedAt: new Date(event.timestamp ?? Date.now()).toISOString(),
        };

        const result = await this.conversations.handleIncomingMessage(incoming);
        const sendResult = result.alreadyProcessed
          ? { mode: 'skipped' as const, recipientId: event.sender.id, text: result.reply.text }
          : await this.messengerSend.sendText({
              recipientId: event.sender.id,
              text: result.reply.text,
            });

        this.logger.event('messenger.message.processed', {
          clientId: incoming.clientId,
          externalConversationId: incoming.externalConversationId,
          confidence: result.reply.confidence,
          shouldEscalate: result.reply.shouldEscalate,
          ticketId: result.ticket?.id,
          sendMode: sendResult.mode,
          alreadyProcessed: result.alreadyProcessed,
        });

        processed.push({
          incomingMessageId: incoming.id,
          reply: result.reply,
          ticket: result.ticket,
          sendResult,
        });
      }
    }

    return {
      status: 'ok',
      processedCount: processed.length,
      processed,
    };
  }
}
