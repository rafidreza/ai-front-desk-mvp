import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../db/client';
import { envString, isProduction } from '../env';
import { BadRequestError, UnauthorizedError } from '../errors';
import { createServices } from '../services';
import { sha256HmacMatches } from '../utils/crypto';
import { jsonBody } from './helpers';

const WebChatMessageSchema = z.object({
  clientId: z.string().trim().min(2),
  visitorId: z.string().trim().min(2).max(160),
  text: z.string().trim().min(1).max(1000),
  messageId: z.string().trim().min(2).max(180).optional(),
  pdpaConsent: z.boolean().optional(),
  consentVersion: z.string().trim().min(2).max(80).optional(),
});

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
          message: z.object({
            mid: z.string().optional(),
            text: z.string().optional(),
            quick_reply: z.object({ payload: z.string().optional() }).optional(),
            attachments: z.array(z.object({
              type: z.string(),
              payload: z.object({ url: z.string().optional() }).optional(),
            })).optional(),
          }).optional(),
          postback: z.object({ payload: z.string().optional(), title: z.string().optional() }).optional(),
        }),
      ),
    }),
  ),
});

const WhatsAppWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            metadata: z.object({ phone_number_id: z.string(), display_phone_number: z.string().optional() }),
            messages: z.array(z.object({
              from: z.string(),
              id: z.string(),
              timestamp: z.string().optional(),
              type: z.string().optional(),
              text: z.object({ body: z.string().optional() }).optional(),
              audio: z.object({ id: z.string(), mime_type: z.string().optional() }).optional(),
              image: z.object({ id: z.string(), mime_type: z.string().optional(), caption: z.string().optional() }).optional(),
            })).optional(),
          }),
        }),
      ),
    }),
  ),
});

function getReceivedAt(timestamp?: string) {
  const seconds = Number(timestamp);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(seconds * 1000).toISOString();
  return new Date().toISOString();
}

function parseMessengerCsat(payload?: string, text?: string) {
  const normalizedPayload = payload?.trim().toLowerCase();
  const payloadMatch = normalizedPayload?.match(/(?:csat|rating|score)[_: -]?([1-5])/) ?? normalizedPayload?.match(/^([1-5])$/);
  if (payloadMatch?.[1] !== undefined) return Number(payloadMatch[1]);
  const normalizedText = text?.trim().toLowerCase();
  const textMatch = normalizedText?.match(/(?:csat|rating|score)[_: -]?([1-5])/);
  if (textMatch?.[1] !== undefined) return Number(textMatch[1]);
  if (normalizedText === '👍') return 5;
  if (normalizedText === '👎') return 1;
  return null;
}

function parseWhatsAppCsat(text?: string) {
  const normalized = text?.trim().toLowerCase();
  const match = normalized?.match(/^(?:csat|rating|score)[_: -]?([1-5])$/);
  if (match?.[1] !== undefined) return Number(match[1]);
  if (normalized === '👍') return 5;
  if (normalized === '👎') return 1;
  return null;
}

async function verifyMessengerSignature(env: AppBindings['Bindings'], signature: string | undefined, rawBody: string) {
  const appSecret = envString(env, 'MESSENGER_APP_SECRET');
  const shouldEnforce = isProduction(env) || env.ENABLE_MESSENGER === 'true' || envString(env, 'MESSENGER_PAGE_ACCESS_TOKEN') !== undefined;
  if (appSecret === undefined) {
    if (shouldEnforce) throw new UnauthorizedError('Messenger app secret is required for signature verification.');
    return { mode: 'skipped' as const };
  }
  if (signature === undefined) throw new UnauthorizedError('Missing Messenger signature.');
  if (!(await sha256HmacMatches({ secret: appSecret, payload: rawBody, signature }))) {
    throw new UnauthorizedError('Invalid Messenger signature.');
  }
  return { mode: 'verified' as const };
}

async function verifyWhatsAppSignature(env: AppBindings['Bindings'], signature: string | undefined, rawBody: string) {
  const appSecret = envString(env, 'WHATSAPP_APP_SECRET') ?? envString(env, 'MESSENGER_APP_SECRET');
  const shouldEnforce = isProduction(env) || env.ENABLE_WHATSAPP === 'true' || envString(env, 'WHATSAPP_ACCESS_TOKEN') !== undefined;
  if (appSecret === undefined) {
    if (shouldEnforce) throw new UnauthorizedError('WhatsApp app secret is required for signature verification.');
    return { mode: 'skipped' as const };
  }
  if (signature === undefined) throw new UnauthorizedError('Missing WhatsApp signature.');
  if (!(await sha256HmacMatches({ secret: appSecret, payload: rawBody, signature }))) {
    throw new UnauthorizedError('Invalid WhatsApp signature.');
  }
  return { mode: 'verified' as const };
}

export function channelRoutes() {
  const app = new Hono<AppBindings>();

  app.post('/web-chat/messages', async (c) => {
    const parsed = WebChatMessageSchema.parse(await jsonBody(c));
    if (parsed.pdpaConsent !== true) {
      throw new BadRequestError('PDPA consent is required before sending a web chat message.');
    }
    const result = await createServices(c).conversations.handleIncomingMessage({
      id: parsed.messageId ?? `web:${parsed.visitorId}:${crypto.randomUUID()}`,
      clientId: parsed.clientId,
      channel: 'web',
      externalConversationId: parsed.visitorId,
      externalSenderId: parsed.visitorId,
      text: parsed.text,
      receivedAt: new Date().toISOString(),
    });
    return c.json({
      conversationId: result.conversation.id,
      reply: result.reply,
      ticket: result.ticket,
      alreadyProcessed: result.alreadyProcessed ?? false,
    });
  });

  app.get('/webhooks/messenger', (c) => {
    const expectedToken = envString(c.env, 'MESSENGER_VERIFY_TOKEN');
    if (expectedToken === undefined && (isProduction(c.env) || c.env.ENABLE_MESSENGER === 'true')) {
      throw new UnauthorizedError('Messenger verification token is required.');
    }
    const mode = c.req.query('hub.mode');
    const verifyToken = c.req.query('hub.verify_token');
    const challenge = c.req.query('hub.challenge');
    if (mode === 'subscribe' && verifyToken === expectedToken && challenge !== undefined) return c.text(challenge);
    throw new UnauthorizedError('Invalid Messenger verification token.');
  });

  app.post('/webhooks/messenger', async (c) => {
    const rawBody = await c.req.text();
    await verifyMessengerSignature(c.env, c.req.header('x-hub-signature-256'), rawBody);
    const parsed = MessengerWebhookSchema.parse(JSON.parse(rawBody));
    const processed = [];
    for (const entry of parsed.entry) {
      const client = await createServices(c).clients.findByPageId(entry.id);
      for (const event of entry.messaging) {
        const csatScore = parseMessengerCsat(event.message?.quick_reply?.payload ?? event.postback?.payload, event.message?.text ?? event.postback?.title);
        if (csatScore !== null) {
          const conversation = await createServices(c).conversations.captureCsatFromChannel({
            clientId: client.id,
            channel: 'messenger',
            externalConversationId: event.sender.id,
            score: csatScore,
            comment: event.message?.text ?? event.postback?.title,
          });
          processed.push({ type: 'csat', externalConversationId: event.sender.id, score: csatScore, conversationId: conversation?.id });
          continue;
        }
        const voiceAttachment = event.message?.attachments?.find((attachment) => attachment.type === 'audio');
        const imageAttachment = event.message?.attachments?.find((attachment) => attachment.type === 'image');
        if (event.message === undefined || (event.message.text === undefined && voiceAttachment === undefined && imageAttachment === undefined)) continue;
        const attachmentType = voiceAttachment !== undefined ? 'voice' : imageAttachment !== undefined ? 'image' : undefined;
        const result = await createServices(c).conversations.handleIncomingMessage({
          id: event.message.mid ?? `${event.sender.id}:${event.timestamp ?? Date.now()}`,
          clientId: client.id,
          channel: 'messenger',
          externalConversationId: event.sender.id,
          externalSenderId: event.sender.id,
          text: event.message.text ??
            (attachmentType === 'image'
              ? 'Customer sent a product photo. OCR not configured.'
              : 'Customer sent a voice note. Transcript pending.'),
          receivedAt: new Date(event.timestamp ?? Date.now()).toISOString(),
          attachmentType,
          attachmentUrl: voiceAttachment?.payload?.url ?? imageAttachment?.payload?.url,
        });
        const sendResult = result.alreadyProcessed
          ? { mode: 'skipped' as const, recipientId: event.sender.id, text: result.reply.text }
          : await createServices(c).channelSend.sendText({ channel: 'messenger', recipientId: event.sender.id, text: result.reply.text });
        processed.push({ incomingMessageId: event.message.mid, reply: result.reply, ticket: result.ticket, sendResult });
      }
    }
    return c.json({ status: 'ok', processedCount: processed.length, processed });
  });

  app.get('/webhooks/whatsapp', (c) => {
    const expectedToken = envString(c.env, 'WHATSAPP_VERIFY_TOKEN') ?? envString(c.env, 'MESSENGER_VERIFY_TOKEN');
    if (expectedToken === undefined && (isProduction(c.env) || c.env.ENABLE_WHATSAPP === 'true')) {
      throw new UnauthorizedError('WhatsApp verification token is required.');
    }
    const mode = c.req.query('hub.mode');
    const verifyToken = c.req.query('hub.verify_token');
    const challenge = c.req.query('hub.challenge');
    if (mode === 'subscribe' && verifyToken === expectedToken && challenge !== undefined) return c.text(challenge);
    throw new UnauthorizedError('Invalid WhatsApp verification token.');
  });

  app.post('/webhooks/whatsapp', async (c) => {
    const rawBody = await c.req.text();
    await verifyWhatsAppSignature(c.env, c.req.header('x-hub-signature-256'), rawBody);
    const parsed = WhatsAppWebhookSchema.parse(JSON.parse(rawBody));
    const processed = [];
    for (const entry of parsed.entry) {
      for (const change of entry.changes) {
        const client = await createServices(c).clients.findByWhatsAppIdentifier(change.value.metadata.phone_number_id);
        for (const message of change.value.messages ?? []) {
          const text = message.text?.body ?? message.image?.caption;
          if ((text === undefined || text.trim() === '') && message.audio === undefined && message.image === undefined) continue;
          const attachmentType = message.audio !== undefined ? 'voice' : message.image !== undefined ? 'image' : undefined;
          const csatScore = parseWhatsAppCsat(text);
          if (csatScore !== null) {
            const conversation = await createServices(c).conversations.captureCsatFromChannel({
              clientId: client.id,
              channel: 'whatsapp',
              externalConversationId: message.from,
              score: csatScore,
              comment: text,
            });
            processed.push({ type: 'csat', externalConversationId: message.from, score: csatScore, conversationId: conversation?.id });
            continue;
          }
          const result = await createServices(c).conversations.handleIncomingMessage({
            id: message.id,
            clientId: client.id,
            channel: 'whatsapp',
            externalConversationId: message.from,
            externalSenderId: message.from,
            text: text?.trim() === '' || text === undefined
              ? attachmentType === 'image'
                ? 'Customer sent a product photo. OCR not configured.'
                : 'Customer sent a voice note. Transcript pending.'
              : text,
            receivedAt: getReceivedAt(message.timestamp),
            attachmentType,
            attachmentUrl:
              message.audio !== undefined
                ? `whatsapp-media:${message.audio.id}`
                : message.image !== undefined
                  ? `whatsapp-media:${message.image.id}`
                  : undefined,
          });
          const sendResult = result.alreadyProcessed
            ? { mode: 'skipped' as const, channel: 'whatsapp' as const, recipientId: message.from, text: result.reply.text }
            : await createServices(c).channelSend.sendText({ channel: 'whatsapp', recipientId: message.from, text: result.reply.text, purpose: 'whatsapp.reply' });
          processed.push({ incomingMessageId: message.id, reply: result.reply, ticket: result.ticket, sendResult });
        }
      }
    }
    return c.json({ status: 'ok', processedCount: processed.length, processed });
  });

  return app;
}
