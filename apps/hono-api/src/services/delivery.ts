import type { ClientProfile, Ticket } from '@ai-front-desk/shared';
import type { Env } from '../env';
import { envString } from '../env';
import { LoggerService } from './logger';

export type SendResult =
  | { mode: 'dry-run'; channel: 'messenger' | 'whatsapp'; recipientId: string; text: string; reason?: string }
  | { mode: 'sent'; channel: 'messenger' | 'whatsapp'; recipientId: string; text: string; providerMessageId?: string };

export class ChannelSendService {
  constructor(
    private readonly env: Env,
    private readonly logger = new LoggerService(),
  ) {}

  async sendText(input: { channel: 'messenger' | 'whatsapp'; recipientId: string; text: string; purpose?: string; accessToken?: string }): Promise<SendResult> {
    return input.channel === 'messenger' ? this.sendMessenger(input) : this.sendWhatsApp(input);
  }

  private async sendMessenger(input: { recipientId: string; text: string; accessToken?: string }) {
    const token = input.accessToken ?? envString(this.env, 'MESSENGER_PAGE_ACCESS_TOKEN');
    if (token === undefined) {
      return { mode: 'dry-run' as const, channel: 'messenger' as const, recipientId: input.recipientId, text: input.text, reason: 'MESSENGER_PAGE_ACCESS_TOKEN missing' };
    }
    const graphVersion = envString(this.env, 'MESSENGER_GRAPH_VERSION', 'v20.0') ?? 'v20.0';
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: input.recipientId },
        message: { text: input.text },
        messaging_type: 'RESPONSE',
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.event('messenger.send.failed', { status: response.status, errorBody }, 'error');
      throw new Error(`Messenger send failed: ${response.status} ${errorBody}`);
    }
    const data = (await response.json()) as { message_id?: string };
    return { mode: 'sent' as const, channel: 'messenger' as const, recipientId: input.recipientId, text: input.text, providerMessageId: data.message_id };
  }

  private async sendWhatsApp(input: { recipientId: string; text: string }) {
    const accessToken = envString(this.env, 'WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = envString(this.env, 'WHATSAPP_PHONE_NUMBER_ID');
    if (accessToken === undefined || phoneNumberId === undefined) {
      return { mode: 'dry-run' as const, channel: 'whatsapp' as const, recipientId: input.recipientId, text: input.text, reason: 'WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing' };
    }
    const graphVersion = envString(this.env, 'WHATSAPP_GRAPH_VERSION', 'v20.0') ?? 'v20.0';
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: input.recipientId,
        type: 'text',
        text: { body: input.text },
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.event('whatsapp.send.failed', { status: response.status, errorBody }, 'error');
      throw new Error(`WhatsApp send failed: ${response.status} ${errorBody}`);
    }
    const data = (await response.json()) as { messages?: { id?: string }[] };
    return { mode: 'sent' as const, channel: 'whatsapp' as const, recipientId: input.recipientId, text: input.text, providerMessageId: data.messages?.[0]?.id };
  }
}

export class EmailDeliveryService {
  constructor(
    private readonly env: Env,
    private readonly logger = new LoggerService(),
  ) {}

  async sendEmail(input: { to: string; subject: string; textBody: string; htmlBody?: string; tag?: string }) {
    const token = envString(this.env, 'POSTMARK_SERVER_TOKEN');
    const from = envString(this.env, 'EMAIL_FROM_ADDRESS') ?? envString(this.env, 'DIGEST_FROM_EMAIL');
    if (token === undefined || from === undefined) {
      return { mode: 'dry-run' as const, provider: 'postmark' as const, to: input.to, subject: input.subject };
    }
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify({
        From: from,
        To: input.to,
        Subject: input.subject,
        TextBody: input.textBody,
        HtmlBody: input.htmlBody,
        Tag: input.tag,
        MessageStream: envString(this.env, 'POSTMARK_MESSAGE_STREAM', 'outbound') ?? 'outbound',
      }),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.event('email.delivery.failed', { to: input.to, subject: input.subject, status: response.status, errorBody }, 'error');
      throw new Error(`Email delivery failed: ${response.status} ${errorBody}`);
    }
    const data = (await response.json()) as { MessageID?: string };
    return { mode: 'sent' as const, provider: 'postmark' as const, to: input.to, subject: input.subject, providerMessageId: data.MessageID };
  }
}

export class AuthCodeDeliveryService {
  constructor(
    private readonly email: EmailDeliveryService,
    private readonly channelSend: ChannelSendService,
  ) {}

  async sendCode(input: { businessName: string; channel: 'email' | 'whatsapp'; destination: string; code: string; expiresInMinutes: number }) {
    if (input.channel === 'whatsapp') {
      return this.channelSend.sendText({
        channel: 'whatsapp',
        recipientId: input.destination,
        text: `${input.businessName} login code: ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
        purpose: 'client-auth-code',
      });
    }
    return this.email.sendEmail({
      to: input.destination,
      subject: `${input.businessName} login code`,
      textBody: `Your Daemion login code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
      tag: 'client-auth-code',
    });
  }
}

export class UrgentTicketNotificationService {
  constructor(private readonly channelSend: ChannelSendService) {}

  async notifyP1(input: { client: ClientProfile; ticket: Ticket }) {
    const recipient = input.client.whatsappPoc ?? input.client.ownerPhone;
    if (recipient === undefined || recipient.trim() === '') {
      return { mode: 'dry-run' as const, channel: 'whatsapp' as const, recipient: '', reason: 'No WhatsApp POC configured.' };
    }
    const result = await this.channelSend.sendText({
      channel: 'whatsapp',
      recipientId: recipient,
      text: `P1 ticket for ${input.client.businessName}: ${input.ticket.reason}\nCustomer: ${input.ticket.customerMessage}\nSuggested reply: ${input.ticket.suggestedReply}`,
      purpose: 'p1-ticket-alert',
    });
    return { mode: result.mode, channel: 'whatsapp' as const, recipient, reason: 'P1 urgent ticket alert.' };
  }
}
