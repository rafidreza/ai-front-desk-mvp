import { Body, Controller, Get, Headers, HttpCode, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { PilotClientService } from '../clients/pilot-client.service';
import { ConversationService } from '../conversations/conversation.service';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { IncomingMessage } from '../types/domain';
import { ChannelSendService } from './channel-send.service';
import { WhatsAppSignatureService } from './whatsapp-signature.service';

const WhatsAppWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            metadata: z.object({
              phone_number_id: z.string(),
              display_phone_number: z.string().optional(),
            }),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string(),
                  timestamp: z.string().optional(),
                  type: z.string().optional(),
                  text: z.object({ body: z.string().optional() }).optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});

function getReceivedAt(timestamp?: string) {
  const seconds = Number(timestamp);
  if (Number.isFinite(seconds) && seconds > 0) {
    return new Date(seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

function parseCsatScore(text?: string): number | null {
  const normalized = text?.trim().toLowerCase();
  const match = normalized?.match(/^(?:csat|rating|score)[_: -]?([1-5])$/);
  if (match?.[1] !== undefined) return Number(match[1]);
  if (normalized === '👍') return 5;
  if (normalized === '👎') return 1;
  return null;
}

@Controller('webhooks/whatsapp')
export class WhatsAppController {
  constructor(
    private readonly clients: PilotClientService,
    private readonly conversations: ConversationService,
    private readonly channelSend: ChannelSendService,
    private readonly signatures: WhatsAppSignatureService,
    private readonly logger: StructuredLoggerService,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN ?? process.env.MESSENGER_VERIFY_TOKEN;
    if (
      expectedToken === undefined &&
      (process.env.NODE_ENV === 'production' || process.env.ENABLE_WHATSAPP === 'true')
    ) {
      throw new UnauthorizedException('WhatsApp verification token is required.');
    }

    if (mode === 'subscribe' && verifyToken === expectedToken && challenge !== undefined) {
      return challenge;
    }

    throw new UnauthorizedException('Invalid WhatsApp verification token.');
  }

  @Post()
  @HttpCode(200)
  async receiveMessage(
    @Body() body: unknown,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    const signatureResult = this.signatures.verify({ signature, rawBody: request.rawBody });
    const parsed = WhatsAppWebhookSchema.parse(body);
    const processed = [];

    this.logger.event('whatsapp.webhook.received', {
      signatureMode: signatureResult.mode,
      entryCount: parsed.entry.length,
    });

    for (const entry of parsed.entry) {
      for (const change of entry.changes) {
        const client = await this.clients.findByWhatsAppIdentifier(change.value.metadata.phone_number_id);

        for (const message of change.value.messages ?? []) {
          const text = message.text?.body;
          if (text === undefined || text.trim() === '') {
            continue;
          }

          const csatScore = parseCsatScore(text);
          if (csatScore !== null) {
            const conversation = await this.conversations.captureCsatFromChannel({
              clientId: client.id,
              channel: 'whatsapp',
              externalConversationId: message.from,
              score: csatScore,
              comment: text,
            });
            processed.push({
              type: 'csat',
              externalConversationId: message.from,
              score: csatScore,
              conversationId: conversation?.id,
            });
            continue;
          }

          const incoming: IncomingMessage = {
            id: message.id,
            clientId: client.id,
            channel: 'whatsapp',
            externalConversationId: message.from,
            externalSenderId: message.from,
            text,
            receivedAt: getReceivedAt(message.timestamp),
          };

          const result = await this.conversations.handleIncomingMessage(incoming);
          const sendResult = result.alreadyProcessed
            ? { mode: 'skipped' as const, channel: 'whatsapp' as const, recipientId: message.from, text: result.reply.text }
            : await this.channelSend.sendText({
                channel: 'whatsapp',
                recipientId: message.from,
                text: result.reply.text,
                purpose: 'whatsapp.reply',
              });

          this.logger.event('whatsapp.message.processed', {
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
    }

    return {
      status: 'ok',
      processedCount: processed.length,
      processed,
    };
  }
}
