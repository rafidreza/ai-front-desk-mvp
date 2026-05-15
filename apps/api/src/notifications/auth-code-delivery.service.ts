import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../observability/structured-logger.service';
import { EmailDeliveryService } from './email-delivery.service';

type AuthCodeChannel = 'email' | 'whatsapp';

export interface AuthCodeDeliveryResult {
  mode: 'dry-run' | 'sent' | 'skipped';
  channel: AuthCodeChannel;
  destination: string;
  reason?: string;
}

function normalizeWhatsappRecipient(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('01')) return `88${digits}`;
  return digits;
}

@Injectable()
export class AuthCodeDeliveryService {
  constructor(
    private readonly email: EmailDeliveryService,
    private readonly logger?: StructuredLoggerService,
  ) {}

  async sendCode(input: {
    businessName: string;
    channel: AuthCodeChannel;
    destination: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<AuthCodeDeliveryResult> {
    if (input.channel === 'email') {
      const result = await this.email.sendEmail({
        to: input.destination,
        subject: `${input.businessName} login code`,
        textBody: `Your AI Front Desk login code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
        htmlBody: `<p>Your AI Front Desk login code is <strong>${input.code}</strong>.</p><p>It expires in ${input.expiresInMinutes} minutes.</p>`,
        tag: 'client-auth-code',
      });
      return { mode: result.mode, channel: 'email', destination: input.destination };
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const recipient = normalizeWhatsappRecipient(input.destination);
    if (recipient.length < 8) {
      return { mode: 'skipped', channel: 'whatsapp', destination: input.destination, reason: 'invalid_whatsapp_destination' };
    }

    if (accessToken === undefined || accessToken === '' || phoneNumberId === undefined || phoneNumberId === '') {
      return { mode: 'dry-run', channel: 'whatsapp', destination: recipient };
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
        to: recipient,
        type: 'text',
        text: {
          preview_url: false,
          body: `Your AI Front Desk login code is ${input.code}. It expires in ${input.expiresInMinutes} minutes.`,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger?.event(
        'auth_code.whatsapp.failed',
        {
          destination: recipient,
          status: response.status,
          errorBody,
        },
        'error',
      );
      throw new Error(`WhatsApp auth-code delivery failed: ${response.status} ${errorBody}`);
    }

    return { mode: 'sent', channel: 'whatsapp', destination: recipient };
  }
}
