import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../observability/structured-logger.service';

export type OutboundChannel = 'messenger' | 'whatsapp';

export interface ChannelSendTextInput {
  channel: OutboundChannel;
  recipientId: string;
  text: string;
  purpose?: string;
}

export interface ChannelSendResult {
  mode: 'dry-run' | 'sent' | 'skipped';
  channel: OutboundChannel;
  recipientId: string;
  text: string;
  reason?: string;
}

export function normalizeWhatsappRecipient(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('01')) return `88${digits}`;
  return digits;
}

@Injectable()
export class ChannelSendService {
  constructor(private readonly logger?: StructuredLoggerService) {}

  async sendText(input: ChannelSendTextInput): Promise<ChannelSendResult> {
    if (input.channel === 'messenger') {
      return this.sendMessengerText(input);
    }

    return this.sendWhatsappText(input);
  }

  private async sendMessengerText(input: ChannelSendTextInput): Promise<ChannelSendResult> {
    const token = process.env.MESSENGER_PAGE_ACCESS_TOKEN;
    if (token === undefined || token === '') {
      return { mode: 'dry-run', channel: 'messenger', recipientId: input.recipientId, text: input.text };
    }

    const graphVersion = process.env.MESSENGER_GRAPH_VERSION ?? 'v20.0';
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        access_token: token,
        recipient: { id: input.recipientId },
        messaging_type: 'RESPONSE',
        message: { text: input.text },
      }),
    });

    if (!response.ok) {
      await this.handleFailedSend({
        channel: 'messenger',
        recipientId: input.recipientId,
        status: response.status,
        errorBody: await response.text(),
        purpose: input.purpose,
      });
    }

    return { mode: 'sent', channel: 'messenger', recipientId: input.recipientId, text: input.text };
  }

  private async sendWhatsappText(input: ChannelSendTextInput): Promise<ChannelSendResult> {
    const recipientId = normalizeWhatsappRecipient(input.recipientId);
    if (recipientId.length < 8) {
      return {
        mode: 'skipped',
        channel: 'whatsapp',
        recipientId: input.recipientId,
        text: input.text,
        reason: 'invalid_whatsapp_recipient',
      };
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (accessToken === undefined || accessToken === '' || phoneNumberId === undefined || phoneNumberId === '') {
      return { mode: 'dry-run', channel: 'whatsapp', recipientId, text: input.text };
    }

    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v20.0';
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'text',
        text: {
          preview_url: false,
          body: input.text,
        },
      }),
    });

    if (!response.ok) {
      await this.handleFailedSend({
        channel: 'whatsapp',
        recipientId,
        status: response.status,
        errorBody: await response.text(),
        purpose: input.purpose,
      });
    }

    return { mode: 'sent', channel: 'whatsapp', recipientId, text: input.text };
  }

  private async handleFailedSend(input: {
    channel: OutboundChannel;
    recipientId: string;
    status: number;
    errorBody: string;
    purpose?: string;
  }): Promise<never> {
    this.logger?.event(
      'channel.send.failed',
      {
        channel: input.channel,
        recipientId: input.recipientId,
        status: input.status,
        errorBody: input.errorBody,
        purpose: input.purpose,
      },
      'error',
    );
    throw new Error(`${input.channel} send failed: ${input.status} ${input.errorBody}`);
  }
}
